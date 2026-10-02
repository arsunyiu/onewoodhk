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

/** 確認使用者對此申請有存取權限（本人或 manager/admin），回傳申請資料或 null */
async function getRequestWithAccess(db: D1Database, user: JwtPayload, requestId: string) {
  const req = await db.prepare('SELECT * FROM accounting_requests WHERE id = ?').bind(requestId).first<any>()
  if (!req) return null
  const isOwner = req.requested_by === user.sub
  const isApprover = user.role === 'admin' || user.role === 'manager'
  if (!isOwner && !isApprover) return null
  return req
}

// GET /api/accounting-requests/:id — 單筆申請詳情
accountingRequests.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await getRequestWithAccess(c.env.DB, user, id)
  if (!existing) return fail(c, '找不到此申請或無權限', 404)

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

  // 申請必須附上至少一張附件（憑證/截圖）才可核准
  const attCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM accounting_request_attachments WHERE request_id = ?')
    .bind(id)
    .first<{ cnt: number }>()
  if (!attCount || attCount.cnt === 0) return fail(c, '此申請尚未提供附件或截圖，無法核准', 400)

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

// ============================================================
// 附件管理（憑證/截圖等檔案，存放於 Cloudflare R2）
// 提交申請時至少需上傳一張附件，審批人員可憑此核實申請內容
// ============================================================
const ALLOWED_REQUEST_ATTACHMENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024 // 20MB

// GET /api/accounting-requests/:id/attachments — 列出附件
accountingRequests.get('/:id/attachments', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await getRequestWithAccess(c.env.DB, user, id)
  if (!existing) return fail(c, '找不到此申請或無權限', 404)

  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.name as uploaded_by_name
     FROM accounting_request_attachments a
     JOIN users u ON u.id = a.uploaded_by
     WHERE a.request_id = ? ORDER BY a.created_at DESC`
  )
    .bind(id)
    .all()
  return ok(c, rows.results)
})

// POST /api/accounting-requests/:id/attachments — 上傳附件（multipart/form-data，欄位名 file）
accountingRequests.post('/:id/attachments', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await getRequestWithAccess(c.env.DB, user, id)
  if (!existing) return fail(c, '找不到此申請或無權限', 404)
  // 申請人僅可於待審核狀態補充附件；manager/admin 審批人員則不限制（方便稽核時補存證）
  if (existing.requested_by === user.sub && existing.status !== 'pending_approval') {
    return fail(c, '僅待審核狀態可上傳附件', 400)
  }

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) return fail(c, '請選擇要上傳的檔案', 400)

  if (file.size > MAX_ATTACHMENT_SIZE) return fail(c, '檔案大小不可超過 20MB', 400)

  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_REQUEST_ATTACHMENT_EXTS.includes(ext)) {
    return fail(c, '僅支援 Word、Excel、PDF、JPEG、PNG 檔案', 400)
  }

  const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fff]/g, '_')
  const r2Key = `accounting-requests/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`

  const buf = await file.arrayBuffer()
  await c.env.R2.put(r2Key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  const result = await c.env.DB.prepare(
    `INSERT INTO accounting_request_attachments (request_id, file_name, r2_key, content_type, file_size, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, file.name, r2Key, file.type || 'application/octet-stream', file.size, user.sub)
    .run()

  const attachment = await c.env.DB.prepare(
    `SELECT a.*, u.name as uploaded_by_name FROM accounting_request_attachments a
     JOIN users u ON u.id = a.uploaded_by WHERE a.id = ?`
  )
    .bind(result.meta.last_row_id)
    .first()

  return ok(c, attachment, undefined, 201)
})

// GET /api/accounting-requests/:id/attachments/:attId/download — 下載附件（回傳檔案內容）
accountingRequests.get('/:id/attachments/:attId/download', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const attId = c.req.param('attId')
  const existing = await getRequestWithAccess(c.env.DB, user, id)
  if (!existing) return fail(c, '找不到此申請或無權限', 404)

  const att = await c.env.DB.prepare('SELECT * FROM accounting_request_attachments WHERE id = ? AND request_id = ?')
    .bind(attId, id)
    .first<any>()
  if (!att) return fail(c, '找不到此附件', 404)

  const object = await c.env.R2.get(att.r2_key)
  if (!object) return fail(c, '檔案不存在或已被刪除', 404)

  const encodedName = encodeURIComponent(att.file_name)
  return new Response(object.body, {
    headers: {
      'Content-Type': att.content_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
    }
  })
})

// DELETE /api/accounting-requests/:id/attachments/:attId — 刪除附件
accountingRequests.delete('/:id/attachments/:attId', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const attId = c.req.param('attId')
  const existing = await getRequestWithAccess(c.env.DB, user, id)
  if (!existing) return fail(c, '找不到此申請或無權限', 404)
  if (existing.status !== 'pending_approval') return fail(c, '僅待審核狀態可刪除附件', 400)

  const att = await c.env.DB.prepare('SELECT * FROM accounting_request_attachments WHERE id = ? AND request_id = ?')
    .bind(attId, id)
    .first<any>()
  if (!att) return fail(c, '找不到此附件', 404)

  // 僅上傳者本人、或 manager 以上角色可刪除
  if (user.role === 'sales' && att.uploaded_by !== user.sub) {
    return fail(c, '無權限刪除此附件', 403)
  }

  await c.env.R2.delete(att.r2_key)
  await c.env.DB.prepare('DELETE FROM accounting_request_attachments WHERE id = ?').bind(attId).run()
  return ok(c, { id: attId })
})

export default accountingRequests
