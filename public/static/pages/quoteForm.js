// ============================================================
// 報價建立 / 編輯頁
// ============================================================
window.Pages = window.Pages || {}

const CURRENCY_OPTIONS = [
  { value: 'HKD', label: 'HKD 港幣' },
  { value: 'TWD', label: 'TWD 台幣' },
  { value: 'USD', label: 'USD 美元' },
  { value: 'CNY', label: 'CNY 人民幣' }
]

const QuoteFormState = {
  id: null,
  editable: true,
  customers: [],
  products: [],
  contacts: [],
  salesUsers: [],
  items: [],
  saving: false
}

function blankQuoteItem() {
  return { product_id: null, item_name: '', description: '', unit: '件', quantity: 1, unit_price: 0, discount_pct: 0, category: '', location: '', line_total: 0 }
}

Pages.quoteForm = async function (id) {
  QuoteFormState.id = id ? Number(id) : null
  QuoteFormState.editable = true
  QuoteFormState.items = [blankQuoteItem()]
  QuoteFormState.contacts = []
  QuoteFormState.saving = false

  mountLayout('quotes')
  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    const [custRes, prodRes, userRes] = await Promise.all([
      API.get('/customers', { page_size: 100 }),
      API.get('/products', { is_active: 1 }),
      API.get('/users')
    ])
    QuoteFormState.customers = custRes.data
    // 依分類 A-Z 順序 + 分類內建立順序排列，並附加 A1/A2/B1... 編號方便在選單中尋找對照
    QuoteFormState.products = sortProductsWithCode(prodRes.data)
    QuoteFormState.salesUsers = userRes.data.filter((u) => u.role === 'sales' || u.role === 'manager')

    let existing = null
    if (QuoteFormState.id) {
      const res = await API.get(`/quotes/${QuoteFormState.id}`)
      existing = res.data
      if (!['draft', 'rejected'].includes(existing.status)) {
        QuoteFormState.editable = false
      }
      QuoteFormState.items = existing.items && existing.items.length
        ? existing.items.map((it) => ({
            product_id: it.product_id,
            item_name: it.item_name,
            description: it.description || '',
            unit: it.unit || '件',
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount_pct: it.discount_pct || 0,
            category: it.category || '',
            location: it.location || '',
            // 小計採用資料庫已存值（可能為使用者先前手動調整過的金額，非單純數量*單價*(1-折扣%)）
            line_total: it.line_total != null ? Number(it.line_total) : calcQuoteLineTotal(it)
          }))
        : [blankQuoteItem()]
      if (existing.customer_id) {
        const cRes = await API.get(`/customers/${existing.customer_id}/contacts`)
        QuoteFormState.contacts = cRes.data
      }
    }

    renderQuoteForm(existing)
  } catch (err) {
    setMainContent(`<div class="text-center py-20 text-red-400">${err.message}</div>`)
  }
}

function renderQuoteForm(existing) {
  const isEdit = !!QuoteFormState.id
  const disabled = !QuoteFormState.editable
  const q = existing || {}

  const customerOptions = QuoteFormState.customers
    .map((c) => `<option value="${c.id}" ${q.customer_id === c.id ? 'selected' : ''}>${Fmt.escapeHtml(c.company_name)}</option>`)
    .join('')

  const canAssignOwner = Auth.isManagerUp() && !isEdit
  const ownerOptions = QuoteFormState.salesUsers
    .map((u) => `<option value="${u.id}">${Fmt.escapeHtml(u.name)}（${Auth.roleLabel(u.role)}）</option>`)
    .join('')

  const currencyOptions = CURRENCY_OPTIONS
    .map((c) => `<option value="${c.value}" ${(q.currency || 'HKD') === c.value ? 'selected' : ''}>${c.label}</option>`)
    .join('')

  setMainContent(`
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-gray-800">${isEdit ? '編輯報價單' : '新增報價單'}</h1>
          <p class="text-sm text-gray-500 mt-0.5">${isEdit ? Fmt.escapeHtml(q.quote_no || '') : '建立新的報價單並填寫明細項目'}</p>
        </div>
        <a href="/quotes" class="text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-arrow-left mr-1"></i> 返回列表</a>
      </div>

      ${disabled ? `<div class="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg">
          <i class="fas fa-lock mr-1"></i> 此報價單目前狀態為「${(QuoteStatusMeta[q.status] || {}).label || q.status}」，僅草稿或被拒絕狀態可編輯，以下內容僅供檢視。
        </div>` : ''}

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        <!-- 基本資訊 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">客戶 <span class="text-red-500">*</span></label>
            <select id="qf-customer" ${disabled ? 'disabled' : ''} class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50">
              <option value="">請選擇客戶</option>
              ${customerOptions}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">聯絡人</label>
            <select id="qf-contact" ${disabled ? 'disabled' : ''} class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50">
              <option value="">不指定</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">報價案標題</label>
            <input id="qf-title" ${disabled ? 'disabled' : ''} type="text" value="${Fmt.escapeHtml(q.title || '')}" placeholder="例：辦公室裝修工程報價"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">工程地址 <span class="text-gray-400">(施工地點，如與客戶地址不同請填寫)</span></label>
            <input id="qf-site-address" ${disabled ? 'disabled' : ''} type="text" value="${Fmt.escapeHtml(q.site_address || '')}" placeholder="例：沙田第一城20座3樓H室"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50" />
          </div>

          ${canAssignOwner ? `
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">負責業務</label>
            <select id="qf-owner" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="">預設為自己</option>
              ${ownerOptions}
            </select>
          </div>` : ''}
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">幣別</label>
            <select id="qf-currency" ${disabled ? 'disabled' : ''} class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50">
              ${currencyOptions}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">報價有效期限</label>
            <input id="qf-valid-until" ${disabled ? 'disabled' : ''} type="date" value="${q.valid_until || ''}"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50" />
          </div>
        </div>

        <!-- 明細項目 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold text-gray-700">報價明細</h2>
            ${disabled ? '' : `<button id="qf-add-item" class="text-primary-600 text-sm hover:underline"><i class="fas fa-plus mr-1"></i>新增項目</button>`}
          </div>
          <div class="overflow-x-auto border border-gray-100 rounded-lg">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th class="px-3 py-2 font-medium w-28">工程分類</th>
                  <th class="px-3 py-2 font-medium min-w-[170px]">產品/項目</th>
                  <th class="px-3 py-2 font-medium w-24">Location<br/>位置</th>
                  <th class="px-3 py-2 font-medium min-w-[150px]">說明</th>
                  <th class="px-3 py-2 font-medium w-20">單位</th>
                  <th class="px-3 py-2 font-medium w-20">數量</th>
                  <th class="px-3 py-2 font-medium w-28">單價</th>
                  <th class="px-3 py-2 font-medium w-20">折扣%</th>
                  <th class="px-3 py-2 font-medium text-right w-28">小計</th>
                  <th class="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody id="qf-items-body"></tbody>
            </table>
          </div>
        </div>

        <!-- 折扣/稅率/總計 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">條款/付款方式備註</label>
              <textarea id="qf-terms" ${disabled ? 'disabled' : ''} rows="2" placeholder="例：簽約後7天內支付訂金50%..."
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50">${Fmt.escapeHtml(q.terms || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">備註（內部用）</label>
              <textarea id="qf-notes" ${disabled ? 'disabled' : ''} rows="2"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50">${Fmt.escapeHtml(q.notes || '')}</textarea>
            </div>
          </div>

          <div class="bg-gray-50 rounded-lg p-4 space-y-3">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-500 w-20 shrink-0">整單折扣</label>
              <select id="qf-discount-type" ${disabled ? 'disabled' : ''} class="border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-100">
                <option value="amount" ${(q.discount_type || 'amount') === 'amount' ? 'selected' : ''}>金額</option>
                <option value="percent" ${q.discount_type === 'percent' ? 'selected' : ''}>百分比</option>
              </select>
              <input id="qf-discount-value" ${disabled ? 'disabled' : ''} type="number" min="0" step="0.01" value="${q.discount_value ?? 0}"
                class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right disabled:bg-gray-100" />
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-500 w-20 shrink-0">稅率</label>
              <input id="qf-tax-rate" ${disabled ? 'disabled' : ''} type="number" min="0" step="0.01" value="${q.tax_rate ?? 0}"
                class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right disabled:bg-gray-100" />
              <span class="text-xs text-gray-400 shrink-0">香港無銷售稅，預設為0</span>
            </div>
            <div class="border-t border-gray-200 pt-3 space-y-1 text-sm">
              <div class="flex justify-between text-gray-500"><span>未稅小計</span><span id="qf-subtotal">-</span></div>
              <div class="flex justify-between text-gray-500"><span>稅額</span><span id="qf-tax-amount">-</span></div>
              <div class="flex justify-between font-semibold text-gray-800 text-base"><span>總金額</span><span id="qf-total-amount">-</span></div>
            </div>
          </div>
        </div>

        ${disabled ? '' : `
        <div class="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <a href="/quotes" class="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">取消</a>
          <button id="qf-save-draft" class="bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 text-sm font-medium px-4 py-2.5 rounded-lg">
            儲存草稿
          </button>
          <button id="qf-save-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
            儲存並送出審核
          </button>
        </div>`}
      </div>
    </div>
  `)

  renderQuoteItemsTable()
  bindQuoteFormEvents()
  recalcQuoteTotals()

  if (existing && existing.customer_id) {
    populateContactOptions(existing.contact_id)
  }
}

function calcQuoteLineTotal(it) {
  const qty = Number(it.quantity) || 0
  const price = Number(it.unit_price) || 0
  const disc = Number(it.discount_pct) || 0
  return Math.round(qty * price * (1 - disc / 100) * 100) / 100
}

function renderQuoteItemsTable() {
  const tbody = document.getElementById('qf-items-body')
  if (!tbody) return

  // 分類下拉選單需包含標準分類（PRODUCT_CATEGORIES）以及產品目錄中實際使用的自訂分類（如「Z. 客制工程」），
  // 否則自訂分類的產品會因為分類選單中找不到對應選項而永遠無法被選取（見：新增產品後在報價單沒有選項）
  const customCategories = [...new Set(
    QuoteFormState.products
      .map((p) => p.category)
      .filter((c) => c && !PRODUCT_CATEGORIES.includes(c))
  )]
  const categoryOptionsHtml = [...PRODUCT_CATEGORIES, ...customCategories]

  tbody.innerHTML = QuoteFormState.items
    .map((it, idx) => {
      // 小計預設為 數量*單價*(1-折扣%) 自動計算，但可由使用者手動覆寫（例如整批工程報價需微調金額）
      const lineTotal = it.line_total != null ? Number(it.line_total) : calcQuoteLineTotal(it)
      const editable = QuoteFormState.editable
      // 依此列目前選擇的工程分類，過濾產品下拉選單只顯示該分類下的產品；未選分類前產品選單停用，強制先選分類
      const filteredProducts = it.category
        ? QuoteFormState.products.filter((p) => p.category === it.category)
        : []
      const productSelectDisabled = !editable || !it.category
      return `
      <tr class="item-row border-b border-gray-50" data-idx="${idx}">
        <td class="px-3 py-2 align-top">
          <select class="item-category w-full border border-gray-200 rounded px-2 py-1 text-xs" ${editable ? '' : 'disabled'}>
            <option value="">請先選擇分類</option>
            ${categoryOptionsHtml.map((c) => `<option value="${Fmt.escapeHtml(c)}" ${it.category === c ? 'selected' : ''}>${Fmt.escapeHtml(categoryLabelWithLetter(c))}</option>`).join('')}
          </select>
        </td>
        <td class="px-3 py-2 align-top">
          <select class="item-product w-full border border-gray-200 rounded px-2 py-1 text-xs mb-1" ${productSelectDisabled ? 'disabled' : ''}>
            <option value="">${it.category ? '自訂項目' : '請先選擇分類'}</option>
            ${filteredProducts.map((p) => `<option value="${p.id}" ${it.product_id === p.id ? 'selected' : ''}>${p.product_code ? '[' + Fmt.escapeHtml(p.product_code) + '] ' : ''}${Fmt.escapeHtml(p.name)}</option>`).join('')}
          </select>
          <input class="item-name w-full border border-gray-200 rounded px-2 py-1 text-sm" placeholder="項目名稱" value="${Fmt.escapeHtml(it.item_name)}" ${editable ? '' : 'disabled'} />
        </td>
        <td class="px-3 py-2 align-top">
          <input class="item-location w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="例：廚房/主人浴室" value="${Fmt.escapeHtml(it.location || '')}" ${editable ? '' : 'disabled'} />
        </td>
        <td class="px-3 py-2 align-top">
          <input class="item-desc w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="說明（選填）" value="${Fmt.escapeHtml(it.description || '')}" ${editable ? '' : 'disabled'} />
        </td>
        <td class="px-3 py-2 align-top"><input class="item-unit w-full border border-gray-200 rounded px-2 py-1 text-sm" value="${Fmt.escapeHtml(it.unit)}" ${editable ? '' : 'disabled'} /></td>
        <td class="px-3 py-2 align-top"><input type="number" min="0" step="0.01" class="item-qty w-full border border-gray-200 rounded px-2 py-1 text-sm text-right" value="${it.quantity}" ${editable ? '' : 'disabled'} /></td>
        <td class="px-3 py-2 align-top"><input type="number" min="0" step="0.01" class="item-price w-full border border-gray-200 rounded px-2 py-1 text-sm text-right" value="${it.unit_price}" ${editable ? '' : 'disabled'} /></td>
        <td class="px-3 py-2 align-top"><input type="number" min="0" max="100" step="0.01" class="item-discount w-full border border-gray-200 rounded px-2 py-1 text-sm text-right" value="${it.discount_pct || 0}" ${editable ? '' : 'disabled'} /></td>
        <td class="px-3 py-2 align-top">
          <input type="number" min="0" step="0.01" class="item-line-total w-full border border-gray-200 rounded px-2 py-1 text-sm text-right font-medium text-gray-700" value="${lineTotal}" title="預設為 數量×單價×(1-折扣%)，可手動修改覆寫" ${editable ? '' : 'disabled'} />
        </td>
        <td class="px-3 py-2 align-top text-center">
          ${editable ? `<button class="item-remove text-gray-400 hover:text-red-500" title="刪除項目"><i class="fas fa-trash"></i></button>` : ''}
        </td>
      </tr>`
    })
    .join('')
}

function bindQuoteFormEvents() {
  const customerSel = document.getElementById('qf-customer')
  if (customerSel) {
    customerSel.addEventListener('change', async (e) => {
      const custId = e.target.value
      const contactSel = document.getElementById('qf-contact')
      contactSel.innerHTML = '<option value="">不指定</option>'
      QuoteFormState.contacts = []
      if (!custId) return
      try {
        const res = await API.get(`/customers/${custId}/contacts`)
        QuoteFormState.contacts = res.data
        populateContactOptions()
      } catch (err) {
        showToast(err.message, 'error')
      }
    })
  }

  const addBtn = document.getElementById('qf-add-item')
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      QuoteFormState.items.push(blankQuoteItem())
      renderQuoteItemsTable()
      recalcQuoteTotals()
    })
  }

  ;['qf-discount-type', 'qf-discount-value', 'qf-tax-rate', 'qf-currency'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) {
      el.addEventListener('input', recalcQuoteTotals)
      el.addEventListener('change', recalcQuoteTotals)
    }
  })

  const tbody = document.getElementById('qf-items-body')
  if (!tbody) return

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('.item-row')
    if (!row) return
    const idx = Number(row.dataset.idx)
    if (e.target.classList.contains('item-category')) {
      // 分類切換：重置該列已選的產品（因產品清單將依新分類重新過濾，先前選的產品可能已不在清單內）
      QuoteFormState.items[idx].category = e.target.value
      QuoteFormState.items[idx].product_id = null
      renderQuoteItemsTable()
      recalcQuoteTotals()
    } else if (e.target.classList.contains('item-product')) {
      const pid = e.target.value ? Number(e.target.value) : null
      QuoteFormState.items[idx].product_id = pid
      if (pid) {
        const p = QuoteFormState.products.find((x) => x.id === pid)
        if (p) {
          QuoteFormState.items[idx].item_name = p.name
          QuoteFormState.items[idx].unit = p.unit
          QuoteFormState.items[idx].unit_price = p.unit_price
          QuoteFormState.items[idx].description = p.description || ''
          // 分類已由使用者於「工程分類」欄位選定，此處不再由產品覆寫
          // 選定產品後帶入其單價，小計依公式重新計算（尚未手動調整過，採自動值）
          QuoteFormState.items[idx].line_total = calcQuoteLineTotal(QuoteFormState.items[idx])
        }
      }
      renderQuoteItemsTable()
      recalcQuoteTotals()
    }
  })

  tbody.addEventListener('input', (e) => {
    const row = e.target.closest('.item-row')
    if (!row) return
    const idx = Number(row.dataset.idx)
    const item = QuoteFormState.items[idx]
    if (e.target.classList.contains('item-name')) item.item_name = e.target.value
    else if (e.target.classList.contains('item-desc')) item.description = e.target.value
    else if (e.target.classList.contains('item-location')) item.location = e.target.value
    else if (e.target.classList.contains('item-unit')) item.unit = e.target.value
    else if (e.target.classList.contains('item-line-total')) {
      // 使用者手動修改小計：直接採用輸入值覆寫，不再由數量/單價/折扣重新計算
      item.line_total = Number(e.target.value) || 0
      recalcQuoteTotals()
      return
    } else if (e.target.classList.contains('item-qty')) item.quantity = Number(e.target.value)
    else if (e.target.classList.contains('item-price')) item.unit_price = Number(e.target.value)
    else if (e.target.classList.contains('item-discount')) item.discount_pct = Number(e.target.value)
    else return
    // 數量/單價/折扣變動時，自動依公式重新計算小計（若使用者先前手動覆寫過小計，此處視為以最新輸入的公式結果為準）
    item.line_total = calcQuoteLineTotal(item)
    const cell = row.querySelector('.item-line-total')
    if (cell) cell.value = item.line_total
    recalcQuoteTotals()
  })

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.item-remove')
    if (!btn) return
    if (QuoteFormState.items.length <= 1) {
      showToast('至少須保留一項報價明細', 'error')
      return
    }
    const row = btn.closest('.item-row')
    const idx = Number(row.dataset.idx)
    QuoteFormState.items.splice(idx, 1)
    renderQuoteItemsTable()
    recalcQuoteTotals()
  })

  const draftBtn = document.getElementById('qf-save-draft')
  const submitBtn = document.getElementById('qf-save-submit')
  if (draftBtn) draftBtn.addEventListener('click', () => submitQuoteForm(false))
  if (submitBtn) submitBtn.addEventListener('click', () => submitQuoteForm(true))
}

function populateContactOptions(selectedId) {
  const sel = document.getElementById('qf-contact')
  if (!sel) return
  sel.innerHTML = '<option value="">不指定</option>' +
    QuoteFormState.contacts
      .map((c) => `<option value="${c.id}" ${Number(selectedId) === c.id ? 'selected' : ''}>${Fmt.escapeHtml(c.name)}${c.is_primary ? '（主要）' : ''}</option>`)
      .join('')
}

function recalcQuoteTotals() {
  const discountType = document.getElementById('qf-discount-type')?.value || 'amount'
  const discountValue = Number(document.getElementById('qf-discount-value')?.value) || 0
  const taxRateRaw = Number(document.getElementById('qf-tax-rate')?.value)
  const taxRate = isNaN(taxRateRaw) ? 0 : taxRateRaw
  const currency = document.getElementById('qf-currency')?.value || 'HKD'

  // 未稅小計＝各項目小計加總；小計若曾被使用者手動修改，以該手動值為準（非重新用公式計算）
  const subtotal = QuoteFormState.items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0)
  let afterDiscount = discountType === 'percent' ? subtotal * (1 - discountValue / 100) : subtotal - discountValue
  afterDiscount = Math.max(0, afterDiscount)
  const taxAmount = Math.round(afterDiscount * taxRate * 100) / 100
  const totalAmount = Math.round((afterDiscount + taxAmount) * 100) / 100

  const subtotalEl = document.getElementById('qf-subtotal')
  const taxEl = document.getElementById('qf-tax-amount')
  const totalEl = document.getElementById('qf-total-amount')
  if (subtotalEl) subtotalEl.textContent = Fmt.currency(subtotal, currency)
  if (taxEl) taxEl.textContent = Fmt.currency(taxAmount, currency)
  if (totalEl) totalEl.textContent = Fmt.currency(totalAmount, currency)
}

async function submitQuoteForm(submitAfter) {
  if (QuoteFormState.saving) return

  const customerSel = document.getElementById('qf-customer')
  const customerId = customerSel ? customerSel.value : ''
  if (!customerId) {
    showToast('請選擇客戶', 'error')
    return
  }

  const items = QuoteFormState.items
    .filter((it) => it.item_name && it.item_name.trim())
    .map((it) => ({
      product_id: it.product_id || null,
      item_name: it.item_name.trim(),
      description: it.description ? it.description.trim() : null,
      unit: it.unit || '件',
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      discount_pct: Number(it.discount_pct) || 0,
      category: it.category ? it.category.trim() : null,
      location: it.location ? it.location.trim() : null,
      // 小計可能已被使用者手動覆寫，直接帶出目前顯示的值供後端採用（後端不再無條件用公式覆蓋）
      line_total: Number(it.line_total) || 0
    }))

  if (!items.length) {
    showToast('請至少新增一項報價明細', 'error')
    return
  }
  if (items.some((it) => it.quantity <= 0)) {
    showToast('項目數量需大於 0', 'error')
    return
  }

  const payload = {
    customer_id: Number(customerId),
    contact_id: document.getElementById('qf-contact').value ? Number(document.getElementById('qf-contact').value) : null,
    title: document.getElementById('qf-title').value.trim() || null,
    site_address: document.getElementById('qf-site-address').value.trim() || null,
    currency: document.getElementById('qf-currency').value,
    valid_until: document.getElementById('qf-valid-until').value || null,
    discount_type: document.getElementById('qf-discount-type').value,
    discount_value: Number(document.getElementById('qf-discount-value').value) || 0,
    tax_rate: Number(document.getElementById('qf-tax-rate').value),
    terms: document.getElementById('qf-terms').value.trim() || null,
    notes: document.getElementById('qf-notes').value.trim() || null,
    items
  }
  const ownerSel = document.getElementById('qf-owner')
  if (ownerSel && ownerSel.value) payload.owner_id = Number(ownerSel.value)

  QuoteFormState.saving = true
  const btns = document.querySelectorAll('#qf-save-draft, #qf-save-submit')
  btns.forEach((b) => (b.disabled = true))

  try {
    let quoteId = QuoteFormState.id
    if (quoteId) {
      await API.put(`/quotes/${quoteId}`, payload)
    } else {
      const res = await API.post('/quotes', payload)
      quoteId = res.data.id
    }
    if (submitAfter) {
      await API.post(`/quotes/${quoteId}/submit`, {})
      showToast('報價單已儲存並送出審核')
    } else {
      showToast('報價單已儲存為草稿')
    }
    location.href = '/quotes'
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    QuoteFormState.saving = false
    btns.forEach((b) => (b.disabled = false))
  }
}
