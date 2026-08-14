// ============================================================
// 供應商管理模組：維護判頭/自聘工人/物料供應商資料，並支援評分機制
// 權限：所有已登入使用者可查看；新增/編輯/刪除僅 admin/manager
// ============================================================
import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'
import { logAuditFromUser } from '../utils/audit'

const suppliers = new Hono<{ Bindings: Bindings }>()
suppliers.use('*', authMiddleware)

export const SUPPLIER_TYPE_META: Record<string, string> = {
  subcontractor: '分判/判頭',
  worker: '自聘工人',
  supplier: '物料供應商',
  other: '其他'
}

// 常見工種分類（供前端下拉選單參考，資料庫欄位為自由文字）
export const SUPPLIER_TRADES = [
  '泥水', '木工', '油漆', '電力', '水喉', '防水', '天花及鋁質', '地板',
  '拆除及清潔', '窗戶', '設備安裝', '物料', '其他'
]

// GET /api/suppliers?search=&type=&trade=&status=&sort=rating|name
suppliers.get('/', async (c) => {
  const { search = '', type = '', trade = '', status = '' } = c.req.query()
  const sort = c.req.query('sort') || 'name'

  const conds: string[] = ['1=1']
  const params: any[] = []
  if (search) {
    conds.push('(s.name LIKE ? OR s.contact_person LIKE ? OR s.phone LIKE ? OR s.mobile LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (type) {
    conds.push('s.type = ?')
    params.push(type)
  }
  if (trade) {
    conds.push('s.trade = ?')
    params.push(trade)
  }
  if (status) {
    conds.push('s.status = ?')
    params.push(status)
  }
  const whereClause = conds.join(' AND ')

  const orderBy = sort === 'rating' ? 'avg_rating DESC, s.name ASC' : 's.name ASC'

  const rows = await c.env.DB.prepare(
    `SELECT s.*,
       COALESCE(ROUND(AVG(r.rating), 1), 0) as avg_rating,
       COUNT(r.id) as rating_count
     FROM suppliers s
     LEFT JOIN supplier_ratings r ON r.supplier_id = s.id
     WHERE ${whereClause}
     GROUP BY s.id
     ORDER BY ${orderBy}`
  )
    .bind(...params)
    .all<any>()

  return ok(c, rows.results)
})

// GET /api/suppliers/trades — 常見工種清單
suppliers.get('/trades', async (c) => {
  return ok(c, SUPPLIER_TRADES)
})

// GET /api/suppliers/:id — 詳情（含評分紀錄）
suppliers.get('/:id', async (c) => {
  const id = c.req.param('id')
  const supplier = await c.env.DB.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first<any>()
  if (!supplier) return fail(c, '找不到此供應商/判頭/工人資料', 404)

  const ratings = await c.env.DB.prepare(
    `SELECT r.*, u.name as rated_by_name, o.order_no
     FROM supplier_ratings r
     LEFT JOIN users u ON u.id = r.rated_by
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE r.supplier_id = ?
     ORDER BY r.rated_at DESC, r.id DESC`
  )
    .bind(id)
    .all<any>()

  const statsRow = await c.env.DB.prepare(
    `SELECT COALESCE(ROUND(AVG(rating), 1), 0) as avg_rating, COUNT(*) as rating_count
     FROM supplier_ratings WHERE supplier_id = ?`
  )
    .bind(id)
    .first<any>()

  return ok(c, {
    ...supplier,
    avg_rating: statsRow?.avg_rating || 0,
    rating_count: statsRow?.rating_count || 0,
    ratings: ratings.results
  })
})

// GET /api/suppliers/:id/projects — 查詢此判頭/工人參與過的工程（反向查詢 project_suppliers）
suppliers.get('/:id/projects', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(id).first()
  if (!existing) return fail(c, '找不到此供應商/判頭/工人資料', 404)

  const rows = await c.env.DB.prepare(
    `SELECT ps.*, p.status as project_status, p.progress_percent, p.site_address,
            o.order_no, c.company_name
     FROM project_suppliers ps
     JOIN projects p ON p.id = ps.project_id
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = o.customer_id
     WHERE ps.supplier_id = ?
     ORDER BY ps.status = 'active' DESC, ps.created_at DESC`
  )
    .bind(id)
    .all<any>()

  return ok(c, rows.results)
})

// POST /api/suppliers — 新增（僅 admin/manager）
suppliers.post('/', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user') as JwtPayload
  const body = await c.req.json().catch(() => null)
  if (!body?.name) return fail(c, '名稱為必填', 400)

  const type = ['subcontractor', 'worker', 'supplier', 'other'].includes(body.type) ? body.type : 'subcontractor'

  const result = await c.env.DB.prepare(
    `INSERT INTO suppliers
      (name, type, trade, contact_person, phone, mobile, id_number, address, bank_account,
       bank_name, bank_account_name, bank_account_no, fps_id, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.name,
      type,
      body.trade || null,
      body.contact_person || null,
      body.phone || null,
      body.mobile || null,
      body.id_number || null,
      body.address || null,
      body.bank_account || null,
      body.bank_name || null,
      body.bank_account_name || null,
      body.bank_account_no || null,
      body.fps_id || null,
      body.status === 'inactive' ? 'inactive' : 'active',
      body.notes || null,
      user.sub
    )
    .run()

  const supplier = await c.env.DB.prepare('SELECT * FROM suppliers WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  await logAuditFromUser(c, user, 'create', 'suppliers', result.meta.last_row_id, `新增供應商/判頭/工人：${body.name}`)
  return ok(c, supplier, undefined, 201)
})

// PUT /api/suppliers/:id — 編輯（僅 admin/manager）
suppliers.put('/:id', requireRole('admin', 'manager'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return fail(c, '請提供更新資料', 400)

  const existing = await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(id).first()
  if (!existing) return fail(c, '找不到此供應商/判頭/工人資料', 404)

  const fields = ['name', 'type', 'trade', 'contact_person', 'phone', 'mobile', 'id_number', 'address', 'bank_account',
    'bank_name', 'bank_account_name', 'bank_account_no', 'fps_id', 'status', 'notes']
  const updates: string[] = []
  const params: any[] = []
  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`)
      params.push(body[f])
    }
  }
  if (!updates.length) return fail(c, '沒有可更新的欄位', 400)
  updates.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).bind(...params, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first()
  const suUser = c.get('user') as JwtPayload
  await logAuditFromUser(c, suUser, 'update', 'suppliers', id, `修改供應商/判頭/工人資料：${(updated as any)?.name || id}`)
  return ok(c, updated)
})

// DELETE /api/suppliers/:id — 刪除（僅 admin）
suppliers.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id, name FROM suppliers WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此供應商/判頭/工人資料', 404)
  await c.env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(id).run()
  await logAuditFromUser(c, user, 'delete', 'suppliers', id, `刪除供應商/判頭/工人：${existing.name}`)
  return ok(c, { deleted: true })
})

// ---- Ratings sub-resource ----

// POST /api/suppliers/:id/ratings — 新增評分（admin/manager）
suppliers.post('/:id/ratings', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user') as JwtPayload
  const supplierId = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(supplierId).first()
  if (!existing) return fail(c, '找不到此供應商/判頭/工人資料', 404)

  const body = await c.req.json().catch(() => null)
  const rating = Number(body?.rating)
  if (!rating || rating < 1 || rating > 5) return fail(c, '評分需為 1 至 5 之間的整數', 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO supplier_ratings (supplier_id, order_id, rating, comment, rated_by, rated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      supplierId,
      body.order_id ? parseInt(body.order_id) : null,
      Math.round(rating),
      body.comment || null,
      user.sub,
      body.rated_at || new Date().toISOString().slice(0, 10)
    )
    .run()

  const created = await c.env.DB.prepare('SELECT * FROM supplier_ratings WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, created, undefined, 201)
})

// DELETE /api/suppliers/:supplierId/ratings/:ratingId — 刪除評分（admin）
suppliers.delete('/:supplierId/ratings/:ratingId', requireRole('admin'), async (c) => {
  const { supplierId, ratingId } = c.req.param()
  const existing = await c.env.DB.prepare('SELECT id FROM supplier_ratings WHERE id = ? AND supplier_id = ?')
    .bind(ratingId, supplierId)
    .first()
  if (!existing) return fail(c, '找不到此評分紀錄', 404)
  await c.env.DB.prepare('DELETE FROM supplier_ratings WHERE id = ?').bind(ratingId).run()
  return ok(c, { deleted: true })
})

export default suppliers
