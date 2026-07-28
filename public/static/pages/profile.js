// ============================================================
// 個人資料設定頁：更新姓名/電話/大頭貼、變更密碼
// ============================================================
window.Pages = window.Pages || {}

let ProfileData = null

Pages.profile = async function () {
  mountLayout('dashboard')
  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    const res = await API.get('/auth/me')
    ProfileData = res.data
    renderProfile(ProfileData)
  } catch (err) {
    setMainContent(`
      <div class="text-center py-20">
        <p class="text-red-400 mb-3">${err.message}</p>
        <a href="/" class="text-primary-600 hover:underline text-sm">回首頁總覽</a>
      </div>`)
  }
}

function profileAvatarHtml(u, sizeClass) {
  if (u.avatar_url) {
    return `<img src="${Fmt.escapeHtml(u.avatar_url)}" alt="${Fmt.escapeHtml(u.name)}" class="${sizeClass} rounded-full object-cover" />`
  }
  return `<div class="${sizeClass} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
    ${Fmt.escapeHtml((u.name || '?').charAt(0))}
  </div>`
}

function renderProfile(u) {
  setMainContent(`
    <div class="max-w-3xl mx-auto">
      <div class="mb-5">
        <h1 class="text-xl font-bold text-gray-800">個人資料設定</h1>
        <p class="text-sm text-gray-500 mt-0.5">管理您的帳號基本資料與登入密碼</p>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div class="flex items-center gap-4 mb-6">
          <div id="profile-avatar-preview">${profileAvatarHtml(u, 'w-16 h-16 text-xl')}</div>
          <div>
            <p class="font-semibold text-gray-800">${Fmt.escapeHtml(u.name)}</p>
            <p class="text-sm text-gray-400">${Fmt.escapeHtml(u.email)}</p>
            <span class="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">${Auth.roleLabel(u.role)}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">姓名 <span class="text-red-500">*</span></label>
            <input id="pf-name" type="text" value="${Fmt.escapeHtml(u.name || '')}"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Email（無法變更）</label>
            <input type="email" value="${Fmt.escapeHtml(u.email || '')}" disabled
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">電話</label>
            <input id="pf-phone" type="text" value="${Fmt.escapeHtml(u.phone || '')}" placeholder="例如：9123 4567"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">角色（無法變更）</label>
            <input type="text" value="${Auth.roleLabel(u.role)}" disabled
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">所屬主管</label>
            <input type="text" value="${Fmt.escapeHtml(u.manager_name || '無')}" disabled
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">加入日期</label>
            <input type="text" value="${Fmt.date(u.created_at)}" disabled
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1">大頭貼圖片網址（選填）</label>
            <input id="pf-avatar" type="text" value="${Fmt.escapeHtml(u.avatar_url || '')}" placeholder="貼上圖片網址，例如：https://.../avatar.jpg"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            <p class="text-xs text-gray-400 mt-1">留空則以姓名首字顯示預設頭像</p>
          </div>
        </div>

        <div class="flex justify-end mt-5">
          <button id="pf-save-basic" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <i class="fas fa-check mr-1.5"></i>儲存變更
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 class="text-base font-bold text-gray-800 mb-1">變更密碼</h2>
        <p class="text-xs text-gray-400 mb-4">變更密碼需先輸入目前密碼進行驗證</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">目前密碼</label>
            <input id="pf-current-password" type="password" placeholder="••••••"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">新密碼</label>
            <input id="pf-new-password" type="password" placeholder="至少 6 位字元"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">確認新密碼</label>
            <input id="pf-new-password-confirm" type="password" placeholder="再次輸入新密碼"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>

        <div class="flex justify-end mt-5">
          <button id="pf-save-password" class="bg-wood-600 hover:bg-wood-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <i class="fas fa-key mr-1.5"></i>更新密碼
          </button>
        </div>
      </div>
    </div>
  `)

  document.getElementById('pf-avatar').addEventListener('input', (e) => {
    const preview = document.getElementById('profile-avatar-preview')
    preview.innerHTML = profileAvatarHtml({ ...u, avatar_url: e.target.value.trim(), name: u.name }, 'w-16 h-16 text-xl')
  })

  document.getElementById('pf-save-basic').addEventListener('click', async () => {
    const name = document.getElementById('pf-name').value.trim()
    if (!name) {
      showToast('請填寫姓名', 'error')
      return
    }
    const payload = {
      name,
      phone: document.getElementById('pf-phone').value.trim() || null,
      avatar_url: document.getElementById('pf-avatar').value.trim() || null
    }
    try {
      const res = await API.put('/auth/me', payload)
      ProfileData = res.data
      const currentToken = Auth.getToken()
      Auth.setSession(currentToken, { ...Auth.getUser(), name: res.data.name, phone: res.data.phone, avatar_url: res.data.avatar_url })
      showToast('個人資料已更新')
      mountLayout('dashboard')
      renderProfile(ProfileData)
    } catch (err) {
      showToast(err.message, 'error')
    }
  })

  document.getElementById('pf-save-password').addEventListener('click', async () => {
    const currentPassword = document.getElementById('pf-current-password').value
    const newPassword = document.getElementById('pf-new-password').value
    const confirmPassword = document.getElementById('pf-new-password-confirm').value

    if (!currentPassword) {
      showToast('請輸入目前密碼', 'error')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      showToast('新密碼至少需 6 位字元', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('兩次輸入的新密碼不一致', 'error')
      return
    }

    try {
      await API.put('/auth/me', { current_password: currentPassword, new_password: newPassword })
      showToast('密碼已更新')
      document.getElementById('pf-current-password').value = ''
      document.getElementById('pf-new-password').value = ''
      document.getElementById('pf-new-password-confirm').value = ''
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
}
