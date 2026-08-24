// ============================================================
// 報價詳情頁：完整內容顯示、審批操作、狀態時間軸、PDF匯出
// ============================================================
window.Pages = window.Pages || {}

const ACTION_LABELS = {
  submit: '送出審核',
  approve: '核准',
  reject: '拒絕',
  send: '標記已寄出',
  win: '標記成交',
  lose: '標記流失',
  revise: '修訂'
}

const ACTION_ICONS = {
  submit: 'fa-paper-plane',
  approve: 'fa-circle-check',
  reject: 'fa-circle-xmark',
  send: 'fa-envelope-circle-check',
  win: 'fa-trophy',
  lose: 'fa-circle-minus',
  revise: 'fa-pen'
}

let QuoteDetailData = null

// 依「工程分類」將報價/發票項目分組，並計算各組小計（順序依 PRODUCT_CATEGORIES 排列，
// 未填分類的項目歸入「其他項目」置於最後），供頁面預覽及 PDF 匯出共用同一分組邏輯
function groupQuoteItemsByCategory(items) {
  const order = (typeof PRODUCT_CATEGORIES !== 'undefined' ? PRODUCT_CATEGORIES : [])
  const groupMap = new Map()
  items.forEach((it) => {
    const key = (it.category && it.category.trim()) || '其他項目'
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key).push(it)
  })
  const orderedKeys = [...order.filter((c) => groupMap.has(c)), ...[...groupMap.keys()].filter((k) => !order.includes(k))]
  return orderedKeys.map((category) => {
    const groupItems = groupMap.get(category)
    const subtotal = groupItems.reduce((sum, it) => sum + Number(it.line_total || 0), 0)
    return { category, items: groupItems, subtotal }
  })
}

Pages.quoteDetail = async function (id) {
  mountLayout('quotes')
  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    const res = await API.get(`/quotes/${id}`)
    QuoteDetailData = res.data
    renderQuoteDetail(QuoteDetailData)
  } catch (err) {
    setMainContent(`
      <div class="text-center py-20">
        <p class="text-red-400 mb-3">${err.message}</p>
        <a href="/quotes" class="text-primary-600 hover:underline text-sm">回報價列表</a>
      </div>`)
  }
}

function renderQuoteDetail(q) {
  const meta = QuoteStatusMeta[q.status] || { label: q.status, color: 'bg-gray-100 text-gray-600' }
  const canEdit = ['draft', 'rejected'].includes(q.status) &&
    (Auth.isManagerUp() || (Auth.getUser() && Auth.getUser().id === q.owner_id))
  const isOwnerOrAbove = Auth.isManagerUp() || (Auth.getUser() && Auth.getUser().id === q.owner_id)

  setMainContent(`
    <div class="max-w-5xl mx-auto">
      <div class="flex items-start justify-between mb-5">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-800">${Fmt.escapeHtml(q.quote_no)}</h1>
            ${statusBadge(meta)}
          </div>
          <p class="text-sm text-gray-500 mt-1">${Fmt.escapeHtml(q.title || '')}</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="qd-export-pdf" class="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3.5 py-2 rounded-lg">
            <i class="fas fa-file-pdf mr-1.5 text-red-500"></i>匯出報價PDF
          </button>
          ${['approved', 'sent', 'won'].includes(q.status) ? `
          <button id="qd-export-invoice" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg">
            <i class="fas fa-file-invoice mr-1.5"></i>匯出發票PDF
          </button>` : ''}
          ${canEdit ? `<a href="/quotes/${q.id}/edit" class="bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 text-sm font-medium px-3.5 py-2 rounded-lg">
            <i class="fas fa-pen mr-1.5"></i>編輯
          </a>` : ''}
          <a href="/quotes" class="text-sm text-gray-500 hover:text-gray-700 px-2"><i class="fas fa-arrow-left mr-1"></i>返回</a>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 主要內容 -->
        <div class="lg:col-span-2 space-y-6">
          <!-- 客戶資訊 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-3">客戶資訊</h2>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-400 text-xs">客戶名稱</p>
                <a href="/customers/${q.customer_id}" class="text-primary-600 hover:underline font-medium">${Fmt.escapeHtml(q.company_name)}</a>
              </div>
              <div>
                <p class="text-gray-400 text-xs">聯絡人</p>
                <p class="text-gray-700">${q.contact ? Fmt.escapeHtml(q.contact.name) + (q.contact.phone ? ' · ' + Fmt.escapeHtml(q.contact.phone) : '') : '未指定'}</p>
              </div>
              <div class="col-span-2">
                <p class="text-gray-400 text-xs">工程地址</p>
                <p class="text-gray-700">${Fmt.escapeHtml(q.site_address || q.customer_address || '未填寫')}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">負責業務</p>
                <p class="text-gray-700">${Fmt.escapeHtml(q.owner_name)}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">有效期限</p>
                <p class="text-gray-700">${Fmt.date(q.valid_until)}</p>
              </div>
            </div>
          </div>

          <!-- 報價明細 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-3">報價明細</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm table-fixed">
                <colgroup>
                  <col style="width:5%" />
                  <col style="width:10%" />
                  <col style="width:50%" />
                  <col style="width:7%" />
                  <col style="width:7%" />
                  <col style="width:10%" />
                  <col style="width:5%" />
                  <col style="width:6%" />
                </colgroup>
                <thead>
                  <tr class="text-left text-gray-400 border-b border-gray-100">
                    <th class="py-2 font-medium">#</th>
                    <th class="py-2 font-medium">位置</th>
                    <th class="py-2 font-medium">項目</th>
                    <th class="py-2 font-medium text-right">數量</th>
                    <th class="py-2 font-medium text-right">單位</th>
                    <th class="py-2 font-medium text-right">單價</th>
                    <th class="py-2 font-medium text-right">折扣</th>
                    <th class="py-2 font-medium text-right">小計</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    let seqIdx = 0
                    return groupQuoteItemsByCategory(q.items).map((group) => `
                  <tr class="bg-gray-50">
                    <td colspan="8" class="py-2 px-1 font-semibold text-gray-700 text-xs">${Fmt.escapeHtml(categoryHeaderWithLetter(group.category))}</td>
                  </tr>
                  ${group.items.map((it) => {
                    seqIdx += 1
                    return `
                  <tr class="border-b border-gray-50">
                    <td class="py-2.5 text-gray-400">${seqIdx}</td>
                    <td class="py-2.5 text-gray-600 text-xs">${Fmt.escapeHtml(it.location || '-')}</td>
                    <td class="py-2.5">
                      <p class="text-gray-800">${Fmt.escapeHtml(it.item_name)}</p>
                      ${it.description ? `<p class="text-xs text-gray-400">${Fmt.escapeHtml(it.description)}</p>` : ''}
                    </td>
                    <td class="py-2.5 text-right text-gray-600">${it.quantity}</td>
                    <td class="py-2.5 text-right text-gray-600">${Fmt.escapeHtml(it.unit)}</td>
                    <td class="py-2.5 text-right text-gray-600">${Number(it.unit_price).toLocaleString()}</td>
                    <td class="py-2.5 text-right text-gray-600">${it.discount_pct ? it.discount_pct + '%' : '-'}</td>
                    <td class="py-2.5 text-right font-medium text-gray-800">${Number(it.line_total).toLocaleString()}</td>
                  </tr>`}).join('')}
                  <tr class="border-b border-gray-100">
                    <td colspan="7" class="py-1.5 px-1 text-right text-xs text-gray-500">Sub-total 小計</td>
                    <td class="py-1.5 text-right text-xs font-semibold text-gray-700">${group.subtotal.toLocaleString()}</td>
                  </tr>`).join('')
                  })()}
                </tbody>
              </table>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <div class="w-64 space-y-1.5 text-sm">
                <div class="flex justify-between text-gray-500"><span>未稅小計</span><span>${Fmt.currency(q.subtotal, q.currency)}</span></div>
                ${q.discount_value ? `<div class="flex justify-between text-gray-500"><span>整單折扣${q.discount_type === 'percent' ? '(' + q.discount_value + '%)' : ''}</span><span>-${q.discount_type === 'percent' ? '' : Fmt.currency(q.discount_value, q.currency)}${q.discount_type === 'percent' ? q.discount_value + '%' : ''}</span></div>` : ''}
                ${q.tax_amount ? `<div class="flex justify-between text-gray-500"><span>稅額 (${(q.tax_rate * 100).toFixed(0)}%)</span><span>${Fmt.currency(q.tax_amount, q.currency)}</span></div>` : ''}
                <div class="flex justify-between font-bold text-gray-800 text-base pt-1.5 border-t border-gray-100"><span>總金額</span><span>${Fmt.currency(q.total_amount, q.currency)}</span></div>
              </div>
            </div>
          </div>

          <!-- 附件（圖紙等檔案） -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-700"><i class="fas fa-paperclip mr-1.5 text-gray-400"></i>附件（圖紙等檔案）</h2>
              <label class="text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg cursor-pointer">
                <i class="fas fa-upload mr-1"></i>上傳附件
                <input type="file" id="qd-attachment-input" class="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png" />
              </label>
            </div>
            <p class="text-[11px] text-gray-400 -mt-2 mb-2">僅支援 Word、Excel、PDF、JPEG、PNG 檔案，大小上限 20MB</p>
            <div id="qd-attachments-list" class="space-y-2">
              <p class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>載入中...</p>
            </div>

            ${['approved', 'sent', 'won'].includes(q.status) ? `
            <div class="mt-4 pt-4 border-t border-gray-100">
              <h3 class="text-xs font-semibold text-gray-600 mb-1.5"><i class="fas fa-file-invoice mr-1 text-gray-400"></i>發票備註</h3>
              <p class="text-[11px] text-gray-400 mb-2">匯出發票PDF時將顯示此備註，取代報價單原有的條款/付款方式（選填）</p>
              <textarea id="qd-invoice-remark-input" rows="3" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="例：付款方式、匯款備註等">${Fmt.escapeHtml(q.invoice_remark || '')}</textarea>
              <div class="flex justify-end mt-2">
                <button id="qd-invoice-remark-save" class="text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg">
                  <i class="fas fa-save mr-1"></i>儲存備註
                </button>
              </div>
            </div>` : ''}
          </div>

          ${q.terms ? `
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-2">條款/付款方式</h2>
            <p class="text-sm text-gray-600 whitespace-pre-line">${Fmt.escapeHtml(q.terms)}</p>
          </div>` : ''}

          ${q.notes ? `
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-2">內部備註</h2>
            <p class="text-sm text-gray-600 whitespace-pre-line">${Fmt.escapeHtml(q.notes)}</p>
          </div>` : ''}

          ${q.status === 'rejected' && q.rejected_reason ? `
          <div class="bg-red-50 border border-red-100 rounded-xl p-5">
            <h2 class="text-sm font-semibold text-red-700 mb-2"><i class="fas fa-circle-exclamation mr-1"></i>拒絕原因</h2>
            <p class="text-sm text-red-600">${Fmt.escapeHtml(q.rejected_reason)}</p>
          </div>` : ''}
        </div>

        <!-- 側邊：操作 + 時間軸 -->
        <div class="space-y-6">
          <!-- 審批操作 -->
          <div id="qd-actions" class="bg-white rounded-xl border border-gray-100 shadow-sm p-5"></div>

          <!-- 狀態時間軸 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-4">審批歷程</h2>
            <div class="space-y-4">
              ${q.logs.length === 0 ? '<p class="text-xs text-gray-400">尚無操作紀錄</p>' : q.logs.map((log, idx) => `
              <div class="flex gap-3">
                <div class="flex flex-col items-center">
                  <div class="w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs shrink-0">
                    <i class="fas ${ACTION_ICONS[log.action] || 'fa-circle'}"></i>
                  </div>
                  ${idx < q.logs.length - 1 ? '<div class="w-px flex-1 bg-gray-100 my-1"></div>' : ''}
                </div>
                <div class="pb-1">
                  <p class="text-sm text-gray-700 font-medium">${ACTION_LABELS[log.action] || log.action}</p>
                  <p class="text-xs text-gray-400 mt-0.5">${Fmt.escapeHtml(log.user_name)} · ${Fmt.datetime(log.created_at)}</p>
                  ${log.comment ? `<p class="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-2">${Fmt.escapeHtml(log.comment)}</p>` : ''}
                </div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `)

  renderQuoteActions(q, isOwnerOrAbove)
  bindQuoteDetailEvents(q)
}

function renderQuoteActions(q, isOwnerOrAbove) {
  const el = document.getElementById('qd-actions')
  const isManagerUp = Auth.isManagerUp()
  let html = '<h2 class="text-sm font-semibold text-gray-700 mb-3">操作</h2><div class="space-y-2">'

  switch (q.status) {
    case 'draft':
      if (isOwnerOrAbove) {
        html += actionBtn('qd-act-submit', 'bg-primary-600 hover:bg-primary-700 text-white', 'fa-paper-plane', '送出審核')
      } else {
        html += emptyActionNote()
      }
      break
    case 'pending_approval':
      if (isManagerUp) {
        html += actionBtn('qd-act-approve', 'bg-green-600 hover:bg-green-700 text-white', 'fa-circle-check', '核准')
        html += actionBtn('qd-act-reject', 'bg-white border border-red-300 text-red-600 hover:bg-red-50', 'fa-circle-xmark', '拒絕')
      } else {
        html += `<p class="text-xs text-gray-400 flex items-center gap-2"><i class="fas fa-hourglass-half"></i>等待主管審核中</p>`
      }
      break
    case 'approved':
      if (isOwnerOrAbove) {
        html += actionBtn('qd-act-send', 'bg-primary-600 hover:bg-primary-700 text-white', 'fa-envelope-circle-check', '標記已寄出')
        html += actionBtn('qd-act-lose', 'bg-white border border-gray-300 text-gray-500 hover:bg-gray-50', 'fa-circle-minus', '標記流失')
      } else {
        html += emptyActionNote()
      }
      break
    case 'sent':
      if (isOwnerOrAbove) {
        html += actionBtn('qd-act-win', 'bg-green-600 hover:bg-green-700 text-white', 'fa-trophy', '標記成交')
        html += actionBtn('qd-act-lose', 'bg-white border border-gray-300 text-gray-500 hover:bg-gray-50', 'fa-circle-minus', '標記流失')
      } else {
        html += emptyActionNote()
      }
      break
    case 'rejected':
      if (isOwnerOrAbove) {
        html += `<a href="/quotes/${q.id}/edit" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white"><i class="fas fa-pen"></i>修訂並重新送審</a>`
      } else {
        html += emptyActionNote()
      }
      break
    case 'won':
      html += `<p class="text-sm text-green-600 flex items-center gap-2"><i class="fas fa-circle-check"></i>已成交，訂單已建立</p>`
      break
    case 'lost':
      html += `<p class="text-sm text-gray-400 flex items-center gap-2"><i class="fas fa-circle-minus"></i>此報價單已標記為流失</p>`
      break
  }

  html += '</div>'
  el.innerHTML = html
}

function actionBtn(id, cls, icon, label) {
  return `<button id="${id}" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${cls}"><i class="fas ${icon}"></i>${label}</button>`
}

function emptyActionNote() {
  return `<p class="text-xs text-gray-400">目前無可執行操作</p>`
}

function bindQuoteDetailEvents(q) {
  const bind = (id, handler) => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('click', handler)
  }

  bind('qd-act-submit', () => runQuoteAction(q.id, 'submit', '確定要送出此報價單審核嗎？'))
  bind('qd-act-approve', () => runQuoteAction(q.id, 'approve', '確定要核准此報價單嗎？'))
  bind('qd-act-reject', () => runQuoteRejectAction(q.id))
  bind('qd-act-send', () => runQuoteAction(q.id, 'send', '確認已將此報價單寄送給客戶？'))
  bind('qd-act-win', () => runQuoteAction(q.id, 'win', '確定標記此報價單為成交？系統將自動建立訂單。'))
  bind('qd-act-lose', () => runQuoteAction(q.id, 'lose', '確定要將此報價單標記為流失嗎？'))
  bind('qd-export-pdf', () => exportQuotePdf(q))
  bind('qd-export-invoice', () => exportInvoicePdf(q))
  bind('qd-invoice-remark-save', () => saveInvoiceRemark(q))

  const fileInput = document.getElementById('qd-attachment-input')
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0]
      if (file) uploadQuoteAttachment(q.id, file)
      fileInput.value = ''
    })
  }
  loadQuoteAttachments(q.id)
}

// ============================================================
// 附件（圖紙等檔案）
// ============================================================
const ATTACHMENT_ICON_MAP = {
  pdf: 'fa-file-pdf text-red-500',
  png: 'fa-file-image text-blue-400',
  jpg: 'fa-file-image text-blue-400',
  jpeg: 'fa-file-image text-blue-400',
  doc: 'fa-file-word text-blue-600',
  docx: 'fa-file-word text-blue-600',
  xls: 'fa-file-excel text-green-600',
  xlsx: 'fa-file-excel text-green-600'
}

// 允許上傳的副檔名（Word / Excel / PDF / JPEG / PNG）
const ALLOWED_ATTACHMENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']

function attachmentIcon(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  return ATTACHMENT_ICON_MAP[ext] || 'fa-file text-gray-400'
}

function formatFileSize(bytes) {
  const n = Number(bytes || 0)
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

async function loadQuoteAttachments(quoteId) {
  const el = document.getElementById('qd-attachments-list')
  if (!el) return
  try {
    const res = await API.get(`/quotes/${quoteId}/attachments`)
    renderQuoteAttachments(quoteId, res.data)
  } catch (err) {
    el.innerHTML = `<p class="text-xs text-red-400">${Fmt.escapeHtml(err.message)}</p>`
  }
}

function renderQuoteAttachments(quoteId, attachments) {
  const el = document.getElementById('qd-attachments-list')
  if (!el) return
  const user = Auth.getUser()
  if (!attachments || attachments.length === 0) {
    el.innerHTML = `<p class="text-xs text-gray-400">尚未上傳任何附件</p>`
    return
  }
  el.innerHTML = attachments
    .map((a) => {
      const canDelete = Auth.isManagerUp() || (user && user.id === a.uploaded_by)
      return `
    <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100">
      <button data-att-id="${a.id}" data-att-name="${Fmt.escapeHtml(a.file_name)}" class="qd-att-download flex items-center gap-2.5 min-w-0 flex-1 text-sm text-gray-700 hover:text-primary-600 text-left">
        <i class="fas ${attachmentIcon(a.file_name)}"></i>
        <span class="truncate">${Fmt.escapeHtml(a.file_name)}</span>
        <span class="text-xs text-gray-400 shrink-0">${formatFileSize(a.file_size)}</span>
      </button>
      <div class="flex items-center gap-2 shrink-0 text-xs text-gray-400">
        <span>${Fmt.escapeHtml(a.uploaded_by_name)} · ${Fmt.datetime(a.created_at)}</span>
        ${canDelete ? `<button data-att-id="${a.id}" class="qd-att-delete text-gray-400 hover:text-red-600 px-1"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>`
    })
    .join('')

  el.querySelectorAll('.qd-att-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteQuoteAttachment(quoteId, btn.dataset.attId))
  })
  el.querySelectorAll('.qd-att-download').forEach((btn) => {
    btn.addEventListener('click', () => downloadQuoteAttachment(quoteId, btn.dataset.attId, btn.dataset.attName))
  })
}

async function downloadQuoteAttachment(quoteId, attId, fileName) {
  try {
    const token = Auth.getToken()
    const resp = await fetch(`/api/quotes/${quoteId}/attachments/${attId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error('下載失敗')
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'attachment'
    // 標記為外部連結，避免被 SPA 前端路由（main.js 的全域 click 攔截器）攔截，
    // 否則 preventDefault() 會擋掉下載，且 blob: 網址會被誤判為站內路徑導致跳轉到 404
    a.setAttribute('data-external', 'true')
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    showToast(err.message || '下載失敗', 'error')
  }
}

async function uploadQuoteAttachment(quoteId, file) {
  const MAX_SIZE = 20 * 1024 * 1024
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_ATTACHMENT_EXTS.includes(ext)) {
    showToast('僅支援 Word、Excel、PDF、JPEG、PNG 檔案', 'error')
    return
  }
  if (file.size > MAX_SIZE) {
    showToast('檔案大小不可超過 20MB', 'error')
    return
  }
  const el = document.getElementById('qd-attachments-list')
  const prevHtml = el ? el.innerHTML : ''
  if (el) el.innerHTML = `<p class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>上傳中...</p>`
  try {
    const form = new FormData()
    form.append('file', file)
    const token = Auth.getToken()
    const resp = await fetch(`/api/quotes/${quoteId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok || !json.success) throw new Error(json.error || '上傳失敗')
    showToast('附件上傳成功')
    loadQuoteAttachments(quoteId)
  } catch (err) {
    if (el) el.innerHTML = prevHtml
    showToast(err.message || '上傳失敗', 'error')
  }
}

async function deleteQuoteAttachment(quoteId, attId) {
  if (!confirm('確定要刪除此附件嗎？')) return
  try {
    await API.delete(`/quotes/${quoteId}/attachments/${attId}`)
    showToast('附件已刪除')
    loadQuoteAttachments(quoteId)
  } catch (err) {
    showToast(err.message || '刪除失敗', 'error')
  }
}

// 儲存發票備註（僅已核准/已寄出/已成交狀態可填寫，位於附件區塊下方），
// 儲存後匯出發票PDF會直接套用此備註，取代報價單的固定條款/付款方式
async function saveInvoiceRemark(q) {
  const input = document.getElementById('qd-invoice-remark-input')
  if (!input) return
  const btn = document.getElementById('qd-invoice-remark-save')
  const originalHtml = btn ? btn.innerHTML : ''
  if (btn) {
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>儲存中...'
  }
  try {
    const remark = input.value.trim() || null
    await API.put(`/quotes/${q.id}/invoice-remark`, { invoice_remark: remark })
    q.invoice_remark = remark
    if (QuoteDetailData) QuoteDetailData.invoice_remark = remark
    showToast('發票備註已儲存')
  } catch (err) {
    showToast(err.message || '儲存失敗', 'error')
  } finally {
    if (btn) {
      btn.disabled = false
      btn.innerHTML = originalHtml
    }
  }
}

async function runQuoteAction(id, action, confirmMsg, payload) {
  if (confirmMsg && !confirm(confirmMsg)) return
  try {
    await API.post(`/quotes/${id}/${action}`, payload || {})
    showToast('操作成功')
    Pages.quoteDetail(id)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function runQuoteRejectAction(id) {
  const reason = prompt('請輸入拒絕原因：')
  if (reason === null) return
  if (!reason.trim()) {
    showToast('請填寫拒絕原因', 'error')
    return
  }
  runQuoteAction(id, 'reject', null, { reason: reason.trim() })
}

// ============================================================
// PDF 匯出：以 HTML/CSS 版面 + html2canvas 轉圖 + jsPDF 拼頁
// （改用瀏覽器原生字型渲染，避免 jsPDF 內建字型不支援中文而產生亂碼）
// docType: 'quote' 報價單 QUOTATION | 'invoice' 發票 INVOICE（僅已核准/已寄送/已成交狀態可匯出）
// ============================================================
function quoteNoToInvoiceNo(quoteNo) {
  // 報價單號 Q-YYMMDDxxx -> 發票編號 INV-YYMMDDxxx，方便追溯對應報價單
  return quoteNo.replace(/^Q-/, 'INV-')
}

function buildQuotePdfHtml(q, docType, invoiceRemark) {
  docType = docType || 'quote'
  const isInvoice = docType === 'invoice'
  const siteAddress = q.site_address || q.customer_address || ''
  const esc = Fmt.escapeHtml
  const docLabel = isInvoice ? '發票 INVOICE' : '報價單 QUOTATION'
  const docNo = isInvoice ? quoteNoToInvoiceNo(q.quote_no) : q.quote_no
  const docNoLabel = isInvoice ? '發票編號：' : '報價單號：'
  const issueDate = isInvoice ? Fmt.date(new Date().toISOString()) : Fmt.date(q.created_at)
  const issueDateLabel = isInvoice ? '發票日期：' : '日期：'
  const footerNote = isInvoice ? COMPANY_INFO.invoiceFooterNote : COMPANY_INFO.footerNote

  // 按工程分類分組，每組顯示分類標題列，項目列拆分 Location / Description 兩欄，
  // 每組結尾顯示 Sub-total，仿照參考報價單（The Visionary - QW260804）Summary + Breakdown 兩段式版面
  const itemGroups = groupQuoteItemsByCategory(q.items)
  let runningIdx = 0
  const headerColor = isInvoice ? '#7a5a3a' : '#1f5b45'
  // 表格欄位標題（位置/說明等）改回綠色系，但用較淺的綠色跟分類色帶（headerColor）區分，避免撞色
  const tableHeadColor = isInvoice ? '#9c7a52' : '#3f8f6d'
  const itemRows = itemGroups.map((group) => {
    const rows = group.items.map((it) => {
      runningIdx += 1
      return `
    <tr class="pdf-row" style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:6px 4px;color:#9ca3af;">${runningIdx}</td>
      <td style="padding:6px 4px;color:#4b5563;">${esc(it.location || '-')}</td>
      <td style="padding:6px 4px;color:#1f2937;">${esc(it.item_name)}${it.description ? `<div style="font-size:10px;color:#9ca3af;margin-top:1px;">${esc(it.description)}</div>` : ''}</td>
      <td style="padding:6px 4px;text-align:right;color:#4b5563;">${it.quantity}</td>
      <td style="padding:6px 4px;text-align:right;color:#4b5563;">${esc(it.unit)}</td>
      <td style="padding:6px 4px;text-align:right;color:#4b5563;">${Number(it.unit_price).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;font-weight:600;color:#1f2937;">${Number(it.line_total).toLocaleString()}</td>
    </tr>`
    }).join('')
    return `
    <tr class="pdf-row">
      <td colspan="7" style="padding:0px 4px 12px 4px;line-height:1;font-weight:700;font-size:11px;color:#fff;background:${headerColor};">${esc(categoryHeaderWithLetter(group.category))}</td>
    </tr>
    ${rows}
    <tr class="pdf-row" style="border-bottom:1px solid #e5e7eb;">
      <td colspan="6" style="padding:5px 4px;text-align:right;font-size:10px;color:#6b7280;">Sub-total 小計</td>
      <td style="padding:5px 4px;text-align:right;font-size:11px;font-weight:700;color:#1f2937;">${group.subtotal.toLocaleString()}</td>
    </tr>`
  }).join('')

  // Summary 頁：各工程分類（A/B/C...）先滙總小計，仿照參考報價單 SUMMARY 頁格式
  const summaryRows = itemGroups.map((group) => `
    <tr class="pdf-row" style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:7px 6px;color:#4b5563;font-weight:600;">${esc(categoryLetter(group.category) || '-')}</td>
      <td style="padding:7px 6px;color:#1f2937;">${esc(categoryBilingual(group.category))}</td>
      <td style="padding:7px 6px;text-align:right;color:#1f2937;">${group.subtotal.toLocaleString()}</td>
    </tr>`).join('')

  const discountAmount = q.discount_value ? (q.subtotal - (q.total_amount - q.tax_amount)) : 0

  const discountRow = q.discount_value ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
      <span>${q.discount_type === 'percent' ? `折扣 (${q.discount_value}%)` : '折扣'}</span>
      <span>-${Fmt.currency(discountAmount, q.currency)}</span>
    </div>` : ''

  const taxRow = q.tax_amount ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
      <span>稅額 (${(q.tax_rate * 100).toFixed(0)}%)</span>
      <span>${Fmt.currency(q.tax_amount, q.currency)}</span>
    </div>` : ''

  const TERMS_DISCLAIMER = '所有報價單所標示尺寸均以實際現場環境尺寸為準。\n因為所有物料會因應生產時期而有所分別，所提交物料樣板只作參考及配飾之用，並會以完成實物之物料為最終色樣。'

  // 發票：條款/付款方式改為單一備註輸入欄（invoiceRemark，匯出前由使用者填寫），不顯示報價單固定條款/免責聲明
  // 報價單：維持原有「條款/付款方式」+ 免責聲明清單
  const termsBlock = isInvoice
    ? (invoiceRemark ? `
    <div class="pdf-row" style="margin-top:18px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">備註</div>
      <div style="font-size:11px;color:#4b5563;white-space:pre-line;">${esc(invoiceRemark)}</div>
    </div>` : '')
    : `
    <div class="pdf-row" style="margin-top:18px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">條款/付款方式</div>
      ${q.terms ? `<div style="font-size:11px;color:#4b5563;white-space:pre-line;margin-bottom:6px;">${esc(q.terms)}</div>` : ''}
      <ul style="font-size:10px;color:#6b7280;line-height:1.6;margin:0;padding-left:16px;">
        ${TERMS_DISCLAIMER.split('\n').map((line) => `<li>${esc(line)}</li>`).join('')}
      </ul>
    </div>`

  // 簽署確認欄：僅在 Summary 頁條款下方顯示一次，供雙方簽署確認（甲方：本公司／乙方：客戶確認）
  const signatureBlock = `
    <div class="pdf-row" style="margin-top:24px;">
      <div style="background:#dce1e7;padding:6px 10px;font-weight:700;font-size:11px;color:#1f2937;">Signed &amp; Confirmation :</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:14px;font-size:11px;color:#1f2937;">
        <div>
          <div>For on behalf of</div>
          <div style="font-weight:700;margin-top:2px;">${esc(COMPANY_INFO.nameEn.toUpperCase())}</div>
          <div style="height:60px;"></div>
          <div style="border-top:1.5px solid #1f2937;padding-top:4px;line-height:1.8;">
            <div>Signed By :</div>
            <div>Date :</div>
          </div>
        </div>
        <div>
          <div>Accepted &amp; Confirmed By</div>
          <div style="height:82px;"></div>
          <div style="border-top:1.5px solid #1f2937;padding-top:4px;line-height:1.8;">
            <div>Signed By :</div>
            <div>Date :</div>
          </div>
        </div>
      </div>
    </div>`

  // 共用文件抬頭（Logo/公司資訊/文件編號等），Summary 頁與 Breakdown 頁各自重複顯示一次
  const headerBlockHtml = (sectionTitle) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="/static/images/logo.png" style="width:44px;height:44px;object-fit:contain;" crossorigin="anonymous" />
        <div>
          <div style="font-size:24px;font-weight:700;">${esc(COMPANY_INFO.nameEn)}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:1px;">${esc(COMPANY_INFO.nameZh)}</div>
        </div>
      </div>
      <div style="font-size:15px;font-weight:600;color:#374151;padding-top:4px;">${docLabel}</div>
    </div>

    <div style="font-size:11px;color:#6b7280;margin-top:10px;line-height:1.5;">
      <div>${esc(COMPANY_INFO.addressZh)}</div>
      <div>${esc(COMPANY_INFO.addressEn)}</div>
      <div>Tel: ${esc(COMPANY_INFO.phone)} ｜ ${esc(COMPANY_INFO.email)} ｜ ${esc(COMPANY_INFO.website)}</div>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:12px;">
      <div><span style="font-weight:700;">${docNoLabel}</span>${esc(docNo)}</div>
      <div><span style="font-weight:700;">${issueDateLabel}</span>${issueDate}</div>
      ${isInvoice
        ? `<div><span style="font-weight:700;">對應報價單號：</span>${esc(q.quote_no)}</div>`
        : `<div><span style="font-weight:700;">有效期限：</span>${Fmt.date(q.valid_until)}</div>`}
      <div><span style="font-weight:700;">客戶：</span>${esc(q.company_name)}</div>
      ${siteAddress ? `<div style="grid-column:1/-1;"><span style="font-weight:700;">工程地址：</span>${esc(siteAddress)}</div>` : ''}
    </div>

    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:1px;color:#1f2937;margin-top:16px;padding-bottom:8px;border-bottom:2px solid ${headerColor};">${sectionTitle}</div>`

  // ---- Summary 頁：各分類先滙總（仿照參考報價單 SUMMARY 頁） ----
  const summaryPageHtml = `
    ${headerBlockHtml('SUMMARY 滙總')}

    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:7px 6px;text-align:left;font-weight:600;width:40px;">Item</th>
          <th style="padding:7px 6px;text-align:left;font-weight:600;">Description 工程分類</th>
          <th style="padding:7px 6px;text-align:right;font-weight:600;width:110px;">Amount (${q.currency || 'HKD'})</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>

    <div class="pdf-row" style="display:flex;justify-content:flex-end;margin-top:6px;">
      <div style="width:260px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:#1f2937;padding:5px 0;border-top:1px solid #e5e7eb;">
          <span>Grand Total 總計</span><span>${Fmt.currency(q.subtotal, q.currency)}</span>
        </div>
        ${discountRow}
        ${taxRow}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px solid #e5e7eb;margin-top:4px;padding-top:6px;">
          <span>Total 合計</span><span>${Fmt.currency(q.total_amount, q.currency)}</span>
        </div>
      </div>
    </div>

    <div class="pdf-row" style="margin-top:14px;text-align:center;font-size:11px;font-weight:600;color:#1f2937;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px;">
      ${esc(Fmt.amountInWords(q.total_amount, q.currency))}
    </div>

    <div class="pdf-row" style="margin-top:22px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">收款資訊</div>
      <div style="font-size:11px;color:#4b5563;line-height:1.6;">
        <div>Bank: ${esc(COMPANY_INFO.bank.name)}</div>
        <div>Account No.: ${esc(COMPANY_INFO.bank.accountNo)}</div>
        <div>Name: ${esc(COMPANY_INFO.bank.accountName)}</div>
      </div>
    </div>

    ${termsBlock}

    ${signatureBlock}

    <div class="pdf-row" style="margin-top:26px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;">
      ${esc(footerNote)} ｜ ${esc(COMPANY_INFO.nameZh)} ｜ Tel: ${esc(COMPANY_INFO.phone)}
    </div>`

  // ---- Breakdown 頁：各分類細分項目（強制另起新頁，class="pdf-page-break" 供分頁邏輯辨識） ----
  // 發票不需要 Breakdown 細分頁，僅報價單顯示
  const breakdownPageHtml = isInvoice ? '' : `
    <div class="pdf-page-break" style="margin-top:24px;">
    ${headerBlockHtml('BREAKDOWN 細分報價')}

    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:22px;">No.</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:70px;">位置</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;">說明</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:40px;">數量</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:40px;">單位</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:60px;">單價</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:72px;">小計</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    </div>`

  return `
  <div style="width:760px;padding:36px;font-family:-apple-system,'PingFang TC','Noto Sans CJK TC','Microsoft JhengHei',Helvetica,Arial,sans-serif;color:#1f2937;background:#fff;box-sizing:border-box;">
    ${summaryPageHtml}
    ${breakdownPageHtml}
  </div>`
}

// 共用的 HTML -> PDF 產生流程（報價單／發票共用，僅版面內容與檔名不同）
// 分頁邏輯：依畫面上標記 class="pdf-row" 的元素邊界找安全斷點分頁，
// 避免表格列（或收款資訊等區塊）被硬生生從中間切開；並在每頁上下保留邊距空白。
async function renderHtmlToPdfAndSave(html, fileName, btn, busyLabel) {
  if (!window.jspdf || !window.html2canvas) {
    showToast('PDF 匯出元件載入中，請稍後再試', 'error')
    return
  }
  const originalHtml = btn ? btn.innerHTML : ''
  if (btn) {
    btn.disabled = true
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1.5"></i>${busyLabel || '匯出中...'}`
  }

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const scale = 2
    const contentEl = container.firstElementChild
    // 記錄所有「不可裁切」區塊（表格分類列/項目列/小計/頁尾等）在內容中的上下邊界座標（CSS px）
    // 注意：表格 <tr> 在部分瀏覽器中 offsetTop/offsetParent 的計算基準會跟一般 <div> 不同
    // （anonymous table box 導致 offsetParent 並非預期的容器），故改用
    // getBoundingClientRect() 相對容器頂部的距離計算，避免斷點算錯導致列被從中間裁斷。
    const containerTop = contentEl.getBoundingClientRect().top
    const rowEls = Array.from(contentEl.querySelectorAll('.pdf-row'))
    const rowRectsCss = rowEls
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { top: r.top - containerTop, bottom: r.bottom - containerTop }
      })
      .sort((a, b) => a.top - b.top)

    // 安全斷點：取相鄰兩個不可裁切區塊之間「空白間隙」的中點，而不是直接用區塊本身量到的邊界。
    // 原因：getBoundingClientRect() 量到的區塊框，有時無法完全包住粗體文字/數字實際渲染出來的墨跡
    // （字型 line-height、anti-aliasing 造成的視覺溢出），若直接拿邊界當斷點，可能剛好切在文字中間。
    // 改用相鄰區塊間空白間隙的中點，即使量測有 1~2px 誤差，斷點仍必定落在真正的空白處。
    const rowBottomsCss = []
    for (let i = 0; i < rowRectsCss.length - 1; i++) {
      const gapTop = rowRectsCss[i].bottom
      const gapBottom = rowRectsCss[i + 1].top
      rowBottomsCss.push(gapBottom > gapTop ? (gapTop + gapBottom) / 2 : gapTop)
    }
    if (rowRectsCss.length > 0) {
      rowBottomsCss.push(rowRectsCss[rowRectsCss.length - 1].bottom)
    }
    rowBottomsCss.sort((a, b) => a - b)

    // 強制分頁點：標記 class="pdf-page-break" 的元素會被強制放到新的一頁開頭
    // （例如 Summary 頁與 Breakdown 頁之間的分隔），取該元素頂部座標作為分頁邊界
    const forcedBreakEls = Array.from(contentEl.querySelectorAll('.pdf-page-break'))
    const forcedBreaksCss = forcedBreakEls
      .map((el) => el.getBoundingClientRect().top - containerTop)
      .sort((a, b) => a - b)

    const canvas = await html2canvas(contentEl, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff'
    })

    const { jsPDF } = window.jspdf
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pdfWidthMm = pdf.internal.pageSize.getWidth()
    const pdfHeightMm = pdf.internal.pageSize.getHeight()
    const imgWidthMm = pdfWidthMm
    const pxPerMm = canvas.width / imgWidthMm

    // 每頁上下各保留邊距，避免內容貼邊、底部留白
    const topMarginMm = 8
    const bottomMarginMm = 12
    const pageContentHeightPx = (pdfHeightMm - topMarginMm - bottomMarginMm) * pxPerMm

    const rowBottomsPx = rowBottomsCss.map((v) => v * scale)
    const forcedBreaksPx = forcedBreaksCss.map((v) => v * scale)
    const totalHeightPx = canvas.height

    // 依安全斷點（不可裁切區塊的底部邊界）切出每一頁的 [startPx, endPx) 範圍；
    // 若強制分頁點落在目前頁範圍內，優先在該處分頁（即使頁面尚未填滿）
    const slices = []
    let cursor = 0
    while (cursor < totalHeightPx - 0.5) {
      const target = cursor + pageContentHeightPx
      const forcedBreak = forcedBreaksPx.find((fb) => fb > cursor + 0.5 && fb < target - 0.5)
      if (forcedBreak) {
        slices.push([cursor, forcedBreak])
        cursor = forcedBreak
        continue
      }
      if (target >= totalHeightPx) {
        slices.push([cursor, totalHeightPx])
        break
      }
      let breakPoint = null
      for (const rb of rowBottomsPx) {
        if (rb > cursor + 0.5 && rb <= target) breakPoint = rb
        if (rb > target) break
      }
      if (breakPoint === null) {
        // 找不到安全斷點（單一區塊本身就超過一頁高度），只能強制裁切
        breakPoint = target
      }
      slices.push([cursor, breakPoint])
      cursor = breakPoint
    }

    // 將整張畫面依安全斷點切成多張子畫布，逐頁貼入 PDF
    const sliceCanvas = document.createElement('canvas')
    const sliceCtx = sliceCanvas.getContext('2d')
    slices.forEach(([startPx, endPx], idx) => {
      const sliceHeightPx = endPx - startPx
      if (sliceHeightPx <= 0) return
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height)
      sliceCtx.drawImage(canvas, 0, startPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)
      const sliceImgData = sliceCanvas.toDataURL('image/png')
      const sliceHeightMm = sliceHeightPx / pxPerMm
      if (idx > 0) pdf.addPage()
      pdf.addImage(sliceImgData, 'PNG', 0, topMarginMm, imgWidthMm, sliceHeightMm)
    })

    // 每頁底部置中加上頁碼 X/X
    const totalPages = pdf.internal.getNumberOfPages()
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      pdf.setPage(pageNum)
      pdf.setFontSize(9)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`${pageNum} / ${totalPages}`, pdfWidthMm / 2, pdfHeightMm - 5, { align: 'center' })
    }

    pdf.save(fileName)
  } catch (err) {
    console.error(err)
    showToast('PDF 匯出失敗，請稍後再試', 'error')
  } finally {
    document.body.removeChild(container)
    if (btn) {
      btn.disabled = false
      btn.innerHTML = originalHtml
    }
  }
}

async function exportQuotePdf(q) {
  const btn = document.getElementById('qd-export-pdf')
  await renderHtmlToPdfAndSave(buildQuotePdfHtml(q, 'quote'), `${q.quote_no}.pdf`, btn, '匯出中...')
}

// 匯出發票PDF：直接套用已儲存的發票備註（於附件區塊下方填寫並儲存），
// 取代報價單原有的固定條款/付款方式，無需每次匯出時重新輸入
async function exportInvoicePdf(q) {
  const btn = document.getElementById('qd-export-invoice')
  await renderHtmlToPdfAndSave(buildQuotePdfHtml(q, 'invoice', q.invoice_remark), `${quoteNoToInvoiceNo(q.quote_no)}.pdf`, btn, '匯出中...')
}
