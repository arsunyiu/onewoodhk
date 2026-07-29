// ============================================================
// Layout：側邊選單 + 頂部列 + 主內容容器
// ============================================================
function renderLayout(activeKey) {
  const user = Auth.getUser()
  const menus = [
    { key: 'dashboard', href: '/', icon: 'fa-gauge-high', label: '首頁總覽' },
    { key: 'customers', href: '/customers', icon: 'fa-building-user', label: '客戶管理' },
    { key: 'quotes', href: '/quotes', icon: 'fa-file-invoice-dollar', label: '報價管理' },
    { key: 'orders', href: '/orders', icon: 'fa-cart-shopping', label: '成交訂單' },
    { key: 'projects', href: '/projects', icon: 'fa-helmet-safety', label: '工程管理' }
  ]
  if (Auth.isManagerUp()) {
    menus.push({ key: 'finance', href: '/finance', icon: 'fa-hand-holding-dollar', label: '財務管理' })
    menus.push({ key: 'accounting', href: '/accounting', icon: 'fa-book', label: '會計管理' })
  }
  menus.push({ key: 'products', href: '/products', icon: 'fa-boxes-stacked', label: '產品目錄' })
  menus.push({ key: 'reports', href: '/reports', icon: 'fa-chart-line', label: '報表分析' })
  if (Auth.isAdmin()) {
    menus.push({ key: 'users', href: '/users', icon: 'fa-users-gear', label: '使用者管理' })
    menus.push({ key: 'roles', href: '/roles', icon: 'fa-user-shield', label: '角色管理' })
  }

  const menuHtml = menus
    .map(
      (m) => `
    <a href="${m.href}" data-nav="${m.key}"
       class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition
              ${activeKey === m.key ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}">
      <i class="fas ${m.icon} w-5 text-center"></i>
      <span>${m.label}</span>
    </a>`
    )
    .join('')

  return `
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div class="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
        <img src="/static/images/logo.png" alt="一木工程" class="w-9 h-9 object-contain shrink-0" />
        <span class="font-bold text-lg text-gray-800">一木工程</span>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">${menuHtml}</nav>
      <div class="p-3 border-t border-gray-100">
        <a href="/settings/profile" class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100">
          ${user?.avatar_url
            ? `<img src="${user.avatar_url}" alt="${user?.name || ''}" class="w-9 h-9 rounded-full object-cover shrink-0" />`
            : `<div class="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold shrink-0">
            ${(user?.name || '?').charAt(0)}
          </div>`}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">${user?.name || ''}</p>
            <p class="text-xs text-gray-400">${Auth.roleLabel(user?.role)}</p>
          </div>
        </a>
        <button onclick="Auth.logout()" class="mt-1 w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
          <i class="fas fa-arrow-right-from-bracket w-5 text-center"></i> 登出
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <main id="main-content" class="flex-1 overflow-y-auto p-6 bg-gray-50"></main>
    </div>
  </div>`
}

function mountLayout(activeKey) {
  document.getElementById('app').innerHTML = renderLayout(activeKey)
}

function setMainContent(html) {
  document.getElementById('main-content').innerHTML = html
}

function showToast(message, type = 'success') {
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-gray-700' }
  const el = document.createElement('div')
  el.className = `fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-white shadow-lg text-sm ${colors[type] || colors.info} animate-fade-in`
  el.innerHTML = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

// ============================================================
// 共用 Modal：供各頁面新增/編輯表單（聯絡人、跟進紀錄、產品、使用者）使用
// ============================================================
function openModal(innerHtml, opts = {}) {
  closeModal()
  const overlay = document.createElement('div')
  overlay.id = 'app-modal-overlay'
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4'
  overlay.innerHTML = `<div id="app-modal-box" class="bg-white rounded-xl shadow-xl w-full ${opts.maxWidth || 'max-w-lg'} max-h-[90vh] overflow-y-auto">${innerHtml}</div>`
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !opts.persistent) closeModal()
  })
  document.body.appendChild(overlay)
}

function closeModal() {
  const el = document.getElementById('app-modal-overlay')
  if (el) el.remove()
}
