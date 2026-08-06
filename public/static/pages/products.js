// ============================================================
// 產品/服務項目目錄頁
// ============================================================
window.Pages = window.Pages || {}

const ProductListState = { search: '', category: '', is_active: '1' }
let ProductListCache = []

Pages.products = async function () {
  mountLayout('products')
  const canManage = Auth.isManagerUp()

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">產品目錄</h1>
        <p class="text-sm text-gray-500 mt-0.5">管理報價可選用的產品/服務項目與標準售價</p>
      </div>
      ${canManage ? `<button id="prod-add-btn" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i> 新增產品
      </button>` : ''}
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        <div class="relative flex-1 min-w-[200px]">
          <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-sm"></i>
          <input id="prod-search" type="text" placeholder="搜尋產品名稱 / SKU..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <select id="prod-category" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none w-48">
          <option value="">全部分類</option>
          ${PRODUCT_CATEGORIES.map((c) => `<option value="${Fmt.escapeHtml(c)}">${Fmt.escapeHtml(c)}</option>`).join('')}
        </select>
        <select id="prod-active" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="1" selected>僅顯示上架中</option>
          <option value="">全部（含已下架）</option>
          <option value="0">僅顯示已下架</option>
        </select>
        <button id="prod-search-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg">
          <i class="fas fa-filter mr-1"></i> 篩選
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">產品/項目名稱</th>
              <th class="px-4 py-3 font-medium">SKU</th>
              <th class="px-4 py-3 font-medium">分類</th>
              <th class="px-4 py-3 font-medium">單位</th>
              <th class="px-4 py-3 font-medium text-right">標準售價</th>
              ${canManage ? '<th class="px-4 py-3 font-medium text-right">成本價</th>' : ''}
              <th class="px-4 py-3 font-medium text-center">狀態</th>
              ${canManage ? '<th class="px-4 py-3 font-medium"></th>' : ''}
            </tr>
          </thead>
          <tbody id="prod-table-body">
            <tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `)

  document.getElementById('prod-search-btn').addEventListener('click', () => {
    ProductListState.search = document.getElementById('prod-search').value.trim()
    ProductListState.category = document.getElementById('prod-category').value
    ProductListState.is_active = document.getElementById('prod-active').value
    loadProductList()
  })
  document.getElementById('prod-category').addEventListener('change', () => {
    document.getElementById('prod-search-btn').click()
  })
  document.getElementById('prod-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('prod-search-btn').click()
  })
  if (canManage) {
    document.getElementById('prod-add-btn').addEventListener('click', () => openProductModal(null))
  }

  loadProductList()
}

async function loadProductList() {
  const canManage = Auth.isManagerUp()
  const tbody = document.getElementById('prod-table-body')
  const colspan = canManage ? 8 : 6
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/products', {
      search: ProductListState.search,
      category: ProductListState.category,
      is_active: ProductListState.is_active
    })
    ProductListCache = res.data
    renderProductTable(res.data)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderProductTable(list) {
  const canManage = Auth.isManagerUp()
  const colspan = canManage ? 8 : 6
  const tbody = document.getElementById('prod-table-body')
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-10 text-gray-400">尚無符合條件的產品資料</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((p) => `
      <tr class="border-b border-gray-50 hover:bg-gray-50">
        <td class="px-4 py-3">
          <p class="font-medium text-gray-800">${Fmt.escapeHtml(p.name)}</p>
          ${p.description ? `<p class="text-xs text-gray-400">${Fmt.escapeHtml(p.description)}</p>` : ''}
        </td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(p.sku || '-')}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(p.category || '-')}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(p.unit || '件')}</td>
        <td class="px-4 py-3 text-right font-medium text-gray-800">${Number(p.unit_price).toLocaleString()}</td>
        ${canManage ? `<td class="px-4 py-3 text-right text-gray-400">${Number(p.cost_price || 0).toLocaleString()}</td>` : ''}
        <td class="px-4 py-3 text-center">
          ${p.is_active
            ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">上架中</span>'
            : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-500">已下架</span>'}
        </td>
        ${canManage ? `<td class="px-4 py-3 text-right whitespace-nowrap">
          <button class="prod-edit-btn text-primary-600 hover:underline text-xs mr-2" data-id="${p.id}">編輯</button>
          ${p.is_active ? `<button class="prod-deactivate-btn text-red-500 hover:underline text-xs" data-id="${p.id}">下架</button>` : ''}
        </td>` : ''}
      </tr>`)
    .join('')

  if (canManage) {
    tbody.querySelectorAll('.prod-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = ProductListCache.find((x) => x.id === Number(btn.dataset.id))
        openProductModal(product)
      })
    })
    tbody.querySelectorAll('.prod-deactivate-btn').forEach((btn) => {
      btn.addEventListener('click', () => deactivateProduct(Number(btn.dataset.id)))
    })
  }
}

function openProductModal(product) {
  const isEdit = !!product
  const p = product || {}
  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">${isEdit ? '編輯產品' : '新增產品'}</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">產品/項目名稱 <span class="text-red-500">*</span></label>
            <input id="pm-name" type="text" value="${Fmt.escapeHtml(p.name || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">SKU</label>
            <input id="pm-sku" type="text" value="${Fmt.escapeHtml(p.sku || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">分類</label>
            <select id="pm-category" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="">請選擇分類</option>
              ${PRODUCT_CATEGORIES.map((c) => `<option value="${Fmt.escapeHtml(c)}" ${p.category === c ? 'selected' : ''}>${Fmt.escapeHtml(c)}</option>`).join('')}
              <option value="__custom__" ${p.category && !PRODUCT_CATEGORIES.includes(p.category) ? 'selected' : ''}>其他（自訂分類）</option>
            </select>
            <input id="pm-category-custom" type="text" value="${p.category && !PRODUCT_CATEGORIES.includes(p.category) ? Fmt.escapeHtml(p.category) : ''}"
              placeholder="輸入自訂分類名稱"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1.5 focus:ring-2 focus:ring-primary-500 outline-none ${p.category && !PRODUCT_CATEGORIES.includes(p.category) ? '' : 'hidden'}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">單位</label>
            <input id="pm-unit" type="text" value="${Fmt.escapeHtml(p.unit || '件')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">標準售價 (HKD)</label>
            <input id="pm-unit-price" type="number" min="0" step="0.01" value="${p.unit_price ?? 0}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">成本價 (HKD)</label>
            <input id="pm-cost-price" type="number" min="0" step="0.01" value="${p.cost_price ?? 0}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">說明</label>
            <textarea id="pm-description" rows="2" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">${Fmt.escapeHtml(p.description || '')}</textarea>
          </div>
          <div class="col-span-2">
            <label class="flex items-center gap-2 text-sm text-gray-600">
              <input id="pm-active" type="checkbox" ${p.is_active !== 0 ? 'checked' : ''} class="rounded" /> 上架中（可供報價選用）
            </label>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button id="pm-cancel" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
        <button id="pm-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">儲存</button>
      </div>
    </div>`)

  document.getElementById('pm-cancel').addEventListener('click', closeModal)
  document.getElementById('pm-category').addEventListener('change', (e) => {
    const customInput = document.getElementById('pm-category-custom')
    if (e.target.value === '__custom__') {
      customInput.classList.remove('hidden')
      customInput.focus()
    } else {
      customInput.classList.add('hidden')
      customInput.value = ''
    }
  })
  document.getElementById('pm-submit').addEventListener('click', async () => {
    const name = document.getElementById('pm-name').value.trim()
    if (!name) {
      showToast('請填寫產品名稱', 'error')
      return
    }
    const categorySelectVal = document.getElementById('pm-category').value
    const category = categorySelectVal === '__custom__'
      ? document.getElementById('pm-category-custom').value.trim()
      : categorySelectVal
    const payload = {
      name,
      sku: document.getElementById('pm-sku').value.trim() || null,
      category: category || null,
      unit: document.getElementById('pm-unit').value.trim() || '件',
      unit_price: Number(document.getElementById('pm-unit-price').value) || 0,
      cost_price: Number(document.getElementById('pm-cost-price').value) || 0,
      description: document.getElementById('pm-description').value.trim() || null,
      is_active: document.getElementById('pm-active').checked
    }
    try {
      if (isEdit) {
        await API.put(`/products/${p.id}`, payload)
        showToast('產品資料已更新')
      } else {
        await API.post('/products', payload)
        showToast('產品已新增')
      }
      closeModal()
      loadProductList()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}

async function deactivateProduct(id) {
  if (!confirm('確定要將此產品下架嗎？下架後將無法於新報價中選用（既有報價明細不受影響）。')) return
  try {
    await API.delete(`/products/${id}`)
    showToast('產品已下架')
    loadProductList()
  } catch (err) {
    showToast(err.message, 'error')
  }
}
