// ============================================================
// 會計申請頁面：任何使用者皆可提交出入帳申請（如報銷、收款申請等）
// manager / admin 另可於「待審批」分頁審核，核准後自動錄入會計管理帳本
// ============================================================
window.Pages = window.Pages || {}

const AR_TYPE_META = {
  income: { label: '收入', color: 'bg-green-100 text-green-700' },
  expense: { label: '支出', color: 'bg-red-100 text-red-700' }
}
const AR_STATUS_META = {
  pending_approval: { label: '待審批', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '已核准', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒絕', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500' }
}

let ARState = { tab: 'mine', page: 1, pageSize: 20, status: '' }
let ARCategories = { income: [], expense: [] }
let ARCache = {}

Pages.accountingRequests = async function () {
  mountLayout('accounting-requests')
  const canApprove = Auth.isManagerUp()
  ARState = { tab: 'mine', page: 1, pageSize: 20, status: '' }

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">會計申請</h1>
        <p class="text-sm text-gray-500 mt-0.5">提交出入帳申請（如報銷、收款申請等），經主管/管理員核准後自動錄入會計管理</p>
      </div>
      <button id="ar-new-btn" class="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
        <i class="fas fa-plus mr-1"></i> 新增申請
      </button>
    </div>

    <div class="flex items-center gap-2 mb-4 border-b border-gray-100">
      <button data-ar-tab="mine" class="ar-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-primary-600 text-primary-600">我的申請</button>
      ${canApprove ? `<button data-ar-tab="pending" class="ar-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">待審批</button>
      <button data-ar-tab="all" class="ar-tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">全部申請</button>` : ''}
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">申請日期</th>
              <th class="px-4 py-3 font-medium text-center">類型</th>
              <th class="px-4 py-3 font-medium">分類</th>
              <th class="px-4 py-3 font-medium text-right">金額</th>
              <th class="px-4 py-3 font-medium">說明</th>
              <th class="px-4 py-3 font-medium">申請人</th>
              <th class="px-4 py-3 font-medium text-center">狀態</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="ar-table-body">
            <tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="ar-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  document.getElementById('ar-new-btn').addEventListener('click', () => openAccountingRequestModal())
  document.querySelectorAll('.ar-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ARState.tab = btn.dataset.arTab
      ARState.page = 1
      document.querySelectorAll('.ar-tab-btn').forEach((b) => {
        b.classList.toggle('border-primary-600', b === btn)
        b.classList.toggle('text-primary-600', b === btn)
        b.classList.toggle('border-transparent', b !== btn)
        b.classList.toggle('text-gray-500', b !== btn)
      })
      loadAccountingRequestList()
    })
  })

  await loadAccountingRequestCategories()
  loadAccountingRequestList()
}

async function loadAccountingRequestCategories() {
  try {
    const res = await API.get('/accounting-requests/categories')
    ARCategories = res.data
  } catch (err) {
    console.error(err)
  }
}

async function loadAccountingRequestList() {
  const tbody = document.getElementById('ar-table-body')
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const params = { scope: ARState.tab, page: ARState.page, page_size: ARState.pageSize }
    const res = await API.get('/accounting-requests', params)
    renderAccountingRequestTable(res.data)
    renderAccountingRequestPagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderAccountingRequestTable(list) {
  const tbody = document.getElementById('ar-table-body')
  if (!tbody) return
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400">尚無申請紀錄</td></tr>`
    return
  }
  ARCache = {}
  list.forEach((r) => { ARCache[r.id] = r })
  const canApprove = Auth.isManagerUp()
  tbody.innerHTML = list
    .map((r) => {
      const typeMeta = AR_TYPE_META[r.request_type] || { label: r.request_type, color: 'bg-gray-100 text-gray-600' }
      const statusMeta = AR_STATUS_META[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-600' }
      const canCancel = r.status === 'pending_approval' && r.requested_by === Auth.getUser()?.id
      const canAct = canApprove && r.status === 'pending_approval' && ARState.tab !== 'mine'
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50">
        <td class="px-4 py-3 text-gray-600">${Fmt.date(r.expected_date)}</td>
        <td class="px-4 py-3 text-center">${statusBadge(typeMeta)}</td>
        <td class="px-4 py-3 text-gray-700">${Fmt.escapeHtml(r.category)}</td>
        <td class="px-4 py-3 text-right font-medium ${r.request_type === 'income' ? 'text-green-600' : 'text-red-500'}">${Fmt.currency(r.amount, 'HKD')}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(r.description || '-')}</td>
        <td class="px-4 py-3 text-gray-400">${Fmt.escapeHtml(r.requester_name || '-')}</td>
        <td class="px-4 py-3 text-center">${statusBadge(statusMeta)}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button onclick="viewAccountingRequestDetail(${r.id})" class="text-primary-600 hover:underline text-xs mr-2">詳情</button>
          ${canCancel ? `<button onclick="cancelAccountingRequest(${r.id})" class="text-gray-400 hover:text-gray-600 text-xs mr-2">取消</button>` : ''}
          ${canAct ? `<button onclick="approveAccountingRequest(${r.id})" class="text-green-600 hover:underline text-xs mr-2">核准</button>
          <button onclick="rejectAccountingRequest(${r.id})" class="text-red-500 hover:underline text-xs">拒絕</button>` : ''}
        </td>
      </tr>`
    })
    .join('')
}

function renderAccountingRequestPagination(p) {
  const el = document.getElementById('ar-pagination')
  if (!el) return
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeAccountingRequestPage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeAccountingRequestPage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeAccountingRequestPage(page) {
  ARState.page = page
  loadAccountingRequestList()
}

function openAccountingRequestModal() {
  const categoryOptions = (type) =>
    (ARCategories[type] || []).map((cat) => `<option value="${Fmt.escapeHtml(cat)}">${Fmt.escapeHtml(cat)}</option>`).join('')

  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">新增會計申請</h3>
      <div class="space-y-3">
        <div>
          <label class="text-xs text-gray-500">類型</label>
          <select id="ar-form-type" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="expense" selected>支出</option>
            <option value="income">收入</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500">分類</label>
          <select id="ar-form-category" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"></select>
        </div>
        <div>
          <label class="text-xs text-gray-500">金額</label>
          <input id="ar-form-amount" type="number" min="0" step="0.01" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
        </div>
        <div>
          <label class="text-xs text-gray-500">預計日期</label>
          <input id="ar-form-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-gray-500">收款人/入帳名稱</label>
          <input id="ar-form-counterparty" type="text" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="選填" />
        </div>
        <div>
          <label class="text-xs text-gray-500">說明</label>
          <textarea id="ar-form-desc" rows="2" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="請說明申請原因，方便審批人員審核"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
        <button id="ar-form-submit" class="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg">送出申請</button>
      </div>
    </div>
  `)

  const typeSel = document.getElementById('ar-form-type')
  const refreshCategoryOptions = () => {
    document.getElementById('ar-form-category').innerHTML = categoryOptions(typeSel.value)
  }
  typeSel.addEventListener('change', refreshCategoryOptions)
  refreshCategoryOptions()

  document.getElementById('ar-form-submit').addEventListener('click', async () => {
    const payload = {
      request_type: typeSel.value,
      category: document.getElementById('ar-form-category').value,
      amount: parseFloat(document.getElementById('ar-form-amount').value),
      expected_date: document.getElementById('ar-form-date').value,
      counterparty_name: document.getElementById('ar-form-counterparty').value.trim() || null,
      description: document.getElementById('ar-form-desc').value.trim() || null
    }
    if (!payload.amount || payload.amount <= 0) {
      showToast('請輸入正確的金額', 'error')
      return
    }
    try {
      await API.post('/accounting-requests', payload)
      showToast('申請已送出，等待審批')
      closeModal()
      loadAccountingRequestList()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

function viewAccountingRequestDetail(id) {
  const r = ARCache[id]
  if (!r) return
  const typeMeta = AR_TYPE_META[r.request_type] || { label: r.request_type, color: 'bg-gray-100 text-gray-600' }
  const statusMeta = AR_STATUS_META[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-600' }
  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">申請詳情 #${r.id}</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-gray-400">類型</span>${statusBadge(typeMeta)}</div>
        <div class="flex justify-between"><span class="text-gray-400">狀態</span>${statusBadge(statusMeta)}</div>
        <div class="flex justify-between"><span class="text-gray-400">分類</span><span class="text-gray-700">${Fmt.escapeHtml(r.category)}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">金額</span><span class="font-medium ${r.request_type === 'income' ? 'text-green-600' : 'text-red-500'}">${Fmt.currency(r.amount, 'HKD')}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">預計日期</span><span class="text-gray-700">${Fmt.date(r.expected_date)}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">收款人/入帳名稱</span><span class="text-gray-700">${Fmt.escapeHtml(r.counterparty_name || '-')}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">申請人</span><span class="text-gray-700">${Fmt.escapeHtml(r.requester_name || '-')}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">申請時間</span><span class="text-gray-700">${Fmt.datetime(r.created_at)}</span></div>
        ${r.approver_name ? `<div class="flex justify-between"><span class="text-gray-400">審批人</span><span class="text-gray-700">${Fmt.escapeHtml(r.approver_name)}</span></div>` : ''}
        ${r.approved_at ? `<div class="flex justify-between"><span class="text-gray-400">核准時間</span><span class="text-gray-700">${Fmt.datetime(r.approved_at)}</span></div>` : ''}
        ${r.rejected_reason ? `<div class="pt-1"><span class="text-gray-400">拒絕原因</span><p class="text-red-500 mt-1">${Fmt.escapeHtml(r.rejected_reason)}</p></div>` : ''}
        ${r.description ? `<div class="pt-1"><span class="text-gray-400">說明</span><p class="text-gray-700 mt-1">${Fmt.escapeHtml(r.description)}</p></div>` : ''}
        ${r.entry_id ? `<div class="flex justify-between"><span class="text-gray-400">會計帳目編號</span><span class="text-gray-700">#${r.entry_id}</span></div>` : ''}
      </div>
      <div class="flex justify-end mt-5">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">關閉</button>
      </div>
    </div>
  `)
}

async function cancelAccountingRequest(id) {
  if (!confirm('確定要取消此申請嗎？')) return
  try {
    await API.post(`/accounting-requests/${id}/cancel`)
    showToast('申請已取消')
    loadAccountingRequestList()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

async function approveAccountingRequest(id) {
  if (!confirm('確定要核准此申請嗎？核准後將自動錄入會計管理帳本。')) return
  try {
    await API.post(`/accounting-requests/${id}/approve`)
    showToast('已核准並錄入會計管理')
    loadAccountingRequestList()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

async function rejectAccountingRequest(id) {
  const reason = prompt('請輸入拒絕原因：')
  if (!reason || !reason.trim()) {
    if (reason !== null) showToast('請填寫拒絕原因', 'error')
    return
  }
  try {
    await API.post(`/accounting-requests/${id}/reject`, { reason: reason.trim() })
    showToast('已拒絕此申請')
    loadAccountingRequestList()
  } catch (err) {
    showToast(err.message, 'error')
  }
}
