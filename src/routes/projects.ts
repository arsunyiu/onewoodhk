// ============================================================
// 工程管理模組：追蹤「成交訂單」對應的施工進度
// 權限：查看依角色資料範圍過濾（比照訂單 owner_id 範圍）；
//       更新進度（狀態/百分比/新增時間軸紀錄）僅限「訂單負責業務本人」或 manager/admin
// ============================================================
import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'

const projects = new Hono<{ Bindings: Bindings }>()
projects.use('*', authMiddleware)

export const PROJECT_STATUSES = ['not_started', 'in_progress', 'paused', 'completed', 'cancelled'] as const

async function canManageProject(db: D1Database, user: JwtPayload, orderOwnerId: number): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'manager') {
    const ownerIds = await getVisibleOwnerIds(db, user)
    return ownerIds === null || ownerIds.includes(orderOwnerId)
  }
  // sales 僅能操作自己負責的訂單
  return user.sub === orderOwnerId
}

// GET /api/projects/summary — 工程進度總覽（依角色範圍）
projects.get('/summary', async (c) => {
  const user = c.get('user') as JwtPayload
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'o.owner_id')

  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       COALESCE(SUM(CASE WHEN p.status = 'not_started' THEN 1 ELSE 0 END),0) as not_started,
       COALESCE(SUM(CASE WHEN p.status = 'in_progress' THEN 1 ELSE 0 END),0) as in_progress,
       COALESCE(SUM(CASE WHEN p.status = 'paused' THEN 1 ELSE 0 END),0) as paused,
       COALESCE(SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END),0) as completed,
       COALESCE(SUM(CASE WHEN p.status = 'cancelled' THEN 1 ELSE 0 END),0) as cancelled
     FROM projects p
     JOIN orders o ON o.id = p.order_id
     WHERE ${clause}`
  )
    .bind(...params)
    .first<any>()

  return ok(c, row)
})

// GET /api/projects?status=&page=&page_size= — 工程列表（依角色範圍）
projects.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const status = c.req.query('status') || ''
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'o.owner_id')

  const statusCond = status && PROJECT_STATUSES.includes(status as any) ? `AND p.status = ?` : ''
  const statusParams = statusCond ? [status] : []

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM projects p JOIN orders o ON o.id = p.order_id WHERE ${clause} ${statusCond}`
  )
    .bind(...params, ...statusParams)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const rows = await c.env.DB.prepare(
    `SELECT p.*, o.order_no, o.total_amount, o.owner_id, c.company_name, u.name as owner_name,
            s.name as supervisor_name
     FROM projects p
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.owner_id
     LEFT JOIN users s ON s.id = p.supervisor_id
     WHERE ${clause} ${statusCond}
     ORDER BY p.updated_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, ...statusParams, pageSize, (page - 1) * pageSize)
    .all<any>()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

// GET /api/projects/:id — 工程詳情（含進度時間軸）
projects.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))
  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'o.owner_id')

  const project = await c.env.DB.prepare(
    `SELECT p.*, o.order_no, o.total_amount, o.owner_id, o.quote_id, c.company_name, u.name as owner_name,
            s.name as supervisor_name
     FROM projects p
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.owner_id
     LEFT JOIN users s ON s.id = p.supervisor_id
     WHERE p.id = ? AND ${clause}`
  )
    .bind(id, ...params)
    .first<any>()
  if (!project) return fail(c, '找不到工程或無權限查看', 404)

  const logs = await c.env.DB.prepare(
    `SELECT l.*, u.name as created_by_name
     FROM project_logs l
     LEFT JOIN users u ON u.id = l.created_by
     WHERE l.project_id = ?
     ORDER BY l.log_date DESC, l.id DESC`
  )
    .bind(id)
    .all<any>()

  const canManage = await canManageProject(c.env.DB, user, project.owner_id)

  return ok(c, { project, logs: logs.results, can_manage: canManage })
})

// PUT /api/projects/:id — 更新工程資訊（狀態/進度/日期/地址/負責人/備註）
projects.put('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))

  const existing = await c.env.DB.prepare(
    `SELECT p.*, o.owner_id FROM projects p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
  )
    .bind(id)
    .first<any>()
  if (!existing) return fail(c, '找不到工程', 404)

  const allowed = await canManageProject(c.env.DB, user, existing.owner_id)
  if (!allowed) return fail(c, '權限不足，無法更新此工程', 403)

  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const params: any[] = []

  if (body.status !== undefined) {
    if (!PROJECT_STATUSES.includes(body.status)) return fail(c, '工程狀態無效', 400)
    updates.push('status = ?')
    params.push(body.status)
    if (body.status === 'completed' && !body.actual_end_date && !existing.actual_end_date) {
      updates.push('actual_end_date = ?')
      params.push(new Date().toISOString().slice(0, 10))
    }
  }
  if (body.progress_percent !== undefined) {
    const p = Number(body.progress_percent)
    if (isNaN(p) || p < 0 || p > 100) return fail(c, '進度百分比需介於 0-100', 400)
    updates.push('progress_percent = ?')
    params.push(p)
  }
  for (const f of ['start_date', 'expected_end_date', 'actual_end_date', 'site_address', 'supervisor_id', 'notes']) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`)
      params.push(body[f] || null)
    }
  }
  if (!updates.length) return fail(c, '沒有可更新的欄位', 400)
  updates.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params, id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  return ok(c, updated)
})

// POST /api/projects/:id/logs — 新增進度時間軸紀錄
projects.post('/:id/logs', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = parseInt(c.req.param('id'))

  const existing = await c.env.DB.prepare(
    `SELECT p.*, o.owner_id FROM projects p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
  )
    .bind(id)
    .first<any>()
  if (!existing) return fail(c, '找不到工程', 404)

  const allowed = await canManageProject(c.env.DB, user, existing.owner_id)
  if (!allowed) return fail(c, '權限不足，無法新增進度紀錄', 403)

  const body = await c.req.json().catch(() => ({}))
  const description = (body.description || '').trim()
  if (!description) return fail(c, '請輸入進度說明', 400)
  const logDate = body.log_date || new Date().toISOString().slice(0, 10)
  const progressPercent =
    body.progress_percent !== undefined && body.progress_percent !== null && body.progress_percent !== ''
      ? Number(body.progress_percent)
      : null

  if (progressPercent !== null && (isNaN(progressPercent) || progressPercent < 0 || progressPercent > 100)) {
    return fail(c, '進度百分比需介於 0-100', 400)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO project_logs (project_id, log_date, progress_percent, description, created_by)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, logDate, progressPercent, description, user.sub)
    .run()

  // 若本次紀錄有帶進度百分比，同步更新工程主進度
  if (progressPercent !== null) {
    await c.env.DB.prepare('UPDATE projects SET progress_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(progressPercent, id)
      .run()
  }

  const log = await c.env.DB.prepare('SELECT * FROM project_logs WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, log, undefined, 201)
})

// DELETE /api/projects/logs/:logId — 刪除進度紀錄（manager/admin 或建立者本人）
projects.delete('/logs/:logId', async (c) => {
  const user = c.get('user') as JwtPayload
  const logId = parseInt(c.req.param('logId'))

  const log = await c.env.DB.prepare(
    `SELECT l.*, o.owner_id FROM project_logs l
     JOIN projects p ON p.id = l.project_id
     JOIN orders o ON o.id = p.order_id
     WHERE l.id = ?`
  )
    .bind(logId)
    .first<any>()
  if (!log) return fail(c, '找不到進度紀錄', 404)

  const isOwnerOfLog = log.created_by === user.sub
  const allowed = isOwnerOfLog || (await canManageProject(c.env.DB, user, log.owner_id) && user.role !== 'sales')
  if (!allowed) return fail(c, '權限不足，無法刪除此紀錄', 403)

  await c.env.DB.prepare('DELETE FROM project_logs WHERE id = ?').bind(logId).run()
  return ok(c, { id: logId })
})

export default projects
