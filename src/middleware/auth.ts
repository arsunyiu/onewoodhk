import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import type { Bindings, JwtPayload, UserRole } from '../types'
import { fail } from '../utils/response'

/**
 * 驗證 JWT，並將解析後的使用者資訊放入 c.set('user', payload)
 */
export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(c, '未授權，請先登入', 401)
  }
  const token = authHeader.substring(7)
  try {
    const payload = (await verify(token, c.env.JWT_SECRET, 'HS256')) as unknown as JwtPayload
    c.set('user', payload)
    await next()
  } catch (e) {
    return fail(c, 'Token 無效或已過期，請重新登入', 401)
  }
}

/**
 * 角色守衛：僅允許指定角色存取
 */
export function requireRole(...roles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as JwtPayload
    if (!user || !roles.includes(user.role)) {
      return fail(c, '權限不足，無法執行此操作', 403)
    }
    await next()
  }
}
