// ============================================================
// 成交訂單列表頁（唯讀，訂單由報價單標記成交時系統自動建立）
// ============================================================
window.Pages = window.Pages || {}

const ORDER_STATUS_META = {
  confirmed: { label: '已確認', color: 'bg-primary-100 text-primary-700' },
  delivered: { label: '已完成', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-gray-200 text-gray-500' }
}

const OrderListState = { page: 1, pageSize: 20 }

Pages.orders = async function () {
  mountLayout('orders')
  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">成交訂單</h1>
        <p class="text-sm text-gray-500 mt-0.5">報價單標記成交後，系統將自動建立對應訂單（此列表為唯讀）</p>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">訂單編號</th>
              <th class="px-4 py-3 font-medium">客戶</th>
              <th class="px-4 py-3 font-medium">負責業務</th>
              <th class="px-4 py-3 font-medium text-right">金額</th>
              <th class="px-4 py-3 font-medium text-center">狀態</th>
              <th class="px-4 py-3 font-medium">訂單日期</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="order-table-body">
            <tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="order-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  loadOrderList()
}

async function loadOrderList() {
  const tbody = document.getElementById('order-table-body')
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/orders', {
      page: OrderListState.page,
      page_size: OrderListState.pageSize
    })
    renderOrderTable(res.data)
    renderOrderPagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderOrderTable(list) {
  const tbody = document.getElementById('order-table-body')
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">尚無訂單資料</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((o) => {
      const meta = ORDER_STATUS_META[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-600' }
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/quotes/${o.quote_id}'">
        <td class="px-4 py-3 font-medium text-gray-800">${Fmt.escapeHtml(o.order_no)}</td>
        <td class="px-4 py-3 text-gray-700">${Fmt.escapeHtml(o.company_name)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(o.owner_name)}</td>
        <td class="px-4 py-3 text-right font-medium text-gray-800">${Fmt.currency(o.total_amount, 'HKD')}</td>
        <td class="px-4 py-3 text-center">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-gray-400">${Fmt.date(o.order_date)}</td>
        <td class="px-4 py-3 text-right">
          <a href="/quotes/${o.quote_id}" class="text-primary-600 hover:underline text-xs">查看來源報價 <i class="fas fa-chevron-right text-[10px]"></i></a>
        </td>
      </tr>`
    })
    .join('')
}

function renderOrderPagination(p) {
  const el = document.getElementById('order-pagination')
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeOrderPage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeOrderPage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeOrderPage(page) {
  OrderListState.page = page
  loadOrderList()
}
