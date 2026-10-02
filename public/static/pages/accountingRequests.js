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

// 新增申請表單暫存待上傳的附件（送出申請後才一併上傳，取得 request_id）
let ARPendingFiles = []

const AR_ATTACHMENT_ICON_MAP = {
  pdf: 'fa-file-pdf text-red-500',
  png: 'fa-file-image text-blue-400',
  jpg: 'fa-file-image text-blue-400',
  jpeg: 'fa-file-image text-blue-400',
  doc: 'fa-file-word text-blue-600',
  docx: 'fa-file-word text-blue-600',
  xls: 'fa-file-excel text-green-600',
  xlsx: 'fa-file-excel text-green-600'
}
const AR_ALLOWED_ATTACHMENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']

function arAttachmentIcon(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  return AR_ATTACHMENT_ICON_MAP[ext] || 'fa-file text-gray-400'
}

function arFormatFileSize(bytes) {
  const n = Number(bytes || 0)
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

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

  ARPendingFiles = []

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
        <div>
          <label class="text-xs text-gray-500">附件/截圖 <span class="text-red-500">*必填</span></label>
          <label class="mt-1 flex items-center justify-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-500 cursor-pointer hover:border-primary-400 hover:text-primary-600">
            <i class="fas fa-paperclip"></i>
            <span>點擊選擇憑證/收據/截圖（可多選）</span>
            <input type="file" id="ar-form-file-input" class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png" />
          </label>
          <p class="text-[11px] text-gray-400 mt-1">僅支援 Word、Excel、PDF、JPEG、PNG 檔案，單檔大小上限 20MB，須至少上傳一張憑證/截圖才可核准</p>
          <div id="ar-form-file-list" class="mt-2 space-y-1.5"></div>
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

  const renderPendingFileList = () => {
    const el = document.getElementById('ar-form-file-list')
    if (!el) return
    el.innerHTML = ARPendingFiles
      .map(
        (f, idx) => `
      <div class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-gray-50 text-sm">
        <span class="flex items-center gap-2 min-w-0 flex-1 text-gray-700">
          <i class="fas ${arAttachmentIcon(f.name)}"></i>
          <span class="truncate">${Fmt.escapeHtml(f.name)}</span>
          <span class="text-xs text-gray-400 shrink-0">${arFormatFileSize(f.size)}</span>
        </span>
        <button type="button" data-remove-idx="${idx}" class="ar-form-file-remove text-gray-400 hover:text-red-600 shrink-0"><i class="fas fa-times"></i></button>
      </div>`
      )
      .join('')
    el.querySelectorAll('.ar-form-file-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        ARPendingFiles.splice(parseInt(btn.dataset.removeIdx), 1)
        renderPendingFileList()
      })
    })
  }

  document.getElementById('ar-form-file-input').addEventListener('change', (e) => {
    const files = Array.from(e.target.files || [])
    const MAX_SIZE = 20 * 1024 * 1024
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      if (!AR_ALLOWED_ATTACHMENT_EXTS.includes(ext)) {
        showToast(`「${f.name}」僅支援 Word、Excel、PDF、JPEG、PNG 檔案`, 'error')
        continue
      }
      if (f.size > MAX_SIZE) {
        showToast(`「${f.name}」檔案大小不可超過 20MB`, 'error')
        continue
      }
      ARPendingFiles.push(f)
    }
    e.target.value = ''
    renderPendingFileList()
  })

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
    if (!ARPendingFiles.length) {
      showToast('請至少上傳一張憑證/收據/截圖作為附件', 'error')
      return
    }
    const submitBtn = document.getElementById('ar-form-submit')
    submitBtn.disabled = true
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i>送出中...`
    try {
      const res = await API.post('/accounting-requests', payload)
      const requestId = res.data.id
      const token = Auth.getToken()
      for (const file of ARPendingFiles) {
        const form = new FormData()
        form.append('file', file)
        const resp = await fetch(`/api/accounting-requests/${requestId}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form
        })
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok || !json.success) throw new Error(json.error || '附件上傳失敗')
      }
      showToast('申請已送出，等待審批')
      closeModal()
      loadAccountingRequestList()
    } catch (err) {
      showToast(err.message, 'error')
      submitBtn.disabled = false
      submitBtn.innerHTML = '送出申請'
    }
  })
}

function viewAccountingRequestDetail(id) {
  const r = ARCache[id]
  if (!r) return
  const typeMeta = AR_TYPE_META[r.request_type] || { label: r.request_type, color: 'bg-gray-100 text-gray-600' }
  const statusMeta = AR_STATUS_META[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-600' }
  const canUpload = r.status === 'pending_approval'
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

      <div class="mt-4 pt-4 border-t border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-semibold text-gray-700"><i class="fas fa-paperclip mr-1.5 text-gray-400"></i>附件/截圖</h4>
          ${canUpload ? `<label class="text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg cursor-pointer">
            <i class="fas fa-upload mr-1"></i>補充上傳
            <input type="file" id="ar-detail-file-input" class="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png" />
          </label>` : ''}
        </div>
        <div id="ar-detail-attachments-list" class="space-y-2">
          <p class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>載入中...</p>
        </div>
      </div>

      <div class="flex justify-end mt-5">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">關閉</button>
      </div>
    </div>
  `)

  const fileInput = document.getElementById('ar-detail-file-input')
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0]
      if (file) uploadAccountingRequestAttachment(r.id, file)
      fileInput.value = ''
    })
  }
  loadAccountingRequestAttachments(r.id)
}

async function loadAccountingRequestAttachments(requestId) {
  const el = document.getElementById('ar-detail-attachments-list')
  if (!el) return
  try {
    const res = await API.get(`/accounting-requests/${requestId}/attachments`)
    renderAccountingRequestAttachments(requestId, res.data)
  } catch (err) {
    el.innerHTML = `<p class="text-xs text-red-400">${Fmt.escapeHtml(err.message)}</p>`
  }
}

function renderAccountingRequestAttachments(requestId, attachments) {
  const el = document.getElementById('ar-detail-attachments-list')
  if (!el) return
  const r = ARCache[requestId]
  const user = Auth.getUser()
  if (!attachments || attachments.length === 0) {
    el.innerHTML = `<p class="text-xs text-gray-400">尚未上傳任何附件</p>`
    return
  }
  el.innerHTML = attachments
    .map((a) => {
      const canDelete = r && r.status === 'pending_approval' && (Auth.isManagerUp() || (user && user.id === a.uploaded_by))
      return `
    <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100">
      <button data-att-id="${a.id}" data-att-name="${Fmt.escapeHtml(a.file_name)}" class="ar-att-download flex items-center gap-2.5 min-w-0 flex-1 text-sm text-gray-700 hover:text-primary-600 text-left">
        <i class="fas ${arAttachmentIcon(a.file_name)}"></i>
        <span class="truncate">${Fmt.escapeHtml(a.file_name)}</span>
        <span class="text-xs text-gray-400 shrink-0">${arFormatFileSize(a.file_size)}</span>
      </button>
      <div class="flex items-center gap-2 shrink-0 text-xs text-gray-400">
        <span>${Fmt.escapeHtml(a.uploaded_by_name)} · ${Fmt.datetime(a.created_at)}</span>
        ${canDelete ? `<button data-att-id="${a.id}" class="ar-att-delete text-gray-400 hover:text-red-600 px-1"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>`
    })
    .join('')

  el.querySelectorAll('.ar-att-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteAccountingRequestAttachment(requestId, btn.dataset.attId))
  })
  el.querySelectorAll('.ar-att-download').forEach((btn) => {
    btn.addEventListener('click', () => downloadAccountingRequestAttachment(requestId, btn.dataset.attId, btn.dataset.attName))
  })
}

async function downloadAccountingRequestAttachment(requestId, attId, fileName) {
  try {
    const token = Auth.getToken()
    const resp = await fetch(`/api/accounting-requests/${requestId}/attachments/${attId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error('下載失敗')
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'attachment'
    a.setAttribute('data-external', 'true')
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    showToast(err.message || '下載失敗', 'error')
  }
}

async function uploadAccountingRequestAttachment(requestId, file) {
  const MAX_SIZE = 20 * 1024 * 1024
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!AR_ALLOWED_ATTACHMENT_EXTS.includes(ext)) {
    showToast('僅支援 Word、Excel、PDF、JPEG、PNG 檔案', 'error')
    return
  }
  if (file.size > MAX_SIZE) {
    showToast('檔案大小不可超過 20MB', 'error')
    return
  }
  const el = document.getElementById('ar-detail-attachments-list')
  const prevHtml = el ? el.innerHTML : ''
  if (el) el.innerHTML = `<p class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>上傳中...</p>`
  try {
    const form = new FormData()
    form.append('file', file)
    const token = Auth.getToken()
    const resp = await fetch(`/api/accounting-requests/${requestId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok || !json.success) throw new Error(json.error || '上傳失敗')
    showToast('附件上傳成功')
    loadAccountingRequestAttachments(requestId)
  } catch (err) {
    if (el) el.innerHTML = prevHtml
    showToast(err.message || '上傳失敗', 'error')
  }
}

async function deleteAccountingRequestAttachment(requestId, attId) {
  if (!confirm('確定要刪除此附件嗎？')) return
  try {
    await API.delete(`/accounting-requests/${requestId}/attachments/${attId}`)
    showToast('附件已刪除')
    loadAccountingRequestAttachments(requestId)
  } catch (err) {
    showToast(err.message || '刪除失敗', 'error')
  }
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
