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
    <div class="w-full">
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
          ${canEdit ? `<a href="/quotes/${q.id}/edit" class="bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 text-sm font-medium px-3.5 py-2 rounded-lg">
            <i class="fas fa-pen mr-1.5"></i>編輯
          </a>` : ''}
          <a href="/quotes" class="text-sm text-gray-500 hover:text-gray-700 px-2"><i class="fas fa-arrow-left mr-1"></i>返回</a>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[5fr_1fr] gap-6">
        <!-- 主要內容 -->
        <div class="space-y-6">
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
                <p class="text-gray-700">${q.contact ? Fmt.escapeHtml(q.contact.name) : '未指定'}</p>
                ${(q.contact_phone || (q.contact && q.contact.phone)) ? `<p class="text-gray-700">${Fmt.escapeHtml(q.contact_phone || q.contact.phone)}</p>` : ''}
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
                      ${it.description ? `<p class="text-xs text-gray-600">${Fmt.escapeHtml(it.description)}</p>` : ''}
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

          </div>

          <!-- 發票管理（支援分期收款，一張報價單可開立多張發票） -->
          ${['approved', 'sent', 'won'].includes(q.status) ? `
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-700"><i class="fas fa-file-invoice mr-1.5 text-gray-400"></i>發票管理</h2>
              <button id="qd-invoice-add-btn" class="text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg">
                <i class="fas fa-plus mr-1"></i>新增發票
              </button>
            </div>
            <p class="text-[11px] text-gray-400 mb-3">如需分期收款（例如：訂金 + 尾款），可依每期分別開立獨立發票，各自填寫金額與備註</p>
            <div id="qd-invoice-summary" class="text-xs text-gray-500 mb-3"></div>
            <div id="qd-invoice-add-form" class="hidden mb-3 p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[11px] text-gray-400">分幾期</label>
                  <input id="qd-invoice-count-input" type="number" step="1" min="1" max="12" value="1" class="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label class="text-[11px] text-gray-400">發票日期（套用至本批所有發票）</label>
                  <input id="qd-invoice-date-input" type="date" class="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value="${new Date().toISOString().slice(0, 10)}" />
                </div>
              </div>
              <p class="text-[11px] text-gray-400">報價總額 <span class="font-semibold text-gray-600">${Fmt.currency(q.total_amount, q.currency)}</span> 會自動帶入，只需填寫各期所佔百分比，系統將自動計算金額並產生對應張數的發票（各自獨立編號）</p>
              <div id="qd-invoice-installment-rows" class="space-y-2"></div>
              <div id="qd-invoice-installment-check" class="text-[11px] text-gray-500"></div>
              <div class="flex justify-end gap-2">
                <button id="qd-invoice-cancel-btn" class="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">取消</button>
                <button id="qd-invoice-save-btn" class="text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg">
                  <i class="fas fa-save mr-1"></i>產生發票
                </button>
              </div>
            </div>
            <div id="qd-invoices-list" class="space-y-2">
              <p class="text-xs text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>載入中...</p>
            </div>
          </div>` : ''}

          ${q.terms ? `
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-2">條款/付款方式</h2>
            <p class="text-sm text-gray-600 whitespace-pre-line">${Fmt.escapeHtml(q.terms)}</p>
          </div>` : ''}

          ${q.remarks ? `
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-2">備註 Remarks</h2>
            <p class="text-sm text-gray-600 whitespace-pre-line">${Fmt.escapeHtml(q.remarks)}</p>
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
  bind('qd-invoice-add-btn', () => toggleInvoiceAddForm(true, q))
  bind('qd-invoice-cancel-btn', () => toggleInvoiceAddForm(false, q))
  bind('qd-invoice-save-btn', () => createQuoteInvoice(q))
  const installmentCountInput = document.getElementById('qd-invoice-count-input')
  if (installmentCountInput) {
    installmentCountInput.addEventListener('input', () => renderInstallmentRows(q))
    installmentCountInput.addEventListener('change', () => renderInstallmentRows(q))
  }

  const fileInput = document.getElementById('qd-attachment-input')
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0]
      if (file) uploadQuoteAttachment(q.id, file)
      fileInput.value = ''
    })
  }
  loadQuoteAttachments(q.id)
  if (['approved', 'sent', 'won'].includes(q.status)) loadQuoteInvoices(q)
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

// ============================================================
// 發票管理（支援單一報價單分期開立多張發票，如訂金 + 尾款）
// 金額自動取自報價單總額：使用者只需設定「分幾期」及「每期佔百分比」，
// 系統即自動計算各期金額，一次過產生對應張數、各自獨立編號的發票
// ============================================================
let QuoteInvoicesCache = []

function toggleInvoiceAddForm(show, q) {
  const form = document.getElementById('qd-invoice-add-form')
  if (!form) return
  form.classList.toggle('hidden', !show)
  if (show) {
    const countInput = document.getElementById('qd-invoice-count-input')
    if (countInput) countInput.value = 1
    renderInstallmentRows(q)
  }
}

// 已開發票總額佔報價單總額的百分比（用於計算「尚餘」可分配的百分比），
// 四捨五入至小數2位，避免浮點數誤差
function getInvoicedPercent(q) {
  const totalAmount = Number(q.total_amount || 0)
  if (totalAmount <= 0) return 0
  const invoicedTotal = QuoteInvoicesCache.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
  return Math.round((invoicedTotal / totalAmount) * 10000) / 100
}

function getRemainingPercent(q) {
  return Math.max(0, Math.round((100 - getInvoicedPercent(q)) * 100) / 100)
}

// 依目前「分幾期」輸入值重新產生每期的百分比/備註輸入列；
// 若使用者先前已輸入過的列（依索引對應）會盡量保留原值，只有新增的列套用預設值
function renderInstallmentRows(q) {
  const countInput = document.getElementById('qd-invoice-count-input')
  const rowsEl = document.getElementById('qd-invoice-installment-rows')
  if (!countInput || !rowsEl) return
  let count = parseInt(countInput.value, 10)
  if (!Number.isFinite(count) || count < 1) count = 1
  if (count > 12) count = 12
  countInput.value = count

  const existingRows = Array.from(rowsEl.querySelectorAll('.qd-installment-row')).map((row) => ({
    percent: row.querySelector('.qd-installment-percent').value,
    remark: row.querySelector('.qd-installment-remark').value
  }))

  const remainingPercent = getRemainingPercent(q)
  const evenSplit = Math.round((remainingPercent / count) * 100) / 100

  const rowsHtml = []
  for (let i = 0; i < count; i++) {
    const existing = existingRows[i]
    const defaultPercent = existing ? existing.percent : (count === 1 ? remainingPercent : evenSplit)
    const defaultRemark = existing
      ? existing.remark
      : (count > 1 && i === 0 ? '訂金 Deposit' : (count > 1 && i === count - 1 ? '尾款 Final payment' : ''))
    rowsHtml.push(`
    <div class="qd-installment-row flex items-center gap-2" data-idx="${i}">
      <span class="text-xs text-gray-400 w-10 shrink-0">第${i + 1}期</span>
      <div class="relative shrink-0">
        <input type="number" step="0.01" min="0" max="100" value="${defaultPercent}" class="qd-installment-percent w-20 border border-gray-200 rounded-lg pl-2 pr-5 py-1.5 text-sm text-right focus:ring-2 focus:ring-primary-500 outline-none" />
        <span class="absolute right-2 top-1.5 text-xs text-gray-400 pointer-events-none">%</span>
      </div>
      <span class="qd-installment-amount text-xs text-gray-500 w-28 text-right shrink-0">-</span>
      <input type="text" placeholder="備註（如：訂金）" value="${Fmt.escapeHtml(defaultRemark)}" class="qd-installment-remark flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
    </div>`)
  }
  rowsEl.innerHTML = rowsHtml.join('')

  rowsEl.querySelectorAll('.qd-installment-percent').forEach((input) => {
    input.addEventListener('input', () => updateInstallmentCheck(q))
  })
  updateInstallmentCheck(q)
}

// 即時顯示每期換算後的金額，以及目前所有期數百分比加總是否剛好等於「尚餘」百分比
function updateInstallmentCheck(q) {
  const rowsEl = document.getElementById('qd-invoice-installment-rows')
  const checkEl = document.getElementById('qd-invoice-installment-check')
  if (!rowsEl || !checkEl) return
  const totalAmount = Number(q.total_amount || 0)
  const rows = Array.from(rowsEl.querySelectorAll('.qd-installment-row'))
  const percents = rows.map((row) => Number(row.querySelector('.qd-installment-percent').value) || 0)

  rows.forEach((row, idx) => {
    const amountEl = row.querySelector('.qd-installment-amount')
    const amt = Math.round(totalAmount * percents[idx]) / 100
    if (amountEl) amountEl.textContent = Fmt.currency(amt, q.currency, 2)
  })

  const sumPct = Math.round(percents.reduce((s, p) => s + p, 0) * 100) / 100
  const remainingPercent = getRemainingPercent(q)
  const diff = Math.round((sumPct - remainingPercent) * 100) / 100
  if (Math.abs(diff) < 0.01) {
    checkEl.innerHTML = `<span class="text-green-600"><i class="fas fa-circle-check mr-1"></i>合計 ${sumPct.toFixed(2)}%，剛好等於尚餘 ${remainingPercent.toFixed(2)}%</span>`
  } else if (sumPct > remainingPercent) {
    checkEl.innerHTML = `<span class="text-red-500"><i class="fas fa-triangle-exclamation mr-1"></i>合計 ${sumPct.toFixed(2)}%，超出尚餘 ${remainingPercent.toFixed(2)}% 共 ${(sumPct - remainingPercent).toFixed(2)}%</span>`
  } else {
    checkEl.innerHTML = `<span class="text-orange-500"><i class="fas fa-circle-info mr-1"></i>合計 ${sumPct.toFixed(2)}%，尚餘 ${remainingPercent.toFixed(2)}%（還差 ${(remainingPercent - sumPct).toFixed(2)}% 未分配）</span>`
  }
}

function renderInvoiceSummary(q) {
  const el = document.getElementById('qd-invoice-summary')
  if (!el) return
  const invoicedTotal = QuoteInvoicesCache.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
  const remaining = Number(q.total_amount || 0) - invoicedTotal
  el.innerHTML = `報價總額 <span class="font-semibold text-gray-700">${Fmt.currency(q.total_amount, q.currency)}</span>
    ｜ 已開發票總額 <span class="font-semibold text-gray-700">${Fmt.currency(invoicedTotal, q.currency)}</span>
    ｜ 尚餘 <span class="font-semibold ${remaining === 0 ? 'text-green-600' : 'text-orange-500'}">${Fmt.currency(remaining, q.currency)}</span>`
}

async function loadQuoteInvoices(q) {
  const el = document.getElementById('qd-invoices-list')
  if (!el) return
  try {
    const res = await API.get(`/quotes/${q.id}/invoices`)
    QuoteInvoicesCache = res.data || []
    renderInvoiceSummary(q)
    renderQuoteInvoicesList(q)
  } catch (err) {
    el.innerHTML = `<p class="text-xs text-red-400">${Fmt.escapeHtml(err.message)}</p>`
  }
}

function renderQuoteInvoicesList(q) {
  const el = document.getElementById('qd-invoices-list')
  if (!el) return
  if (!QuoteInvoicesCache.length) {
    el.innerHTML = `<p class="text-xs text-gray-400">尚未開立任何發票</p>`
    return
  }
  el.innerHTML = QuoteInvoicesCache
    .map((inv) => `
    <div class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-800">${Fmt.escapeHtml(inv.invoice_no)}</span>
          <span class="text-xs px-1.5 py-0.5 rounded ${inv.is_paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}">${inv.is_paid ? '已收款' : '未收款'}</span>
        </div>
        <div class="text-xs text-gray-500 mt-0.5">${Fmt.currency(inv.amount, q.currency)} ｜ ${Fmt.date(inv.issue_date)} ｜ 第${inv.seq}期${inv.installment_total ? `／共${inv.installment_total}期` : ''}${inv.remark ? ' ｜ ' + Fmt.escapeHtml(inv.remark) : ''}</div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" data-inv-id="${inv.id}" class="qd-inv-paid-toggle" ${inv.is_paid ? 'checked' : ''} />
          收款
        </label>
        <button data-inv-id="${inv.id}" class="qd-inv-export text-gray-500 hover:text-primary-600 px-1.5" title="匯出PDF"><i class="fas fa-file-pdf"></i></button>
        ${!inv.is_paid ? `<button data-inv-id="${inv.id}" class="qd-inv-delete text-gray-400 hover:text-red-600 px-1.5" title="刪除"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>`)
    .join('')

  el.querySelectorAll('.qd-inv-paid-toggle').forEach((cb) => {
    cb.addEventListener('change', () => toggleInvoicePaid(q, cb.dataset.invId, cb.checked))
  })
  el.querySelectorAll('.qd-inv-export').forEach((btn) => {
    btn.addEventListener('click', () => exportInvoicePdf(q, btn.dataset.invId))
  })
  el.querySelectorAll('.qd-inv-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteQuoteInvoice(q, btn.dataset.invId))
  })
}

// 依「分幾期」+「每期百分比」批量產生發票：金額自動以報價單總額 x 百分比計算，
// 依序呼叫建立發票 API（後端已會自動編號 INV-{報價單號}-{序號}，故每張發票編號各自不同），
// installment_total 自動帶入本批的期數，讓PDF顯示「第X期／共Y期」
async function createQuoteInvoice(q) {
  const dateInput = document.getElementById('qd-invoice-date-input')
  const rowsEl = document.getElementById('qd-invoice-installment-rows')
  if (!rowsEl) return
  const totalAmount = Number(q.total_amount || 0)
  const rows = Array.from(rowsEl.querySelectorAll('.qd-installment-row')).map((row) => ({
    percent: Number(row.querySelector('.qd-installment-percent').value) || 0,
    remark: row.querySelector('.qd-installment-remark').value.trim()
  }))

  if (!rows.length) {
    showToast('請至少設定一期', 'error')
    return
  }
  if (rows.some((r) => !(r.percent > 0))) {
    showToast('每期百分比必須大於 0', 'error')
    return
  }
  const sumPct = Math.round(rows.reduce((s, r) => s + r.percent, 0) * 100) / 100
  const remainingPercent = getRemainingPercent(q)
  if (sumPct - remainingPercent > 0.01) {
    showToast(`百分比合計 ${sumPct.toFixed(2)}% 超出尚餘 ${remainingPercent.toFixed(2)}%，請調整`, 'error')
    return
  }

  const installmentTotal = rows.length > 1 ? rows.length : undefined
  const issueDate = dateInput ? dateInput.value : undefined
  const btn = document.getElementById('qd-invoice-save-btn')
  const originalHtml = btn ? btn.innerHTML : ''
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>產生中...' }
  try {
    for (const row of rows) {
      const amount = Math.round(totalAmount * row.percent) / 100
      await API.post(`/quotes/${q.id}/invoices`, {
        amount,
        issue_date: issueDate,
        remark: row.remark,
        installment_total: installmentTotal
      })
    }
    showToast(rows.length > 1 ? `已產生 ${rows.length} 張發票` : '發票已建立')
    toggleInvoiceAddForm(false, q)
    loadQuoteInvoices(q)
  } catch (err) {
    showToast(err.message || '建立失敗', 'error')
    loadQuoteInvoices(q)
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalHtml }
  }
}

async function toggleInvoicePaid(q, invId, isPaid) {
  try {
    await API.put(`/quotes/invoices/${invId}/paid`, { is_paid: isPaid })
    showToast(isPaid ? '已標記為已收款' : '已取消收款標記')
    loadQuoteInvoices(q)
  } catch (err) {
    showToast(err.message || '操作失敗', 'error')
    loadQuoteInvoices(q)
  }
}

async function deleteQuoteInvoice(q, invId) {
  if (!confirm('確定要刪除此發票嗎？')) return
  try {
    await API.delete(`/quotes/invoices/${invId}`)
    showToast('發票已刪除')
    loadQuoteInvoices(q)
  } catch (err) {
    showToast(err.message || '刪除失敗', 'error')
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
// PDF 匯出：以 HTML/CSS 版面 + 瀏覽器原生列印（window.print）產生 PDF，
// 使用者於列印對話框選擇「另存為 PDF」。相較舊版 html2canvas 轉圖再拼頁的做法，
// 此方式輸出的 PDF 文字為原生可選取/可複製文字（非圖片），且不受 jsPDF 內建
// 字型不支援中文的限制（列印時直接沿用瀏覽器/系統字型渲染中文）。
// docType: 'quote' 報價單 QUOTATION | 'invoice' 發票 INVOICE（僅已核准/已寄送/已成交狀態可匯出）
// invoiceData: 匯出發票時傳入該張發票的獨立資料 { invoice_no, amount, remark, issue_date }，
// 使每張發票 PDF 只顯示該筆金額與備註（支援分期收款，不再套用報價單全額/合併備註）
// ============================================================
// PDF 各語言版面固定文字標籤（純中文／純英文兩套，依 I18n.getLang() 選用，不再中英混雜顯示）
const PDF_LABELS = {
  zh: {
    docLabelQuote: '報價單', docLabelInvoice: '發票',
    docNoLabelQuote: '報價單號：', docNoLabelInvoice: '發票編號：',
    issueDateLabelQuote: '日期：', issueDateLabelInvoice: '發票日期：',
    relatedQuoteNo: '對應報價單號：', validUntil: '有效期限：',
    customer: '客戶：', siteAddress: '工程地址：', contactPhone: '聯絡人：',
    summaryTitle: '滙總', breakdownTitle: '細分報價',
    itemCol: '項目', descCol: '說明', amountCol: '金額', noCol: '編號',
    locationCol: '位置', qtyCol: '數量', unitCol: '單位', priceCol: '單價', subtotalCol: '小計',
    subtotalLabel: '小計',
    amountDue: (quoteNo) => `本次應付款項（對應報價單 ${quoteNo}）`,
    remarkTitle: '備註', termsTitle: '條款/付款方式', bankInfoTitle: '收款資訊',
    bankLabel: '銀行：', accountNoLabel: '帳號：', accountNameLabel: '戶名：', fpsLabel: '轉數快(FPS) 電話號碼：', fpsIdLabel: '轉數快(FPS) 識別碼：',
    remarksTitle: '備註',
    signTitle: '簽署確認：', signOnBehalf: '代表本公司', signAccepted: '客戶確認接受',
    signAcceptedStatement: '本人/吾等茲確認接受此報價單，並授權按上述條款進行相關工程。',
    signBy: '簽署人：', signDate: '簽署確實日期：',
    contractTotal: '工程總額', installmentLabel: '收款期數', percentOfTotal: '本期應收比例',
    totalDue: '本次應付', totalDueWithPct: (pct) => `本次應付（總額 × ${pct}%）`,
    discountLabel: (pct) => pct !== null ? `折扣 (${pct}%)` : '折扣',
    taxLabel: (pct) => `稅額 (${pct}%)`,
    grandTotal: '總計', total: '合計',
    installmentText: (seq, total) => `第 ${seq} 期${total ? ` ／ 共 ${total} 期` : ''}`
  },
  en: {
    docLabelQuote: 'QUOTATION', docLabelInvoice: 'INVOICE',
    docNoLabelQuote: 'Quotation No.: ', docNoLabelInvoice: 'Invoice No.: ',
    issueDateLabelQuote: 'Date: ', issueDateLabelInvoice: 'Invoice Date: ',
    relatedQuoteNo: 'Related Quotation No.: ', validUntil: 'Valid Until: ',
    customer: 'Customer: ', siteAddress: 'Site Address: ', contactPhone: 'Contact: ',
    summaryTitle: 'SUMMARY', breakdownTitle: 'BREAKDOWN',
    itemCol: 'Item', descCol: 'Description', amountCol: 'Amount', noCol: 'No.',
    locationCol: 'Location', qtyCol: 'Qty', unitCol: 'Unit', priceCol: 'Unit Price', subtotalCol: 'Sub-total',
    subtotalLabel: 'Sub-total',
    amountDue: (quoteNo) => `Amount Due (Ref. Quotation ${quoteNo})`,
    remarkTitle: 'Remarks', termsTitle: 'Terms & Payment', bankInfoTitle: 'Payment Details',
    bankLabel: 'Bank: ', accountNoLabel: 'Account No.: ', accountNameLabel: 'Name: ', fpsLabel: 'FPS Phone No.: ', fpsIdLabel: 'FPS ID: ',
    remarksTitle: 'Remarks',
    signTitle: 'Signed & Confirmation:', signOnBehalf: 'For and on behalf of', signAccepted: 'Accepted & Confirmed By',
    signAcceptedStatement: 'I/We hereby accept this quotation and authorize the works to proceed under the listed terms.',
    signBy: 'Signed By: ', signDate: 'Date: ',
    contractTotal: 'Contract Total', installmentLabel: 'Installment', percentOfTotal: '% of Total',
    totalDue: 'Total Due', totalDueWithPct: (pct) => `Total Due (Total × ${pct}%)`,
    discountLabel: (pct) => pct !== null ? `Discount (${pct}%)` : 'Discount',
    taxLabel: (pct) => `Tax (${pct}%)`,
    grandTotal: 'Grand Total', total: 'Total',
    installmentText: (seq, total) => `Installment #${seq}${total ? ` of ${total}` : ''}`
  }
}

function buildQuotePdfHtml(q, docType, invoiceData) {
  docType = docType || 'quote'
  const isInvoice = docType === 'invoice'
  const esc = Fmt.escapeHtml
  // PDF 語言：跟隨畫面目前切換的語言（I18n.getLang()），中文模式輸出純中文模版，
  // 英文模式輸出純英文模版（不再像畫面 UI 那樣中英混雜顯示）
  const lang = (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'zh'
  const L = PDF_LABELS[lang]
  // 自由文字欄位（項目名稱/說明/位置/產品目錄資料）在英文模式下透過 I18n 字典比對翻譯；
  // 查無對應英文的部分維持原文（比中英混雜更符合「純語言模版」原則的折衷）
  const tr = (text) => (lang === 'en' && typeof I18n !== 'undefined') ? I18n.translateText(text) : text
  // 條款/備註/發票備註等「使用者自由輸入的長篇文字」：這類內容是完整句子/條款段落，
  // 若逐詞套用字典替換（如「期」→"installment"、「物料」→"Material"）會插入到句子中間，
  // 產生不成句的破碎英文（如「付款installment數細節」），比維持原文更糟。
  // 故此類自由段落一律保留使用者原文，不做自動詞彙替換；短版且結構化的欄位
  // （項目名稱/說明/位置/分類，見 tr()）因來源可控、已有完整字串對照，才適用字典翻譯。
  const trFreeText = (text) => text

  const siteAddress = tr(q.site_address || q.customer_address || '')
  const docLabel = isInvoice ? L.docLabelInvoice : L.docLabelQuote
  // Section 標題（SUMMARY/BREAKDOWN）前綴文件類型名稱：英文加空格分隔（如 "QUOTATION SUMMARY"），
  // 中文直接相連不加空格（如「報價單滙總」），符合中文排版習慣
  const sectionLabel = (title) => lang === 'en' ? `${docLabel} ${title}` : `${docLabel}${title}`
  const docNo = isInvoice ? invoiceData.invoice_no : q.quote_no
  const docNoLabel = isInvoice ? L.docNoLabelInvoice : L.docNoLabelQuote
  const issueDate = isInvoice ? Fmt.date(invoiceData.issue_date) : Fmt.date(q.created_at)
  const issueDateLabel = isInvoice ? L.issueDateLabelInvoice : L.issueDateLabelQuote
  const footerNote = isInvoice
    ? (lang === 'en' ? COMPANY_INFO.invoiceFooterNoteEn : COMPANY_INFO.invoiceFooterNote)
    : (lang === 'en' ? COMPANY_INFO.footerNoteEn : COMPANY_INFO.footerNote)
  const companyName = lang === 'en' ? COMPANY_INFO.nameEn : COMPANY_INFO.nameZh
  const companyAddress = lang === 'en' ? COMPANY_INFO.addressEn : COMPANY_INFO.addressZh
  const bankName = lang === 'en' ? COMPANY_INFO.bank.nameEn : COMPANY_INFO.bank.name
  // 發票金額：使用該張發票自己的金額（分期收款），而非報價單全額
  const displayAmount = isInvoice ? Number(invoiceData.amount) : Number(q.total_amount)

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
      <td style="padding:3px 4px;color:#9ca3af;">${runningIdx}</td>
      <td style="padding:3px 4px;color:#4b5563;">${esc(tr(it.location) || '-')}</td>
      <td style="padding:3px 4px;color:#1f2937;">${esc(tr(it.item_name))}${it.description ? `<div style="font-size:9px;color:#4b5563;margin-top:0px;">${esc(tr(it.description))}</div>` : ''}</td>
      <td style="padding:3px 4px;text-align:right;color:#4b5563;">${it.quantity}</td>
      <td style="padding:3px 4px;text-align:right;color:#4b5563;">${esc(tr(it.unit))}</td>
      <td style="padding:3px 4px;text-align:right;color:#4b5563;">${Number(it.unit_price).toLocaleString()}</td>
      <td style="padding:3px 4px;text-align:right;font-weight:600;color:#1f2937;">${Number(it.line_total).toLocaleString()}</td>
    </tr>`
    }).join('')
    return `
    <tr class="pdf-row">
      <td colspan="7" style="padding:0px 4px 6px 4px;line-height:1;font-weight:700;font-size:10px;color:#fff;background:${headerColor};">${esc(categoryHeaderPure(group.category, lang))}</td>
    </tr>
    ${rows}
    <tr class="pdf-row" style="border-bottom:1px solid #e5e7eb;">
      <td colspan="6" style="padding:3px 4px;text-align:right;font-size:9px;color:#6b7280;">${L.subtotalLabel}</td>
      <td style="padding:3px 4px;text-align:right;font-size:10px;font-weight:700;color:#1f2937;">${group.subtotal.toLocaleString()}</td>
    </tr>`
  }).join('')

  // Summary 頁：各工程分類（A/B/C...）先滙總小計，仿照參考報價單 SUMMARY 頁格式
  const summaryRows = itemGroups.map((group) => `
    <tr class="pdf-row" style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:4px 6px;color:#4b5563;font-weight:600;">${esc(categoryLetter(group.category) || '-')}</td>
      <td style="padding:4px 6px;color:#1f2937;">${esc(categoryNamePure(group.category, lang))}</td>
      <td style="padding:4px 6px;text-align:right;color:#1f2937;">${group.subtotal.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`).join('')

  const discountAmount = q.discount_value ? (q.subtotal - (q.total_amount - q.tax_amount)) : 0

  const discountRow = q.discount_value ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:1.5px 0;">
      <span>${L.discountLabel(q.discount_type === 'percent' ? q.discount_value : null)}</span>
      <span>-${Fmt.currency(discountAmount, q.currency, 2)}</span>
    </div>` : ''

  const taxRow = q.tax_amount ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:1.5px 0;">
      <span>${L.taxLabel((q.tax_rate * 100).toFixed(0))}</span>
      <span>${Fmt.currency(q.tax_amount, q.currency, 2)}</span>
    </div>` : ''

  // 發票：顯示該張發票自己的備註（invoiceData.remark，如「訂金 Deposit payment」），不顯示報價單固定條款/免責聲明
  // 報價單：維持原有「條款/付款方式」（固定免責聲明清單已按需求移除）
  // 註：此處僅產生區塊「內容」（不含外層 pdf-row/margin 包裝），因為需與「收款資訊」
  // 併排成左右兩欄以節省版面高度（見下方 bankTermsBlock），故包裝統一交由外層處理
  const termsInnerHtml = isInvoice
    ? (invoiceData.remark ? `
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">${L.remarkTitle}</div>
      <div style="font-size:11px;color:#4b5563;white-space:pre-line;">${esc(trFreeText(invoiceData.remark))}</div>` : '')
    : (q.terms ? `
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">${L.termsTitle}</div>
      <div style="font-size:11px;color:#4b5563;white-space:pre-line;">${esc(trFreeText(q.terms))}</div>` : '')

  // 收款資訊：與條款/付款方式並排兩欄顯示（節省版面高度，讓 SUMMARY 頁含簽署確認欄能收在同一頁）
  // 兩個收款戶口（OCBC / BOC）並排左右兩欄顯示，方便客戶選擇任一戶口轉帳
  const bank2Name = lang === 'en' ? COMPANY_INFO.bank2.nameEn : COMPANY_INFO.bank2.name
  const bankInfoInnerHtml = `
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">${L.bankInfoTitle}</div>
      <div style="display:flex;gap:24px;">
        <div style="font-size:11px;color:#4b5563;line-height:1.5;">
          <div>${L.bankLabel}${esc(bankName)}</div>
          <div>${L.accountNoLabel}${esc(COMPANY_INFO.bank.accountNo)}</div>
          <div>${L.accountNameLabel}${esc(COMPANY_INFO.bank.accountName)}</div>
          <div>${L.fpsLabel}${esc(COMPANY_INFO.bank.fpsPhone)}</div>
        </div>
        <div style="font-size:11px;color:#4b5563;line-height:1.5;">
          <div>${L.bankLabel}${esc(bank2Name)}</div>
          <div>${L.accountNoLabel}${esc(COMPANY_INFO.bank2.accountNo)}</div>
          <div>${L.accountNameLabel}${esc(COMPANY_INFO.bank2.accountName)}</div>
          <div>${L.fpsIdLabel}${esc(COMPANY_INFO.bank2.fpsId)}</div>
        </div>
      </div>`

  // 收款資訊與條款/付款方式改為上下堆疊顯示（收款資訊在上，條款在下），
  // 不再左右並排——並排時條款內容較長會被壓縮成兩欄過窄，不易閱讀
  const bankTermsBlock = `
    <div class="pdf-row" style="margin-top:14px;">
      <div>${bankInfoInnerHtml}</div>
      ${termsInnerHtml ? `<div style="margin-top:12px;">${termsInnerHtml}</div>` : ''}
    </div>`

  // 報價單：備註 Remarks（客戶條款聲明，如材料範圍/不包含項目/變更需簽署確認等），發票不顯示
  const remarksBlock = (!isInvoice && q.remarks) ? `
    <div class="pdf-row" style="margin-top:12px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:3px;">${L.remarksTitle}</div>
      <div style="font-size:10px;color:#6b7280;white-space:pre-line;line-height:1.45;">${esc(trFreeText(q.remarks))}</div>
    </div>` : ''

  // 簽署確認欄：僅在 Summary 頁條款下方顯示一次，供雙方簽署確認（甲方：本公司／乙方：客戶確認）
  // 簽名留白高度已縮減，確保整個 SUMMARY 頁（含此簽署欄）能收在同一頁，不再溢出到下一頁
  const signatureBlock = `
    <div class="pdf-row" style="margin-top:8px;">
      <div style="background:#dce1e7;padding:3px 10px;font-weight:700;font-size:11px;color:#1f2937;">${L.signTitle}</div>
      <!-- 用CSS grid明確分3列（說明文字/簽名留白/簽名線），同一列高度左右共用，
           確保無論說明文字長短不一，中間簽名留白與底部簽名線都能左右對齊同一水平 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 32px auto;gap:0 24px;margin-top:6px;font-size:11px;color:#1f2937;">
        <div style="grid-column:1;grid-row:1;">
          <div>${L.signOnBehalf}</div>
          <div style="font-weight:700;margin-top:2px;">${esc(COMPANY_INFO.nameEn.toUpperCase())}</div>
        </div>
        <div style="grid-column:2;grid-row:1;">
          <div>${L.signAccepted}</div>
          <div style="font-size:9px;color:#6b7280;margin-top:2px;line-height:1.4;">${esc(L.signAcceptedStatement)}</div>
        </div>
        <div style="grid-column:1;grid-row:3;border-top:1.5px solid #1f2937;padding-top:3px;line-height:1.6;">
          <div>${L.signBy}</div>
          <div>${L.signDate}</div>
        </div>
        <div style="grid-column:2;grid-row:3;border-top:1.5px solid #1f2937;padding-top:3px;line-height:1.6;">
          <div>${L.signBy}</div>
          <div>${L.signDate}</div>
        </div>
      </div>
    </div>`

  // 共用文件抬頭（Logo/公司資訊/文件編號等），Summary 頁與 Breakdown 頁各自重複顯示一次
  const headerBlockHtml = (sectionTitle) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="/static/images/logo.png" style="width:44px;height:44px;object-fit:contain;" crossorigin="anonymous" />
        <div>
          <div style="font-size:24px;font-weight:700;">${esc(companyName)}</div>
        </div>
      </div>
      <div style="font-size:15px;font-weight:600;color:#374151;padding-top:4px;">${docLabel}</div>
    </div>

    <div style="font-size:11px;color:#6b7280;margin-top:6px;line-height:1.4;">
      <div>${esc(companyAddress)}</div>
      <div>Tel: ${esc(COMPANY_INFO.phone)} ｜ ${esc(COMPANY_INFO.email)} ｜ ${esc(COMPANY_INFO.website)}</div>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0;">

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:12px;">
      <div><span style="font-weight:700;">${docNoLabel}</span>${esc(docNo)}</div>
      <div><span style="font-weight:700;">${issueDateLabel}</span>${issueDate}</div>
      ${isInvoice
        ? `<div><span style="font-weight:700;">${L.relatedQuoteNo}</span>${esc(q.quote_no)}</div>`
        : `<div><span style="font-weight:700;">${L.validUntil}</span>${Fmt.date(q.valid_until)}</div>`}
      <div><span style="font-weight:700;">${L.customer}</span>${esc(q.company_name)}</div>
      ${(q.contact && q.contact.name) || q.contact_phone ? `<div><span style="font-weight:700;">${L.contactPhone}</span>${(q.contact && q.contact.name) ? esc(q.contact.name) + (q.contact_phone ? '　' : '') : ''}${esc(q.contact_phone || '')}</div>` : ''}
      ${siteAddress ? `<div style="grid-column:1/-1;"><span style="font-weight:700;">${L.siteAddress}</span>${esc(siteAddress)}</div>` : ''}
    </div>

    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:1px;color:#1f2937;margin-top:10px;padding-bottom:6px;border-bottom:2px solid ${headerColor};">${sectionTitle}</div>`

  // ---- Summary 頁：報價單顯示各分類滙總（仿照參考報價單 SUMMARY 頁）；
  // 發票僅顯示此張發票專屬的金額與備註，不套用報價單全額/合併備註（支援分期收款） ----
  const summaryTableHtml = isInvoice ? `
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:7px 6px;text-align:left;font-weight:600;">${L.descCol}</th>
          <th style="padding:7px 6px;text-align:right;font-weight:600;width:110px;">${L.amountCol} (${q.currency || 'HKD'})</th>
        </tr>
      </thead>
      <tbody>
        <tr class="pdf-row" style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 6px;color:#1f2937;">${invoiceData.remark ? esc(trFreeText(invoiceData.remark)) : esc(L.amountDue(q.quote_no))}</td>
          <td style="padding:8px 6px;text-align:right;color:#1f2937;">${displayAmount.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>` : `
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:7px 6px;text-align:left;font-weight:600;width:40px;">${L.itemCol}</th>
          <th style="padding:7px 6px;text-align:left;font-weight:600;">${L.descCol}</th>
          <th style="padding:7px 6px;text-align:right;font-weight:600;width:110px;">${L.amountCol} (${q.currency || 'HKD'})</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>`

  // 發票百分比／期數：本次應付金額佔工程總額的比例（如訂金30%），以及所屬期數（第X期／共Y期）
  // 供客戶清楚核對「總額」與「本次收款」的關係，避免誤以為此發票金額即為工程總額
  const invoicePercent = isInvoice && Number(q.total_amount) > 0
    ? Math.round((displayAmount / Number(q.total_amount)) * 1000) / 10
    : null
  const invoiceInstallmentLabel = isInvoice
    ? L.installmentText(invoiceData.seq || 1, invoiceData.installment_total)
    : ''

  const summaryTotalsHtml = isInvoice ? `
    <div class="pdf-row" style="margin-top:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:10px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;color:#4b5563;">
        <tr>
          <td style="padding:3px 0;white-space:nowrap;">${L.contractTotal}</td>
          <td style="padding:3px 0;text-align:right;white-space:nowrap;font-weight:600;color:#1f2937;">${Fmt.currency(q.total_amount, q.currency, 2)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;white-space:nowrap;">${L.installmentLabel}</td>
          <td style="padding:3px 0;text-align:right;white-space:nowrap;font-weight:600;color:#1f2937;">${esc(invoiceInstallmentLabel)}</td>
        </tr>
        ${invoicePercent !== null ? `
        <tr>
          <td style="padding:3px 0;white-space:nowrap;">${L.percentOfTotal}</td>
          <td style="padding:3px 0;text-align:right;white-space:nowrap;font-weight:600;color:#1f2937;">${invoicePercent}%</td>
        </tr>` : ''}
        <tr>
          <td colspan="2" style="border-top:1px solid #d1d5db;padding-top:6px;"></td>
        </tr>
        <tr>
          <td style="padding:2px 0;font-weight:700;font-size:13px;color:#1f2937;white-space:nowrap;">${invoicePercent !== null ? L.totalDueWithPct(invoicePercent) : L.totalDue}</td>
          <td style="padding:2px 0;text-align:right;font-weight:700;font-size:14px;color:#1f2937;white-space:nowrap;">${Fmt.currency(displayAmount, q.currency, 2)}</td>
        </tr>
      </table>
    </div>` : `
    <div class="pdf-row" style="display:flex;justify-content:flex-end;margin-top:6px;">
      <div style="width:260px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:#1f2937;padding:5px 0;border-top:1px solid #e5e7eb;">
          <span>${L.grandTotal}</span><span>${Fmt.currency(q.subtotal, q.currency, 2)}</span>
        </div>
        ${discountRow}
        ${taxRow}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px solid #e5e7eb;margin-top:4px;padding-top:6px;">
          <span>${L.total}</span><span>${Fmt.currency(q.total_amount, q.currency, 2)}</span>
        </div>
      </div>
    </div>`

  const amountInWordsText = lang === 'en'
    ? Fmt.amountInWords(displayAmount, q.currency)
    : Fmt.amountInWordsZh(displayAmount, q.currency)

  const summaryPageHtml = `
    ${headerBlockHtml(sectionLabel(L.summaryTitle))}

    ${summaryTableHtml}

    ${summaryTotalsHtml}

    <div class="pdf-row" style="margin-top:10px;text-align:center;font-size:11px;font-weight:600;color:#1f2937;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:6px;">
      ${esc(amountInWordsText)}
    </div>

    ${bankTermsBlock}

    ${remarksBlock}

    ${signatureBlock}

    <div class="pdf-row" style="margin-top:14px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;">
      ${esc(footerNote)} ｜ ${esc(companyName)} ｜ Tel: ${esc(COMPANY_INFO.phone)}
    </div>`

  // ---- Breakdown 頁：各分類細分項目（強制另起新頁，class="pdf-page-break" 供分頁邏輯辨識） ----
  // 發票不需要 Breakdown 細分頁，僅報價單顯示
  const breakdownPageHtml = isInvoice ? '' : `
    <div class="pdf-page-break" style="margin-top:24px;">
    ${headerBlockHtml(sectionLabel(L.breakdownTitle))}

    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:22px;">${L.noCol}</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:70px;">${L.locationCol}</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;">${L.descCol}</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:40px;">${L.qtyCol}</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:40px;">${L.unitCol}</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:60px;">${L.priceCol}</th>
          <th style="padding:0px 4px 10px 4px;line-height:1;text-align:center;font-weight:600;width:72px;">${L.subtotalCol}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    </div>`

  return `
  <div style="width:100%;color:#1f2937;background:#fff;box-sizing:border-box;" lang="${lang === 'en' ? 'en' : 'zh-Hant'}">
    ${summaryPageHtml}
    ${breakdownPageHtml}
  </div>`
}

// 共用的 HTML -> PDF 產生流程（報價單／發票共用，僅版面內容與檔名不同）
// 改用瀏覽器原生列印，由使用者在列印對話框選擇「另存為 PDF」。輸出的 PDF
// 文字為原生文字（非圖片截圖），可選取/複製，中文亦由瀏覽器/系統字型直接
// 渲染，不會有字型不支援造成的亂碼問題。
// 分頁邏輯改用純 CSS：
//   - class="pdf-row" 的區塊套用 page-break-inside: avoid，避免表格列/小計/
//     簽署欄等區塊被從中間裁斷到下一頁
//   - class="pdf-page-break" 的區塊套用 page-break-before: always，強制
//     Summary 頁與 Breakdown 頁分頁
//
// 實作改用「獨立視窗（window.open）」而非隱藏 iframe：
// iOS Safari／Chrome 對隱藏或零尺寸 iframe 呼叫 contentWindow.print() 存在已知
// 限制——實際觸發列印的常常是「外層主頁面」本身（即使用者畫面上目前顯示的整個
// App 介面），而非 iframe 裡準備好的發票/報價單版面，導致匯出結果變成網站截圖
// 而非正確文件內容。改用 window.open() 開啟同源的獨立視窗、直接對該視窗呼叫
// print()，可在所有主流瀏覽器（含 iOS Safari）穩定印出視窗本身的內容。
function renderHtmlToPdfAndSave(html, fileName, btn, busyLabel, outerTitle) {
  return new Promise((resolve) => {
    const originalHtml = btn ? btn.innerHTML : ''
    if (btn) {
      btn.disabled = true
      btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1.5"></i>${busyLabel || '匯出中...'}`
    }

    const restoreBtn = () => {
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalHtml
      }
    }

    // 檔名（去除 .pdf 副檔名）／outerTitle 作為列印視窗標題，部分瀏覽器
    // 另存為 PDF 時會以視窗標題作為預設檔名
    const docTitle = outerTitle || String(fileName || '').replace(/\.pdf$/i, '')

    const printLang = (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'zh-Hant'
    const printDocHtml = `<!DOCTYPE html>
<html lang="${printLang}">
<head>
<meta charset="UTF-8">
<title>${Fmt.escapeHtml(docTitle)}</title>
<style>
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: -apple-system, 'PingFang TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', Helvetica, Arial, sans-serif;
    color: #1f2937;
    padding: 7mm 10mm 10mm 10mm;
  }
  table { border-collapse: collapse; width: 100%; }
  .pdf-row { page-break-inside: avoid; }
  .pdf-page-break { page-break-before: always; }
  @page { size: A4; margin: 6mm 8mm 12mm 8mm; }
  @media print {
    .pdf-row { page-break-inside: avoid; }
    .pdf-page-break { page-break-before: always; }
  }
</style>
</head>
<body>${html}</body>
</html>`

    // 以使用者點擊的同一輪事件循環內同步呼叫 window.open，避免被瀏覽器的
    // 彈出視窗攔截器擋下（大多數瀏覽器僅允許由使用者手勢直接觸發的 open）
    const printWin = window.open('', '_blank')
    if (!printWin) {
      showToast('無法開啟列印視窗，請允許此網站的彈出視窗後再試', 'error')
      restoreBtn()
      resolve()
      return
    }

    printWin.document.open()
    printWin.document.write(printDocHtml)
    printWin.document.close()

    let done = false
    const finish = () => {
      if (done) return
      done = true
      restoreBtn()
      // 延遲關閉視窗，避免部分瀏覽器在列印對話框仍讀取視窗內容時被中途關閉；
      // 若使用者已自行關閉視窗，closed 已為 true，略過即可
      setTimeout(() => {
        try {
          if (!printWin.closed) printWin.close()
        } catch (err) {
          // 忽略跨視窗存取時可能的例外
        }
      }, 1000)
      resolve()
    }

    let printed = false
    const triggerPrint = () => {
      if (printed) return
      printed = true
      try {
        printWin.focus()
        // afterprint：使用者完成列印/另存為 PDF 對話框（無論確認或取消）後觸發
        printWin.addEventListener('afterprint', finish)
        printWin.print()
      } catch (err) {
        console.error(err)
        showToast('PDF 匯出失敗，請稍後再試', 'error')
        finish()
        return
      }
      // 保底：部分瀏覽器（尤其行動裝置）不會觸發 afterprint，逾時後仍還原按鈕狀態
      setTimeout(finish, 4000)
    }

    // 等待版面內的圖片（Logo）載入完成再觸發列印，避免圖片還沒渲染出來
    const images = Array.from(printWin.document.images || [])
    if (images.length === 0) {
      setTimeout(triggerPrint, 150)
    } else {
      let pending = images.length
      const onImgDone = () => {
        pending -= 1
        if (pending <= 0) setTimeout(triggerPrint, 50)
      }
      images.forEach((img) => {
        if (img.complete) {
          onImgDone()
        } else {
          img.addEventListener('load', onImgDone)
          img.addEventListener('error', onImgDone)
        }
      })
      // 保底逾時：圖片載入異常久時，仍強制觸發列印
      setTimeout(triggerPrint, 3000)
    }
  })
}

// 下載檔名用：移除檔名中不允許/易造成問題的字元（保留中英數字、括號、空格、連字號）
function sanitizeFileNamePart(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '').trim()
}

async function exportQuotePdf(q) {
  const btn = document.getElementById('qd-export-pdf')
  const fileName = `${q.quote_no}_${sanitizeFileNamePart(q.company_name)}.pdf`
  const outerTitle = `${q.quote_no} - ${q.company_name || ''}`.trim()
  await renderHtmlToPdfAndSave(buildQuotePdfHtml(q, 'quote'), fileName, btn, '匯出中...', outerTitle)
}

// 匯出單張發票PDF：僅顯示該張發票自己的金額與備註（支援分期收款，如訂金/尾款各自匯出）
async function exportInvoicePdf(q, invId) {
  const invoice = QuoteInvoicesCache.find((i) => String(i.id) === String(invId))
  if (!invoice) {
    showToast('找不到此發票資料', 'error')
    return
  }
  const btn = document.querySelector(`.qd-inv-export[data-inv-id="${invId}"]`)
  const fileName = `${invoice.invoice_no}_${sanitizeFileNamePart(q.company_name)}.pdf`
  const outerTitle = `${invoice.invoice_no} - ${q.company_name || ''}`.trim()
  await renderHtmlToPdfAndSave(buildQuotePdfHtml(q, 'invoice', invoice), fileName, btn, '', outerTitle)
}
