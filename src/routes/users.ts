import { Hono } from 'hono'
import type { Bindings } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'
import { hashPassword } from '../utils/crypto'

const users = new Hono<{ Bindings: Bindings }>()
users.use('*', authMiddleware)

// GET /api/users （所有登入者皆可取得業務清單，用於下拉選單；admin 專用管理則另外前端限制顯示）
users.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, name, email, role, manager_id, phone, is_active, created_at FROM users ORDER BY id ASC`
  ).all()
  return ok(c, rows.results)
})

// POST /api/users （admin only）
users.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.name || !body?.email || !body?.password) {
    return fail(c, '姓名、Email、密碼為必填', 400)
  }
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.email.toLowerCase()).first()
  if (existing) return fail(c, '此 Email 已被使用', 400)

  const passwordHash = await hashPassword(body.password)
  const result = await c.env.DB.prepare(
    `INSERT INTO users (name, email, password_hash, role, manager_id, phone) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(body.name, body.email.toLowerCase(), passwordHash, body.role || 'sales', body.manager_id || null, body.phone || null)
    .run()

  const user = await c.env.DB.prepare('SELECT id, name, email, role, manager_id FROM users WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, user, undefined, 201)
})

// PUT /api/users/:id （admin only）
users.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return fail(c, '請提供更新資料', 400)

  const updates: string[] = []
  const params: any[] = []
  for (const f of ['name', 'role', 'manager_id', 'phone', 'is_active']) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`)
      params.push(body[f])
    }
  }
  if (body.password) {
    updates.push('password_hash = ?')
    params.push(await hashPassword(body.password))
  }
  if (!updates.length) return fail(c, '沒有可更新的欄位', 400)
  updates.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params, id).run()
  const updated = await c.env.DB.prepare('SELECT id, name, email, role, manager_id, phone, is_active FROM users WHERE id = ?')
    .bind(id)
    .first()
  return ok(c, updated)
})

export default users
