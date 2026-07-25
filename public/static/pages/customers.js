// ============================================================
// 客戶列表頁
// ============================================================
window.Pages = window.Pages || {}

const CustomerListState = { page: 1, pageSize: 20, search: '', status: '' }

Pages.customerList = async function () {
  mountLayout('customers')
  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">客戶管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">管理您的客戶資料與跟進紀錄</p>
      </div>
      <a href="/customers/new" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i> 新增客戶
      </a>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        <div class="relative flex-1 min-w-[200px]">
          <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-sm"></i>
          <input id="cust-search" type="text" placeholder="搜尋公司名稱 / 統編..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <select id="cust-status" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">所有狀態</option>
          <option value="lead">潛在客戶</option>
          <option value="active">合作中</option>
          <option value="inactive">停止合作</option>
        </select>
        <button id="cust-search-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">
          <i class="fas fa-filter mr-1"></i> 篩選
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">公司名稱</th>
              <th class="px-4 py-3 font-medium">產業</th>
              <th class="px-4 py-3 font-medium">狀態</th>
              <th class="px-4 py-3 font-medium">負責業務</th>
              <th class="px-4 py-3 font-medium text-center">報價數</th>
              <th class="px-4 py-3 font-medium">最後更新</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="cust-table-body">
            <tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="cust-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  document.getElementById('cust-search-btn').addEventListener('click', () => {
    CustomerListState.search = document.getElementById('cust-search').value.trim()
    CustomerListState.status = document.getElementById('cust-status').value
    CustomerListState.page = 1
    loadCustomerList()
  })
  document.getElementById('cust-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('cust-search-btn').click()
  })

  loadCustomerList()
}

async function loadCustomerList() {
  const tbody = document.getElementById('cust-table-body')
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/customers', {
      search: CustomerListState.search,
      status: CustomerListState.status,
      page: CustomerListState.page,
      page_size: CustomerListState.pageSize
    })
    renderCustomerTable(res.data)
    renderCustomerPagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderCustomerTable(list) {
  const tbody = document.getElementById('cust-table-body')
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">尚無符合條件的客戶資料</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((cust) => {
      const meta = CustomerStatusMeta[cust.status] || { label: cust.status, color: 'bg-gray-100 text-gray-600' }
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/customers/${cust.id}'">
        <td class="px-4 py-3">
          <p class="font-medium text-gray-800">${Fmt.escapeHtml(cust.company_name)}</p>
          <p class="text-xs text-gray-400">${Fmt.escapeHtml(cust.tax_id || '')}</p>
        </td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(cust.industry || '-')}</td>
        <td class="px-4 py-3">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(cust.owner_name)}</td>
        <td class="px-4 py-3 text-center text-gray-500">${cust.quote_count}</td>
        <td class="px-4 py-3 text-gray-400">${Fmt.date(cust.updated_at)}</td>
        <td class="px-4 py-3 text-right">
          <a href="/customers/${cust.id}" class="text-primary-600 hover:underline text-xs">查看 <i class="fas fa-chevron-right text-[10px]"></i></a>
        </td>
      </tr>`
    })
    .join('')
}

function renderCustomerPagination(p) {
  const el = document.getElementById('cust-pagination')
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeCustPage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeCustPage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeCustPage(page) {
  CustomerListState.page = page
  loadCustomerList()
}
