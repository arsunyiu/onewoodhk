// ============================================================
// 共用型別定義
// ============================================================

export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  R2: R2Bucket
}

export type UserRole = 'admin' | 'manager' | 'sales'

export interface JwtPayload {
  sub: number // user id
  name: string
  email: string
  role: UserRole
  manager_id: number | null
  exp: number
}

export interface AppVariables {
  user: JwtPayload
}

export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'won'
  | 'lost'

export type CustomerStatus = 'lead' | 'active' | 'inactive'

export interface ApiSuccess<T> {
  success: true
  data: T
  pagination?: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export interface ApiError {
  success: false
  error: string
}
