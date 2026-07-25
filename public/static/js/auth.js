// ============================================================
// Auth 工具：登入狀態管理、角色判斷
// ============================================================
const Auth = {
  getToken() {
    return localStorage.getItem('bizflow_token')
  },
  getUser() {
    const raw = localStorage.getItem('bizflow_user')
    return raw ? JSON.parse(raw) : null
  },
  isLoggedIn() {
    return !!this.getToken()
  },
  setSession(token, user) {
    localStorage.setItem('bizflow_token', token)
    localStorage.setItem('bizflow_user', JSON.stringify(user))
  },
  logout() {
    localStorage.removeItem('bizflow_token')
    localStorage.removeItem('bizflow_user')
    location.href = '/login'
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      location.href = '/login'
      return false
    }
    return true
  },
  roleLabel(role) {
    return { admin: '管理員', manager: '主管', sales: '業務' }[role] || role
  },
  isManagerUp() {
    const u = this.getUser()
    return u && (u.role === 'admin' || u.role === 'manager')
  },
  isAdmin() {
    const u = this.getUser()
    return u && u.role === 'admin'
  }
}
