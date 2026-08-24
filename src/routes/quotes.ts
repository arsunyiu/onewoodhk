import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'
import { COMPANY_INFO } from '../types/company'
import { logAuditFromUser } from '../utils/audit'

const quotes = new Hono<{ Bindings: Bindings }>()
quotes.use('*', authMiddleware)

// 報價單號格式對齊實際業務單據：Q-YYMMDDxxx（如 Q-260512001）
async function generateQuoteNo(db: D1Database): Promise<string> {
  const today = new Date()
  const yy = String(today.getFullYear()).slice(2)
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const dateStr = `${yy}${mm}${dd}`
  const prefix = `Q-${dateStr}`
  const row = await db
    .prepare(`SELECT quote_no FROM quotes WHERE quote_no LIKE ? ORDER BY quote_no DESC LIMIT 1`)
    .bind(`${prefix}%`)
    .first<{ quote_no: string }>()
  let seq = 1
  if (row?.quote_no) {
    const seqStr = row.quote_no.slice(prefix.length)
    const parsed = parseInt(seqStr)
    if (!isNaN(parsed)) seq = parsed + 1
  }
  return `${prefix}${String(seq).padStart(3, '0')}`
}

function calcTotals(items: any[], discountType: string, discountValue: number, taxRate: number) {
  const subtotal = items.reduce((sum, it) => {
    // 小計：優先採用前端傳來的值（使用者可能已手動調整覆寫），
    // 只有在未提供或非有效數值時才回退用「數量*單價*(1-折扣%)」公式自動計算
    const provided = Number(it.line_total)
    const lineTotal = Number.isFinite(provided) && it.line_total !== null && it.line_total !== undefined
      ? provided
      : it.quantity * it.unit_price * (1 - (it.discount_pct || 0) / 100)
    it.line_total = Math.round(lineTotal * 100) / 100
    return sum + it.line_total
  }, 0)
  let afterDiscount = subtotal
  if (discountType === 'percent') {
    afterDiscount = subtotal * (1 - discountValue / 100)
  } else {
    afterDiscount = subtotal - discountValue
  }
  afterDiscount = Math.max(0, afterDiscount)
  const taxAmount = Math.round(afterDiscount * taxRate * 100) / 100
  const totalAmount = Math.round((afterDiscount + taxAmount) * 100) / 100
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount,
    totalAmount
  }
}

// GET /api/quotes?search=&status=&customer_id=&page=&page_size=
quotes.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const { search = '', status = '', customer_id = '' } = c.req.query()
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'q.owner_id')

  let where = `WHERE ${clause}`
  const conds: string[] = []
  if (search) {
    conds.push(`(q.quote_no LIKE ? OR q.title LIKE ? OR c.company_name LIKE ?)`)
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (status) {
    conds.push(`q.status = ?`)
    params.push(status)
  }
  if (customer_id) {
    conds.push(`q.customer_id = ?`)
    params.push(customer_id)
  }
  if (conds.length) where += ' AND ' + conds.join(' AND ')

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM quotes q JOIN customers c ON c.id = q.customer_id ${where}`
  )
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const offset = (page - 1) * pageSize
  const rows = await c.env.DB.prepare(
    `SELECT q.id, q.quote_no, q.title, q.status, q.total_amount, q.currency, q.valid_until, q.created_at, q.updated_at,
            c.company_name, c.id as customer_id, u.name as owner_name
     FROM quotes q
     JOIN customers c ON c.id = q.customer_id
     JOIN users u ON u.id = q.owner_id
     ${where}
     ORDER BY q.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

// POST /api/quotes  建立報價（含明細）
quotes.post('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const body = await c.req.json().catch(() => null)
  if (!body?.customer_id || !Array.isArray(body.items) || body.items.length === 0) {
    return fail(c, '客戶與報價明細為必填', 400)
  }

  const discountType = body.discount_type || 'amount'
  const discountValue = body.discount_value || 0
  const taxRate = body.tax_rate !== undefined ? body.tax_rate : COMPANY_INFO.defaultTaxRate
  const items = body.items.map((it: any) => ({ ...it }))
  const { subtotal, taxAmount, totalAmount } = calcTotals(items, discountType, discountValue, taxRate)

  const quoteNo = await generateQuoteNo(c.env.DB)
  const ownerId = body.owner_id && (user.role === 'admin' || user.role === 'manager') ? body.owner_id : user.sub

  // 報價有效期限：若未指定，預設為今天起 30 天（對齊實際業務單據慣例）
  let validUntil = body.valid_until || null
  if (!validUntil) {
    const d = new Date()
    d.setDate(d.getDate() + COMPANY_INFO.quoteValidDays)
    validUntil = d.toISOString().slice(0, 10)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO quotes
      (quote_no, customer_id, contact_id, owner_id, status, title, currency, subtotal,
       discount_type, discount_value, tax_rate, tax_amount, total_amount, valid_until, terms, notes, site_address)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      quoteNo,
      body.customer_id,
      body.contact_id || null,
      ownerId,
      body.title || null,
      body.currency || COMPANY_INFO.defaultCurrency,
      subtotal,
      discountType,
      discountValue,
      taxRate,
      taxAmount,
      totalAmount,
      validUntil,
      body.terms || null,
      body.notes || null,
      body.site_address || null
    )
    .run()

  const quoteId = result.meta.last_row_id
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    await c.env.DB.prepare(
      `INSERT INTO quote_items (quote_id, product_id, item_name, description, unit, quantity, unit_price, discount_pct, line_total, sort_order, category, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        quoteId,
        it.product_id || null,
        it.item_name,
        it.description || null,
        it.unit || '件',
        it.quantity,
        it.unit_price,
        it.discount_pct || 0,
        it.line_total,
        i,
        it.category || null,
        it.location || null
      )
      .run()
  }

  const quote = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(quoteId).first()
  return ok(c, quote, undefined, 201)
})

// GET /api/quotes/:id
quotes.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')

  const quote = await c.env.DB.prepare(
    `SELECT q.*, c.company_name, c.address as customer_address, c.tax_id as customer_tax_id,
            u.name as owner_name, a.name as approver_name
     FROM quotes q
     JOIN customers c ON c.id = q.customer_id
     JOIN users u ON u.id = q.owner_id
     LEFT JOIN users a ON a.id = q.approver_id
     WHERE q.id = ?`
  )
    .bind(id)
    .first<any>()
  if (!quote) return fail(c, '找不到此報價單', 404)

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  if (ownerIds !== null && !ownerIds.includes(quote.owner_id)) {
    return fail(c, '無權限查看此報價單', 403)
  }

  const items = await c.env.DB.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC')
    .bind(id)
    .all()

  const contact = quote.contact_id
    ? await c.env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(quote.contact_id).first()
    : null

  const logs = await c.env.DB.prepare(
    `SELECT l.*, u.name as user_name FROM quote_approval_logs l
     JOIN users u ON u.id = l.user_id WHERE l.quote_id = ? ORDER BY l.created_at ASC`
  )
    .bind(id)
    .all()

  return ok(c, { ...quote, items: items.results, contact, logs: logs.results })
})

// PUT /api/quotes/:id  編輯（僅 draft/rejected 狀態可編輯）
quotes.put('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return fail(c, '請提供更新資料', 400)

  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (user.role === 'sales' && existing.owner_id !== user.sub) {
    return fail(c, '無權限編輯此報價單', 403)
  }
  if (!['draft', 'rejected'].includes(existing.status)) {
    return fail(c, '僅草稿或被拒絕狀態的報價單可編輯', 400)
  }

  const discountType = body.discount_type ?? existing.discount_type
  const discountValue = body.discount_value ?? existing.discount_value
  const taxRate = body.tax_rate ?? existing.tax_rate

  let subtotal = existing.subtotal
  let taxAmount = existing.tax_amount
  let totalAmount = existing.total_amount

  if (Array.isArray(body.items)) {
    const items = body.items.map((it: any) => ({ ...it }))
    const totals = calcTotals(items, discountType, discountValue, taxRate)
    subtotal = totals.subtotal
    taxAmount = totals.taxAmount
    totalAmount = totals.totalAmount

    await c.env.DB.prepare('DELETE FROM quote_items WHERE quote_id = ?').bind(id).run()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      await c.env.DB.prepare(
        `INSERT INTO quote_items (quote_id, product_id, item_name, description, unit, quantity, unit_price, discount_pct, line_total, sort_order, category, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(id, it.product_id || null, it.item_name, it.description || null, it.unit || '件', it.quantity, it.unit_price, it.discount_pct || 0, it.line_total, i, it.category || null, it.location || null)
        .run()
    }
  }

  await c.env.DB.prepare(
    `UPDATE quotes SET title=?, contact_id=?, currency=?, subtotal=?, discount_type=?, discount_value=?,
       tax_rate=?, tax_amount=?, total_amount=?, valid_until=?, terms=?, notes=?, site_address=?,
       status = CASE WHEN status='rejected' THEN 'draft' ELSE status END,
       updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  )
    .bind(
      body.title ?? existing.title,
      body.contact_id ?? existing.contact_id,
      body.currency ?? existing.currency,
      subtotal,
      discountType,
      discountValue,
      taxRate,
      taxAmount,
      totalAmount,
      body.valid_until ?? existing.valid_until,
      body.terms ?? existing.terms,
      body.notes ?? existing.notes,
      body.site_address ?? existing.site_address,
      id
    )
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first()
  return ok(c, updated)
})

// DELETE /api/quotes/:id （僅 draft 可刪除）
quotes.delete('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (user.role === 'sales' && existing.owner_id !== user.sub) return fail(c, '無權限刪除', 403)
  if (existing.status !== 'draft') return fail(c, '僅草稿狀態可刪除', 400)

  await c.env.DB.prepare('DELETE FROM quotes WHERE id = ?').bind(id).run()
  await logAuditFromUser(c, user, 'delete', 'quotes', id, `刪除報價單：${existing.quote_no || id}`)
  return ok(c, { deleted: true })
})

// ---- 工作流程操作 ----

async function logAction(db: D1Database, quoteId: string, userId: number, action: string, comment?: string) {
  await db
    .prepare('INSERT INTO quote_approval_logs (quote_id, user_id, action, comment) VALUES (?, ?, ?, ?)')
    .bind(quoteId, userId, action, comment || null)
    .run()
}

// POST /api/quotes/:id/submit  送審
quotes.post('/:id/submit', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (existing.owner_id !== user.sub && user.role === 'sales') return fail(c, '無權限操作', 403)
  if (existing.status !== 'draft') return fail(c, '僅草稿狀態可送審', 400)

  await c.env.DB.prepare("UPDATE quotes SET status='pending_approval', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()
  await logAction(c.env.DB, id, user.sub, 'submit', (await c.req.json().catch(() => ({})))?.comment)
  return ok(c, { id, status: 'pending_approval' })
})

// POST /api/quotes/:id/approve  核准（manager/admin）
quotes.post('/:id/approve', async (c) => {
  const user = c.get('user') as JwtPayload
  if (user.role === 'sales') return fail(c, '權限不足', 403)
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (existing.status !== 'pending_approval') return fail(c, '此報價單非待審核狀態', 400)

  const body = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare(
    "UPDATE quotes SET status='approved', approver_id=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?"
  )
    .bind(user.sub, id)
    .run()
  await logAction(c.env.DB, id, user.sub, 'approve', body?.comment)
  return ok(c, { id, status: 'approved' })
})

// POST /api/quotes/:id/reject  拒絕（manager/admin）
quotes.post('/:id/reject', async (c) => {
  const user = c.get('user') as JwtPayload
  if (user.role === 'sales') return fail(c, '權限不足', 403)
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (existing.status !== 'pending_approval') return fail(c, '此報價單非待審核狀態', 400)

  const body = await c.req.json().catch(() => ({}))
  if (!body?.reason) return fail(c, '請填寫拒絕原因', 400)

  await c.env.DB.prepare(
    "UPDATE quotes SET status='rejected', approver_id=?, rejected_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
  )
    .bind(user.sub, body.reason, id)
    .run()
  await logAction(c.env.DB, id, user.sub, 'reject', body.reason)
  return ok(c, { id, status: 'rejected' })
})

// POST /api/quotes/:id/send  標記已寄出（approved -> sent）
quotes.post('/:id/send', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (user.role === 'sales' && existing.owner_id !== user.sub) return fail(c, '無權限操作', 403)
  if (existing.status !== 'approved') return fail(c, '僅已核准狀態可標記寄出', 400)

  await c.env.DB.prepare("UPDATE quotes SET status='sent', sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()
  await logAction(c.env.DB, id, user.sub, 'send')
  return ok(c, { id, status: 'sent' })
})

// POST /api/quotes/:id/win  成交 -> 建立訂單
quotes.post('/:id/win', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (user.role === 'sales' && existing.owner_id !== user.sub) return fail(c, '無權限操作', 403)
  if (existing.status !== 'sent') return fail(c, '僅已寄出狀態可標記成交', 400)

  await c.env.DB.prepare("UPDATE quotes SET status='won', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()
  await logAction(c.env.DB, id, user.sub, 'win')

  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const orderNo = `O${dateStr}-${String(Math.floor(Math.random() * 9000) + 1000)}`

  const orderResult = await c.env.DB.prepare(
    `INSERT INTO orders (order_no, quote_id, customer_id, owner_id, total_amount, status)
     VALUES (?, ?, ?, ?, ?, 'confirmed')`
  )
    .bind(orderNo, id, existing.customer_id, existing.owner_id, existing.total_amount)
    .run()

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderResult.meta.last_row_id).first()

  // 訂單成交後自動建立對應工程紀錄（預設負責人為訂單負責業務）
  await c.env.DB.prepare(
    `INSERT INTO projects (order_id, status, progress_percent, site_address, supervisor_id)
     VALUES (?, 'not_started', 0, ?, ?)`
  )
    .bind(orderResult.meta.last_row_id, existing.site_address || null, existing.owner_id)
    .run()

  return ok(c, { id, status: 'won', order })
})

// POST /api/quotes/:id/lose  標記流失
quotes.post('/:id/lose', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (user.role === 'sales' && existing.owner_id !== user.sub) return fail(c, '無權限操作', 403)
  if (!['sent', 'approved'].includes(existing.status)) return fail(c, '此狀態無法標記流失', 400)

  const body = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare("UPDATE quotes SET status='lost', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()
  await logAction(c.env.DB, id, user.sub, 'lose', body?.comment)
  return ok(c, { id, status: 'lost' })
})

// PUT /api/quotes/:id/invoice-remark  更新發票備註（取代條款/付款方式，僅寄出後可填寫）
quotes.put('/:id/invoice-remark', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此報價單', 404)
  if (user.role === 'sales' && existing.owner_id !== user.sub) return fail(c, '無權限操作', 403)
  if (!['approved', 'sent', 'won'].includes(existing.status)) {
    return fail(c, '僅已核准/已寄出/已成交狀態可填寫發票備註', 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const remark = typeof body?.invoice_remark === 'string' ? body.invoice_remark.trim() || null : null

  await c.env.DB.prepare('UPDATE quotes SET invoice_remark=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(remark, id)
    .run()

  return ok(c, { id, invoice_remark: remark })
})

// ============================================================
// 附件管理（圖紙等檔案，存放於 Cloudflare R2）
// ============================================================

/** 確認使用者對此報價單有存取權限，回傳報價單資料或 null */
async function getQuoteWithAccess(db: D1Database, user: JwtPayload, quoteId: string) {
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(quoteId).first<any>()
  if (!quote) return null
  const ownerIds = await getVisibleOwnerIds(db, user)
  if (ownerIds !== null && !ownerIds.includes(quote.owner_id)) return null
  return quote
}

// GET /api/quotes/:id/attachments  列出附件
quotes.get('/:id/attachments', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const quote = await getQuoteWithAccess(c.env.DB, user, id)
  if (!quote) return fail(c, '找不到此報價單或無權限', 404)

  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.name as uploaded_by_name
     FROM quote_attachments a
     JOIN users u ON u.id = a.uploaded_by
     WHERE a.quote_id = ? ORDER BY a.created_at DESC`
  )
    .bind(id)
    .all()
  return ok(c, rows.results)
})

// POST /api/quotes/:id/attachments  上傳附件（multipart/form-data，欄位名 file）
quotes.post('/:id/attachments', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const quote = await getQuoteWithAccess(c.env.DB, user, id)
  if (!quote) return fail(c, '找不到此報價單或無權限', 404)

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) return fail(c, '請選擇要上傳的檔案', 400)

  const MAX_SIZE = 20 * 1024 * 1024 // 20MB
  if (file.size > MAX_SIZE) return fail(c, '檔案大小不可超過 20MB', 400)

  // 僅允許 Word / Excel / PDF / JPEG / PNG
  const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXTS.includes(ext)) {
    return fail(c, '僅支援 Word、Excel、PDF、JPEG、PNG 檔案', 400)
  }

  const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fff]/g, '_')
  const r2Key = `quotes/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`

  const buf = await file.arrayBuffer()
  await c.env.R2.put(r2Key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  const result = await c.env.DB.prepare(
    `INSERT INTO quote_attachments (quote_id, file_name, r2_key, content_type, file_size, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, file.name, r2Key, file.type || 'application/octet-stream', file.size, user.sub)
    .run()

  const attachment = await c.env.DB.prepare(
    `SELECT a.*, u.name as uploaded_by_name FROM quote_attachments a
     JOIN users u ON u.id = a.uploaded_by WHERE a.id = ?`
  )
    .bind(result.meta.last_row_id)
    .first()

  return ok(c, attachment, undefined, 201)
})

// GET /api/quotes/:id/attachments/:attId/download  下載附件（回傳檔案內容）
quotes.get('/:id/attachments/:attId/download', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const attId = c.req.param('attId')
  const quote = await getQuoteWithAccess(c.env.DB, user, id)
  if (!quote) return fail(c, '找不到此報價單或無權限', 404)

  const att = await c.env.DB.prepare('SELECT * FROM quote_attachments WHERE id = ? AND quote_id = ?')
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

// DELETE /api/quotes/:id/attachments/:attId  刪除附件
quotes.delete('/:id/attachments/:attId', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const attId = c.req.param('attId')
  const quote = await getQuoteWithAccess(c.env.DB, user, id)
  if (!quote) return fail(c, '找不到此報價單或無權限', 404)

  const att = await c.env.DB.prepare('SELECT * FROM quote_attachments WHERE id = ? AND quote_id = ?')
    .bind(attId, id)
    .first<any>()
  if (!att) return fail(c, '找不到此附件', 404)

  // 僅上傳者本人、或 manager 以上角色可刪除
  if (user.role === 'sales' && att.uploaded_by !== user.sub) {
    return fail(c, '無權限刪除此附件', 403)
  }

  await c.env.R2.delete(att.r2_key)
  await c.env.DB.prepare('DELETE FROM quote_attachments WHERE id = ?').bind(attId).run()
  return ok(c, { id: attId })
})

export default quotes
