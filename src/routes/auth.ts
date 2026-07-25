import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { Bindings, JwtPayload } from '../types'
import { ok, fail } from '../utils/response'
import { verifyPassword } from '../utils/crypto'
import { authMiddleware } from '../middleware/auth'

const auth = new Hono<{ Bindings: Bindings }>()

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return fail(c, '請輸入帳號與密碼', 400)
  }
  const { email, password } = body

  const user = await c.env.DB.prepare(
    'SELECT id, name, email, password_hash, role, manager_id, is_active FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase().trim())
    .first<any>()

  if (!user) {
    return fail(c, '帳號或密碼錯誤', 401)
  }
  if (!user.is_active) {
    return fail(c, '此帳號已被停用，請聯繫管理員', 403)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
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
    'SELECT id, name, email, role, manager_id, phone, avatar_url FROM users WHERE id = ?'
  )
    .bind(jwtUser.sub)
    .first()
  if (!user) return fail(c, '使用者不存在', 404)
  return ok(c, user)
})

export default auth
