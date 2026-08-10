// ============================================================
// 供應商管理頁：維護判頭/自聘工人/物料供應商資料及評分
// ============================================================
window.Pages = window.Pages || {}

const SUPPLIER_TYPE_META = {
  subcontractor: { label: '分判/判頭', color: 'bg-wood-100 text-wood-700' },
  worker: { label: '自聘工人', color: 'bg-primary-100 text-primary-700' },
  supplier: { label: '物料供應商', color: 'bg-blue-100 text-blue-700' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-600' }
}

const SupplierListState = { search: '', type: '', trade: '', status: 'active', sort: 'name' }
let SupplierListCache = []
let SupplierTradesCache = []

// 星級評分顯示（唯讀），支援小數（如 4.5 顯示半星）
function renderStars(avg, count) {
  const rounded = Math.round(Number(avg || 0) * 2) / 2
  let html = '<span class="text-amber-400 text-sm">'
  for (let i = 1; i <= 5; i++) {
    if (rounded >= i) html += '<i class="fas fa-star"></i>'
    else if (rounded >= i - 0.5) html += '<i class="fas fa-star-half-alt"></i>'
    else html += '<i class="far fa-star"></i>'
  }
  html += '</span>'
  if (count !== undefined) {
    html += ` <span class="text-xs text-gray-400 ml-1">${avg > 0 ? avg : '-'} (${count})</span>`
  }
  return html
}

// 可點擊星級評分輸入元件
function renderStarInput(id, value) {
  let html = `<div id="${id}" class="flex items-center gap-1 text-2xl text-amber-400" data-value="${value || 0}">`
  for (let i = 1; i <= 5; i++) {
    html += `<i class="star-input-icon ${i <= (value || 0) ? 'fas' : 'far'} fa-star cursor-pointer" data-star="${i}"></i>`
  }
  html += '</div>'
  return html
}

function bindStarInput(id) {
  const container = document.getElementById(id)
  if (!container) return
  const icons = container.querySelectorAll('.star-input-icon')
  icons.forEach((icon) => {
    icon.addEventListener('click', () => {
      const val = Number(icon.dataset.star)
      container.dataset.value = val
      icons.forEach((ic) => {
        ic.classList.toggle('fas', Number(ic.dataset.star) <= val)
        ic.classList.toggle('far', Number(ic.dataset.star) > val)
      })
    })
  })
}

Pages.suppliers = async function () {
  mountLayout('suppliers')
  const canManage = Auth.isManagerUp()

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">供應商管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">維護分判商/判頭、自聘工人、物料供應商資料及合作評分</p>
      </div>
      ${canManage ? `<button id="sup-add-btn" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i> 新增供應商/判頭
      </button>` : ''}
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        <div class="relative flex-1 min-w-[200px]">
          <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-sm"></i>
          <input id="sup-search" type="text" placeholder="搜尋姓名/公司/聯絡人/電話..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <select id="sup-type" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">全部類型</option>
          ${Object.entries(SUPPLIER_TYPE_META).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </select>
        <select id="sup-trade" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">全部工種</option>
        </select>
        <select id="sup-status" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="active" selected>僅顯示合作中</option>
          <option value="">全部（含已停用）</option>
          <option value="inactive">僅顯示已停用</option>
        </select>
        <select id="sup-sort" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="name">依名稱排序</option>
          <option value="rating">依評分排序（高到低）</option>
        </select>
        <button id="sup-search-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">
          <i class="fas fa-filter mr-1"></i> 篩選
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">名稱</th>
              <th class="px-4 py-3 font-medium">類型</th>
              <th class="px-4 py-3 font-medium">工種</th>
              <th class="px-4 py-3 font-medium">聯絡方式</th>
              <th class="px-4 py-3 font-medium">評分</th>
              <th class="px-4 py-3 font-medium text-center">狀態</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="sup-table-body">
            <tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `)

  document.getElementById('sup-search-btn').addEventListener('click', () => {
    SupplierListState.search = document.getElementById('sup-search').value.trim()
    SupplierListState.type = document.getElementById('sup-type').value
    SupplierListState.trade = document.getElementById('sup-trade').value
    SupplierListState.status = document.getElementById('sup-status').value
    SupplierListState.sort = document.getElementById('sup-sort').value
    loadSupplierList()
  })
  document.getElementById('sup-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sup-search-btn').click()
  })
  if (canManage) {
    document.getElementById('sup-add-btn').addEventListener('click', () => openSupplierModal(null))
  }

  await loadSupplierTrades()
  loadSupplierList()
}

async function loadSupplierTrades() {
  try {
    const res = await API.get('/suppliers/trades')
    SupplierTradesCache = res.data
    const sel = document.getElementById('sup-trade')
    if (sel) {
      sel.innerHTML =
        '<option value="">全部工種</option>' +
        SupplierTradesCache.map((t) => `<option value="${Fmt.escapeHtml(t)}">${Fmt.escapeHtml(t)}</option>`).join('')
    }
  } catch (err) {
    console.error(err)
  }
}

async function loadSupplierList() {
  const tbody = document.getElementById('sup-table-body')
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/suppliers', {
      search: SupplierListState.search,
      type: SupplierListState.type,
      trade: SupplierListState.trade,
      status: SupplierListState.status,
      sort: SupplierListState.sort
    })
    SupplierListCache = res.data
    renderSupplierTable(SupplierListCache)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderSupplierTable(list) {
  const canManage = Auth.isManagerUp()
  const tbody = document.getElementById('sup-table-body')
  if (!tbody) return
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">尚無符合條件的供應商/判頭資料</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((s) => {
      const meta = SUPPLIER_TYPE_META[s.type] || { label: s.type, color: 'bg-gray-100 text-gray-600' }
      const contact = [s.contact_person, s.phone || s.mobile].filter(Boolean).join(' · ')
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/suppliers/${s.id}'">
        <td class="px-4 py-3">
          <p class="font-medium text-gray-800">${Fmt.escapeHtml(s.name)}</p>
        </td>
        <td class="px-4 py-3">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(s.trade || '-')}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(contact || '-')}</td>
        <td class="px-4 py-3">${renderStars(s.avg_rating, s.rating_count)}</td>
        <td class="px-4 py-3 text-center">
          ${s.status === 'active'
            ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">合作中</span>'
            : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-500">已停用</span>'}
        </td>
        <td class="px-4 py-3 text-right" onclick="event.stopPropagation()">
          <a href="/suppliers/${s.id}" class="text-primary-600 hover:underline text-xs mr-2">查看</a>
          ${canManage ? `<button class="sup-edit-btn text-gray-500 hover:underline text-xs" data-id="${s.id}">編輯</button>` : ''}
        </td>
      </tr>`
    })
    .join('')

  if (canManage) {
    tbody.querySelectorAll('.sup-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const supplier = SupplierListCache.find((x) => x.id === Number(btn.dataset.id))
        openSupplierModal(supplier)
      })
    })
  }
}

function openSupplierModal(supplier) {
  const isEdit = !!supplier
  const s = supplier || {}
  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">${isEdit ? '編輯供應商/判頭資料' : '新增供應商/判頭'}</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">名稱（判頭/工人姓名 或 供應商公司名稱） <span class="text-red-500">*</span></label>
            <input id="sm-name" type="text" value="${Fmt.escapeHtml(s.name || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">類型</label>
            <select id="sm-type" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              ${Object.entries(SUPPLIER_TYPE_META).map(([k, v]) => `<option value="${k}" ${(s.type || 'subcontractor') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">工種/專長</label>
            <select id="sm-trade" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="">請選擇</option>
              ${SupplierTradesCache.map((t) => `<option value="${Fmt.escapeHtml(t)}" ${s.trade === t ? 'selected' : ''}>${Fmt.escapeHtml(t)}</option>`).join('')}
              <option value="__custom__" ${s.trade && !SupplierTradesCache.includes(s.trade) ? 'selected' : ''}>其他（自訂）</option>
            </select>
            <input id="sm-trade-custom" type="text" value="${s.trade && !SupplierTradesCache.includes(s.trade) ? Fmt.escapeHtml(s.trade) : ''}"
              placeholder="輸入自訂工種名稱"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1.5 focus:ring-2 focus:ring-primary-500 outline-none ${s.trade && !SupplierTradesCache.includes(s.trade) ? '' : 'hidden'}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">聯絡人</label>
            <input id="sm-contact" type="text" value="${Fmt.escapeHtml(s.contact_person || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">電話</label>
            <input id="sm-phone" type="text" value="${Fmt.escapeHtml(s.phone || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">手機</label>
            <input id="sm-mobile" type="text" value="${Fmt.escapeHtml(s.mobile || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">身份證/商業登記號</label>
            <input id="sm-id-number" type="text" value="${Fmt.escapeHtml(s.id_number || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">地址</label>
            <input id="sm-address" type="text" value="${Fmt.escapeHtml(s.address || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">收款銀行帳戶</label>
            <input id="sm-bank" type="text" value="${Fmt.escapeHtml(s.bank_account || '')}" placeholder="選填，方便付款作業" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">備註</label>
            <textarea id="sm-notes" rows="2" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">${Fmt.escapeHtml(s.notes || '')}</textarea>
          </div>
          <div class="col-span-2">
            <label class="flex items-center gap-2 text-sm text-gray-600">
              <input id="sm-active" type="checkbox" ${s.status !== 'inactive' ? 'checked' : ''} class="rounded" /> 合作中（可供工程指派選用）
            </label>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button id="sm-cancel" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
        <button id="sm-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">儲存</button>
      </div>
    </div>`)

  document.getElementById('sm-cancel').addEventListener('click', closeModal)
  document.getElementById('sm-trade').addEventListener('change', (e) => {
    const customInput = document.getElementById('sm-trade-custom')
    if (e.target.value === '__custom__') {
      customInput.classList.remove('hidden')
      customInput.focus()
    } else {
      customInput.classList.add('hidden')
      customInput.value = ''
    }
  })
  document.getElementById('sm-submit').addEventListener('click', async () => {
    const name = document.getElementById('sm-name').value.trim()
    if (!name) {
      showToast('請填寫名稱', 'error')
      return
    }
    const tradeSelectVal = document.getElementById('sm-trade').value
    const trade = tradeSelectVal === '__custom__'
      ? document.getElementById('sm-trade-custom').value.trim()
      : tradeSelectVal
    const payload = {
      name,
      type: document.getElementById('sm-type').value,
      trade: trade || null,
      contact_person: document.getElementById('sm-contact').value.trim() || null,
      phone: document.getElementById('sm-phone').value.trim() || null,
      mobile: document.getElementById('sm-mobile').value.trim() || null,
      id_number: document.getElementById('sm-id-number').value.trim() || null,
      address: document.getElementById('sm-address').value.trim() || null,
      bank_account: document.getElementById('sm-bank').value.trim() || null,
      notes: document.getElementById('sm-notes').value.trim() || null,
      status: document.getElementById('sm-active').checked ? 'active' : 'inactive'
    }
    try {
      if (isEdit) {
        await API.put(`/suppliers/${s.id}`, payload)
        showToast('資料已更新')
      } else {
        await API.post('/suppliers', payload)
        showToast('已新增供應商/判頭資料')
      }
      closeModal()
      loadSupplierList()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

// ============================================================
// 供應商詳情頁：完整資料 + 評分歷史 + 新增評分
// ============================================================
let SupplierDetailData = null

Pages.supplierDetail = async function (id) {
  mountLayout('suppliers')
  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    await loadSupplierTrades()
    const res = await API.get(`/suppliers/${id}`)
    SupplierDetailData = res.data
    renderSupplierDetail(SupplierDetailData)
  } catch (err) {
    setMainContent(`
      <div class="text-center py-20">
        <p class="text-red-400 mb-3">${err.message}</p>
        <a href="/suppliers" class="text-primary-600 hover:underline text-sm">回供應商列表</a>
      </div>`)
  }
}

function renderSupplierDetail(s) {
  const canManage = Auth.isManagerUp()
  const canDelete = Auth.isAdmin()
  const meta = SUPPLIER_TYPE_META[s.type] || { label: s.type, color: 'bg-gray-100 text-gray-600' }

  setMainContent(`
    <div class="max-w-4xl mx-auto">
      <div class="flex items-start justify-between mb-5">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-800">${Fmt.escapeHtml(s.name)}</h1>
            ${statusBadge(meta)}
            ${s.status === 'active'
              ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">合作中</span>'
              : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-500">已停用</span>'}
          </div>
          <p class="text-sm text-gray-500 mt-1">${Fmt.escapeHtml(s.trade || '未分類工種')}</p>
        </div>
        <div class="flex items-center gap-2">
          ${canManage ? `<button id="sd-edit-btn" class="bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 text-sm font-medium px-3.5 py-2 rounded-lg">
            <i class="fas fa-pen mr-1.5"></i>編輯
          </button>` : ''}
          <a href="/suppliers" class="text-sm text-gray-500 hover:text-gray-700 px-2"><i class="fas fa-arrow-left mr-1"></i>返回</a>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <!-- 基本資料 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 class="text-sm font-bold text-gray-700 mb-3"><i class="fas fa-id-card mr-1.5 text-primary-600"></i>基本資料</h2>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div><p class="text-xs text-gray-400">聯絡人</p><p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(s.contact_person || '-')}</p></div>
              <div><p class="text-xs text-gray-400">電話</p><p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(s.phone || '-')}</p></div>
              <div><p class="text-xs text-gray-400">手機</p><p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(s.mobile || '-')}</p></div>
              <div><p class="text-xs text-gray-400">身份證/商業登記號</p><p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(s.id_number || '-')}</p></div>
              <div class="col-span-2"><p class="text-xs text-gray-400">地址</p><p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(s.address || '-')}</p></div>
              <div class="col-span-2"><p class="text-xs text-gray-400">收款銀行帳戶</p><p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(s.bank_account || '-')}</p></div>
              ${s.notes ? `<div class="col-span-2"><p class="text-xs text-gray-400">備註</p><p class="text-gray-700 mt-0.5 whitespace-pre-wrap">${Fmt.escapeHtml(s.notes)}</p></div>` : ''}
            </div>
          </div>

          <!-- 評分歷史 -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-bold text-gray-700"><i class="fas fa-star mr-1.5 text-amber-400"></i>評分紀錄</h2>
              ${canManage ? `<button id="sd-add-rating-btn" class="text-primary-600 hover:underline text-xs font-medium"><i class="fas fa-plus mr-1"></i>新增評分</button>` : ''}
            </div>
            <div id="sd-ratings-list">
              ${s.ratings.length
                ? s.ratings
                    .map(
                      (r) => `
                    <div class="flex items-start justify-between py-3 border-b border-gray-50 last:border-0">
                      <div>
                        ${renderStars(r.rating)}
                        <p class="text-sm text-gray-700 mt-1">${r.comment ? Fmt.escapeHtml(r.comment) : '<span class="text-gray-400">無評語</span>'}</p>
                        <p class="text-xs text-gray-400 mt-1">${Fmt.date(r.rated_at)} · ${Fmt.escapeHtml(r.rated_by_name || '-')}${r.order_no ? ' · 訂單 ' + Fmt.escapeHtml(r.order_no) : ''}</p>
                      </div>
                      ${canDelete ? `<button class="sd-del-rating-btn text-red-400 hover:text-red-600 text-xs" data-id="${r.id}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>`
                    )
                    .join('')
                : '<p class="text-sm text-gray-400 py-6 text-center">尚無評分紀錄</p>'}
            </div>
          </div>
        </div>

        <!-- 側邊：評分總覽 -->
        <div class="space-y-6">
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p class="text-xs text-gray-400 mb-1">平均評分</p>
            <p class="text-3xl font-bold text-amber-500">${s.avg_rating > 0 ? s.avg_rating : '-'}</p>
            <div class="mt-2">${renderStars(s.avg_rating)}</div>
            <p class="text-xs text-gray-400 mt-2">共 ${s.rating_count} 筆評分</p>
          </div>
        </div>
      </div>
    </div>`)

  if (canManage) {
    document.getElementById('sd-edit-btn').addEventListener('click', () => openSupplierModal(s))
    document.getElementById('sd-add-rating-btn').addEventListener('click', () => openRatingModal(s.id))
  }
  if (canDelete) {
    document.querySelectorAll('.sd-del-rating-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteSupplierRating(s.id, Number(btn.dataset.id)))
    })
  }
}

function openRatingModal(supplierId) {
  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">新增評分</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">評分 <span class="text-red-500">*</span></label>
          ${renderStarInput('rm-stars', 5)}
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">評分日期</label>
          <input id="rm-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">評語</label>
          <textarea id="rm-comment" rows="3" placeholder="施工品質、配合度、準時程度等（選填）" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button id="rm-cancel" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
        <button id="rm-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">送出評分</button>
      </div>
    </div>`)

  bindStarInput('rm-stars')
  document.getElementById('rm-cancel').addEventListener('click', closeModal)
  document.getElementById('rm-submit').addEventListener('click', async () => {
    const rating = Number(document.getElementById('rm-stars').dataset.value)
    if (!rating) {
      showToast('請選擇評分星數', 'error')
      return
    }
    try {
      await API.post(`/suppliers/${supplierId}/ratings`, {
        rating,
        rated_at: document.getElementById('rm-date').value,
        comment: document.getElementById('rm-comment').value.trim() || null
      })
      showToast('評分已新增')
      closeModal()
      Pages.supplierDetail(supplierId)
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

async function deleteSupplierRating(supplierId, ratingId) {
  if (!confirm('確定要刪除此筆評分紀錄嗎？')) return
  try {
    await API.delete(`/suppliers/${supplierId}/ratings/${ratingId}`)
    showToast('已刪除評分')
    Pages.supplierDetail(supplierId)
  } catch (err) {
    showToast(err.message, 'error')
  }
}
