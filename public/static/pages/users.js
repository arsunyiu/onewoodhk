// ============================================================
// 使用者管理頁（僅管理員可用）
// ============================================================
window.Pages = window.Pages || {}

let UserListCache = []

Pages.users = async function () {
  mountLayout('users')

  if (!Auth.isAdmin()) {
    setMainContent(`
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <i class="fas fa-lock text-2xl"></i>
        </div>
        <h1 class="text-lg font-bold text-gray-800 mb-1">權限不足</h1>
        <p class="text-sm text-gray-400 max-w-sm">使用者管理頁面僅限管理員（Admin）存取。</p>
        <a href="/" class="mt-6 text-primary-600 text-sm hover:underline">回首頁總覽</a>
      </div>`)
    return
  }

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">使用者管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">管理系統帳號、角色與主管歸屬</p>
      </div>
      <button id="user-add-btn" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i> 新增使用者
      </button>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">姓名</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">角色</th>
              <th class="px-4 py-3 font-medium">所屬主管</th>
              <th class="px-4 py-3 font-medium">電話</th>
              <th class="px-4 py-3 font-medium text-center">狀態</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="user-table-body">
            <tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `)

  document.getElementById('user-add-btn').addEventListener('click', () => openUserModal(null))
  loadUserList()
}

async function loadUserList() {
  const tbody = document.getElementById('user-table-body')
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/users')
    UserListCache = res.data
    renderUserTable(res.data)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function renderUserTable(list) {
  const tbody = document.getElementById('user-table-body')
  if (!tbody) return
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">尚無使用者資料</td></tr>`
    return
  }
  const currentUserId = Auth.getUser()?.id
  tbody.innerHTML = list
    .map((u) => {
      const managerName = u.manager_id ? (list.find((x) => x.id === u.manager_id)?.name || `#${u.manager_id}`) : '-'
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50">
        <td class="px-4 py-3 font-medium text-gray-800">${Fmt.escapeHtml(u.name)} ${u.id === currentUserId ? '<span class="text-xs text-gray-400">(我)</span>' : ''}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(u.email)}</td>
        <td class="px-4 py-3 text-gray-700">${Auth.roleLabel(u.role)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(managerName)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(u.phone || '-')}</td>
        <td class="px-4 py-3 text-center">
          ${u.is_active
            ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">啟用</span>'
            : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-500">停用</span>'}
        </td>
        <td class="px-4 py-3 text-right">
          <button class="user-edit-btn text-primary-600 hover:underline text-xs" data-id="${u.id}">編輯</button>
        </td>
      </tr>`
    })
    .join('')

  tbody.querySelectorAll('.user-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = UserListCache.find((x) => x.id === Number(btn.dataset.id))
      openUserModal(user)
    })
  })
}

function openUserModal(user) {
  const isEdit = !!user
  const u = user || {}
  const managerOptions = UserListCache
    .filter((x) => x.role === 'admin' || x.role === 'manager')
    .map((x) => `<option value="${x.id}" ${u.manager_id === x.id ? 'selected' : ''}>${Fmt.escapeHtml(x.name)}（${Auth.roleLabel(x.role)}）</option>`)
    .join('')

  openModal(`
    <div class="p-5">
      <h3 class="text-base font-bold text-gray-800 mb-4">${isEdit ? '編輯使用者' : '新增使用者'}</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">姓名 <span class="text-red-500">*</span></label>
            <input id="um-name" type="text" value="${Fmt.escapeHtml(u.name || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Email ${isEdit ? '' : '<span class="text-red-500">*</span>'}</label>
            <input id="um-email" type="email" value="${Fmt.escapeHtml(u.email || '')}" ${isEdit ? 'disabled' : ''} placeholder="name@onewood.com.hk"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">角色</label>
            <select id="um-role" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="sales" ${(u.role || 'sales') === 'sales' ? 'selected' : ''}>業務</option>
              <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>主管</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理員</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">所屬主管</label>
            <select id="um-manager" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="">無</option>
              ${managerOptions}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">電話</label>
            <input id="um-phone" type="text" value="${Fmt.escapeHtml(u.phone || '')}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">${isEdit ? '重設密碼（留空則不變更）' : '密碼 <span class="text-red-500">*</span>'}</label>
            <input id="um-password" type="password" placeholder="${isEdit ? '••••••' : '至少 6 位字元'}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          ${isEdit ? `
          <div class="col-span-2">
            <label class="flex items-center gap-2 text-sm text-gray-600">
              <input id="um-active" type="checkbox" ${u.is_active !== 0 ? 'checked' : ''} class="rounded" /> 帳號啟用中
            </label>
          </div>` : ''}
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button id="um-cancel" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
        <button id="um-submit" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">儲存</button>
      </div>
    </div>`)

  document.getElementById('um-cancel').addEventListener('click', closeModal)
  document.getElementById('um-submit').addEventListener('click', async () => {
    const name = document.getElementById('um-name').value.trim()
    if (!name) {
      showToast('請填寫姓名', 'error')
      return
    }
    const password = document.getElementById('um-password').value

    try {
      if (isEdit) {
        const payload = {
          name,
          role: document.getElementById('um-role').value,
          manager_id: document.getElementById('um-manager').value ? Number(document.getElementById('um-manager').value) : null,
          phone: document.getElementById('um-phone').value.trim() || null,
          is_active: document.getElementById('um-active').checked
        }
        if (password) payload.password = password
        await API.put(`/users/${u.id}`, payload)
        showToast('使用者資料已更新')
      } else {
        const email = document.getElementById('um-email').value.trim()
        if (!email) {
          showToast('請填寫 Email', 'error')
          return
        }
        if (!password || password.length < 6) {
          showToast('請設定至少 6 位字元的密碼', 'error')
          return
        }
        const payload = {
          name,
          email,
          password,
          role: document.getElementById('um-role').value,
          manager_id: document.getElementById('um-manager').value ? Number(document.getElementById('um-manager').value) : null,
          phone: document.getElementById('um-phone').value.trim() || null
        }
        await API.post('/users', payload)
        showToast('使用者已新增')
      }
      closeModal()
      loadUserList()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}
