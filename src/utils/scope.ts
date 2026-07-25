import type { JwtPayload } from '../types'

/**
 * 資料範圍過濾工具
 * - admin: 可看全部
 * - manager: 可看自己 + 自己團隊（manager_id = 自己）的所有 sales 資料
 * - sales: 僅可看自己 (owner_id = 自己)
 *
 * 回傳可用於 SQL 的 owner_id IN (...) 子句與參數
 */
export async function getVisibleOwnerIds(
  db: D1Database,
  user: JwtPayload
): Promise<number[] | null> {
  if (user.role === 'admin') {
    return null // null 代表不限制（全部可見）
  }
  if (user.role === 'manager') {
    const rows = await db
      .prepare('SELECT id FROM users WHERE id = ? OR manager_id = ?')
      .bind(user.sub, user.sub)
      .all<{ id: number }>()
    return rows.results.map((r) => r.id)
  }
  // sales
  return [user.sub]
}

/** 依 ownerIds 產生 SQL IN 子句片段與對應參數，null 代表不加限制 */
export function ownerScopeClause(
  ownerIds: number[] | null,
  columnName: string = 'owner_id'
): { clause: string; params: number[] } {
  if (ownerIds === null) {
    return { clause: '1=1', params: [] }
  }
  if (ownerIds.length === 0) {
    return { clause: '1=0', params: [] } // 沒有任何可見資料
  }
  const placeholders = ownerIds.map(() => '?').join(',')
  return { clause: `${columnName} IN (${placeholders})`, params: ownerIds }
}
