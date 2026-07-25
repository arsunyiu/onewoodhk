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
            <i class="fas fa-file-pdf mr-1.5 text-red-500"></i>匯出PDF
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
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-400 border-b border-gray-100">
                    <th class="py-2 font-medium w-8">#</th>
                    <th class="py-2 font-medium">項目</th>
                    <th class="py-2 font-medium text-right w-16">數量</th>
                    <th class="py-2 font-medium text-right w-16">單位</th>
                    <th class="py-2 font-medium text-right w-24">單價</th>
                    <th class="py-2 font-medium text-right w-16">折扣</th>
                    <th class="py-2 font-medium text-right w-28">小計</th>
                  </tr>
                </thead>
                <tbody>
                  ${q.items.map((it, idx) => `
                  <tr class="border-b border-gray-50">
                    <td class="py-2.5 text-gray-400">${idx + 1}</td>
                    <td class="py-2.5">
                      <p class="text-gray-800">${Fmt.escapeHtml(it.item_name)}</p>
                      ${it.description ? `<p class="text-xs text-gray-400">${Fmt.escapeHtml(it.description)}</p>` : ''}
                    </td>
                    <td class="py-2.5 text-right text-gray-600">${it.quantity}</td>
                    <td class="py-2.5 text-right text-gray-600">${Fmt.escapeHtml(it.unit)}</td>
                    <td class="py-2.5 text-right text-gray-600">${Number(it.unit_price).toLocaleString()}</td>
                    <td class="py-2.5 text-right text-gray-600">${it.discount_pct ? it.discount_pct + '%' : '-'}</td>
                    <td class="py-2.5 text-right font-medium text-gray-800">${Number(it.line_total).toLocaleString()}</td>
                  </tr>`).join('')}
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
// PDF 匯出：使用 jsPDF (CDN) 於前端產生，樣式比照公司實際報價單範本
// ============================================================
function exportQuotePdf(q) {
  if (!window.jspdf) {
    showToast('PDF 匯出元件載入中，請稍後再試', 'error')
    return
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40
  let y = 50

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(COMPANY_INFO.nameEn, marginX, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('QUOTATION', pageWidth - marginX, y, { align: 'right' })

  y += 20
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(COMPANY_INFO.addressEn, marginX, y)
  y += 14
  doc.text(`Tel: ${COMPANY_INFO.phone}  |  ${COMPANY_INFO.contactPerson}  Tel: ${COMPANY_INFO.contactPhone}`, marginX, y)
  doc.setTextColor(0)

  y += 26
  doc.setDrawColor(220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 22

  doc.setFontSize(10)
  const leftColX = marginX
  const rightColX = pageWidth / 2 + 10
  doc.setFont('helvetica', 'bold')
  doc.text('Quote No.:', leftColX, y)
  doc.text('Date:', rightColX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(q.quote_no, leftColX + 65, y)
  doc.text(Fmt.date(q.created_at), rightColX + 40, y)

  y += 18
  doc.setFont('helvetica', 'bold')
  doc.text('Valid Until:', leftColX, y)
  doc.text('Customer:', rightColX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(Fmt.date(q.valid_until), leftColX + 65, y)
  doc.text(q.company_name, rightColX + 55, y, { maxWidth: pageWidth - rightColX - 55 - marginX })

  const siteAddress = q.site_address || q.customer_address
  if (siteAddress) {
    y += 18
    doc.setFont('helvetica', 'bold')
    doc.text('Site Address:', leftColX, y)
    doc.setFont('helvetica', 'normal')
    doc.text(siteAddress, leftColX + 80, y, { maxWidth: pageWidth - leftColX - 80 - marginX })
  }

  y += 30

  // 明細表頭
  const col = { no: marginX, desc: marginX + 30, amount: pageWidth - marginX }
  doc.setFillColor(37, 99, 235)
  doc.rect(marginX, y - 12, pageWidth - marginX * 2, 20, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('No.', col.no + 4, y + 2)
  doc.text('Description', col.desc, y + 2)
  doc.text('Amount', col.amount - 4, y + 2, { align: 'right' })
  doc.setTextColor(0)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  q.items.forEach((it, idx) => {
    const lines = doc.splitTextToSize(
      it.item_name + (it.description ? ' — ' + it.description : ''),
      col.amount - col.desc - 60
    )
    const lineHeight = 12
    const blockHeight = Math.max(lineHeight * lines.length, 16)

    if (y + blockHeight > 760) {
      doc.addPage()
      y = 50
    }

    doc.text(String(idx + 1), col.no + 4, y)
    doc.text(lines, col.desc, y)
    doc.text(Number(it.line_total).toLocaleString(), col.amount - 4, y, { align: 'right' })
    y += blockHeight
    doc.setDrawColor(235)
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4)
  })

  y += 10
  doc.setDrawColor(220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 18

  const totalsX = pageWidth - marginX - 160
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', totalsX, y)
  doc.text(Fmt.currency(q.subtotal, q.currency), pageWidth - marginX - 4, y, { align: 'right' })

  if (q.discount_value) {
    y += 16
    const label = q.discount_type === 'percent' ? `Discount (${q.discount_value}%):` : 'Discount:'
    doc.text(label, totalsX, y)
    doc.text('-' + Fmt.currency(q.subtotal - (q.total_amount - q.tax_amount), q.currency), pageWidth - marginX - 4, y, { align: 'right' })
  }
  if (q.tax_amount) {
    y += 16
    doc.text(`Tax (${(q.tax_rate * 100).toFixed(0)}%):`, totalsX, y)
    doc.text(Fmt.currency(q.tax_amount, q.currency), pageWidth - marginX - 4, y, { align: 'right' })
  }

  y += 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Total:', totalsX, y)
  doc.text(Fmt.currency(q.total_amount, q.currency), pageWidth - marginX - 4, y, { align: 'right' })

  y += 34
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Bank Information', marginX, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.text(`Bank: ${COMPANY_INFO.bank.name}   Account No.: ${COMPANY_INFO.bank.accountNo}   Name: ${COMPANY_INFO.bank.accountName}`, marginX, y)

  if (q.terms) {
    y += 22
    doc.setFont('helvetica', 'bold')
    doc.text('Terms:', marginX, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    const termLines = doc.splitTextToSize(q.terms, pageWidth - marginX * 2)
    doc.text(termLines, marginX, y)
    y += termLines.length * 12
  }

  y += 24
  doc.setFontSize(8)
  doc.setTextColor(130)
  doc.text(`${COMPANY_INFO.footerNote}  |  ${COMPANY_INFO.nameZh}  |  Tel: ${COMPANY_INFO.phone}`, marginX, Math.min(y, 800))

  doc.save(`${q.quote_no}.pdf`)
}
