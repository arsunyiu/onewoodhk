import { Hono } from 'hono'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { getVisibleOwnerIds, ownerScopeClause } from '../utils/scope'

const customers = new Hono<{ Bindings: Bindings }>()
customers.use('*', authMiddleware)

// GET /api/customers?search=&status=&owner_id=&page=1&page_size=20
customers.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const { search = '', status = '', owner_id = '' } = c.req.query()
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('page_size') || '20')))

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  const { clause, params } = ownerScopeClause(ownerIds, 'c.owner_id')

  let where = `WHERE ${clause}`
  const conds: string[] = []
  if (search) {
    conds.push(`(c.company_name LIKE ? OR c.tax_id LIKE ?)`)
    params.push(`%${search}%`, `%${search}%`)
  }
  if (status) {
    conds.push(`c.status = ?`)
    params.push(status)
  }
  if (owner_id) {
    conds.push(`c.owner_id = ?`)
    params.push(owner_id)
  }
  if (conds.length) where += ' AND ' + conds.join(' AND ')

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM customers c ${where}`)
    .bind(...params)
    .first<{ cnt: number }>()
  const total = countRow?.cnt || 0

  const offset = (page - 1) * pageSize
  const rows = await c.env.DB.prepare(
    `SELECT c.*, u.name as owner_name,
       (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id) as quote_count
     FROM customers c
     JOIN users u ON u.id = c.owner_id
     ${where}
     ORDER BY c.updated_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all()

  return ok(c, rows.results, { page, page_size: pageSize, total })
})

// POST /api/customers
customers.post('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const body = await c.req.json().catch(() => null)
  if (!body?.company_name) return fail(c, '公司名稱為必填', 400)

  const ownerId = body.owner_id && (user.role === 'admin' || user.role === 'manager') ? body.owner_id : user.sub

  const result = await c.env.DB.prepare(
    `INSERT INTO customers
      (company_name, tax_id, industry, status, source, address, city, website, credit_limit, notes, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.company_name,
      body.tax_id || null,
      body.industry || null,
      body.status || 'lead',
      body.source || null,
      body.address || null,
      body.city || null,
      body.website || null,
      body.credit_limit || 0,
      body.notes || null,
      ownerId
    )
    .run()

  const newCustomer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, newCustomer, undefined, 201)
})

// GET /api/customers/:id
customers.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')

  const customer = await c.env.DB.prepare(
    `SELECT c.*, u.name as owner_name FROM customers c JOIN users u ON u.id = c.owner_id WHERE c.id = ?`
  )
    .bind(id)
    .first<any>()
  if (!customer) return fail(c, '找不到此客戶', 404)

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  if (ownerIds !== null && !ownerIds.includes(customer.owner_id)) {
    return fail(c, '無權限查看此客戶', 403)
  }

  const contacts = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, id ASC'
  )
    .bind(id)
    .all()

  const activities = await c.env.DB.prepare(
    `SELECT a.*, u.name as user_name FROM activities a JOIN users u ON u.id = a.user_id
     WHERE a.customer_id = ? ORDER BY a.activity_date DESC LIMIT 20`
  )
    .bind(id)
    .all()

  const quotes = await c.env.DB.prepare(
    `SELECT id, quote_no, title, status, total_amount, valid_until, created_at
     FROM quotes WHERE customer_id = ? ORDER BY created_at DESC`
  )
    .bind(id)
    .all()

  return ok(c, {
    ...customer,
    contacts: contacts.results,
    activities: activities.results,
    quotes: quotes.results
  })
})

// PUT /api/customers/:id
customers.put('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return fail(c, '請提供更新資料', 400)

  const existing = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此客戶', 404)

  const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
  if (ownerIds !== null && !ownerIds.includes(existing.owner_id)) {
    return fail(c, '無權限編輯此客戶', 403)
  }

  const fields = ['company_name','tax_id','industry','status','source','address','city','website','credit_limit','notes']
  const updates: string[] = []
  const params: any[] = []
  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`)
      params.push(body[f])
    }
  }
  if (body.owner_id !== undefined && (user.role === 'admin' || user.role === 'manager')) {
    updates.push('owner_id = ?')
    params.push(body.owner_id)
  }
  if (updates.length === 0) return fail(c, '沒有可更新的欄位', 400)
  updates.push("updated_at = CURRENT_TIMESTAMP")

  await c.env.DB.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params, id)
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
  return ok(c, updated)
})

// DELETE /api/customers/:id
customers.delete('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first<any>()
  if (!existing) return fail(c, '找不到此客戶', 404)

  if (user.role === 'sales' && existing.owner_id !== user.sub) {
    return fail(c, '無權限刪除此客戶', 403)
  }
  if (user.role === 'manager') {
    const ownerIds = await getVisibleOwnerIds(c.env.DB, user)
    if (!ownerIds!.includes(existing.owner_id)) return fail(c, '無權限刪除此客戶', 403)
  }

  await c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run()
  return ok(c, { deleted: true })
})

// ---- Contacts sub-resource ----
customers.get('/:id/contacts', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, id ASC')
    .bind(c.req.param('id'))
    .all()
  return ok(c, rows.results)
})

customers.post('/:id/contacts', async (c) => {
  const customerId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body?.name) return fail(c, '聯絡人姓名為必填', 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO contacts (customer_id, name, title, phone, mobile, email, is_primary, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      customerId,
      body.name,
      body.title || null,
      body.phone || null,
      body.mobile || null,
      body.email || null,
      body.is_primary ? 1 : 0,
      body.notes || null
    )
    .run()

  const contact = await c.env.DB.prepare('SELECT * FROM contacts WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, contact, undefined, 201)
})

// ---- Activities sub-resource ----
customers.get('/:id/activities', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.name as user_name FROM activities a JOIN users u ON u.id = a.user_id
     WHERE a.customer_id = ? ORDER BY a.activity_date DESC`
  )
    .bind(c.req.param('id'))
    .all()
  return ok(c, rows.results)
})

customers.post('/:id/activities', async (c) => {
  const user = c.get('user') as JwtPayload
  const customerId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body?.subject) return fail(c, '主旨為必填', 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO activities (customer_id, user_id, type, subject, content, activity_date, is_done)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      customerId,
      user.sub,
      body.type || 'note',
      body.subject,
      body.content || null,
      body.activity_date || new Date().toISOString(),
      body.is_done !== undefined ? (body.is_done ? 1 : 0) : 1
    )
    .run()

  const activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return ok(c, activity, undefined, 201)
})

export default customers
