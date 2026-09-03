// ============================================================
// 登入頁（深色奢華風格）
// ============================================================
window.Pages = window.Pages || {}

Pages.login = function () {
  document.getElementById('app').innerHTML = `
  <div class="min-h-screen flex items-center justify-center bg-[#f3f2eb] px-4 relative overflow-hidden">
    <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(circle at 20% 20%, rgba(204,169,105,0.14), transparent 45%), radial-gradient(circle at 80% 80%, rgba(61,96,75,0.08), transparent 45%);"></div>
    <div class="w-full max-w-md relative z-10">
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-2xl bg-surface-100 border border-line p-2 mx-auto mb-4 flex items-center justify-center">
          <img src="/static/images/logo.png" alt="一木工程" class="w-full h-full object-contain" />
        </div>
        <h1 class="text-2xl font-bold text-ink-50 tracking-wide">一木工程</h1>
        <p class="text-primary-500 text-[11px] mt-1 tracking-label uppercase">One Wood Limited &middot; MUI Suite</p>
        <p class="text-ink-400 text-sm mt-2">B2B 報價管理 · 客戶關係 · 銷售一體化平台</p>
      </div>

      <div class="bg-surface-100 border border-line rounded-2xl shadow-xl p-8">
        <h2 class="text-lg font-semibold text-ink-50 mb-6">登入您的帳號</h2>
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-ink-400 mb-1">Email</label>
            <div class="relative">
              <i class="fas fa-envelope absolute left-3 top-3.5 text-ink-400 text-sm"></i>
              <input type="email" id="login-email" required autocomplete="email"
                class="w-full pl-9 pr-3 py-2.5 bg-surface-200 border border-line rounded-lg text-sm text-ink-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none placeholder:text-ink-400"
                placeholder="you@company.com" value="manager@onewood.com.hk" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink-400 mb-1">密碼</label>
            <div class="relative">
              <i class="fas fa-lock absolute left-3 top-3.5 text-ink-400 text-sm"></i>
              <input type="password" id="login-password" required autocomplete="current-password"
                class="w-full pl-9 pr-3 py-2.5 bg-surface-200 border border-line rounded-lg text-sm text-ink-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none placeholder:text-ink-400"
                placeholder="輸入密碼" value="OneWood2026#" />
            </div>
          </div>
          <div id="login-error" class="hidden text-sm text-bad-400 bg-bad-50 rounded-lg px-3 py-2"></div>
          <button type="submit" id="login-btn"
            class="w-full bg-primary-500 hover:bg-primary-600 text-surface-300 font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
            <span>登入</span>
            <i class="fas fa-arrow-right text-xs"></i>
          </button>
        </form>

        <div class="mt-6 pt-5 border-t border-line">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button data-quick="manager@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-surface-200 hover:bg-surface-50 text-ink-400 hover:text-ink-50 transition">
              <i class="fas fa-user-tie text-ink-400 mr-1"></i> 主管
            </button>
            <button data-quick="kenny@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-surface-200 hover:bg-surface-50 text-ink-400 hover:text-ink-50 transition">
              <i class="fas fa-user text-ink-400 mr-1"></i> 業務 - Kenny Yip
            </button>
            <button data-quick="wah@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-surface-200 hover:bg-surface-50 text-ink-400 hover:text-ink-50 transition">
              <i class="fas fa-user text-ink-400 mr-1"></i> 業務 - Wah Tong
            </button>
            <button data-quick="joy@onewood.com.hk" class="quick-login text-left px-2 py-1.5 rounded bg-surface-200 hover:bg-surface-50 text-ink-400 hover:text-ink-50 transition">
              <i class="fas fa-user text-ink-400 mr-1"></i> 業務 - Joy Ng
            </button>
          </div>
        </div>
      </div>
      <p class="text-center text-ink-400 text-xs mt-6">&copy; 2026 一木工程. All rights reserved.</p>
    </div>
  </div>`

  document.querySelectorAll('.quick-login').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('login-email').value = btn.dataset.quick
      document.getElementById('login-password').value = 'OneWood2026#'
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
