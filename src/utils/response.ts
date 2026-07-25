import type { Context } from 'hono'

/** 統一成功回應格式 */
export function ok<T>(
  c: Context,
  data: T,
  pagination?: { page: number; page_size: number; total: number },
  status: number = 200
) {
  const body: any = { success: true, data }
  if (pagination) {
    body.pagination = {
      ...pagination,
      total_pages: Math.max(1, Math.ceil(pagination.total / pagination.page_size))
    }
  }
  return c.json(body, status as any)
}

/** 統一錯誤回應格式 */
export function fail(c: Context, message: string, status: number = 400) {
  return c.json({ success: false, error: message }, status as any)
}
