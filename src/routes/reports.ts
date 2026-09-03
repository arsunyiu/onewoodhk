import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'

const reports = new Hono<{ Bindings: Bindings }>()
reports.use('*', authMiddleware)

// 期間篩選：依「建立/更新」時間往前算的天數，all 代表不限制
const RANGE_DAYS: Record<string, number | null> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
  all: null
}

function rangeToSqlDate(range: string): string | null {
  const days = RANGE_DAYS[range] ?? 90
  if (days === null) return null
  return `-${days} days`
}

/** 產生最近 N 個月份字串陣列（含當月），如 ['2026-02',...,'2026-07'] */
function lastMonths(n: number): string[] {
  const arr: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    arr.push(ym)
  }
  return arr
}

// GET /api/reports/summary?range=90d
reports.get('/summary', async (c) => {
  const user = c.get('user') as JwtPayload
  const range = c.req.query('range') || '90d'
  const modifier = rangeToSqlDate(range) // e.g. '-90 days' or null(=all)

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause: qClauseBare, params: qParamsBare } = ownerScopeClause(ownerIds, 'owner_id')
  const { clause: cClause, params: cParams } = ownerScopeClause(ownerIds, 'owner_id')
  // 用於 customers c JOIN quotes q 的情境，需加表別名避免 owner_id 欄位歧義
  const { clause: cClauseAliased, params: cParamsAliased } = ownerScopeClause(ownerIds, 'c.owner_id')

  const dateCond = modifier ? `AND created_at >= date('now', ?)` : ''
  const dateCondParams = modifier ? [modifier] : []
  const wonDateCond = modifier ? `AND updated_at >= date('now', ?)` : ''

  // ---- KPI：期間內建立的報價量、期間內成交/流失量與金額 ----
  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt
     FROM quotes WHERE ${qClauseBare} ${dateCond}`
  )
    .bind(...qParamsBare, ...dateCondParams)
    .first<any>()

  const wonLostRow = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as won_cnt,
       COALESCE(SUM(CASE WHEN status='won' THEN total_amount ELSE 0 END),0) as won_amt,
       SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) as lost_cnt
     FROM quotes WHERE ${qClauseBare} ${modifier ? "AND updated_at >= date('now', ?)" : ''}
       AND status IN ('won','lost')`
  )
    .bind(...qParamsBare, ...dateCondParams)
    .first<any>()

  const newCustomersRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM customers WHERE ${cClause} ${dateCond}`
  )
    .bind(...cParams, ...dateCondParams)
    .first<any>()

  const wonCnt = wonLostRow?.won_cnt || 0
  const lostCnt = wonLostRow?.lost_cnt || 0
  const wonAmt = wonLostRow?.won_amt || 0
  const closedCnt = wonCnt + lostCnt
  const winRate = closedCnt > 0 ? Math.round((wonCnt / closedCnt) * 1000) / 10 : null
  const avgDealSize = wonCnt > 0 ? Math.round((wonAmt / wonCnt) * 100) / 100 : 0

  // ---- Pipeline：目前可見報價的即時狀態快照（不受期間篩選）----
  const pipelineRows = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt
     FROM quotes WHERE ${qClauseBare} GROUP BY status`
  )
    .bind(...qParamsBare)
    .all<any>()
  const pipeline: Record<string, { count: number; amount: number }> = {
    draft: { count: 0, amount: 0 },
    pending_approval: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    sent: { count: 0, amount: 0 },
    won: { count: 0, amount: 0 },
    lost: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 }
  }
  for (const row of pipelineRows.results) {
    pipeline[row.status] = { count: row.cnt, amount: row.amt }
  }

  // ---- 近 6 個月趨勢（建立量 vs 成交金額）----
  const months = lastMonths(6)
  const createdTrendRows = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', created_at) as ym, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt
     FROM quotes WHERE ${qClauseBare} AND created_at >= date('now', '-6 months')
     GROUP BY ym`
  )
    .bind(...qParamsBare)
    .all<any>()
  const wonTrendRows = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', updated_at) as ym, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt
     FROM quotes WHERE ${qClauseBare} AND status='won' AND updated_at >= date('now', '-6 months')
     GROUP BY ym`
  )
    .bind(...qParamsBare)
    .all<any>()
  const createdMap = new Map(createdTrendRows.results.map((r: any) => [r.ym, r]))
  const wonMap = new Map(wonTrendRows.results.map((r: any) => [r.ym, r]))
  const trend = months.map((ym) => ({
    month: ym,
    created_count: (createdMap.get(ym) as any)?.cnt || 0,
    created_amount: (createdMap.get(ym) as any)?.amt || 0,
    won_count: (wonMap.get(ym) as any)?.cnt || 0,
    won_amount: (wonMap.get(ym) as any)?.amt || 0
  }))

  // ---- 業務業績排行（僅團隊/全部可見範圍內的 sales）----
  const ownerFilterClause = ownerIds === null ? '1=1' : ownerIds.length === 0 ? '1=0' : `u.id IN (${ownerIds.map(() => '?').join(',')})`
  const ownerFilterParams = ownerIds === null || ownerIds.length === 0 ? [] : ownerIds
  const byOwnerRows = await c.env.DB.prepare(
    `SELECT u.id as owner_id, u.name as owner_name,
       COUNT(CASE WHEN q.id IS NOT NULL ${dateCond.replace('created_at', 'q.created_at')} THEN 1 END) as quote_count,
       SUM(CASE WHEN q.status='won' ${modifier ? "AND q.updated_at >= date('now', ?)" : ''} THEN 1 ELSE 0 END) as won_count,
       COALESCE(SUM(CASE WHEN q.status='won' ${modifier ? "AND q.updated_at >= date('now', ?)" : ''} THEN q.total_amount ELSE 0 END),0) as won_amount,
       SUM(CASE WHEN q.status='lost' ${modifier ? "AND q.updated_at >= date('now', ?)" : ''} THEN 1 ELSE 0 END) as lost_count
     FROM users u
     LEFT JOIN quotes q ON q.owner_id = u.id
     WHERE u.role = 'sales' AND ${ownerFilterClause}
     GROUP BY u.id, u.name
     ORDER BY won_amount DESC`
  )
    .bind(
      ...dateCondParams,
      ...dateCondParams,
      ...dateCondParams,
      ...dateCondParams,
      ...ownerFilterParams
    )
    .all<any>()
  const byOwner = byOwnerRows.results.map((r: any) => ({
    owner_id: r.owner_id,
    owner_name: r.owner_name,
    quote_count: r.quote_count || 0,
    won_count: r.won_count || 0,
    won_amount: r.won_amount || 0,
    lost_count: r.lost_count || 0,
    win_rate:
      (r.won_count || 0) + (r.lost_count || 0) > 0
        ? Math.round((r.won_count / (r.won_count + r.lost_count)) * 1000) / 10
        : null
  }))

  // ---- 客戶排行 Top 10（依成交金額）----
  const byCustomerRows = await c.env.DB.prepare(
    `SELECT c.id as customer_id, c.company_name,
       COUNT(q.id) as quote_count,
       SUM(CASE WHEN q.status='won' THEN 1 ELSE 0 END) as won_count,
       COALESCE(SUM(CASE WHEN q.status='won' THEN q.total_amount ELSE 0 END),0) as won_amount
     FROM customers c
     LEFT JOIN quotes q ON q.customer_id = c.id
     WHERE ${cClauseAliased}
     GROUP BY c.id, c.company_name
     HAVING won_amount > 0
     ORDER BY won_amount DESC
     LIMIT 10`
  )
    .bind(...cParamsAliased)
    .all<any>()

  // ---- 案件類型分布（依已成交報價的項目分類統計金額，供首頁/報表分類排行使用）----
  const byCategoryRows = await c.env.DB.prepare(
    `SELECT COALESCE(NULLIF(TRIM(qi.category), ''), '其他項目') as category,
       COUNT(DISTINCT q.id) as quote_count,
       COALESCE(SUM(qi.line_total), 0) as amount
     FROM quote_items qi
     JOIN quotes q ON q.id = qi.quote_id
     WHERE q.status = 'won' AND ${qClauseBare}
     GROUP BY category
     ORDER BY amount DESC
     LIMIT 8`
  )
    .bind(...qParamsBare)
    .all<any>()

  return ok(c, {
    range,
    kpi: {
      total_quotes: totalRow?.cnt || 0,
      total_amount: totalRow?.amt || 0,
      won_count: wonCnt,
      won_amount: wonAmt,
      lost_count: lostCnt,
      win_rate: winRate,
      avg_deal_size: avgDealSize,
      new_customers: newCustomersRow?.cnt || 0
    },
    pipeline,
    trend,
    by_owner: byOwner,
    by_customer: byCustomerRows.results,
    by_category: byCategoryRows.results
  })
})

export default reports
