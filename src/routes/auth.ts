import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { verifyPassword, hashPassword } from '../utils/crypto'
import { authMiddleware } from '../middleware/auth'
import { logAudit } from '../utils/audit'

const auth = new Hono<{ Bindings: Bindings }>()

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return fail(c, '請輸入帳號與密碼', 400)
  }
  const { email, password } = body
  const normalizedEmail = String(email).toLowerCase().trim()

  const user = await c.env.DB.prepare(
    'SELECT id, name, email, password_hash, role, manager_id, is_active FROM users WHERE email = ?'
  )
    .bind(normalizedEmail)
    .first<any>()

  if (!user) {
    await logAudit(c, {
      user_id: null,
      user_email: normalizedEmail,
      action: 'login_failed',
      module: 'auth',
      description: '登入失敗：帳號不存在'
    })
    return fail(c, '帳號或密碼錯誤', 401)
  }
  if (!user.is_active) {
    await logAudit(c, {
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      role: user.role,
      action: 'login_failed',
      module: 'auth',
      description: '登入失敗：帳號已被停用'
    })
    return fail(c, '此帳號已被停用，請聯繫管理員', 403)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    await logAudit(c, {
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      role: user.role,
      action: 'login_failed',
      module: 'auth',
      description: '登入失敗：密碼錯誤'
    })
    return fail(c, '帳號或密碼錯誤', 401)
  }

  const payload: JwtPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    manager_id: user.manager_id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 天
  }
  const token = await sign(payload as any, c.env.JWT_SECRET)

  await logAudit(c, {
    user_id: user.id,
    user_name: user.name,
    user_email: user.email,
    role: user.role,
    action: 'login_success',
    module: 'auth',
    description: '登入成功'
  })

  return ok(c, {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  })
})

// GET /api/auth/me
auth.get('/me', authMiddleware, async (c) => {
  const jwtUser = c.get('user') as JwtPayload
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.manager_id, u.phone, u.avatar_url, u.created_at,
            m.name as manager_name
     FROM users u
     LEFT JOIN users m ON m.id = u.manager_id
     WHERE u.id = ?`
  )
    .bind(jwtUser.sub)
    .first()
  if (!user) return fail(c, '使用者不存在', 404)
  return ok(c, user)
})

// PUT /api/auth/me  （自助更新個人資料：姓名/電話/大頭貼，變更密碼需附上正確的舊密碼）
auth.put('/me', authMiddleware, async (c) => {
  const jwtUser = c.get('user') as JwtPayload
  const body = await c.req.json().catch(() => null)
  if (!body) return fail(c, '請提供更新資料', 400)

  const updates: string[] = []
  const params: any[] = []

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return fail(c, '姓名不可為空', 400)
    updates.push('name = ?')
    params.push(name)
  }
  if (body.phone !== undefined) {
    updates.push('phone = ?')
    params.push(body.phone ? String(body.phone).trim() : null)
  }
  if (body.avatar_url !== undefined) {
    updates.push('avatar_url = ?')
    params.push(body.avatar_url || null)
  }

  // 變更密碼：需驗證舊密碼正確
  if (body.new_password) {
    if (!body.current_password) {
      return fail(c, '請輸入目前密碼以變更密碼', 400)
    }
    if (String(body.new_password).length < 6) {
      return fail(c, '新密碼至少需 6 位字元', 400)
    }
    const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(jwtUser.sub)
      .first<{ password_hash: string }>()
    if (!row) return fail(c, '使用者不存在', 404)
    const valid = await verifyPassword(body.current_password, row.password_hash)
    // 注意：這裡不可回傳 401，前端 axios 攔截器會將 401 視為登入逾時並強制登出，
    // 造成使用者輸錯目前密碼時被踢出系統。改用 400 表示「請求內容驗證失敗」。
    if (!valid) return fail(c, '目前密碼不正確', 400)

    updates.push('password_hash = ?')
    params.push(await hashPassword(body.new_password))
  }

  if (!updates.length) return fail(c, '沒有可更新的欄位', 400)
  updates.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params, jwtUser.sub)
    .run()

  const updated = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.manager_id, u.phone, u.avatar_url, u.created_at,
            m.name as manager_name
     FROM users u
     LEFT JOIN users m ON m.id = u.manager_id
     WHERE u.id = ?`
  )
    .bind(jwtUser.sub)
    .first()
  return ok(c, updated)
})

export default auth
