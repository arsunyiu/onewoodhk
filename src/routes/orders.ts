import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'

const orders = new Hono<{ Bindings: Bindings }>()
orders.use('*', authMiddleware)

// GET /api/orders?page=&page_size=
orders.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'o.owner_id')

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM orders o WHERE ${clause}`)
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const offset = (page - 1) * pageSize
  const rows = await c.env.DB.prepare(
    `SELECT o.*, c.company_name, u.name as owner_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.owner_id
     WHERE ${clause}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

export default orders
