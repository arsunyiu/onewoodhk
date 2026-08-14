// ============================================================
// 審計紀錄頁（僅管理員可用）：登入紀錄與重要操作歷史查詢
// ============================================================
window.Pages = window.Pages || {}

const AUDIT_ACTION_META = {
  login_success: { label: '登入成功', color: 'bg-green-100 text-green-700', icon: 'fa-right-to-bracket' },
  login_failed:  { label: '登入失敗', color: 'bg-red-100 text-red-700', icon: 'fa-triangle-exclamation' },
  create:        { label: '新增', color: 'bg-primary-100 text-primary-700', icon: 'fa-circle-plus' },
  update:        { label: '修改', color: 'bg-yellow-100 text-yellow-700', icon: 'fa-pen' },
  delete:        { label: '刪除', color: 'bg-red-100 text-red-700', icon: 'fa-trash' }
}

const AUDIT_MODULE_LABEL = {
  auth: '登入/帳號',
  users: '使用者管理',
  customers: '客戶管理',
  quotes: '報價管理',
  products: '產品目錄',
  accounting: '會計管理',
  finance: '財務管理',
  suppliers: '供應商管理'
}

let AuditFilters = { module: '', action: '', search: '', start_date: '', end_date: '', page: 1 }

Pages.auditLog = async function () {
  mountLayout('audit')

  if (!Auth.isAdmin()) {
    setMainContent(`
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <i class="fas fa-lock text-2xl"></i>
        </div>
        <h1 class="text-lg font-bold text-gray-800 mb-1">權限不足</h1>
        <p class="text-sm text-gray-400 max-w-sm">審計紀錄頁面僅限管理員（Admin）存取。</p>
        <a href="/" class="mt-6 text-primary-600 text-sm hover:underline">回首頁總覽</a>
      </div>`)
    return
  }

  AuditFilters = { module: '', action: '', search: '', start_date: '', end_date: '', page: 1 }
  setMainContent(`<div class="flex items-center justify-center py-24 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> 載入中...</div>`)

  try {
    const summary = await API.get('/audit/summary')
    await loadAuditList(summary.data)
  } catch (err) {
    setMainContent(`<div class="text-center py-20"><p class="text-red-400 mb-3">${err.message}</p></div>`)
  }
}

async function loadAuditList(summary) {
  try {
    const res = await API.get('/audit', {
      module: AuditFilters.module || undefined,
      action: AuditFilters.action || undefined,
      search: AuditFilters.search || undefined,
      start_date: AuditFilters.start_date || undefined,
      end_date: AuditFilters.end_date || undefined,
      page: AuditFilters.page,
      page_size: 20
    })
    renderAuditPage(summary, res.data, res.pagination)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function renderAuditPage(summary, list, pagination) {
  const moduleOptions = Object.keys(AUDIT_MODULE_LABEL)
    .map((m) => `<option value="${m}" ${AuditFilters.module === m ? 'selected' : ''}>${AUDIT_MODULE_LABEL[m]}</option>`)
    .join('')
  const actionOptions = Object.keys(AUDIT_ACTION_META)
    .map((a) => `<option value="${a}" ${AuditFilters.action === a ? 'selected' : ''}>${AUDIT_ACTION_META[a].label}</option>`)
    .join('')

  const rows = list.length
    ? list.map((row) => {
        const meta = AUDIT_ACTION_META[row.action] || { label: row.action, color: 'bg-gray-100 text-gray-600', icon: 'fa-circle-info' }
        return `
        <tr class="border-b border-gray-50 hover:bg-gray-50">
          <td class="px-4 py-3 text-gray-500 whitespace-nowrap">${Fmt.datetime(row.created_at)}</td>
          <td class="px-4 py-3">
            <p class="font-medium text-gray-800">${Fmt.escapeHtml(row.user_name || '未知')}</p>
            <p class="text-xs text-gray-400">${Fmt.escapeHtml(row.user_email || '-')}</p>
          </td>
          <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${meta.color}"><i class="fas ${meta.icon} mr-1"></i>${meta.label}</span></td>
          <td class="px-4 py-3 text-gray-600">${AUDIT_MODULE_LABEL[row.module] || row.module}</td>
          <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${Fmt.escapeHtml(row.description || '')}">${Fmt.escapeHtml(row.description || '-')}</td>
          <td class="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">${Fmt.escapeHtml(row.ip_address || '-')}</td>
        </tr>`
      }).join('')
    : `<tr><td colspan="6" class="text-center text-gray-400 py-10">尚無審計紀錄</td></tr>`

  const totalPages = pagination?.total_pages || 1
  const page = pagination?.page || 1

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">審計紀錄</h1>
        <p class="text-sm text-gray-500 mt-0.5">登入紀錄與系統重要操作歷史（僅管理員可查閱）</p>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-2xl font-bold text-green-600">${summary.today_login_success}</p>
        <p class="text-xs text-gray-400 mt-1">今日登入成功</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-2xl font-bold text-red-500">${summary.today_login_failed}</p>
        <p class="text-xs text-gray-400 mt-1">今日登入失敗</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-2xl font-bold text-gray-800">${summary.last_7d_total}</p>
        <p class="text-xs text-gray-400 mt-1">近 7 日操作紀錄</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-2xl font-bold text-gray-800">${summary.total_all}</p>
        <p class="text-xs text-gray-400 mt-1">歷史總筆數</p>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 p-4">
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <select id="audit-filter-module" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">全部模組</option>
          ${moduleOptions}
        </select>
        <select id="audit-filter-action" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">全部動作</option>
          ${actionOptions}
        </select>
        <input id="audit-filter-search" type="text" placeholder="搜尋姓名/Email/說明" value="${Fmt.escapeHtml(AuditFilters.search)}"
               class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input id="audit-filter-start" type="date" value="${AuditFilters.start_date}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input id="audit-filter-end" type="date" value="${AuditFilters.end_date}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button id="audit-filter-reset" class="text-sm text-gray-500 hover:underline px-3 py-2">清除篩選</button>
        <button id="audit-filter-apply" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <i class="fas fa-filter mr-1"></i> 套用篩選
        </button>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">時間</th>
              <th class="px-4 py-3 font-medium">操作者</th>
              <th class="px-4 py-3 font-medium">動作</th>
              <th class="px-4 py-3 font-medium">模組</th>
              <th class="px-4 py-3 font-medium">說明</th>
              <th class="px-4 py-3 font-medium">來源 IP</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
        <span>共 ${pagination?.total || 0} 筆，第 ${page} / ${totalPages} 頁</span>
        <div class="flex gap-2">
          <button id="audit-page-prev" ${page <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">上一頁</button>
          <button id="audit-page-next" ${page >= totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">下一頁</button>
        </div>
      </div>
    </div>
  `)

  document.getElementById('audit-filter-apply').addEventListener('click', () => {
    AuditFilters.module = document.getElementById('audit-filter-module').value
    AuditFilters.action = document.getElementById('audit-filter-action').value
    AuditFilters.search = document.getElementById('audit-filter-search').value.trim()
    AuditFilters.start_date = document.getElementById('audit-filter-start').value
    AuditFilters.end_date = document.getElementById('audit-filter-end').value
    AuditFilters.page = 1
    loadAuditList(summary)
  })
  document.getElementById('audit-filter-reset').addEventListener('click', () => {
    AuditFilters = { module: '', action: '', search: '', start_date: '', end_date: '', page: 1 }
    loadAuditList(summary)
  })
  const prevBtn = document.getElementById('audit-page-prev')
  const nextBtn = document.getElementById('audit-page-next')
  if (prevBtn) prevBtn.addEventListener('click', () => { if (page > 1) { AuditFilters.page = page - 1; loadAuditList(summary) } })
  if (nextBtn) nextBtn.addEventListener('click', () => { if (page < totalPages) { AuditFilters.page = page + 1; loadAuditList(summary) } })
}
