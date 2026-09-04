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
            <div id="qd-invoice-add-form" class="hidden mb-3 p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[11px] text-gray-400">金額 (${Fmt.escapeHtml(q.currency || 'HKD')})</label>
                  <input id="qd-invoice-amount-input" type="number" step="0.01" min="0.01" class="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="例：51800" />
                </div>
                <div>
                  <label class="text-[11px] text-gray-400">發票日期</label>
                  <input id="qd-invoice-date-input" type="date" class="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value="${new Date().toISOString().slice(0, 10)}" />
                </div>
              </div>
              <div>
                <label class="text-[11px] text-gray-400">總共分幾期（選填，供PDF顯示「第X期／共Y期」，如訂金+尾款共2期）</label>
                <input id="qd-invoice-installment-total-input" type="number" step="1" min="1" class="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="例：2（不填則PDF僅顯示期數，不顯示共幾期）" />
              </div>
              <div>
                <label class="text-[11px] text-gray-400">備註（此張發票專屬，如「訂金 Deposit payment」）</label>
                <textarea id="qd-invoice-remark-input" rows="2" class="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="例：訂金 Deposit payment"></textarea>
              </div>
              <div class="flex justify-end gap-2">
                <button id="qd-invoice-cancel-btn" class="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">取消</button>
                <button id="qd-invoice-save-btn" class="text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg">
                  <i class="fas fa-save mr-1"></i>建立發票
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
  bind('qd-invoice-add-btn', () => toggleInvoiceAddForm(true))
  bind('qd-invoice-cancel-btn', () => toggleInvoiceAddForm(false))
  bind('qd-invoice-save-btn', () => createQuoteInvoice(q))

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
// ============================================================
let QuoteInvoicesCache = []

function toggleInvoiceAddForm(show) {
  const form = document.getElementById('qd-invoice-add-form')
  if (!form) return
  form.classList.toggle('hidden', !show)
  if (show) {
    const amountInput = document.getElementById('qd-invoice-amount-input')
    if (amountInput) { amountInput.value = ''; amountInput.focus() }
    const remarkInput = document.getElementById('qd-invoice-remark-input')
    if (remarkInput) remarkInput.value = ''
    const installmentTotalInput = document.getElementById('qd-invoice-installment-total-input')
    if (installmentTotalInput) installmentTotalInput.value = ''
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

async function createQuoteInvoice(q) {
  const amountInput = document.getElementById('qd-invoice-amount-input')
  const dateInput = document.getElementById('qd-invoice-date-input')
  const remarkInput = document.getElementById('qd-invoice-remark-input')
  const installmentTotalInput = document.getElementById('qd-invoice-installment-total-input')
  const amount = Number(amountInput ? amountInput.value : 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('請輸入有效金額', 'error')
    return
  }
  const installmentTotal = installmentTotalInput && installmentTotalInput.value ? Number(installmentTotalInput.value) : undefined
  const btn = document.getElementById('qd-invoice-save-btn')
  const originalHtml = btn ? btn.innerHTML : ''
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>建立中...' }
  try {
    await API.post(`/quotes/${q.id}/invoices`, {
      amount,
      issue_date: dateInput ? dateInput.value : undefined,
      remark: remarkInput ? remarkInput.value.trim() : '',
      installment_total: installmentTotal
    })
    showToast('發票已建立')
    toggleInvoiceAddForm(false)
    loadQuoteInvoices(q)
  } catch (err) {
    showToast(err.message || '建立失敗', 'error')
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
function buildQuotePdfHtml(q, docType, invoiceData) {
  docType = docType || 'quote'
  const isInvoice = docType === 'invoice'
  const siteAddress = q.site_address || q.customer_address || ''
  const esc = Fmt.escapeHtml
  const docLabel = isInvoice ? '發票 INVOICE' : '報價單 QUOTATION'
  const docNo = isInvoice ? invoiceData.invoice_no : q.quote_no
  const docNoLabel = isInvoice ? '發票編號：' : '報價單號：'
  const issueDate = isInvoice ? Fmt.date(invoiceData.issue_date) : Fmt.date(q.created_at)
  const issueDateLabel = isInvoice ? '發票日期：' : '日期：'
  const footerNote = isInvoice ? COMPANY_INFO.invoiceFooterNote : COMPANY_INFO.footerNote
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
      <td style="padding:6px 4px;color:#9ca3af;">${runningIdx}</td>
      <td style="padding:6px 4px;color:#4b5563;">${esc(it.location || '-')}</td>
      <td style="padding:6px 4px;color:#1f2937;">${esc(it.item_name)}${it.description ? `<div style="font-size:10px;color:#4b5563;margin-top:1px;">${esc(it.description)}</div>` : ''}</td>
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
      <td style="padding:7px 6px;text-align:right;color:#1f2937;">${group.subtotal.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`).join('')

  const discountAmount = q.discount_value ? (q.subtotal - (q.total_amount - q.tax_amount)) : 0

  const discountRow = q.discount_value ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
      <span>${q.discount_type === 'percent' ? `折扣 (${q.discount_value}%)` : '折扣'}</span>
      <span>-${Fmt.currency(discountAmount, q.currency, 2)}</span>
    </div>` : ''

  const taxRow = q.tax_amount ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
      <span>稅額 (${(q.tax_rate * 100).toFixed(0)}%)</span>
      <span>${Fmt.currency(q.tax_amount, q.currency, 2)}</span>
    </div>` : ''

  // 發票：顯示該張發票自己的備註（invoiceData.remark，如「訂金 Deposit payment」），不顯示報價單固定條款/免責聲明
  // 報價單：維持原有「條款/付款方式」（固定免責聲明清單已按需求移除）
  const termsBlock = isInvoice
    ? (invoiceData.remark ? `
    <div class="pdf-row" style="margin-top:18px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">備註</div>
      <div style="font-size:11px;color:#4b5563;white-space:pre-line;">${esc(invoiceData.remark)}</div>
    </div>` : '')
    : (q.terms ? `
    <div class="pdf-row" style="margin-top:18px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">條款/付款方式</div>
      <div style="font-size:11px;color:#4b5563;white-space:pre-line;margin-bottom:6px;">${esc(q.terms)}</div>
    </div>` : '')

  // 報價單：備註 Remarks（客戶條款聲明，如材料範圍/不包含項目/變更需簽署確認等），發票不顯示
  const remarksBlock = (!isInvoice && q.remarks) ? `
    <div class="pdf-row" style="margin-top:18px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">Remarks 備註</div>
      <div style="font-size:10px;color:#6b7280;white-space:pre-line;line-height:1.6;">${esc(q.remarks)}</div>
    </div>` : ''

  // 簽署確認欄：僅在 Summary 頁條款下方顯示一次，供雙方簽署確認（甲方：本公司／乙方：客戶確認）
  const signatureBlock = `
    <div class="pdf-row" style="margin-top:24px;">
      <div style="background:#dce1e7;padding:6px 10px;font-weight:700;font-size:11px;color:#1f2937;">Signed &amp; Confirmation 簽署確認 :</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:14px;font-size:11px;color:#1f2937;">
        <div>
          <div>For on behalf of 代表本公司</div>
          <div style="font-weight:700;margin-top:2px;">${esc(COMPANY_INFO.nameEn.toUpperCase())}</div>
          <div style="height:60px;"></div>
          <div style="border-top:1.5px solid #1f2937;padding-top:4px;line-height:1.8;">
            <div>Signed By 簽署人 :</div>
            <div>Date 簽署確實日期 :</div>
          </div>
        </div>
        <div>
          <div>Accepted &amp; Confirmed By 客戶確認接受</div>
          <div style="height:82px;"></div>
          <div style="border-top:1.5px solid #1f2937;padding-top:4px;line-height:1.8;">
            <div>Signed By 簽署人 :</div>
            <div>Date 簽署確實日期 :</div>
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

  // ---- Summary 頁：報價單顯示各分類滙總（仿照參考報價單 SUMMARY 頁）；
  // 發票僅顯示此張發票專屬的金額與備註，不套用報價單全額/合併備註（支援分期收款） ----
  const summaryTableHtml = isInvoice ? `
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:7px 6px;text-align:left;font-weight:600;">Description 說明</th>
          <th style="padding:7px 6px;text-align:right;font-weight:600;width:110px;">Amount (${q.currency || 'HKD'})</th>
        </tr>
      </thead>
      <tbody>
        <tr class="pdf-row" style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 6px;color:#1f2937;">${invoiceData.remark ? esc(invoiceData.remark) : `本次應付款項（對應報價單 ${esc(q.quote_no)}）`}</td>
          <td style="padding:8px 6px;text-align:right;color:#1f2937;">${displayAmount.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>` : `
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;">
      <thead>
        <tr style="background:${tableHeadColor};color:#fff;">
          <th style="padding:7px 6px;text-align:left;font-weight:600;width:40px;">Item</th>
          <th style="padding:7px 6px;text-align:left;font-weight:600;">Description 工程分類</th>
          <th style="padding:7px 6px;text-align:right;font-weight:600;width:110px;">Amount (${q.currency || 'HKD'})</th>
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
    ? `第 ${invoiceData.seq || 1} 期${invoiceData.installment_total ? ` ／ 共 ${invoiceData.installment_total} 期` : ''}`
    : ''

  const summaryTotalsHtml = isInvoice ? `
    <div class="pdf-row" style="margin-top:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:10px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;color:#4b5563;">
        <tr>
          <td style="padding:3px 0;white-space:nowrap;">工程總額 Contract Total</td>
          <td style="padding:3px 0;text-align:right;white-space:nowrap;font-weight:600;color:#1f2937;">${Fmt.currency(q.total_amount, q.currency, 2)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;white-space:nowrap;">收款期數 Installment</td>
          <td style="padding:3px 0;text-align:right;white-space:nowrap;font-weight:600;color:#1f2937;">${esc(invoiceInstallmentLabel)}</td>
        </tr>
        ${invoicePercent !== null ? `
        <tr>
          <td style="padding:3px 0;white-space:nowrap;">本期應收比例 % of Total</td>
          <td style="padding:3px 0;text-align:right;white-space:nowrap;font-weight:600;color:#1f2937;">${invoicePercent}%</td>
        </tr>` : ''}
        <tr>
          <td colspan="2" style="border-top:1px solid #d1d5db;padding-top:6px;"></td>
        </tr>
        <tr>
          <td style="padding:2px 0;font-weight:700;font-size:13px;color:#1f2937;white-space:nowrap;">Total Due 本次應付${invoicePercent !== null ? `（總額 × ${invoicePercent}%）` : ''}</td>
          <td style="padding:2px 0;text-align:right;font-weight:700;font-size:14px;color:#1f2937;white-space:nowrap;">${Fmt.currency(displayAmount, q.currency, 2)}</td>
        </tr>
      </table>
    </div>` : `
    <div class="pdf-row" style="display:flex;justify-content:flex-end;margin-top:6px;">
      <div style="width:260px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:#1f2937;padding:5px 0;border-top:1px solid #e5e7eb;">
          <span>Grand Total 總計</span><span>${Fmt.currency(q.subtotal, q.currency, 2)}</span>
        </div>
        ${discountRow}
        ${taxRow}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px solid #e5e7eb;margin-top:4px;padding-top:6px;">
          <span>Total 合計</span><span>${Fmt.currency(q.total_amount, q.currency, 2)}</span>
        </div>
      </div>
    </div>`

  const summaryPageHtml = `
    ${headerBlockHtml('SUMMARY 滙總')}

    ${summaryTableHtml}

    ${summaryTotalsHtml}

    <div class="pdf-row" style="margin-top:14px;text-align:center;font-size:11px;font-weight:600;color:#1f2937;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px;">
      ${esc(Fmt.amountInWords(displayAmount, q.currency))}
    </div>

    <div class="pdf-row" style="margin-top:22px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">收款資訊</div>
      <div style="font-size:11px;color:#4b5563;line-height:1.6;">
        <div>Bank: ${esc(COMPANY_INFO.bank.name)}</div>
        <div>Account No.: ${esc(COMPANY_INFO.bank.accountNo)}</div>
        <div>Name: ${esc(COMPANY_INFO.bank.accountName)}</div>
        <div>轉數快(FPS) 電話號碼: ${esc(COMPANY_INFO.bank.fpsPhone)}</div>
      </div>
    </div>

    ${termsBlock}

    ${remarksBlock}

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
  <div style="width:100%;color:#1f2937;background:#fff;box-sizing:border-box;">
    ${summaryPageHtml}
    ${breakdownPageHtml}
  </div>`
}

// 共用的 HTML -> PDF 產生流程（報價單／發票共用，僅版面內容與檔名不同）
// 改用瀏覽器原生列印（隱藏 iframe + window.print()），由使用者在列印對話框
// 選擇「另存為 PDF」。輸出的 PDF 文字為原生文字（非圖片截圖），可選取/複製，
// 中文亦由瀏覽器/系統字型直接渲染，不會有字型不支援造成的亂碼問題。
// 分頁邏輯改用純 CSS：
//   - class="pdf-row" 的區塊套用 page-break-inside: avoid，避免表格列/小計/
//     簽署欄等區塊被從中間裁斷到下一頁
//   - class="pdf-page-break" 的區塊套用 page-break-before: always，強制
//     Summary 頁與 Breakdown 頁分頁
function renderHtmlToPdfAndSave(html, fileName, btn, busyLabel) {
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

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    // 檔名（去除 .pdf 副檔名）作為列印視窗標題，部分瀏覽器（如 Chrome）
    // 另存為 PDF 時會以視窗標題作為預設檔名
    const docTitle = String(fileName || '').replace(/\.pdf$/i, '')

    const printDocHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>${Fmt.escapeHtml(docTitle)}</title>
<style>
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: -apple-system, 'PingFang TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', Helvetica, Arial, sans-serif;
    color: #1f2937;
    padding: 12mm 10mm;
  }
  table { border-collapse: collapse; width: 100%; }
  .pdf-row { page-break-inside: avoid; }
  .pdf-page-break { page-break-before: always; }
  @page { size: A4; margin: 10mm 8mm 14mm 8mm; }
  @media print {
    .pdf-row { page-break-inside: avoid; }
    .pdf-page-break { page-break-before: always; }
  }
</style>
</head>
<body>${html}</body>
</html>`

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(printDocHtml)
    doc.close()

    let done = false
    const finish = () => {
      if (done) return
      done = true
      restoreBtn()
      // 延遲移除 iframe，避免部分瀏覽器在列印對話框仍讀取 iframe 內容時被中途移除
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }, 1000)
      resolve()
    }

    let printed = false
    const triggerPrint = () => {
      if (printed) return
      printed = true
      try {
        iframe.contentWindow.focus()
        // afterprint：使用者完成列印/另存為 PDF 對話框（無論確認或取消）後觸發
        iframe.contentWindow.addEventListener('afterprint', finish)
        iframe.contentWindow.print()
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
    const images = Array.from(doc.images || [])
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
  await renderHtmlToPdfAndSave(buildQuotePdfHtml(q, 'quote'), fileName, btn, '匯出中...')
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
  await renderHtmlToPdfAndSave(buildQuotePdfHtml(q, 'invoice', invoice), fileName, btn, '')
}
