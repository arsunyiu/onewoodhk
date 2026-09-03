// ============================================================
// Layout：側邊選單 + 主內容容器（深色奢華風格 MUI Suite）
// ============================================================
function renderLayout(activeKey) {
  const user = Auth.getUser()
  const menuGroups = [
    {
      label: 'MAIN',
      items: [
        { key: 'dashboard', href: '/', icon: 'fa-gauge-high', label: '首頁總覽' },
        { key: 'customers', href: '/customers', icon: 'fa-building-user', label: '客戶管理' },
        { key: 'quotes', href: '/quotes', icon: 'fa-file-invoice-dollar', label: '報價管理' },
        { key: 'orders', href: '/orders', icon: 'fa-cart-shopping', label: '成交訂單' },
        { key: 'projects', href: '/projects', icon: 'fa-helmet-safety', label: '工程管理' }
      ]
    }
  ]

  const opsItems = [
    { key: 'suppliers', href: '/suppliers', icon: 'fa-user-gear', label: '供應商管理' }
  ]
  if (Auth.isManagerUp()) {
    opsItems.push({ key: 'finance', href: '/finance', icon: 'fa-hand-holding-dollar', label: '財務管理' })
    opsItems.push({ key: 'accounting', href: '/accounting', icon: 'fa-book', label: '會計管理' })
  }
  opsItems.push({ key: 'products', href: '/products', icon: 'fa-boxes-stacked', label: '產品目錄' })
  opsItems.push({ key: 'reports', href: '/reports', icon: 'fa-chart-line', label: '報表分析' })
  menuGroups.push({ label: 'OPERATIONS', items: opsItems })

  if (Auth.isAdmin()) {
    menuGroups.push({
      label: 'ADMIN',
      items: [
        { key: 'users', href: '/users', icon: 'fa-users-gear', label: '使用者管理' },
        { key: 'roles', href: '/roles', icon: 'fa-user-shield', label: '角色管理' },
        { key: 'audit', href: '/audit-log', icon: 'fa-clipboard-list', label: '審計紀錄' }
      ]
    })
  }

  const renderGroup = (group) => `
    <div class="mb-5">
      <p class="px-4 mb-2 text-[10px] font-semibold text-ink-400 tracking-label uppercase">${group.label}</p>
      <div class="space-y-1">
        ${group.items
          .map(
            (m) => `
        <a href="${m.href}" data-nav="${m.key}"
           class="relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition
                  ${activeKey === m.key ? 'bg-surface-200 text-primary-500' : 'text-ink-400 hover:bg-surface-200 hover:text-ink-50'}">
          ${activeKey === m.key ? '<span class="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary-500"></span>' : ''}
          <i class="fas ${m.icon} w-5 text-center"></i>
          <span>${m.label}</span>
        </a>`
          )
          .join('')}
      </div>
    </div>`

  const menuHtml = menuGroups.map(renderGroup).join('')

  return `
  <div class="flex h-screen overflow-hidden bg-surface-300">
    <!-- Sidebar -->
    <aside class="w-[22%] sm:w-60 bg-surface-400 border-r border-line flex flex-col shrink-0">
      <div class="h-16 flex items-center gap-2.5 px-5 border-b border-line">
        <div class="w-9 h-9 rounded-lg bg-surface-100 border border-line flex items-center justify-center shrink-0 overflow-hidden">
          <img src="/static/images/logo.png" alt="一木工程" class="w-full h-full object-contain" />
        </div>
        <div class="min-w-0">
          <p class="font-bold text-sm text-ink-50 leading-tight truncate">一木工程</p>
          <p class="text-[10px] text-primary-500 tracking-label uppercase leading-tight">MUI Suite</p>
        </div>
      </div>
      <nav class="flex-1 px-3 pt-4 overflow-y-auto">${menuHtml}</nav>
      <div class="p-3 border-t border-line">
        <a href="/settings/profile" class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-200 transition">
          ${user?.avatar_url
            ? `<img src="${user.avatar_url}" alt="${user?.name || ''}" class="w-9 h-9 rounded-full object-cover shrink-0 border border-line" />`
            : `<div class="w-9 h-9 rounded-full bg-primary-500/20 text-primary-500 border border-line flex items-center justify-center font-semibold shrink-0">
            ${(user?.name || '?').charAt(0)}
          </div>`}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-ink-50 truncate">${user?.name || ''}</p>
            <p class="text-xs text-ink-400 uppercase tracking-label">${Auth.roleLabel(user?.role)}</p>
          </div>
        </a>
        <button onclick="Auth.logout()" class="mt-1 w-full flex items-center gap-2 px-2 py-2 text-sm text-ink-400 hover:text-bad-400 hover:bg-bad-50 rounded-lg transition">
          <i class="fas fa-arrow-right-from-bracket w-5 text-center"></i> 登出
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <main id="main-content" class="flex-1 overflow-y-auto p-6 bg-surface-300"></main>
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
  const colors = { success: 'bg-good-400 text-surface-300', error: 'bg-bad-400 text-surface-300', info: 'bg-surface-100 text-ink-50 border border-line' }
  const el = document.createElement('div')
  el.className = `fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${colors[type] || colors.info} animate-fade-in`
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
  overlay.className = 'fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4'
  overlay.innerHTML = `<div id="app-modal-box" class="bg-surface-100 border border-line rounded-xl shadow-xl w-full ${opts.maxWidth || 'max-w-lg'} max-h-[90vh] overflow-y-auto">${innerHtml}</div>`
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !opts.persistent) closeModal()
  })
  document.body.appendChild(overlay)
}

function closeModal() {
  const el = document.getElementById('app-modal-overlay')
  if (el) el.remove()
}
