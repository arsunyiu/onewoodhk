// ============================================================
// 前端 Router：依 pathname 呼叫對應頁面渲染函式
// 所有頁面渲染函式定義於 /static/pages/*.js
// ============================================================

const routes = [
  { pattern: /^\/login$/, page: () => Pages.login() },
  { pattern: /^\/$/, page: () => Pages.dashboard() },
  { pattern: /^\/customers$/, page: () => Pages.customerList() },
  { pattern: /^\/customers\/new$/, page: () => Pages.customerForm(null) },
  { pattern: /^\/customers\/(\d+)$/, page: (m) => Pages.customerDetail(m[1]) },
  { pattern: /^\/quotes$/, page: () => Pages.quoteList() },
  { pattern: /^\/quotes\/new$/, page: () => Pages.quoteForm(null) },
  { pattern: /^\/quotes\/(\d+)$/, page: (m) => Pages.quoteDetail(m[1]) },
  { pattern: /^\/products$/, page: () => Pages.products() },
  { pattern: /^\/orders$/, page: () => Pages.orders() },
  { pattern: /^\/users$/, page: () => Pages.users() },
  { pattern: /^\/reports$/, page: () => Pages.reports() },
  { pattern: /^\/settings\/profile$/, page: () => Pages.profile() }
]

function router() {
  const path = location.pathname

  if (path === '/login') {
    if (Auth.isLoggedIn()) {
      location.href = '/'
      return
    }
    Pages.login()
    return
  }

  if (!Auth.requireAuth()) return

  for (const r of routes) {
    const m = path.match(r.pattern)
    if (m) {
      r.page(m)
      return
    }
  }
  // 404 fallback
  document.getElementById('app').innerHTML = `
    <div class="flex items-center justify-center h-screen text-gray-500">
      <div class="text-center">
        <i class="fas fa-face-frown text-4xl mb-3"></i>
        <p>找不到頁面</p>
        <a href="/" class="text-primary-600 hover:underline">回首頁</a>
      </div>
    </div>`
}

// 攔截站內連結點擊，改用 pushState 進行前端路由（避免整頁刷新）
document.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (a && a.origin === location.origin && !a.hasAttribute('data-external') && !a.hasAttribute('target')) {
    e.preventDefault()
    if (a.pathname !== location.pathname) {
      history.pushState(null, '', a.pathname)
      router()
    }
  }
})
window.addEventListener('popstate', router)

document.addEventListener('DOMContentLoaded', router)
