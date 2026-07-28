// ============================================================
// 財務模組：追蹤「成交訂單」(orders) 的收款紀錄
// 權限：所有登入者可依角色範圍查看訂單收款狀況；
//       登記/刪除收款僅限 admin / manager（sales 僅可查看自己名下訂單）
// ============================================================
import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'

const finance = new Hono<{ Bindings: Bindings }>()
finance.use('*', authMiddleware)

function payStatusOf(totalAmount: number, paidAmount: number): 'unpaid' | 'partial' | 'paid' {
  if (totalAmount > 0 && paidAmount >= totalAmount) return 'paid'
  if (paidAmount > 0) return 'partial'
  return 'unpaid'
}

// GET /api/finance/summary — 應收/已收/未收總覽（依角色範圍）
finance.get('/summary', async (c) => {
  const user = c.get('user') as JwtPayload
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'owner_id')

  const totalRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(total_amount),0) as total_amount, COUNT(*) as order_count
     FROM orders WHERE ${clause}`
  )
    .bind(...params)
    .first<any>()

  const paidRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(p.amount),0) as paid_amount
     FROM order_payments p
     JOIN orders o ON o.id = p.order_id
     WHERE ${clause.replace(/owner_id/g, 'o.owner_id')}`
  )
    .bind(...params)
    .first<any>()

  const totalAmount = totalRow?.total_amount || 0
  const paidAmount = paidRow?.paid_amount || 0

  return ok(c, {
    order_count: totalRow?.order_count || 0,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance: Math.max(0, totalAmount - paidAmount)
  })
})

// GET /api/finance/orders — 訂單收款總覽列表（含已收/未收金額與付款狀態）
finance.get('/orders', async (c) => {
  const user = c.get('user') as JwtPayload
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'o.owner_id')

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM orders o WHERE ${clause}`)
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.total_amount, o.status, o.order_date, o.quote_id,
            c.company_name, u.name as owner_name,
            COALESCE((SELECT SUM(amount) FROM order_payments p WHERE p.order_id = o.id), 0) as paid_amount
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.owner_id
     WHERE ${clause}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<any>()

  const list = rows.results.map((r: any) => {
    const balance = Math.max(0, r.total_amount - r.paid_amount)
    return { ...r, balance, pay_status: payStatusOf(r.total_amount, r.paid_amount) }
  })

  return ok(c, list, { page, page_size: pageSize, total })
})

// GET /api/finance/orders/:id — 單筆訂單收款詳情（含收款紀錄）
finance.get('/orders/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'o.owner_id')

  const order = await c.env.DB.prepare(
    `SELECT o.*, c.company_name, u.name as owner_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.owner_id
     WHERE o.id = ? AND ${clause}`
  )
    .bind(id, ...params)
    .first<any>()
  if (!order) return fail(c, '找不到訂單或無權限查看', 404)

  const payments = await c.env.DB.prepare(
    `SELECT p.*, u.name as recorded_by_name
     FROM order_payments p
     LEFT JOIN users u ON u.id = p.recorded_by
     WHERE p.order_id = ?
     ORDER BY p.payment_date DESC, p.id DESC`
  )
    .bind(id)
    .all<any>()

  const paidAmount = payments.results.reduce((s: number, p: any) => s + p.amount, 0)
  const balance = Math.max(0, order.total_amount - paidAmount)

  return ok(c, {
    order,
    payments: payments.results,
    paid_amount: paidAmount,
    balance,
    pay_status: payStatusOf(order.total_amount, paidAmount)
  })
})

// POST /api/finance/orders/:id/payments — 登記收款（admin / manager）
finance.post('/orders/:id/payments', requireRole('admin', 'manager'), async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>()
  if (!order) return fail(c, '找不到訂單', 404)

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  if (ownerIds !== null && !ownerIds.includes(order.owner_id)) {
    return fail(c, '權限不足，無法為此訂單登記收款', 403)
  }

  const body = await c.req.json().catch(() => ({}))
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return fail(c, '收款金額需大於 0', 400)
  const method = ['cash', 'bank_transfer', 'cheque', 'other'].includes(body.method) ? body.method : 'bank_transfer'
  const paymentDate = body.payment_date || new Date().toISOString().slice(0, 10)
  const notes = body.notes || null

  const result = await c.env.DB.prepare(
    `INSERT INTO order_payments (order_id, amount, payment_date, method, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, amount, paymentDate, method, notes, user.sub)
    .run()

  const payment = await c.env.DB.prepare('SELECT * FROM order_payments WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, payment, undefined, 201)
})

// DELETE /api/finance/payments/:id — 刪除收款紀錄（僅 admin）
finance.delete('/payments/:id', requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id FROM order_payments WHERE id = ?').bind(id).first()
  if (!existing) return fail(c, '找不到收款紀錄', 404)
  await c.env.DB.prepare('DELETE FROM order_payments WHERE id = ?').bind(id).run()
  return ok(c, { id })
})

export default finance
