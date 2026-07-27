// ============================================================
// 佔位頁面（後續迭代將擴充完整功能）
// 尚未開發：個人資料設定
// ============================================================
window.Pages = window.Pages || {}

function comingSoon(activeKey, title, desc) {
  mountLayout(activeKey)
  setMainContent(`
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
        <i class="fas fa-hammer text-2xl"></i>
      </div>
      <h1 class="text-lg font-bold text-gray-800 mb-1">${title}</h1>
      <p class="text-sm text-gray-400 max-w-sm">${desc}</p>
      <a href="/" class="mt-6 text-primary-600 text-sm hover:underline">回首頁總覽</a>
    </div>`)
}

Pages.profile = function () {
  comingSoon('dashboard', '個人資料設定', '個人資料設定頁面將於下一階段開發完成。')
}
