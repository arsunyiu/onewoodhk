// ============================================================
// 報表分析頁：KPI總覽 / 趨勢圖 / Pipeline漏斗 / 業績排行 / 客戶排行
// ============================================================
window.Pages = window.Pages || {}

const ReportsState = { range: '90d' }
let ReportsCharts = { trend: null, pipeline: null }

const RANGE_LABELS = {
  '30d': '近30天',
  '90d': '近90天',
  '180d': '近半年',
  '365d': '近一年',
  all: '全部時間'
}

Pages.reports = async function () {
  mountLayout('reports')
  const user = Auth.getUser()

  setMainContent(`
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-800">報表分析</h1>
        <p class="text-sm text-gray-500 mt-0.5">業績排行、轉換率、Pipeline 漏斗與客戶貢獻總覽</p>
      </div>
      <div class="flex items-center gap-2">
        <select id="rpt-range" class="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none bg-white">
          <option value="30d">近30天</option>
          <option value="90d" selected>近90天</option>
          <option value="180d">近半年</option>
          <option value="365d">近一年</option>
          <option value="all">全部時間</option>
        </select>
      </div>
    </div>

    <div id="rpt-kpi-cards" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700 mb-4">近6個月 報價建立量 vs 成交金額</h2>
        <canvas id="rpt-trend-chart" height="230"></canvas>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700 mb-4">Pipeline 狀態分布（即時）</h2>
        <canvas id="rpt-pipeline-chart" height="230"></canvas>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700">
            <i class="fas fa-ranking-star text-yellow-500 mr-1"></i> 業務業績排行
          </h2>
          <span id="rpt-owner-range-label" class="text-xs text-gray-400"></span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th class="text-left px-4 py-2.5 font-medium">業務</th>
                <th class="text-right px-4 py-2.5 font-medium">報價數</th>
                <th class="text-right px-4 py-2.5 font-medium">成交金額</th>
                <th class="text-right px-4 py-2.5 font-medium">成交率</th>
              </tr>
            </thead>
            <tbody id="rpt-owner-tbody" class="divide-y divide-gray-100"></tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700">
            <i class="fas fa-trophy text-wood-500 mr-1"></i> 客戶貢獻排行 Top 10（累計成交）
          </h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th class="text-left px-4 py-2.5 font-medium">客戶</th>
                <th class="text-right px-4 py-2.5 font-medium">報價數</th>
                <th class="text-right px-4 py-2.5 font-medium">成交數</th>
                <th class="text-right px-4 py-2.5 font-medium">成交金額</th>
              </tr>
            </thead>
            <tbody id="rpt-customer-tbody" class="divide-y divide-gray-100"></tbody>
          </table>
        </div>
      </div>
    </div>
  `)

  document.getElementById('rpt-range').addEventListener('change', (e) => {
    ReportsState.range = e.target.value
    loadReports()
  })

  await loadReports()
}

async function loadReports() {
  try {
    const res = await API.get('/reports/summary', { range: ReportsState.range })
    renderReports(res.data)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function renderReports(d) {
  renderKpiCards(d.kpi)
  renderTrendChart(d.trend)
  renderPipelineChart(d.pipeline)
  renderReportOwnerTable(d.by_owner)
  renderReportCustomerTable(d.by_customer)
  const lbl = document.getElementById('rpt-owner-range-label')
  if (lbl) lbl.textContent = RANGE_LABELS[d.range] || ''
}

function renderKpiCards(kpi) {
  const winRateStr = kpi.win_rate === null ? '-' : `${kpi.win_rate}%`
  document.getElementById('rpt-kpi-cards').innerHTML = `
    ${kpiCard('fa-file-invoice-dollar', 'text-primary-600 bg-primary-50', '期間報價數', kpi.total_quotes, Fmt.currency(kpi.total_amount))}
    ${kpiCard('fa-sack-dollar', 'text-green-600 bg-green-50', '期間成交金額', Fmt.currency(kpi.won_amount), `共 ${kpi.won_count} 筆成交`)}
    ${kpiCard('fa-percent', 'text-wood-600 bg-wood-50', '成交轉換率', winRateStr, `成交 ${kpi.won_count} / 流失 ${kpi.lost_count}`)}
    ${kpiCard('fa-coins', 'text-yellow-600 bg-yellow-50', '平均成交金額', Fmt.currency(kpi.avg_deal_size), `新增客戶 ${kpi.new_customers} 位`)}
  `
}

function kpiCard(icon, colorCls, label, value, sub) {
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

function renderTrendChart(trend) {
  const labels = trend.map((t) => t.month)
  const createdData = trend.map((t) => t.created_count)
  const wonData = trend.map((t) => t.won_amount)

  if (ReportsCharts.trend) ReportsCharts.trend.destroy()
  ReportsCharts.trend = new Chart(document.getElementById('rpt-trend-chart'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: '報價建立量（筆）',
          data: createdData,
          backgroundColor: '#e0c090',
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: '成交金額',
          data: wonData,
          borderColor: '#5fdba3',
          backgroundColor: '#5fdba3',
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, position: 'left', title: { display: true, text: '筆數' } },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: '金額' },
          ticks: { callback: (v) => Fmt.currency(v) }
        }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.dataset.yAxisID === 'y1'
                ? `${ctx.dataset.label}: ${Fmt.currency(ctx.raw)}`
                : `${ctx.dataset.label}: ${ctx.raw}`
          }
        }
      }
    }
  })
}

function renderPipelineChart(pipeline) {
  const keys = ['draft', 'pending_approval', 'approved', 'sent', 'won', 'lost', 'rejected']
  const labels = ['草稿', '待審核', '已核准', '已寄送', '已成交', '已流失', '已拒絕']
  const colors = ['#9baaa1', '#e6c274', '#82b0ca', '#e0c090', '#5fdba3', '#b6a1cf', '#eea095']
  const data = keys.map((k) => pipeline[k]?.count || 0)

  if (ReportsCharts.pipeline) ReportsCharts.pipeline.destroy()
  ReportsCharts.pipeline = new Chart(document.getElementById('rpt-pipeline-chart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const key = keys[ctx.dataIndex]
              const amt = pipeline[key]?.amount || 0
              return `${ctx.label}: ${ctx.raw} 筆 · ${Fmt.currency(amt)}`
            }
          }
        }
      }
    }
  })
}

function renderReportOwnerTable(rows) {
  const tbody = document.getElementById('rpt-owner-tbody')
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-8">尚無資料</td></tr>`
    return
  }
  const maxAmount = Math.max(...rows.map((r) => r.won_amount), 1)
  tbody.innerHTML = rows
    .map((r, idx) => {
      const winRateStr = r.win_rate === null ? '-' : `${r.win_rate}%`
      const barPct = Math.round((r.won_amount / maxAmount) * 100)
      return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}">${idx + 1}</span>
            <span class="font-medium text-gray-700">${Fmt.escapeHtml(r.owner_name)}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-right text-gray-500">${r.quote_count}</td>
        <td class="px-4 py-3 text-right">
          <div class="font-semibold text-gray-700">${Fmt.currency(r.won_amount)}</div>
          <div class="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
            <div class="h-full bg-primary-500 rounded-full" style="width:${barPct}%"></div>
          </div>
        </td>
        <td class="px-4 py-3 text-right text-gray-500">${winRateStr}</td>
      </tr>`
    })
    .join('')
}

function renderReportCustomerTable(rows) {
  const tbody = document.getElementById('rpt-customer-tbody')
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-8">尚無成交紀錄</td></tr>`
    return
  }
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr class="hover:bg-gray-50 cursor-pointer" onclick="location.href='/customers/${r.customer_id}'">
        <td class="px-4 py-3 font-medium text-gray-700">${Fmt.escapeHtml(r.company_name)}</td>
        <td class="px-4 py-3 text-right text-gray-500">${r.quote_count}</td>
        <td class="px-4 py-3 text-right text-gray-500">${r.won_count}</td>
        <td class="px-4 py-3 text-right font-semibold text-gray-700">${Fmt.currency(r.won_amount)}</td>
      </tr>`
    )
    .join('')
}
