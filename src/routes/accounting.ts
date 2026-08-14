// ============================================================
// 會計模組：管理公司整體出入帳（收入/支出），含工程支出、人工等分類
// 權限：僅 admin / manager 可查看與管理（公司財務資料，sales 不可存取）
// ============================================================
import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'
import { logAuditFromUser } from '../utils/audit'

const accounting = new Hono<{ Bindings: Bindings }>()
accounting.use('*', authMiddleware)
accounting.use('*', requireRole('admin', 'manager'))

// 預設分類（前端下拉選單參考，資料庫欄位為自由文字，方便未來擴充）
// 依裝修工程行業常見用途整理：人工（自聘工人薪資）、物料（材料採購）、
// 外判費用（分判/判頭費用）、貨款（供應商/廠商貨款）等為工程公司最常見的支出用途
export const EXPENSE_CATEGORIES = ['人工', '物料', '外判費用', '貨款', '租金', '水電雜費', '交通運輸', '行政開支', '其他支出']
export const INCOME_CATEGORIES = ['訂金', '中期款', '尾款', '訂單收入', '其他收入']

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

// 計算週/月/年報表的起訖日期（以 UTC 計算避免時區偏移影響日期邊界）
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function getReportRange(period: string, dateStr: string): { start: string; end: string; label: string } {
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (period === 'week') {
    const day = d.getUTCDay() // 0=Sun ... 6=Sat
    const diffToMonday = day === 0 ? 6 : day - 1
    const start = new Date(d)
    start.setUTCDate(d.getUTCDate() - diffToMonday)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    return { start: toISODate(start), end: toISODate(end), label: `${toISODate(start)} ~ ${toISODate(end)}` }
  }
  if (period === 'year') {
    const y = d.getUTCFullYear()
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y} 年` }
  }
  // 預設為月
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1))
  const end = new Date(Date.UTC(y, m + 1, 0)) // 該月最後一天
  return { start: toISODate(start), end: toISODate(end), label: `${y}-${String(m + 1).padStart(2, '0')}` }
}

// GET /api/accounting/report?period=week|month|year&date=YYYY-MM-DD — 週/月/年出入帳報表
// date 為參考日期（預設今天），系統會自動算出該週/月/年的完整範圍
accounting.get('/report', async (c) => {
  const period = ['week', 'month', 'year'].includes(c.req.query('period') || '') ? (c.req.query('period') as string) : 'month'
  const dateParam = c.req.query('date') || new Date().toISOString().slice(0, 10)
  const { start, end, label } = getReportRange(period, dateParam)

  const totalsRow = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type='income' THEN amount ELSE 0 END),0) as total_income,
       COALESCE(SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END),0) as total_expense,
       COUNT(*) as cnt
     FROM accounting_entries WHERE entry_date >= ? AND entry_date <= ?`
  )
    .bind(start, end)
    .first<any>()

  const byCategoryRows = await c.env.DB.prepare(
    `SELECT entry_type, category, COALESCE(SUM(amount),0) as amount, COUNT(*) as cnt
     FROM accounting_entries
     WHERE entry_date >= ? AND entry_date <= ?
     GROUP BY entry_type, category
     ORDER BY entry_type, amount DESC`
  )
    .bind(start, end)
    .all<any>()

  const entriesRows = await c.env.DB.prepare(
    `SELECT e.*, u.name as recorded_by_name, o.order_no
     FROM accounting_entries e
     LEFT JOIN users u ON u.id = e.recorded_by
     LEFT JOIN orders o ON o.id = e.order_id
     WHERE e.entry_date >= ? AND e.entry_date <= ?
     ORDER BY e.entry_date ASC, e.id ASC`
  )
    .bind(start, end)
    .all<any>()

  const totalIncome = totalsRow?.total_income || 0
  const totalExpense = totalsRow?.total_expense || 0

  return ok(c, {
    period,
    date: dateParam,
    range: { start, end, label },
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: totalIncome - totalExpense,
    entry_count: totalsRow?.cnt || 0,
    by_category: byCategoryRows.results,
    entries: entriesRows.results
  })
})

// GET /api/accounting/entries — 出入帳列表（可依 type/category/日期範圍/收款人 篩選）
accounting.get('/entries', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))
  const type = c.req.query('type') // income | expense
  const category = c.req.query('category')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const keyword = c.req.query('keyword') // 依收款人/入帳名稱或說明搜尋

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
  if (dateFrom) {
    conds.push('e.entry_date >= ?')
    params.push(dateFrom)
  }
  if (dateTo) {
    conds.push('e.entry_date <= ?')
    params.push(dateTo)
  }
  if (keyword) {
    conds.push('(e.counterparty_name LIKE ? OR e.description LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
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
  const counterpartyName = body.counterparty_name ? String(body.counterparty_name).trim() : null

  const result = await c.env.DB.prepare(
    `INSERT INTO accounting_entries (entry_type, category, amount, entry_date, description, order_id, recorded_by, counterparty_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(entryType, category, amount, entryDate, description, orderId, user.sub, counterpartyName)
    .run()

  const entry = await c.env.DB.prepare('SELECT * FROM accounting_entries WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  await logAuditFromUser(c, user, 'create', 'accounting', result.meta.last_row_id, `新增${entryType === 'income' ? '收入' : '支出'}：${category} $${amount}`)
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
  const counterpartyName =
    body.counterparty_name !== undefined
      ? (body.counterparty_name ? String(body.counterparty_name).trim() : null)
      : existing.counterparty_name

  await c.env.DB.prepare(
    `UPDATE accounting_entries SET entry_type=?, category=?, amount=?, entry_date=?, description=?, order_id=?, counterparty_name=? WHERE id=?`
  )
    .bind(entryType, category, amount, entryDate, description, orderId, counterpartyName, id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM accounting_entries WHERE id = ?').bind(id).first()
  const auUser = c.get('user') as JwtPayload
  await logAuditFromUser(c, auUser, 'update', 'accounting', id, `修改出入帳紀錄：${category} $${amount}`)
  return ok(c, updated)
})

// DELETE /api/accounting/entries/:id — 刪除出入帳紀錄（僅 admin）
accounting.delete('/entries/:id', requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id, category, amount FROM accounting_entries WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到紀錄', 404)
  await c.env.DB.prepare('DELETE FROM accounting_entries WHERE id = ?').bind(id).run()
  await logAuditFromUser(c, user, 'delete', 'accounting', id, `刪除出入帳紀錄：${existing.category} $${existing.amount}`)
  return ok(c, { id })
})

export default accounting
