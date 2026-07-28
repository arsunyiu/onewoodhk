// ============================================================
// Dashboard 首頁
// ============================================================
window.Pages = window.Pages || {}

Pages.dashboard = async function () {
  mountLayout('dashboard')
  const user = Auth.getUser()
  setMainContent(`
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">早安，${user?.name || ''} 👋</h1>
        <p class="text-sm text-gray-500 mt-0.5">這是您今天的業務總覽</p>
      </div>
      <a href="/quotes/new" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i> 建立新報價
      </a>
    </div>
    <div id="dash-cards" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700 mb-4">銷售 Pipeline 漏斗</h2>
        <canvas id="pipeline-chart" height="220"></canvas>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700 mb-4">待辦跟進</h2>
        <div id="dash-tasks" class="space-y-3 text-sm"></div>
      </div>
    </div>
    <div id="dash-approvals-section" class="mt-6 hidden bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h2 class="text-sm font-semibold text-gray-700 mb-4">
        <i class="fas fa-clipboard-check text-yellow-500 mr-1"></i> 待審核報價（需您核准）
      </h2>
      <div id="dash-approvals" class="space-y-2 text-sm"></div>
    </div>
  `)

  try {
    const res = await API.get('/dashboard/summary')
    renderDashboard(res.data)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function renderDashboard(d) {
  document.getElementById('dash-cards').innerHTML = `
    ${dashCard('fa-building-user', 'text-primary-600 bg-primary-50', '客戶總數', d.customers.total, `潛在 ${d.customers.lead} · 合作中 ${d.customers.active}`)}
    ${dashCard('fa-file-invoice-dollar', 'text-wood-600 bg-wood-50', 'Pipeline 金額', Fmt.currency(d.pipeline_amount), '待審核/已核准/已寄送 報價總額')}
    ${dashCard('fa-sack-dollar', 'text-green-600 bg-green-50', '本月成交金額', Fmt.currency(d.won_this_month.amount), `共 ${d.won_this_month.count} 筆成交`)}
    ${dashCard('fa-hourglass-half', 'text-yellow-600 bg-yellow-50', '待審核報價', d.pipeline.pending_approval || 0, '等待主管核准')}
  `

  // Pipeline 漏斗圖
  const labels = ['草稿', '待審核', '已核准', '已寄送', '已成交', '已流失', '已拒絕']
  const keys = ['draft', 'pending_approval', 'approved', 'sent', 'won', 'lost', 'rejected']
  const data = keys.map((k) => d.pipeline[k] || 0)
  new Chart(document.getElementById('pipeline-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#9ca3af','#eab308','#1f5b45','#7a5a3a','#22c55e','#94a3b8','#ef4444'],
        borderRadius: 6
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  })

  // 待辦跟進
  const tasksEl = document.getElementById('dash-tasks')
  if (!d.upcoming_tasks.length) {
    tasksEl.innerHTML = `<p class="text-gray-400 text-center py-6"><i class="fas fa-circle-check text-2xl block mb-2"></i>目前沒有待辦事項</p>`
  } else {
    tasksEl.innerHTML = d.upcoming_tasks
      .map(
        (t) => `
      <a href="/customers/${t.customer_id}" class="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
        <p class="font-medium text-gray-700">${Fmt.escapeHtml(t.subject)}</p>
        <p class="text-gray-400 text-xs mt-0.5">${Fmt.escapeHtml(t.company_name)} · ${Fmt.date(t.activity_date)}</p>
      </a>`
      )
      .join('')
  }

  // 待審核報價（主管/管理員限定）
  if (d.pending_approvals && d.pending_approvals.length) {
    document.getElementById('dash-approvals-section').classList.remove('hidden')
    document.getElementById('dash-approvals').innerHTML = d.pending_approvals
      .map(
        (q) => `
      <a href="/quotes/${q.id}" class="flex items-center justify-between p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100">
        <div>
          <p class="font-medium text-gray-700">${Fmt.escapeHtml(q.quote_no)} · ${Fmt.escapeHtml(q.title || '')}</p>
          <p class="text-gray-400 text-xs mt-0.5">${Fmt.escapeHtml(q.company_name)} · 業務：${Fmt.escapeHtml(q.owner_name)}</p>
        </div>
        <span class="font-semibold text-gray-700">${Fmt.currency(q.total_amount)}</span>
      </a>`
      )
      .join('')
  }
}

function dashCard(icon, colorCls, label, value, sub) {
  return `
  <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-lg ${colorCls} flex items-center justify-center">
        <i class="fas ${icon}"></i>
      </div>
      <span class="text-sm text-gray-500">${label}</span>
    </div>
    <p class="text-2xl font-bold text-gray-800">${value}</p>
    <p class="text-xs text-gray-400 mt-1">${sub}</p>
  </div>`
}
