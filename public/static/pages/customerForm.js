// ============================================================
// 客戶新增 / 編輯表單頁
// ============================================================
window.Pages = window.Pages || {}

const CustomerFormState = {
  id: null,
  salesUsers: [],
  saving: false
}

Pages.customerForm = async function (id) {
  CustomerFormState.id = id ? Number(id) : null
  CustomerFormState.saving = false

  mountLayout('customers')
  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    const userRes = await API.get('/users')
    CustomerFormState.salesUsers = userRes.data.filter((u) => u.role === 'sales' || u.role === 'manager')

    let existing = null
    if (CustomerFormState.id) {
      const res = await API.get(`/customers/${CustomerFormState.id}`)
      existing = res.data
      const canEdit = Auth.isManagerUp() || (Auth.getUser() && Auth.getUser().id === existing.owner_id)
      if (!canEdit) {
        setMainContent(`
          <div class="text-center py-20">
            <p class="text-red-400 mb-3">您沒有權限編輯此客戶</p>
            <a href="/customers/${existing.id}" class="text-primary-600 hover:underline text-sm">回客戶詳情</a>
          </div>`)
        return
      }
    }

    renderCustomerForm(existing)
  } catch (err) {
    setMainContent(`<div class="text-center py-20 text-red-400">${err.message}</div>`)
  }
}

function renderCustomerForm(existing) {
  const isEdit = !!CustomerFormState.id
  const c = existing || {}

  const canAssignOwner = Auth.isManagerUp()
  const ownerOptions = CustomerFormState.salesUsers
    .map((u) => `<option value="${u.id}" ${c.owner_id === u.id ? 'selected' : ''}>${Fmt.escapeHtml(u.name)}（${Auth.roleLabel(u.role)}）</option>`)
    .join('')

  setMainContent(`
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-gray-800">${isEdit ? '編輯客戶' : '新增客戶'}</h1>
          <p class="text-sm text-gray-500 mt-0.5">${isEdit ? Fmt.escapeHtml(c.company_name || '') : '建立新的客戶主檔資料'}</p>
        </div>
        <a href="${isEdit ? '/customers/' + c.id : '/customers'}" class="text-sm text-gray-500 hover:text-gray-700"><i class="fas fa-arrow-left mr-1"></i> 返回</a>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">公司名稱 <span class="text-red-500">*</span></label>
            <input id="cf-company-name" type="text" value="${Fmt.escapeHtml(c.company_name || '')}" placeholder="例：昌賢工程有限公司"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">統一編號 / BR No.</label>
            <input id="cf-tax-id" type="text" value="${Fmt.escapeHtml(c.tax_id || '')}"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">產業類別</label>
            <input id="cf-industry" type="text" value="${Fmt.escapeHtml(c.industry || '')}" placeholder="例：物業管理 / 室內設計"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">客戶狀態</label>
            <select id="cf-status" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="lead" ${(c.status || 'lead') === 'lead' ? 'selected' : ''}>潛在客戶</option>
              <option value="active" ${c.status === 'active' ? 'selected' : ''}>合作中</option>
              <option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>停止合作</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">客戶來源</label>
            <input id="cf-source" type="text" value="${Fmt.escapeHtml(c.source || '')}" placeholder="例：轉介 / 官網詢問 / 陌生開發"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          ${canAssignOwner ? `
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">負責業務</label>
            <select id="cf-owner" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="">預設為自己</option>
              ${ownerOptions}
            </select>
          </div>` : ''}
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">地址</label>
            <input id="cf-address" type="text" value="${Fmt.escapeHtml(c.address || '')}"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">地區/城市</label>
            <input id="cf-city" type="text" value="${Fmt.escapeHtml(c.city || '')}" placeholder="例：九龍 / 香港島 / 新界"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">網站</label>
            <input id="cf-website" type="text" value="${Fmt.escapeHtml(c.website || '')}" placeholder="https://..."
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">信用額度 (HKD)</label>
            <input id="cf-credit-limit" type="number" min="0" step="0.01" value="${c.credit_limit ?? 0}"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">備註</label>
            <textarea id="cf-notes" rows="3" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">${Fmt.escapeHtml(c.notes || '')}</textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <a href="${isEdit ? '/customers/' + c.id : '/customers'}" class="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">取消</a>
          <button id="cf-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
            ${isEdit ? '儲存變更' : '建立客戶'}
          </button>
        </div>
      </div>
    </div>
  `)

  document.getElementById('cf-submit').addEventListener('click', submitCustomerForm)
}

async function submitCustomerForm() {
  if (CustomerFormState.saving) return

  const companyName = document.getElementById('cf-company-name').value.trim()
  if (!companyName) {
    showToast('請填寫公司名稱', 'error')
    return
  }

  const payload = {
    company_name: companyName,
    tax_id: document.getElementById('cf-tax-id').value.trim() || null,
    industry: document.getElementById('cf-industry').value.trim() || null,
    status: document.getElementById('cf-status').value,
    source: document.getElementById('cf-source').value.trim() || null,
    address: document.getElementById('cf-address').value.trim() || null,
    city: document.getElementById('cf-city').value.trim() || null,
    website: document.getElementById('cf-website').value.trim() || null,
    credit_limit: Number(document.getElementById('cf-credit-limit').value) || 0,
    notes: document.getElementById('cf-notes').value.trim() || null
  }
  const ownerSel = document.getElementById('cf-owner')
  if (ownerSel && ownerSel.value) payload.owner_id = Number(ownerSel.value)

  CustomerFormState.saving = true
  const btn = document.getElementById('cf-submit')
  btn.disabled = true

  try {
    let custId = CustomerFormState.id
    if (custId) {
      await API.put(`/customers/${custId}`, payload)
      showToast('客戶資料已更新')
    } else {
      const res = await API.post('/customers', payload)
      custId = res.data.id
      showToast('客戶已建立')
    }
    location.href = `/customers/${custId}`
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    CustomerFormState.saving = false
    btn.disabled = false
  }
}
