// ============================================================
// 登入頁
// ============================================================
window.Pages = window.Pages || {}

Pages.login = function () {
  document.getElementById('app').innerHTML = `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-indigo-700 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-bolt text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-white">一木工程</h1>
        <p class="text-primary-100 text-xs mt-0.5">ONE WOOD LIMITED</p>
        <p class="text-primary-100 text-sm mt-1">B2B 報價管理 · 客戶關係 · 銷售一體化平台</p>
      </div>

      <div class="bg-white rounded-2xl shadow-xl p-8">
        <h2 class="text-lg font-semibold text-gray-800 mb-6">登入您的帳號</h2>
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <div class="relative">
              <i class="fas fa-envelope absolute left-3 top-3.5 text-gray-400 text-sm"></i>
              <input type="email" id="login-email" required autocomplete="email"
                class="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="you@company.com" value="manager@onewood.com.hk" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">密碼</label>
            <div class="relative">
              <i class="fas fa-lock absolute left-3 top-3.5 text-gray-400 text-sm"></i>
              <input type="password" id="login-password" required autocomplete="current-password"
                class="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="輸入密碼" value="password123" />
            </div>
          </div>
          <div id="login-error" class="hidden text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"></div>
          <button type="submit" id="login-btn"
            class="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2">
            <span>登入</span>
            <i class="fas fa-arrow-right text-xs"></i>
          </button>
        </form>

        <div class="mt-6 pt-5 border-t border-gray-100">
          <p class="text-xs text-gray-400 mb-2">測試帳號（密碼皆為 password123）：</p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button data-quick="admin@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-600">
              <i class="fas fa-user-shield text-gray-400 mr-1"></i> 管理員
            </button>
            <button data-quick="manager@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-600">
              <i class="fas fa-user-tie text-gray-400 mr-1"></i> 主管
            </button>
            <button data-quick="alice@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-600">
              <i class="fas fa-user text-gray-400 mr-1"></i> 業務 - 王小美
            </button>
            <button data-quick="bob@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-600">
              <i class="fas fa-user text-gray-400 mr-1"></i> 業務 - 林大同
            </button>
          </div>
        </div>
      </div>
      <p class="text-center text-primary-100 text-xs mt-6">© 2026 一木工程. All rights reserved.</p>
    </div>
  </div>`

  document.querySelectorAll('.quick-login').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('login-email').value = btn.dataset.quick
      document.getElementById('login-password').value = 'password123'
    })
  })

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value
    const errBox = document.getElementById('login-error')
    const btn = document.getElementById('login-btn')
    errBox.classList.add('hidden')
    btn.disabled = true
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 登入中...`

    try {
      const res = await API.post('/auth/login', { email, password })
      Auth.setSession(res.data.token, res.data.user)
      location.href = '/'
    } catch (err) {
      errBox.textContent = err.message
      errBox.classList.remove('hidden')
      btn.disabled = false
      btn.innerHTML = `<span>登入</span><i class="fas fa-arrow-right text-xs"></i>`
    }
  })
}
