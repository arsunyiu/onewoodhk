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
// PDF 匯出：以 HTML/CSS 版面 + html2canvas 轉圖 + jsPDF 拼頁
// （改用瀏覽器原生字型渲染，避免 jsPDF 內建字型不支援中文而產生亂碼）
// ============================================================
function buildQuotePdfHtml(q) {
  const siteAddress = q.site_address || q.customer_address || ''
  const esc = Fmt.escapeHtml

  const itemRows = q.items.map((it, idx) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:7px 4px;color:#9ca3af;">${idx + 1}</td>
      <td style="padding:7px 4px;">
        <div style="color:#1f2937;">${esc(it.item_name)}</div>
        ${it.description ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">${esc(it.description)}</div>` : ''}
      </td>
      <td style="padding:7px 4px;text-align:right;color:#4b5563;">${it.quantity}</td>
      <td style="padding:7px 4px;text-align:right;color:#4b5563;">${esc(it.unit)}</td>
      <td style="padding:7px 4px;text-align:right;color:#4b5563;">${Number(it.unit_price).toLocaleString()}</td>
      <td style="padding:7px 4px;text-align:right;font-weight:600;color:#1f2937;">${Number(it.line_total).toLocaleString()}</td>
    </tr>`).join('')

  const discountRow = q.discount_value ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
      <span>${q.discount_type === 'percent' ? `折扣 (${q.discount_value}%)` : '折扣'}</span>
      <span>-${Fmt.currency(q.subtotal - (q.total_amount - q.tax_amount), q.currency)}</span>
    </div>` : ''

  const taxRow = q.tax_amount ? `
    <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
      <span>稅額 (${(q.tax_rate * 100).toFixed(0)}%)</span>
      <span>${Fmt.currency(q.tax_amount, q.currency)}</span>
    </div>` : ''

  const termsBlock = q.terms ? `
    <div style="margin-top:18px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">條款/付款方式</div>
      <div style="font-size:11px;color:#4b5563;white-space:pre-line;">${esc(q.terms)}</div>
    </div>` : ''

  return `
  <div style="width:760px;padding:36px;font-family:-apple-system,'PingFang TC','Noto Sans CJK TC','Microsoft JhengHei',Helvetica,Arial,sans-serif;color:#1f2937;background:#fff;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:24px;font-weight:700;">${esc(COMPANY_INFO.nameEn)}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:1px;">${esc(COMPANY_INFO.nameZh)}</div>
      </div>
      <div style="font-size:15px;font-weight:600;color:#374151;padding-top:4px;">報價單 QUOTATION</div>
    </div>

    <div style="font-size:11px;color:#6b7280;margin-top:10px;line-height:1.5;">
      <div>${esc(COMPANY_INFO.addressZh)}</div>
      <div>${esc(COMPANY_INFO.addressEn)}</div>
      <div>Tel: ${esc(COMPANY_INFO.phone)} ｜ ${esc(COMPANY_INFO.email)} ｜ ${esc(COMPANY_INFO.website)}</div>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:12px;">
      <div><span style="font-weight:700;">報價單號：</span>${esc(q.quote_no)}</div>
      <div><span style="font-weight:700;">日期：</span>${Fmt.date(q.created_at)}</div>
      <div><span style="font-weight:700;">有效期限：</span>${Fmt.date(q.valid_until)}</div>
      <div><span style="font-weight:700;">客戶：</span>${esc(q.company_name)}</div>
      ${siteAddress ? `<div style="grid-column:1/-1;"><span style="font-weight:700;">工程地址：</span>${esc(siteAddress)}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:11px;">
      <thead>
        <tr style="background:#2563eb;color:#fff;">
          <th style="padding:7px 4px;text-align:left;font-weight:600;width:24px;">No.</th>
          <th style="padding:7px 4px;text-align:left;font-weight:600;">項目說明</th>
          <th style="padding:7px 4px;text-align:right;font-weight:600;width:44px;">數量</th>
          <th style="padding:7px 4px;text-align:right;font-weight:600;width:44px;">單位</th>
          <th style="padding:7px 4px;text-align:right;font-weight:600;width:64px;">單價</th>
          <th style="padding:7px 4px;text-align:right;font-weight:600;width:76px;">小計</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <div style="width:220px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;color:#6b7280;padding:3px 0;">
          <span>未稅小計</span><span>${Fmt.currency(q.subtotal, q.currency)}</span>
        </div>
        ${discountRow}
        ${taxRow}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px solid #e5e7eb;margin-top:4px;padding-top:6px;">
          <span>總金額</span><span>${Fmt.currency(q.total_amount, q.currency)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:22px;">
      <div style="font-weight:700;font-size:11px;color:#1f2937;margin-bottom:4px;">收款資訊</div>
      <div style="font-size:11px;color:#4b5563;">
        Bank: ${esc(COMPANY_INFO.bank.name)}　Account No.: ${esc(COMPANY_INFO.bank.accountNo)}　Name: ${esc(COMPANY_INFO.bank.accountName)}
      </div>
    </div>

    ${termsBlock}

    <div style="margin-top:26px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;">
      ${esc(COMPANY_INFO.footerNote)} ｜ ${esc(COMPANY_INFO.nameZh)} ｜ Tel: ${esc(COMPANY_INFO.phone)}
    </div>
  </div>`
}

async function exportQuotePdf(q) {
  if (!window.jspdf || !window.html2canvas) {
    showToast('PDF 匯出元件載入中，請稍後再試', 'error')
    return
  }
  const btn = document.getElementById('qd-export-pdf')
  const originalHtml = btn ? btn.innerHTML : ''
  if (btn) {
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>匯出中...'
  }

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.innerHTML = buildQuotePdfHtml(q)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container.firstElementChild, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    })

    const { jsPDF } = window.jspdf
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pdfWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL('image/png')

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight

    while (heightLeft > 0.5) {
      position -= pdfHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight
    }

    pdf.save(`${q.quote_no}.pdf`)
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
