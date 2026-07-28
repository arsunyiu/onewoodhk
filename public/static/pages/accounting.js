// ============================================================
// 會計頁面：管理公司整體出入帳（收入/支出），含工程支出、人工等分類
// 權限：admin / manager 可用（後端已限制，sidebar 也僅對此角色顯示）
// ============================================================
window.Pages = window.Pages || {}

const ACCOUNTING_TYPE_META = {
  income: { label: '收入', color: 'bg-green-100 text-green-700' },
  expense: { label: '支出', color: 'bg-red-100 text-red-700' }
}

const AccountingListState = { page: 1, pageSize: 20, type: '', category: '' }
let AccountingCategories = { income: [], expense: [] }
let AccountingEntryCache = {}

Pages.accounting = async function () {
  mountLayout('accounting')

  if (!Auth.isManagerUp()) {
    setMainContent(`
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <i class="fas fa-lock text-2xl"></i>
        </div>
        <h1 class="text-lg font-bold text-gray-800 mb-1">權限不足</h1>
        <p class="text-sm text-gray-400 max-w-sm">會計管理頁面僅限管理員與主管存取。</p>
        <a href="/" class="mt-6 text-primary-600 text-sm hover:underline">回首頁總覽</a>
      </div>`)
    return
  }

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">會計管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">記錄公司整體出入帳，包括工程支出、人工等各項收支</p>
      </div>
      <button id="acc-new-btn" class="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
        <i class="fas fa-plus mr-1"></i> 新增出入帳
      </button>
    </div>

    <div id="acc-summary" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5"></div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-5 p-4">
      <canvas id="acc-trend-chart" height="80"></canvas>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        <select id="acc-filter-type" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">全部類型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
        </select>
        <select id="acc-filter-category" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">全部分類</option>
        </select>
        <button id="acc-filter-apply" class="text-sm text-primary-600 hover:underline">套用篩選</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">日期</th>
              <th class="px-4 py-3 font-medium text-center">類型</th>
              <th class="px-4 py-3 font-medium">分類</th>
              <th class="px-4 py-3 font-medium text-right">金額</th>
              <th class="px-4 py-3 font-medium">說明</th>
              <th class="px-4 py-3 font-medium">關聯訂單</th>
              <th class="px-4 py-3 font-medium">登記人</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="acc-table-body">
            <tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="acc-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  document.getElementById('acc-new-btn').addEventListener('click', () => openAccountingModal())
  document.getElementById('acc-filter-apply').addEventListener('click', () => {
    AccountingListState.page = 1
    AccountingListState.type = document.getElementById('acc-filter-type').value
    AccountingListState.category = document.getElementById('acc-filter-category').value
    loadAccountingList()
  })

  await loadAccountingCategories()
  loadAccountingSummary()
  loadAccountingList()
}

async function loadAccountingCategories() {
  try {
    const res = await API.get('/accounting/categories')
    AccountingCategories = res.data
    const sel = document.getElementById('acc-filter-category')
    if (sel) {
      sel.innerHTML =
        '<option value="">全部分類</option>' +
        [...AccountingCategories.income, ...AccountingCategories.expense]
          .map((cat) => `<option value="${Fmt.escapeHtml(cat)}">${Fmt.escapeHtml(cat)}</option>`)
          .join('')
    }
  } catch (err) {
    console.error(err)
  }
}

async function loadAccountingSummary() {
  const el = document.getElementById('acc-summary')
  if (!el) return
  try {
    const res = await API.get('/accounting/summary', { range: '365d' })
    const s = res.data
    el.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">總收入（近一年）</p>
        <p class="text-2xl font-bold text-green-600 mt-1">${Fmt.currency(s.total_income, 'HKD')}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">總支出（近一年）</p>
        <p class="text-2xl font-bold text-red-500 mt-1">${Fmt.currency(s.total_expense, 'HKD')}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">淨利（近一年）</p>
        <p class="text-2xl font-bold ${s.net_profit >= 0 ? 'text-primary-600' : 'text-red-500'} mt-1">${Fmt.currency(s.net_profit, 'HKD')}</p>
      </div>`
    renderAccountingTrendChart(s.trend)
  } catch (err) {
    el.innerHTML = `<div class="col-span-3 text-red-400 text-sm">${err.message}</div>`
  }
}

let AccountingTrendChartInstance = null
function renderAccountingTrendChart(trend) {
  const canvas = document.getElementById('acc-trend-chart')
  if (!canvas) return
  if (AccountingTrendChartInstance) AccountingTrendChartInstance.destroy()
  AccountingTrendChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: trend.map((t) => t.month),
      datasets: [
        { label: '收入', data: trend.map((t) => t.income), backgroundColor: '#2a6a52' },
        { label: '支出', data: trend.map((t) => t.expense), backgroundColor: '#c0524a' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  })
}

async function loadAccountingList() {
  const tbody = document.getElementById('acc-table-body')
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const params = { page: AccountingListState.page, page_size: AccountingListState.pageSize }
    if (AccountingListState.type) params.type = AccountingListState.type
    if (AccountingListState.category) params.category = AccountingListState.category
    const res = await API.get('/accounting/entries', params)
    renderAccountingTable(res.data)
    renderAccountingPagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderAccountingTable(list) {
  const tbody = document.getElementById('acc-table-body')
  if (!tbody) return
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400">尚無出入帳紀錄</td></tr>`
    return
  }
  AccountingEntryCache = {}
  list.forEach((e) => { AccountingEntryCache[e.id] = e })
  tbody.innerHTML = list
    .map((e) => {
      const meta = ACCOUNTING_TYPE_META[e.entry_type] || { label: e.entry_type, color: 'bg-gray-100 text-gray-600' }
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50">
        <td class="px-4 py-3 text-gray-600">${Fmt.date(e.entry_date)}</td>
        <td class="px-4 py-3 text-center">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-gray-700">${Fmt.escapeHtml(e.category)}</td>
        <td class="px-4 py-3 text-right font-medium ${e.entry_type === 'income' ? 'text-green-600' : 'text-red-500'}">${Fmt.currency(e.amount, 'HKD')}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(e.description || '-')}</td>
        <td class="px-4 py-3 text-gray-400">${e.order_no ? Fmt.escapeHtml(e.order_no) : '-'}</td>
        <td class="px-4 py-3 text-gray-400">${Fmt.escapeHtml(e.recorded_by_name || '-')}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button onclick="openAccountingModal(AccountingEntryCache[${e.id}])" class="text-primary-600 hover:underline text-xs mr-2">編輯</button>
          ${Auth.isAdmin() ? `<button onclick="deleteAccountingEntry(${e.id})" class="text-red-400 hover:text-red-600 text-xs">刪除</button>` : ''}
        </td>
      </tr>`
    })
    .join('')
}

function renderAccountingPagination(p) {
  const el = document.getElementById('acc-pagination')
  if (!el) return
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeAccountingPage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeAccountingPage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeAccountingPage(page) {
  AccountingListState.page = page
  loadAccountingList()
}

function openAccountingModal(entry) {
  const isEdit = !!entry
  const categoryOptions = (type) =>
    (AccountingCategories[type] || [])
      .map((cat) => `<option value="${Fmt.escapeHtml(cat)}" ${entry && entry.category === cat ? 'selected' : ''}>${Fmt.escapeHtml(cat)}</option>`)
      .join('')

  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">${isEdit ? '編輯出入帳' : '新增出入帳'}</h3>
      <div class="space-y-3">
        <div>
          <label class="text-xs text-gray-500">類型</label>
          <select id="acc-form-type" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="expense" ${!entry || entry.entry_type === 'expense' ? 'selected' : ''}>支出</option>
            <option value="income" ${entry && entry.entry_type === 'income' ? 'selected' : ''}>收入</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500">分類</label>
          <select id="acc-form-category" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"></select>
        </div>
        <div>
          <label class="text-xs text-gray-500">金額</label>
          <input id="acc-form-amount" type="number" min="0" step="0.01" value="${entry ? entry.amount : ''}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
        </div>
        <div>
          <label class="text-xs text-gray-500">日期</label>
          <input id="acc-form-date" type="date" value="${entry ? entry.entry_date : new Date().toISOString().slice(0, 10)}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-gray-500">說明</label>
          <textarea id="acc-form-desc" rows="2" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="選填">${entry && entry.description ? Fmt.escapeHtml(entry.description) : ''}</textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
        <button id="acc-form-submit" class="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg">${isEdit ? '儲存' : '新增'}</button>
      </div>
    </div>
  `)

  const typeSel = document.getElementById('acc-form-type')
  const refreshCategoryOptions = () => {
    document.getElementById('acc-form-category').innerHTML = categoryOptions(typeSel.value)
  }
  typeSel.addEventListener('change', refreshCategoryOptions)
  refreshCategoryOptions()

  document.getElementById('acc-form-submit').addEventListener('click', async () => {
    const payload = {
      entry_type: typeSel.value,
      category: document.getElementById('acc-form-category').value,
      amount: parseFloat(document.getElementById('acc-form-amount').value),
      entry_date: document.getElementById('acc-form-date').value,
      description: document.getElementById('acc-form-desc').value.trim() || null
    }
    if (!payload.amount || payload.amount <= 0) {
      showToast('請輸入正確的金額', 'error')
      return
    }
    try {
      if (isEdit) {
        await API.put(`/accounting/entries/${entry.id}`, payload)
        showToast('出入帳已更新')
      } else {
        await API.post('/accounting/entries', payload)
        showToast('出入帳已新增')
      }
      closeModal()
      loadAccountingSummary()
      loadAccountingList()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

async function deleteAccountingEntry(id) {
  if (!confirm('確定要刪除此筆出入帳紀錄嗎？')) return
  try {
    await API.delete(`/accounting/entries/${id}`)
    showToast('已刪除紀錄')
    loadAccountingSummary()
    loadAccountingList()
  } catch (err) {
    showToast(err.message, 'error')
  }
}
