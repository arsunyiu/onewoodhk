import type { Context } from 'hono'
import type { Bindings, JwtPayload } from '../types'

export interface AuditEntry {
  user_id?: number | null
  user_name?: string | null
  user_email?: string | null
  role?: string | null
  action: string
  module: string
  resource_id?: string | number | null
  description?: string | null
}

/**
 * 寫入一筆審計紀錄。使用 c 取得 IP / User-Agent，失敗時僅記錄至 console，
 * 不應中斷主要業務流程（因此不會 throw）。
 */
export async function logAudit(c: Context<{ Bindings: Bindings }>, entry: AuditEntry): Promise<void> {
  try {
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      null
    const ua = c.req.header('User-Agent') || null

    await c.env.DB.prepare(
      `INSERT INTO audit_logs (user_id, user_name, user_email, role, action, module, resource_id, description, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.user_id ?? null,
        entry.user_name ?? null,
        entry.user_email ?? null,
        entry.role ?? null,
        entry.action,
        entry.module,
        entry.resource_id != null ? String(entry.resource_id) : null,
        entry.description ?? null,
        ip,
        ua
      )
      .run()
  } catch (err) {
    // 審計紀錄寫入失敗不應影響主要業務流程，僅記錄錯誤
    console.error('logAudit failed:', err)
  }
}

/** 由目前登入使用者（JwtPayload）快速產生審計紀錄，減少重複程式碼 */
export async function logAuditFromUser(
  c: Context<{ Bindings: Bindings }>,
  user: JwtPayload,
  action: string,
  module: string,
  resource_id?: string | number | null,
  description?: string | null
): Promise<void> {
  await logAudit(c, {
    user_id: user.sub,
    user_name: user.name,
    user_email: user.email,
    role: user.role,
    action,
    module,
    resource_id,
    description
  })
}
