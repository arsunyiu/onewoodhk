// ============================================================
// 前端 Router：依 pathname 呼叫對應頁面渲染函式
// 所有頁面渲染函式定義於 /static/pages/*.js
// ============================================================

// 深色主題下 Chart.js 預設文字/格線顏色（各頁圖表若未個別覆寫則套用此設定）
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#b3c1b8'
  Chart.defaults.borderColor = '#3a4f47'
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Noto Sans TC', sans-serif"
}

const routes = [
  { pattern: /^\/login$/, page: () => Pages.login() },
  { pattern: /^\/$/, page: () => Pages.dashboard() },
  { pattern: /^\/customers$/, page: () => Pages.customerList() },
  { pattern: /^\/customers\/new$/, page: () => Pages.customerForm(null) },
  { pattern: /^\/customers\/(\d+)\/edit$/, page: (m) => Pages.customerForm(m[1]) },
  { pattern: /^\/customers\/(\d+)$/, page: (m) => Pages.customerDetail(m[1]) },
  { pattern: /^\/quotes$/, page: () => Pages.quoteList() },
  { pattern: /^\/quotes\/new$/, page: () => Pages.quoteForm(null) },
  { pattern: /^\/quotes\/(\d+)\/edit$/, page: (m) => Pages.quoteForm(m[1]) },
  { pattern: /^\/quotes\/(\d+)$/, page: (m) => Pages.quoteDetail(m[1]) },
  { pattern: /^\/products$/, page: () => Pages.products() },
  { pattern: /^\/orders$/, page: () => Pages.orders() },
  { pattern: /^\/projects$/, page: () => Pages.projects() },
  { pattern: /^\/projects\/(\d+)$/, page: (m) => Pages.projectDetail(m[1]) },
  { pattern: /^\/suppliers$/, page: () => Pages.suppliers() },
  { pattern: /^\/suppliers\/(\d+)$/, page: (m) => Pages.supplierDetail(m[1]) },
  { pattern: /^\/finance$/, page: () => Pages.finance() },
  { pattern: /^\/finance\/(\d+)$/, page: (m) => Pages.financeDetail(m[1]) },
  { pattern: /^\/accounting$/, page: () => Pages.accounting() },
  { pattern: /^\/users$/, page: () => Pages.users() },
  { pattern: /^\/roles$/, page: () => Pages.roles() },
  { pattern: /^\/audit-log$/, page: () => Pages.auditLog() },
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
    <div class="flex items-center justify-center h-screen text-ink-400 bg-surface-300">
      <div class="text-center">
        <i class="fas fa-face-frown text-4xl mb-3"></i>
        <p>找不到頁面</p>
        <a href="/" class="text-primary-500 hover:underline">回首頁</a>
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
