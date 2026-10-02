// ============================================================
// 會計申請及審批流程
// 權限：任何已登入使用者皆可提交申請（例如報銷、收款申請等）；
//       manager / admin 可審批（核准／拒絕）。
// 核准後，系統自動將申請內容寫入 accounting_entries（會計管理帳本）。
// ============================================================
import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'
import { logAuditFromUser } from '../utils/audit'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './accounting'

const accountingRequests = new Hono<{ Bindings: Bindings }>()
accountingRequests.use('*', authMiddleware)

// GET /api/accounting-requests/categories — 分類選項（與會計管理共用）
accountingRequests.get('/categories', async (c) => {
  return ok(c, { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES })
})

// GET /api/accounting-requests?scope=mine|pending&status=&page=&page_size=
// scope=mine（預設）：僅查看自己提交的申請
// scope=pending：待審批清單（manager/admin 專用，列出所有待審核的申請）
// scope=all：全部申請（manager/admin 專用，供稽核查看歷史）
accountingRequests.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const scope = c.req.query('scope') || 'mine'
  const status = c.req.query('status')
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))

  const conds: string[] = ['1=1']
  const params: any[] = []

  if (scope === 'pending') {
    if (user.role !== 'admin' && user.role !== 'manager') return fail(c, '權限不足', 403)
    conds.push('r.status = ?')
    params.push('pending_approval')
  } else if (scope === 'all') {
    if (user.role !== 'admin' && user.role !== 'manager') return fail(c, '權限不足', 403)
    if (status) {
      conds.push('r.status = ?')
      params.push(status)
    }
  } else {
    // mine
    conds.push('r.requested_by = ?')
    params.push(user.sub)
    if (status) {
      conds.push('r.status = ?')
      params.push(status)
    }
  }

  const whereClause = conds.join(' AND ')

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM accounting_requests r WHERE ${whereClause}`)
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const rows = await c.env.DB.prepare(
    `SELECT r.*, u.name as requester_name, a.name as approver_name, o.order_no
     FROM accounting_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users a ON a.id = r.approver_id
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE ${whereClause}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<any>()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

// GET /api/accounting-requests/:id — 單筆申請詳情
accountingRequests.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare(
    `SELECT r.*, u.name as requester_name, a.name as approver_name, o.order_no
     FROM accounting_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users a ON a.id = r.approver_id
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE r.id = ?`
  )
    .bind(id)
    .first<any>()
  if (!row) return fail(c, '找不到此申請', 404)
  const isOwner = row.requested_by === user.sub
  const isApprover = user.role === 'admin' || user.role === 'manager'
  if (!isOwner && !isApprover) return fail(c, '無權限查看此申請', 403)
  return ok(c, row)
})

// POST /api/accounting-requests — 提交申請（任何已登入使用者皆可）
accountingRequests.post('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const body = await c.req.json().catch(() => ({}))

  const requestType = body.request_type
  if (requestType !== 'income' && requestType !== 'expense') return fail(c, '請選擇收入或支出類型', 400)
  const category = String(body.category || '').trim()
  if (!category) return fail(c, '請選擇或輸入分類', 400)
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return fail(c, '金額需大於 0', 400)
  const expectedDate = body.expected_date || new Date().toISOString().slice(0, 10)
  const description = body.description ? String(body.description).trim() : null
  const counterpartyName = body.counterparty_name ? String(body.counterparty_name).trim() : null
  const orderId = body.order_id ? parseInt(body.order_id) : null

  const result = await c.env.DB.prepare(
    `INSERT INTO accounting_requests
       (request_type, category, amount, expected_date, description, counterparty_name, order_id, status, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)`
  )
    .bind(requestType, category, amount, expectedDate, description, counterpartyName, orderId, user.sub)
    .run()

  const request = await c.env.DB.prepare('SELECT * FROM accounting_requests WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  await logAuditFromUser(
    c,
    user,
    'submit',
    'accounting_requests',
    result.meta.last_row_id,
    `提交${requestType === 'income' ? '收入' : '支出'}申請：${category} $${amount}`
  )
  return ok(c, request, undefined, 201)
})

// POST /api/accounting-requests/:id/cancel — 申請人自行取消（僅限 pending_approval 狀態、且為本人提交）
accountingRequests.post('/:id/cancel', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM accounting_requests WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此申請', 404)
  if (existing.requested_by !== user.sub) return fail(c, '無權限操作', 403)
  if (existing.status !== 'pending_approval') return fail(c, '僅待審核狀態可取消', 400)

  await c.env.DB.prepare(
    "UPDATE accounting_requests SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?"
  )
    .bind(id)
    .run()
  await logAuditFromUser(c, user, 'cancel', 'accounting_requests', id, `取消申請：${existing.category} $${existing.amount}`)
  return ok(c, { id, status: 'cancelled' })
})

// POST /api/accounting-requests/:id/approve — 核准（manager/admin），核准後自動錄入 accounting_entries
accountingRequests.post('/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM accounting_requests WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此申請', 404)
  if (existing.status !== 'pending_approval') return fail(c, '此申請非待審核狀態', 400)

  // 核准並同時寫入會計管理帳本（accounting_entries），兩步驟一起完成
  const entryResult = await c.env.DB.prepare(
    `INSERT INTO accounting_entries (entry_type, category, amount, entry_date, description, order_id, recorded_by, counterparty_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      existing.request_type,
      existing.category,
      existing.amount,
      existing.expected_date,
      existing.description ? `${existing.description}（申請編號 #${id} 核准錄入）` : `申請編號 #${id} 核准錄入`,
      existing.order_id,
      user.sub,
      existing.counterparty_name
    )
    .run()
  const entryId = entryResult.meta.last_row_id

  await c.env.DB.prepare(
    `UPDATE accounting_requests
     SET status='approved', approver_id=?, approved_at=CURRENT_TIMESTAMP, entry_id=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  )
    .bind(user.sub, entryId, id)
    .run()

  await logAuditFromUser(
    c,
    user,
    'approve',
    'accounting_requests',
    id,
    `核准申請並錄入會計管理：${existing.category} $${existing.amount}（帳目編號 #${entryId}）`
  )
  return ok(c, { id, status: 'approved', entry_id: entryId })
})

// POST /api/accounting-requests/:id/reject — 拒絕（manager/admin），需填寫原因
accountingRequests.post('/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM accounting_requests WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此申請', 404)
  if (existing.status !== 'pending_approval') return fail(c, '此申請非待審核狀態', 400)

  const body = await c.req.json().catch(() => ({}))
  if (!body?.reason || !String(body.reason).trim()) return fail(c, '請填寫拒絕原因', 400)

  await c.env.DB.prepare(
    `UPDATE accounting_requests
     SET status='rejected', approver_id=?, rejected_reason=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  )
    .bind(user.sub, String(body.reason).trim(), id)
    .run()

  await logAuditFromUser(
    c,
    user,
    'reject',
    'accounting_requests',
    id,
    `拒絕申請：${existing.category} $${existing.amount}（原因：${body.reason}）`
  )
  return ok(c, { id, status: 'rejected' })
})

export default accountingRequests
