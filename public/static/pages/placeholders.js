// ============================================================
// 佔位頁面（後續迭代將擴充完整功能）
// 本次交付重點頁面：login / dashboard / customerList / quoteList
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

Pages.customerForm = function (id) {
  comingSoon('customers', id ? '編輯客戶' : '新增客戶', '客戶新增/編輯表單將於下一階段開發完成，敬請期待。')
}

Pages.customerDetail = function (id) {
  comingSoon('customers', `客戶詳情 #${id}`, '客戶詳情頁（含聯絡人、跟進紀錄、歷史報價）將於下一階段開發完成。')
}

Pages.quoteDetail = function (id) {
  comingSoon('quotes', `報價詳情 #${id}`, '報價詳情頁（含審批操作、寄送、轉訂單、PDF匯出）將於下一階段開發完成。')
}

Pages.products = function () {
  comingSoon('products', '產品目錄', '產品/服務項目管理頁面將於下一階段開發完成。')
}

Pages.orders = function () {
  comingSoon('orders', '成交訂單', '訂單列表頁面將於下一階段開發完成。')
}

Pages.users = function () {
  comingSoon('users', '使用者管理', '使用者管理頁面（僅管理員可用）將於下一階段開發完成。')
}

Pages.reports = function () {
  comingSoon('reports', '報表分析', '業績排行、轉換率、Pipeline 漏斗報表將於下一階段開發完成。')
}

Pages.profile = function () {
  comingSoon('dashboard', '個人資料設定', '個人資料設定頁面將於下一階段開發完成。')
}
