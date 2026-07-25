import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'

const dashboard = new Hono<{ Bindings: Bindings }>()
dashboard.use('*', authMiddleware)

// GET /api/dashboard/summary
dashboard.get('/summary', async (c) => {
  const user = c.get('user') as JwtPayload
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'owner_id')

  // 客戶統計
  const customerStats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status='lead' THEN 1 ELSE 0 END) as lead_count,
       SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_count
     FROM customers WHERE ${clause}`
  )
    .bind(...params)
    .first<any>()

  // 報價統計（依狀態分組）
  const quoteStats = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amount
     FROM quotes WHERE ${clause}
     GROUP BY status`
  )
    .bind(...params)
    .all<any>()

  // 本月成交金額
  const wonThisMonth = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as cnt
     FROM quotes
     WHERE ${clause} AND status='won'
       AND strftime('%Y-%m', updated_at) = strftime('%Y-%m','now')`
  )
    .bind(...params)
    .first<any>()

  // Pipeline 漏斗（各狀態數量）
  const pipeline = {
    draft: 0,
    pending_approval: 0,
    approved: 0,
    rejected: 0,
    sent: 0,
    won: 0,
    lost: 0
  } as Record<string, number>
  let totalPipelineAmount = 0
  for (const row of quoteStats.results) {
    pipeline[row.status] = row.cnt
    if (['pending_approval', 'approved', 'sent'].includes(row.status)) {
      totalPipelineAmount += row.amount
    }
  }

  // 待審核清單（僅 manager/admin 需要看到待自己審批的）
  let pendingApprovals: any[] = []
  if (user.role === 'manager' || user.role === 'admin') {
    const approvalClause =
      user.role === 'admin' ? '1=1' : 'q.owner_id IN (SELECT id FROM users WHERE manager_id = ?)'
    const approvalParams = user.role === 'admin' ? [] : [user.sub]
    const pending = await c.env.DB.prepare(
      `SELECT q.id, q.quote_no, q.title, q.total_amount, c.company_name, u.name as owner_name, q.created_at
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       JOIN users u ON u.id = q.owner_id
       WHERE q.status = 'pending_approval' AND ${approvalClause}
       ORDER BY q.created_at ASC LIMIT 10`
    )
      .bind(...approvalParams)
      .all<any>()
    pendingApprovals = pending.results
  }

  // 近期跟進待辦（is_done=0）
  const { clause: taskClause, params: taskParams } = ownerScopeClause(ownerIds, 'a.user_id')
  const upcomingTasks = await c.env.DB.prepare(
    `SELECT a.id, a.subject, a.activity_date, c.company_name, a.customer_id
     FROM activities a
     JOIN customers c ON c.id = a.customer_id
     WHERE a.is_done = 0 AND ${taskClause}
     ORDER BY a.activity_date ASC LIMIT 5`
  )
    .bind(...taskParams)
    .all<any>()

  return ok(c, {
    customers: {
      total: customerStats?.total || 0,
      lead: customerStats?.lead_count || 0,
      active: customerStats?.active_count || 0
    },
    pipeline,
    pipeline_amount: totalPipelineAmount,
    won_this_month: {
      amount: wonThisMonth?.amount || 0,
      count: wonThisMonth?.cnt || 0
    },
    pending_approvals: pendingApprovals,
    upcoming_tasks: upcomingTasks.results || []
  })
})

export default dashboard
