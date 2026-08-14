import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'
import { logAuditFromUser } from '../utils/audit'

const products = new Hono<{ Bindings: Bindings }>()
products.use('*', authMiddleware)

// GET /api/products?search=&category=&is_active=
products.get('/', async (c) => {
  const { search = '', category = '', is_active = '' } = c.req.query()
  let where = 'WHERE 1=1'
  const params: any[] = []
  if (search) {
    where += ' AND (name LIKE ? OR sku LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  if (category) {
    where += ' AND category = ?'
    params.push(category)
  }
  if (is_active !== '') {
    where += ' AND is_active = ?'
    params.push(is_active)
  }
  const rows = await c.env.DB.prepare(`SELECT * FROM products ${where} ORDER BY id DESC`)
    .bind(...params)
    .all()
  return ok(c, rows.results)
})

// POST /api/products （manager/admin）
products.post('/', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.name) return fail(c, '產品名稱為必填', 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO products (sku, name, category, unit, unit_price, cost_price, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.sku || null,
      body.name,
      body.category || null,
      body.unit || '件',
      body.unit_price || 0,
      body.cost_price || 0,
      body.description || null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1
    )
    .run()

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(result.meta.last_row_id).first()
  return ok(c, product, undefined, 201)
})

// PUT /api/products/:id
products.put('/:id', requireRole('admin', 'manager'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return fail(c, '請提供更新資料', 400)

  const fields = ['sku','name','category','unit','unit_price','cost_price','description','is_active']
  const updates: string[] = []
  const params: any[] = []
  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`)
      params.push(f === 'is_active' ? (body[f] ? 1 : 0) : body[f])
    }
  }
  if (!updates.length) return fail(c, '沒有可更新的欄位', 400)
  updates.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  return ok(c, updated)
})

// DELETE /api/products/:id
products.delete('/:id', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE products SET is_active = 0 WHERE id = ?').bind(id).run()
  await logAuditFromUser(c, user, 'delete', 'products', id, `下架產品 ID ${id}`)
  return ok(c, { deactivated: true })
})

export default products
