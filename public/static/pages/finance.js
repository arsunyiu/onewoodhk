// ============================================================
// 財務頁面：追蹤「成交訂單」的收款狀況
// - 列表頁：/finance（訂單收款總覽，含已收/未收/付款狀態）
// - 詳情頁：/finance/:id（單筆訂單收款紀錄 + 登記收款）
// 權限：admin / manager 可用（後端已限制，sidebar 也僅對此角色顯示）
// ============================================================
window.Pages = window.Pages || {}

function financeAccessDenied() {
  setMainContent(`
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
        <i class="fas fa-lock text-2xl"></i>
      </div>
      <h1 class="text-lg font-bold text-gray-800 mb-1">權限不足</h1>
      <p class="text-sm text-gray-400 max-w-sm">財務管理頁面僅限管理員與主管存取。</p>
      <a href="/" class="mt-6 text-primary-600 text-sm hover:underline">回首頁總覽</a>
    </div>`)
}

const PAY_STATUS_META = {
  paid: { label: '已付清', color: 'bg-green-100 text-green-700' },
  partial: { label: '部分付款', color: 'bg-yellow-100 text-yellow-700' },
  unpaid: { label: '未付款', color: 'bg-red-100 text-red-700' }
}

const PAYMENT_METHOD_META = {
  cash: '現金',
  bank_transfer: '銀行轉帳',
  cheque: '支票',
  other: '其他'
}

const FinanceListState = { page: 1, pageSize: 20 }

Pages.finance = async function () {
  mountLayout('finance')

  if (!Auth.isManagerUp()) {
    financeAccessDenied()
    return
  }

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">財務管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">追蹤成交訂單的收款進度，掌握已收款與未收款金額</p>
      </div>
    </div>

    <div id="finance-summary" class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5"></div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">訂單編號</th>
              <th class="px-4 py-3 font-medium">客戶</th>
              <th class="px-4 py-3 font-medium">負責業務</th>
              <th class="px-4 py-3 font-medium text-right">訂單金額</th>
              <th class="px-4 py-3 font-medium text-right">已收金額</th>
              <th class="px-4 py-3 font-medium text-right">未收餘額</th>
              <th class="px-4 py-3 font-medium text-center">付款狀態</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="finance-table-body">
            <tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="finance-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  loadFinanceSummary()
  loadFinanceList()
}

async function loadFinanceSummary() {
  const el = document.getElementById('finance-summary')
  if (!el) return
  try {
    const res = await API.get('/finance/summary')
    const s = res.data
    el.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">訂單總數</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">${s.order_count}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">應收總金額</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">${Fmt.currency(s.total_amount, 'HKD')}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">已收金額</p>
        <p class="text-2xl font-bold text-green-600 mt-1">${Fmt.currency(s.paid_amount, 'HKD')}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">未收餘額</p>
        <p class="text-2xl font-bold text-red-500 mt-1">${Fmt.currency(s.balance, 'HKD')}</p>
      </div>`
  } catch (err) {
    el.innerHTML = `<div class="col-span-4 text-red-400 text-sm">${err.message}</div>`
  }
}

async function loadFinanceList() {
  const tbody = document.getElementById('finance-table-body')
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/finance/orders', {
      page: FinanceListState.page,
      page_size: FinanceListState.pageSize
    })
    renderFinanceTable(res.data)
    renderFinancePagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderFinanceTable(list) {
  const tbody = document.getElementById('finance-table-body')
  if (!tbody) return
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400">尚無訂單資料</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((o) => {
      const meta = PAY_STATUS_META[o.pay_status] || PAY_STATUS_META.unpaid
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/finance/${o.id}'">
        <td class="px-4 py-3 font-medium text-gray-800">${Fmt.escapeHtml(o.order_no)}</td>
        <td class="px-4 py-3 text-gray-700">${Fmt.escapeHtml(o.company_name)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(o.owner_name)}</td>
        <td class="px-4 py-3 text-right text-gray-800">${Fmt.currency(o.total_amount, 'HKD')}</td>
        <td class="px-4 py-3 text-right text-green-600">${Fmt.currency(o.paid_amount, 'HKD')}</td>
        <td class="px-4 py-3 text-right font-medium ${o.balance > 0 ? 'text-red-500' : 'text-gray-400'}">${Fmt.currency(o.balance, 'HKD')}</td>
        <td class="px-4 py-3 text-center">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-right">
          <a href="/finance/${o.id}" class="text-primary-600 hover:underline text-xs">查看收款 <i class="fas fa-chevron-right text-[10px]"></i></a>
        </td>
      </tr>`
    })
    .join('')
}

function renderFinancePagination(p) {
  const el = document.getElementById('finance-pagination')
  if (!el) return
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeFinancePage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeFinancePage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeFinancePage(page) {
  FinanceListState.page = page
  loadFinanceList()
}

// ------------------------------------------------------------
// 訂單收款詳情頁
// ------------------------------------------------------------
let FinanceDetailOrderId = null

Pages.financeDetail = async function (orderId) {
  FinanceDetailOrderId = orderId
  mountLayout('finance')

  if (!Auth.isManagerUp()) {
    financeAccessDenied()
    return
  }

  setMainContent(`
    <div class="mb-5">
      <a href="/finance" class="text-sm text-gray-500 hover:text-primary-600"><i class="fas fa-arrow-left mr-1"></i> 返回財務列表</a>
    </div>
    <div id="finance-detail-content">
      <div class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</div>
    </div>
  `)
  await loadFinanceDetail(orderId)
}

async function loadFinanceDetail(orderId) {
  const el = document.getElementById('finance-detail-content')
  if (!el) return
  try {
    const res = await API.get(`/finance/orders/${orderId}`)
    renderFinanceDetail(res.data)
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`
  }
}

function renderFinanceDetail(d) {
  const el = document.getElementById('finance-detail-content')
  if (!el) return
  const o = d.order
  const meta = PAY_STATUS_META[d.pay_status] || PAY_STATUS_META.unpaid
  const canManage = Auth.isManagerUp()

  el.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold text-gray-800">${Fmt.escapeHtml(o.order_no)}</h2>
              <p class="text-sm text-gray-500">${Fmt.escapeHtml(o.company_name)} · 負責業務：${Fmt.escapeHtml(o.owner_name)}</p>
            </div>
            ${statusBadge(meta)}
          </div>
          <div class="grid grid-cols-3 gap-4 text-center border-t border-gray-100 pt-4">
            <div>
              <p class="text-xs text-gray-400">訂單金額</p>
              <p class="text-lg font-bold text-gray-800">${Fmt.currency(o.total_amount, 'HKD')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">已收金額</p>
              <p class="text-lg font-bold text-green-600">${Fmt.currency(d.paid_amount, 'HKD')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">未收餘額</p>
              <p class="text-lg font-bold text-red-500">${Fmt.currency(d.balance, 'HKD')}</p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">收款紀錄</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-400 border-b border-gray-100">
                  <th class="px-3 py-2 font-medium">日期</th>
                  <th class="px-3 py-2 font-medium text-right">金額</th>
                  <th class="px-3 py-2 font-medium">付款方式</th>
                  <th class="px-3 py-2 font-medium">備註</th>
                  <th class="px-3 py-2 font-medium">登記人</th>
                  ${canManage ? '<th class="px-3 py-2 font-medium"></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${
                  d.payments.length
                    ? d.payments
                        .map(
                          (p) => `
                  <tr class="border-b border-gray-50">
                    <td class="px-3 py-2 text-gray-600">${Fmt.date(p.payment_date)}</td>
                    <td class="px-3 py-2 text-right font-medium text-gray-800">${Fmt.currency(p.amount, 'HKD')}</td>
                    <td class="px-3 py-2 text-gray-500">${PAYMENT_METHOD_META[p.method] || p.method}</td>
                    <td class="px-3 py-2 text-gray-500">${Fmt.escapeHtml(p.notes || '-')}</td>
                    <td class="px-3 py-2 text-gray-400">${Fmt.escapeHtml(p.recorded_by_name || '-')}</td>
                    ${canManage ? `<td class="px-3 py-2 text-right"><button onclick="deletePayment(${p.id})" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-trash"></i></button></td>` : ''}
                  </tr>`
                        )
                        .join('')
                    : `<tr><td colspan="${canManage ? 6 : 5}" class="text-center py-6 text-gray-400">尚無收款紀錄</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="space-y-5">
        ${
          canManage
            ? `
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">登記收款</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-gray-500">收款金額</label>
              <input id="pay-amount" type="number" min="0" step="0.01" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label class="text-xs text-gray-500">收款日期</label>
              <input id="pay-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-gray-500">付款方式</label>
              <select id="pay-method" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="bank_transfer">銀行轉帳</option>
                <option value="cash">現金</option>
                <option value="cheque">支票</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500">備註</label>
              <textarea id="pay-notes" rows="2" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="選填"></textarea>
            </div>
            <button id="pay-submit" class="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-2 text-sm font-medium">
              <i class="fas fa-plus mr-1"></i> 新增收款紀錄
            </button>
          </div>
        </div>`
            : ''
        }
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <a href="/quotes/${o.quote_id}" class="text-primary-600 hover:underline text-sm"><i class="fas fa-file-invoice mr-1"></i> 查看來源報價單</a>
        </div>
      </div>
    </div>
  `

  if (canManage) {
    document.getElementById('pay-submit').addEventListener('click', submitPayment)
  }
}

async function submitPayment() {
  const amount = parseFloat(document.getElementById('pay-amount').value)
  if (!amount || amount <= 0) {
    showToast('請輸入正確的收款金額', 'error')
    return
  }
  const payload = {
    amount,
    payment_date: document.getElementById('pay-date').value,
    method: document.getElementById('pay-method').value,
    notes: document.getElementById('pay-notes').value.trim() || null
  }
  const btn = document.getElementById('pay-submit')
  btn.disabled = true
  try {
    await API.post(`/finance/orders/${FinanceDetailOrderId}/payments`, payload)
    showToast('收款紀錄已新增')
    await loadFinanceDetail(FinanceDetailOrderId)
    loadFinanceSummary()
  } catch (err) {
    showToast(err.message, 'error')
    btn.disabled = false
  }
}

async function deletePayment(id) {
  if (!confirm('確定要刪除此筆收款紀錄嗎？')) return
  try {
    await API.delete(`/finance/payments/${id}`)
    showToast('已刪除收款紀錄')
    await loadFinanceDetail(FinanceDetailOrderId)
  } catch (err) {
    showToast(err.message, 'error')
  }
}
