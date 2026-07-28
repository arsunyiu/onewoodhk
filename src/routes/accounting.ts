// ============================================================
// 會計模組：管理公司整體出入帳（收入/支出），含工程支出、人工等分類
// 權限：僅 admin / manager 可查看與管理（公司財務資料，sales 不可存取）
// ============================================================
import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'

const accounting = new Hono<{ Bindings: Bindings }>()
accounting.use('*', authMiddleware)
accounting.use('*', requireRole('admin', 'manager'))

// 預設分類（前端下拉選單參考，資料庫欄位為自由文字，方便未來擴充）
export const EXPENSE_CATEGORIES = ['工程支出', '人工', '材料採購', '租金', '水電雜費', '行政開支', '其他支出']
export const INCOME_CATEGORIES = ['訂單收入', '其他收入']

const RANGE_DAYS: Record<string, number | null> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
  all: null
}

// GET /api/accounting/categories — 分類選項
accounting.get('/categories', async (c) => {
  return ok(c, { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES })
})

// GET /api/accounting/summary?range=90d — 收支總覽 + 分類統計 + 近6月趨勢
accounting.get('/summary', async (c) => {
  const range = c.req.query('range') || '90d'
  const days = RANGE_DAYS[range] ?? 90
  const dateCond = days !== null ? `AND entry_date >= date('now', '-${days} days')` : ''

  const totalsRow = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type='income' THEN amount ELSE 0 END),0) as total_income,
       COALESCE(SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END),0) as total_expense
     FROM accounting_entries WHERE 1=1 ${dateCond}`
  ).first<any>()

  const byCategoryRows = await c.env.DB.prepare(
    `SELECT entry_type, category, COALESCE(SUM(amount),0) as amount, COUNT(*) as cnt
     FROM accounting_entries WHERE 1=1 ${dateCond}
     GROUP BY entry_type, category
     ORDER BY amount DESC`
  ).all<any>()

  // 近 6 個月趨勢
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const trendRows = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', entry_date) as ym,
       COALESCE(SUM(CASE WHEN entry_type='income' THEN amount ELSE 0 END),0) as income,
       COALESCE(SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END),0) as expense
     FROM accounting_entries
     WHERE entry_date >= date('now', '-6 months')
     GROUP BY ym`
  ).all<any>()
  const trendMap = new Map(trendRows.results.map((r: any) => [r.ym, r]))
  const trend = months.map((ym) => ({
    month: ym,
    income: (trendMap.get(ym) as any)?.income || 0,
    expense: (trendMap.get(ym) as any)?.expense || 0
  }))

  const totalIncome = totalsRow?.total_income || 0
  const totalExpense = totalsRow?.total_expense || 0

  return ok(c, {
    range,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: totalIncome - totalExpense,
    by_category: byCategoryRows.results,
    trend
  })
})

// GET /api/accounting/entries — 出入帳列表（可依 type/category/日期範圍篩選）
accounting.get('/entries', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))
  const type = c.req.query('type') // income | expense
  const category = c.req.query('category')

  const conds: string[] = ['1=1']
  const params: any[] = []
  if (type === 'income' || type === 'expense') {
    conds.push('e.entry_type = ?')
    params.push(type)
  }
  if (category) {
    conds.push('e.category = ?')
    params.push(category)
  }
  const whereClause = conds.join(' AND ')

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM accounting_entries e WHERE ${whereClause}`)
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const rows = await c.env.DB.prepare(
    `SELECT e.*, u.name as recorded_by_name, o.order_no
     FROM accounting_entries e
     LEFT JOIN users u ON u.id = e.recorded_by
     LEFT JOIN orders o ON o.id = e.order_id
     WHERE ${whereClause}
     ORDER BY e.entry_date DESC, e.id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<any>()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

// POST /api/accounting/entries — 新增出入帳紀錄
accounting.post('/entries', async (c) => {
  const user = c.get('user') as JwtPayload
  const body = await c.req.json().catch(() => ({}))

  const entryType = body.entry_type
  if (entryType !== 'income' && entryType !== 'expense') return fail(c, '請選擇收入或支出類型', 400)
  const category = String(body.category || '').trim()
  if (!category) return fail(c, '請選擇或輸入分類', 400)
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return fail(c, '金額需大於 0', 400)
  const entryDate = body.entry_date || new Date().toISOString().slice(0, 10)
  const description = body.description || null
  const orderId = body.order_id ? parseInt(body.order_id) : null

  const result = await c.env.DB.prepare(
    `INSERT INTO accounting_entries (entry_type, category, amount, entry_date, description, order_id, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(entryType, category, amount, entryDate, description, orderId, user.sub)
    .run()

  const entry = await c.env.DB.prepare('SELECT * FROM accounting_entries WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, entry, undefined, 201)
})

// PUT /api/accounting/entries/:id — 編輯出入帳紀錄
accounting.put('/entries/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM accounting_entries WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到紀錄', 404)

  const body = await c.req.json().catch(() => ({}))
  const entryType = body.entry_type === 'income' || body.entry_type === 'expense' ? body.entry_type : existing.entry_type
  const category = body.category !== undefined ? String(body.category).trim() : existing.category
  if (!category) return fail(c, '分類不可為空', 400)
  const amount = body.amount !== undefined ? Number(body.amount) : existing.amount
  if (!amount || amount <= 0) return fail(c, '金額需大於 0', 400)
  const entryDate = body.entry_date || existing.entry_date
  const description = body.description !== undefined ? body.description : existing.description
  const orderId = body.order_id !== undefined ? (body.order_id ? parseInt(body.order_id) : null) : existing.order_id

  await c.env.DB.prepare(
    `UPDATE accounting_entries SET entry_type=?, category=?, amount=?, entry_date=?, description=?, order_id=? WHERE id=?`
  )
    .bind(entryType, category, amount, entryDate, description, orderId, id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM accounting_entries WHERE id = ?').bind(id).first()
  return ok(c, updated)
})

// DELETE /api/accounting/entries/:id — 刪除出入帳紀錄（僅 admin）
accounting.delete('/entries/:id', requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id FROM accounting_entries WHERE id = ?').bind(id).first()
  if (!existing) return fail(c, '找不到紀錄', 404)
  await c.env.DB.prepare('DELETE FROM accounting_entries WHERE id = ?').bind(id).run()
  return ok(c, { id })
})

export default accounting
