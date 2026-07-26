// ============================================================
// 客戶詳情頁：客戶資訊、聯絡人、跟進紀錄時間軸、歷史報價
// ============================================================
window.Pages = window.Pages || {}

const ACTIVITY_TYPE_META = {
  call:    { label: '電話聯絡', icon: 'fa-phone' },
  meeting: { label: '會議/拜訪', icon: 'fa-people-arrows' },
  email:   { label: 'Email', icon: 'fa-envelope' },
  note:    { label: '備註', icon: 'fa-note-sticky' },
  task:    { label: '待辦事項', icon: 'fa-list-check' }
}

let CustomerDetailData = null

Pages.customerDetail = async function (id) {
  mountLayout('customers')
  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    const res = await API.get(`/customers/${id}`)
    CustomerDetailData = res.data
    renderCustomerDetail(CustomerDetailData)
  } catch (err) {
    setMainContent(`
      <div class="text-center py-20">
        <p class="text-red-400 mb-3">${err.message}</p>
        <a href="/customers" class="text-primary-600 hover:underline text-sm">回客戶列表</a>
      </div>`)
  }
}

function renderCustomerDetail(cust) {
  const meta = CustomerStatusMeta[cust.status] || { label: cust.status, color: 'bg-gray-100 text-gray-600' }
  const canEdit = Auth.isManagerUp() || (Auth.getUser() && Auth.getUser().id === cust.owner_id)

  setMainContent(`
    <div class="max-w-5xl mx-auto">
      <div class="flex items-start justify-between mb-5">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-800">${Fmt.escapeHtml(cust.company_name)}</h1>
            ${statusBadge(meta)}
          </div>
          <p class="text-sm text-gray-500 mt-1">${Fmt.escapeHtml(cust.tax_id || '')} ${cust.industry ? ' · ' + Fmt.escapeHtml(cust.industry) : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          ${canEdit ? `<a href="/customers/${cust.id}/edit" class="bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 text-sm font-medium px-3.5 py-2 rounded-lg">
            <i class="fas fa-pen mr-1.5"></i>編輯
          </a>` : ''}
          <a href="/customers" class="text-sm text-gray-500 hover:text-gray-700 px-2"><i class="fas fa-arrow-left mr-1"></i>返回</a>
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
                <p class="text-gray-400 text-xs">客戶來源</p>
                <p class="text-gray-700">${Fmt.escapeHtml(cust.source || '未填寫')}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">負責業務</p>
                <p class="text-gray-700">${Fmt.escapeHtml(cust.owner_name)}</p>
              </div>
              <div class="col-span-2">
                <p class="text-gray-400 text-xs">地址</p>
                <p class="text-gray-700">${Fmt.escapeHtml([cust.address, cust.city].filter(Boolean).join(', ') || '未填寫')}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">網站</p>
                <p class="text-gray-700">${cust.website ? `<a href="${Fmt.escapeHtml(cust.website)}" target="_blank" class="text-primary-600 hover:underline">${Fmt.escapeHtml(cust.website)}</a>` : '未填寫'}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">信用額度</p>
                <p class="text-gray-700">${Fmt.currency(cust.credit_limit, 'HKD')}</p>
              </div>
              ${cust.notes ? `<div class="col-span-2">
                <p class="text-gray-400 text-xs">備註</p>
                <p class="text-gray-700 whitespace-pre-line">${Fmt.escapeHtml(cust.notes)}</p>
              </div>` : ''}
            </div>
          </div>

          <!-- 聯絡人 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-700">聯絡人</h2>
              <button id="cd-add-contact" class="text-primary-600 text-sm hover:underline"><i class="fas fa-plus mr-1"></i>新增聯絡人</button>
            </div>
            <div id="cd-contacts-list" class="space-y-2"></div>
          </div>

          <!-- 歷史報價 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-semibold text-gray-700 mb-3">歷史報價</h2>
            <div id="cd-quotes-list" class="overflow-x-auto"></div>
          </div>
        </div>

        <!-- 側邊：跟進紀錄時間軸 -->
        <div class="space-y-6">
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-gray-700">跟進紀錄</h2>
              <button id="cd-add-activity" class="text-primary-600 text-sm hover:underline"><i class="fas fa-plus mr-1"></i>新增</button>
            </div>
            <div id="cd-activities-list" class="space-y-4"></div>
          </div>
        </div>
      </div>
    </div>
  `)

  renderContactsList(cust.contacts || [])
  renderActivitiesTimeline(cust.activities || [])
  renderCustomerQuotesList(cust.quotes || [])

  document.getElementById('cd-add-contact').addEventListener('click', () => openContactModal(cust.id))
  document.getElementById('cd-add-activity').addEventListener('click', () => openActivityModal(cust.id))
}

function renderContactsList(contacts) {
  const el = document.getElementById('cd-contacts-list')
  if (!contacts.length) {
    el.innerHTML = `<p class="text-sm text-gray-400 py-2">尚無聯絡人資料</p>`
    return
  }
  el.innerHTML = contacts.map((ct) => `
    <div class="flex items-start justify-between border border-gray-100 rounded-lg p-3">
      <div>
        <p class="text-sm font-medium text-gray-800">
          ${Fmt.escapeHtml(ct.name)}
          ${ct.is_primary ? '<span class="ml-1 px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 text-[10px]">主要</span>' : ''}
          ${ct.title ? `<span class="text-gray-400 text-xs ml-1">${Fmt.escapeHtml(ct.title)}</span>` : ''}
        </p>
        <p class="text-xs text-gray-500 mt-0.5">
          ${[ct.phone && `<i class="fas fa-phone text-[10px] mr-1"></i>${Fmt.escapeHtml(ct.phone)}`,
             ct.mobile && `<i class="fas fa-mobile-screen text-[10px] mr-1"></i>${Fmt.escapeHtml(ct.mobile)}`,
             ct.email && `<i class="fas fa-envelope text-[10px] mr-1"></i>${Fmt.escapeHtml(ct.email)}`]
            .filter(Boolean).join(' &nbsp; ') || '未填寫聯絡方式'}
        </p>
        ${ct.notes ? `<p class="text-xs text-gray-400 mt-1">${Fmt.escapeHtml(ct.notes)}</p>` : ''}
      </div>
    </div>`).join('')
}

function renderActivitiesTimeline(activities) {
  const el = document.getElementById('cd-activities-list')
  if (!activities.length) {
    el.innerHTML = `<p class="text-xs text-gray-400">尚無跟進紀錄</p>`
    return
  }
  el.innerHTML = activities.map((a, idx) => {
    const meta = ACTIVITY_TYPE_META[a.type] || { label: a.type, icon: 'fa-circle' }
    return `
    <div class="flex gap-3">
      <div class="flex flex-col items-center">
        <div class="w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs shrink-0">
          <i class="fas ${meta.icon}"></i>
        </div>
        ${idx < activities.length - 1 ? '<div class="w-px flex-1 bg-gray-100 my-1"></div>' : ''}
      </div>
      <div class="pb-1">
        <p class="text-sm text-gray-700 font-medium">${Fmt.escapeHtml(a.subject)} <span class="text-xs text-gray-400 font-normal">（${meta.label}）</span></p>
        <p class="text-xs text-gray-400 mt-0.5">${Fmt.escapeHtml(a.user_name)} · ${Fmt.datetime(a.activity_date)}</p>
        ${a.content ? `<p class="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-2 whitespace-pre-line">${Fmt.escapeHtml(a.content)}</p>` : ''}
      </div>
    </div>`
  }).join('')
}

function renderCustomerQuotesList(quotes) {
  const el = document.getElementById('cd-quotes-list')
  if (!quotes.length) {
    el.innerHTML = `<p class="text-sm text-gray-400 py-2">尚無報價紀錄</p>`
    return
  }
  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-gray-400 border-b border-gray-100">
          <th class="px-2 py-2 font-medium">報價單號</th>
          <th class="px-2 py-2 font-medium">狀態</th>
          <th class="px-2 py-2 font-medium text-right">金額</th>
          <th class="px-2 py-2 font-medium">有效期限</th>
          <th class="px-2 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        ${quotes.map((q) => {
          const meta = QuoteStatusMeta[q.status] || { label: q.status, color: 'bg-gray-100 text-gray-600' }
          return `
          <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/quotes/${q.id}'">
            <td class="px-2 py-2.5">
              <p class="font-medium text-gray-800">${Fmt.escapeHtml(q.quote_no)}</p>
              <p class="text-xs text-gray-400">${Fmt.escapeHtml(q.title || '')}</p>
            </td>
            <td class="px-2 py-2.5">${statusBadge(meta)}</td>
            <td class="px-2 py-2.5 text-right font-medium text-gray-800">${Number(q.total_amount).toLocaleString()}</td>
            <td class="px-2 py-2.5 text-gray-400">${Fmt.date(q.valid_until)}</td>
            <td class="px-2 py-2.5 text-right"><a href="/quotes/${q.id}" class="text-primary-600 hover:underline text-xs">查看</a></td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`
}

// ---- 新增聯絡人 Modal ----
function openContactModal(customerId) {
  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">新增聯絡人</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">姓名 <span class="text-red-500">*</span></label>
          <input id="ct-name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">職稱</label>
            <input id="ct-title" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div class="flex items-end pb-2">
            <label class="flex items-center gap-2 text-sm text-gray-600">
              <input id="ct-primary" type="checkbox" class="rounded" /> 設為主要聯絡人
            </label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">電話</label>
            <input id="ct-phone" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">手機</label>
            <input id="ct-mobile" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input id="ct-email" type="email" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">備註</label>
          <textarea id="ct-notes" rows="2" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button id="ct-cancel" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
        <button id="ct-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">儲存</button>
      </div>
    </div>`)

  document.getElementById('ct-cancel').addEventListener('click', closeModal)
  document.getElementById('ct-submit').addEventListener('click', async () => {
    const name = document.getElementById('ct-name').value.trim()
    if (!name) {
      showToast('請填寫聯絡人姓名', 'error')
      return
    }
    const payload = {
      name,
      title: document.getElementById('ct-title').value.trim() || null,
      phone: document.getElementById('ct-phone').value.trim() || null,
      mobile: document.getElementById('ct-mobile').value.trim() || null,
      email: document.getElementById('ct-email').value.trim() || null,
      is_primary: document.getElementById('ct-primary').checked,
      notes: document.getElementById('ct-notes').value.trim() || null
    }
    try {
      await API.post(`/customers/${customerId}/contacts`, payload)
      showToast('聯絡人已新增')
      closeModal()
      Pages.customerDetail(customerId)
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

// ---- 新增跟進紀錄 Modal ----
function openActivityModal(customerId) {
  const now = dayjs().format('YYYY-MM-DDTHH:mm')
  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">新增跟進紀錄</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">類型</label>
            <select id="ac-type" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="call">電話聯絡</option>
              <option value="meeting">會議/拜訪</option>
              <option value="email">Email</option>
              <option value="note" selected>備註</option>
              <option value="task">待辦事項</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">日期時間</label>
            <input id="ac-date" type="datetime-local" value="${now}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">主旨 <span class="text-red-500">*</span></label>
          <input id="ac-subject" type="text" placeholder="例：電話確認裝修需求" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">內容</label>
          <textarea id="ac-content" rows="3" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></textarea>
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input id="ac-done" type="checkbox" checked class="rounded" /> 已完成
        </label>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button id="ac-cancel" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
        <button id="ac-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">儲存</button>
      </div>
    </div>`)

  document.getElementById('ac-cancel').addEventListener('click', closeModal)
  document.getElementById('ac-submit').addEventListener('click', async () => {
    const subject = document.getElementById('ac-subject').value.trim()
    if (!subject) {
      showToast('請填寫主旨', 'error')
      return
    }
    const dateVal = document.getElementById('ac-date').value
    const payload = {
      type: document.getElementById('ac-type').value,
      subject,
      content: document.getElementById('ac-content').value.trim() || null,
      activity_date: dateVal ? dayjs(dateVal).toISOString() : null,
      is_done: document.getElementById('ac-done').checked
    }
    try {
      await API.post(`/customers/${customerId}/activities`, payload)
      showToast('跟進紀錄已新增')
      closeModal()
      Pages.customerDetail(customerId)
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}
