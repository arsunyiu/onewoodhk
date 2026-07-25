// ============================================================
// 報價列表頁
// ============================================================
window.Pages = window.Pages || {}

const QuoteListState = { page: 1, pageSize: 20, search: '', status: '' }

const QUOTE_STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'pending_approval', label: '待審核' },
  { value: 'approved', label: '已核准' },
  { value: 'sent', label: '已寄送' },
  { value: 'won', label: '已成交' },
  { value: 'rejected', label: '已拒絕' },
  { value: 'lost', label: '已流失' }
]

Pages.quoteList = async function () {
  mountLayout('quotes')
  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">報價管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">建立、審批與追蹤所有報價單</p>
      </div>
      <a href="/quotes/new" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i> 新增報價
      </a>
    </div>

    <div class="flex flex-wrap gap-2 mb-4" id="quote-status-tabs"></div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        <div class="relative flex-1 min-w-[220px]">
          <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-sm"></i>
          <input id="quote-search" type="text" placeholder="搜尋報價單號 / 標題 / 客戶..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <button id="quote-search-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">
          <i class="fas fa-filter mr-1"></i> 篩選
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">報價單號</th>
              <th class="px-4 py-3 font-medium">客戶 / 標題</th>
              <th class="px-4 py-3 font-medium">狀態</th>
              <th class="px-4 py-3 font-medium text-right">金額</th>
              <th class="px-4 py-3 font-medium">負責業務</th>
              <th class="px-4 py-3 font-medium">有效期限</th>
              <th class="px-4 py-3 font-medium">建立時間</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="quote-table-body">
            <tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="quote-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  renderQuoteStatusTabs()

  document.getElementById('quote-search-btn').addEventListener('click', () => {
    QuoteListState.search = document.getElementById('quote-search').value.trim()
    QuoteListState.page = 1
    loadQuoteList()
  })
  document.getElementById('quote-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('quote-search-btn').click()
  })

  loadQuoteList()
}

function renderQuoteStatusTabs() {
  const el = document.getElementById('quote-status-tabs')
  el.innerHTML = QUOTE_STATUS_TABS.map((tab) => `
    <button data-status="${tab.value}"
      class="quote-tab px-3.5 py-1.5 rounded-full text-sm font-medium transition
        ${QuoteListState.status === tab.value ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}">
      ${tab.label}
    </button>`).join('')

  el.querySelectorAll('.quote-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      QuoteListState.status = btn.dataset.status
      QuoteListState.page = 1
      renderQuoteStatusTabs()
      loadQuoteList()
    })
  })
}

async function loadQuoteList() {
  const tbody = document.getElementById('quote-table-body')
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/quotes', {
      search: QuoteListState.search,
      status: QuoteListState.status,
      page: QuoteListState.page,
      page_size: QuoteListState.pageSize
    })
    renderQuoteTable(res.data)
    renderQuotePagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderQuoteTable(list) {
  const tbody = document.getElementById('quote-table-body')
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400">尚無符合條件的報價單</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((q) => {
      const meta = QuoteStatusMeta[q.status] || { label: q.status, color: 'bg-gray-100 text-gray-600' }
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/quotes/${q.id}'">
        <td class="px-4 py-3 font-medium text-gray-800">${Fmt.escapeHtml(q.quote_no)}</td>
        <td class="px-4 py-3">
          <p class="text-gray-800">${Fmt.escapeHtml(q.company_name)}</p>
          <p class="text-xs text-gray-400">${Fmt.escapeHtml(q.title || '')}</p>
        </td>
        <td class="px-4 py-3">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-right font-medium text-gray-800">${Fmt.currency(q.total_amount, q.currency)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(q.owner_name)}</td>
        <td class="px-4 py-3 text-gray-400">${Fmt.date(q.valid_until)}</td>
        <td class="px-4 py-3 text-gray-400">${Fmt.date(q.created_at)}</td>
        <td class="px-4 py-3 text-right">
          <a href="/quotes/${q.id}" class="text-primary-600 hover:underline text-xs">查看 <i class="fas fa-chevron-right text-[10px]"></i></a>
        </td>
      </tr>`
    })
    .join('')
}

function renderQuotePagination(p) {
  const el = document.getElementById('quote-pagination')
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeQuotePage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeQuotePage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeQuotePage(page) {
  QuoteListState.page = page
  loadQuoteList()
}
