// ============================================================
// 審計紀錄模組：查詢登入紀錄與重要操作歷史，僅限管理員（admin）存取
// ============================================================
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware, requireRole } from '../middleware/auth'

const audit = new Hono<{ Bindings: Bindings }>()
audit.use('*', authMiddleware)
audit.use('*', requireRole('admin'))

// GET /api/audit?module=&action=&user_id=&start_date=&end_date=&search=&page=1&page_size=20
audit.get('/', async (c) => {
  const { module = '', action = '', user_id = '', start_date = '', end_date = '', search = '' } = c.req.query()
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(c.req.query('page_size') || '20')))

  const conds: string[] = []
  const params: any[] = []
  if (module) {
    conds.push('module = ?')
    params.push(module)
  }
  if (action) {
    conds.push('action = ?')
    params.push(action)
  }
  if (user_id) {
    conds.push('user_id = ?')
    params.push(user_id)
  }
  if (start_date) {
    conds.push('created_at >= ?')
    params.push(start_date)
  }
  if (end_date) {
    conds.push('created_at <= ?')
    params.push(end_date + ' 23:59:59')
  }
  if (search) {
    conds.push('(user_name LIKE ? OR user_email LIKE ? OR description LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM audit_logs ${where}`)
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const offset = (page - 1) * pageSize
  const rows = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

// GET /api/audit/summary — 概覽統計（今日登入次數、失敗次數、近 7 日操作總數等）
audit.get('/summary', async (c) => {
  const todayLoginSuccess = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'login_success' AND date(created_at) = date('now')`
  ).first<{ cnt: number }>()
  const todayLoginFailed = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'login_failed' AND date(created_at) = date('now')`
  ).first<{ cnt: number }>()
  const last7dTotal = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM audit_logs WHERE created_at >= datetime('now', '-7 days')`
  ).first<{ cnt: number }>()
  const totalAll = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM audit_logs`).first<{ cnt: number }>()

  return ok(c, {
    today_login_success: todayLoginSuccess?.cnt || 0,
    today_login_failed: todayLoginFailed?.cnt || 0,
    last_7d_total: last7dTotal?.cnt || 0,
    total_all: totalAll?.cnt || 0
  })
})

export default audit
