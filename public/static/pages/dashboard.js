// ============================================================
// Dashboard 首頁 — MUI SUITE 深色奢華主題
// ============================================================
window.Pages = window.Pages || {}

const DASH_PALETTE = ['#3d604b', '#cca969', '#5a738e', '#8e4e4e', '#6c5a8e', '#546e5a']

Pages.dashboard = async function () {
  mountLayout('dashboard')
  const user = Auth.getUser()
  const now = new Date()
  const greeting = now.getHours() < 12 ? '早安' : now.getHours() < 18 ? '午安' : '晚安'
  const dateStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })

  setMainContent(`
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-ink-50">${greeting}，${Fmt.escapeHtml(user?.name || '')}。 <span class="text-ink-400 text-xs font-semibold tracking-label uppercase align-middle">Good ${now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening'}</span></h1>
        <p id="dash-date-sub" class="text-sm text-ink-400 mt-1">${dateStr}</p>
      </div>
      <div class="flex items-center gap-2">
        <a href="/projects" class="bg-surface-200 hover:bg-surface-300 border border-line text-ink-100 text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2">
          <i class="fas fa-arrow-up-right-from-square"></i> EXPORT
        </a>
        <a href="/quotes/new" class="bg-primary-500 hover:bg-primary-600 text-surface-300 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
          <i class="fas fa-plus"></i> 新增報價
        </a>
      </div>
    </div>

    <div id="dash-cards" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"></div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <div class="xl:col-span-2 bg-surface-100 rounded-xl border border-line p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-sm font-semibold text-ink-50">進行中工程</h2>
            <p class="text-[11px] text-ink-400 tracking-label uppercase">Active Projects · Gantt</p>
          </div>
          <div class="flex items-center gap-1 text-[11px]">
            <span class="px-2.5 py-1 rounded-md bg-surface-200 text-ink-100">WEEK</span>
            <span class="px-2.5 py-1 rounded-md bg-primary-500 text-surface-300 font-semibold">MONTH</span>
            <span class="px-2.5 py-1 rounded-md bg-surface-200 text-ink-100">QUARTER</span>
          </div>
        </div>
        <div id="dash-gantt" class="space-y-1 text-sm"></div>
      </div>

      <div class="space-y-6">
        <div class="bg-surface-100 rounded-xl border border-line p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-sm font-semibold text-ink-50">營收趨勢</h2>
              <p class="text-[11px] text-ink-400 tracking-label uppercase">Revenue Trend · 6M</p>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-md bg-good-500/15 text-good-500 font-semibold">ACTUAL</span>
          </div>
          <canvas id="dash-revenue-chart" height="130"></canvas>
        </div>

        <div class="bg-surface-100 rounded-xl border border-line p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-sm font-semibold text-ink-50">案件類型</h2>
              <p class="text-[11px] text-ink-400 tracking-label uppercase">By Category</p>
            </div>
          </div>
          <div id="dash-category" class="space-y-2.5 text-sm"></div>
        </div>
      </div>
    </div>

    <div class="bg-surface-100 rounded-xl border border-line p-5 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-sm font-semibold text-ink-50">工地實況</h2>
          <p class="text-[11px] text-ink-400 tracking-label uppercase">Live Site Feed</p>
        </div>
        <a href="/projects" class="text-xs text-primary-500 hover:text-primary-600 font-medium">查看全部 <i class="fas fa-arrow-right ml-1"></i></a>
      </div>
      <div id="dash-sitefeed" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-surface-100 rounded-xl border border-line p-5">
        <h2 class="text-sm font-semibold text-ink-50 mb-4">待辦跟進</h2>
        <div id="dash-tasks" class="space-y-2 text-sm"></div>
      </div>
      <div id="dash-approvals-section" class="hidden bg-surface-100 rounded-xl border border-line p-5">
        <h2 class="text-sm font-semibold text-ink-50 mb-4">
          <i class="fas fa-clipboard-check text-gold-500 mr-1"></i> 待審核報價（需您核准）
        </h2>
        <div id="dash-approvals" class="space-y-2 text-sm"></div>
      </div>
    </div>
  `)

  try {
    const isManager = user?.role === 'admin' || user?.role === 'manager'
    const [dashRes, reportsRes, projSummaryRes, activeProjRes, financeRes] = await Promise.all([
      API.get('/dashboard/summary'),
      API.get('/reports/summary?range=180d'),
      API.get('/projects/summary'),
      API.get('/projects?status=in_progress&page_size=8'),
      isManager ? API.get('/finance/summary').catch(() => null) : Promise.resolve(null)
    ])
    renderDashboard(dashRes.data, reportsRes.data, projSummaryRes.data, activeProjRes.data || [], financeRes ? financeRes.data : null)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function dashTrendPct(trend, key) {
  if (!trend || trend.length < 2) return null
  const last = trend[trend.length - 1][key] || 0
  const prev = trend[trend.length - 2][key] || 0
  if (!prev) return null
  return Math.round(((last - prev) / prev) * 1000) / 10
}

function dashTrendBadge(pct) {
  if (pct === null || pct === undefined) return `<span class="text-[11px] text-ink-400">— 尚無比較資料</span>`
  const up = pct >= 0
  return `<span class="text-[11px] font-semibold ${up ? 'text-good-500' : 'text-bad-500'}">
    <i class="fas fa-caret-${up ? 'up' : 'down'} mr-0.5"></i>${Math.abs(pct)}% <span class="text-ink-400 font-normal">vs 上月</span>
  </span>`
}

function dashSparkBars(values, colorCls) {
  const max = Math.max(1, ...values)
  return `<div class="flex items-end gap-1 h-9 mt-2">
    ${values
      .map((v) => `<div class="flex-1 ${colorCls} rounded-sm" style="height:${Math.max(6, Math.round((v / max) * 100))}%"></div>`)
      .join('')}
  </div>`
}

// 迷你波浪趨勢圖（SVG 平滑折線 + 漸層填色），用於卡片內展示近月走勢
let dashSparklineSeq = 0
function dashSparkline(values, colorHex) {
  const vals = values && values.length ? values : [0, 0]
  const w = 100
  const h = 36
  const pad = 4
  const max = Math.max(...vals, 0)
  const min = Math.min(...vals, 0)
  const range = max - min || 1
  const stepX = vals.length > 1 ? w / (vals.length - 1) : w
  const pts = vals.map((v, i) => [i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)])

  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const mx = ((x0 + x1) / 2).toFixed(1)
    const my = ((y0 + y1) / 2).toFixed(1)
    line += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${mx} ${my}`
    line += ` Q ${x1.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  const lastX = pts[pts.length - 1][0].toFixed(1)
  const firstX = pts[0][0].toFixed(1)
  const area = `${line} L ${lastX} ${h} L ${firstX} ${h} Z`
  const gid = `dashSpark${dashSparklineSeq++}`

  return `<div class="mt-2">
    <svg viewBox="0 0 ${w} ${h}" class="w-full h-9" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colorHex}" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="${colorHex}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gid})" stroke="none"/>
      <path d="${line}" fill="none" stroke="${colorHex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${lastX}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2.2" fill="${colorHex}"/>
    </svg>
  </div>`
}

// 圓形進度環，用於卡片內展示單一比率指標（如已收款比例）
function dashRadialGauge(pct, colorHex, trackHex, subLabel) {
  const p = Math.max(0, Math.min(100, pct))
  const r = 15.5
  const c = 2 * Math.PI * r
  const offset = c - (p / 100) * c
  return `<div class="flex items-center gap-3 mt-2">
    <svg viewBox="0 0 36 36" class="w-9 h-9 -rotate-90 shrink-0">
      <circle cx="18" cy="18" r="${r}" fill="none" stroke="${trackHex}" stroke-width="4"/>
      <circle cx="18" cy="18" r="${r}" fill="none" stroke="${colorHex}" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
    </svg>
    <div class="min-w-0">
      <p class="text-sm font-bold text-ink-50">${p}%</p>
      <p class="text-[10px] text-ink-400 truncate">${subLabel || ''}</p>
    </div>
  </div>`
}

function renderDashboard(d, r, ps, activeProjects, finance) {
  // ---------- KPI 卡片 ----------
  const revenuePct = dashTrendPct(r.trend, 'won_amount')
  const revenueBars = (r.trend || []).map((t) => t.won_amount || 0)
  const statusBars = [ps.not_started || 0, ps.in_progress || 0, ps.paused || 0, ps.completed || 0]
  // 由近月 created_count / won_count 換算出月度成交率走勢（無需新資料來源）
  const winRateSeries = (r.trend || []).map((t) => (t.created_count ? Math.round((t.won_count / t.created_count) * 1000) / 10 : 0))

  let card3
  if (finance) {
    const pct = finance.total_amount > 0 ? Math.round((finance.paid_amount / finance.total_amount) * 100) : 0
    card3 = dashCard({
      icon: 'fa-hand-holding-dollar',
      badge: 'A/R',
      badgeCls: 'bg-info-500/15 text-info-500',
      label: '應收帳款',
      sub2: '應收 · RECEIVABLES',
      value: Fmt.currency(finance.balance),
      extra: dashRadialGauge(pct, '#41668c', '#e1e0d5', `已收 ${Fmt.currency(finance.paid_amount)} / ${Fmt.currency(finance.total_amount)}`)
    })
  } else {
    card3 = dashCard({
      icon: 'fa-file-invoice-dollar',
      badge: 'PIPELINE',
      badgeCls: 'bg-info-500/15 text-info-500',
      label: 'Pipeline 金額',
      sub2: '進行中報價 · PIPELINE',
      value: Fmt.currency(d.pipeline_amount),
      extra: `<p class="text-[11px] text-ink-400 mt-3">待審核/已核准/已寄送 報價總額</p>`
    })
  }

  document.getElementById('dash-cards').innerHTML = `
    ${dashCard({
      icon: 'fa-sack-dollar',
      badge: 'MTD',
      badgeCls: 'bg-good-500/15 text-good-500',
      label: '本月成交金額',
      sub2: '本月營收 · MONTHLY REVENUE',
      value: Fmt.currency(d.won_this_month.amount),
      extra: dashSparkline(revenueBars.length ? revenueBars : [0, 0], '#3d604b') + `<div class="mt-1">${dashTrendBadge(revenuePct)}</div>`
    })}
    ${dashCard({
      icon: 'fa-helmet-safety',
      badge: 'SITES',
      badgeCls: 'bg-primary-500/15 text-primary-500',
      label: '在建工程',
      sub2: '進行中工地 · ACTIVE PROJECTS',
      value: `${ps.in_progress || 0}`,
      extra: dashSparkBars(statusBars, 'bg-primary-500/70') + `<p class="text-[11px] text-ink-400 mt-1">共 ${ps.total || 0} 個工程 · 未開工 ${ps.not_started || 0}</p>`
    })}
    ${card3}
    ${dashCard({
      icon: 'fa-trophy',
      badge: 'RATE',
      badgeCls: 'bg-wood-500/15 text-wood-500',
      label: '成交率',
      sub2: '報價成交率 · WIN RATE',
      value: r.kpi.win_rate !== null ? `${r.kpi.win_rate}%` : '—',
      extra: dashSparkline(winRateSeries.length ? winRateSeries : [0, 0], '#cca969') + `<p class="text-[11px] text-ink-400 mt-1">${r.kpi.won_count} 成交 · ${r.kpi.lost_count} 流失</p>`
    })}
  `

  // ---------- 進行中工程（Gantt 風格列表） ----------
  const gantt = document.getElementById('dash-gantt')
  if (!activeProjects.length) {
    gantt.innerHTML = `<p class="text-ink-400 text-center py-8"><i class="fas fa-helmet-safety text-2xl block mb-2"></i>目前沒有進行中的工程</p>`
  } else {
    gantt.innerHTML = activeProjects
      .map((p) => {
        const pct = p.progress_percent || 0
        const phase = dashPhaseOf(pct)
        return `
      <a href="/projects/${p.id}" class="grid grid-cols-[1fr_auto] md:grid-cols-[180px_1fr_50px] items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-surface-200 border-b border-line last:border-b-0">
        <div class="min-w-0">
          <p class="font-medium text-ink-50 truncate">${Fmt.escapeHtml(p.company_name)}</p>
          <p class="text-[11px] text-ink-400 truncate">${Fmt.escapeHtml(p.order_no)} · ${Fmt.escapeHtml(p.owner_name || '')}</p>
        </div>
        <div class="hidden md:block relative h-6 bg-surface-300 rounded-md overflow-hidden">
          <div class="absolute inset-y-0 left-0 ${phase.color} flex items-center px-2 text-[11px] font-medium text-surface-300 whitespace-nowrap" style="width:${Math.max(pct, 14)}%">
            ${phase.label}
          </div>
        </div>
        <div class="text-right font-semibold text-ink-50 text-sm">${pct}%</div>
      </a>`
      })
      .join('')
  }

  // ---------- 營收趨勢折線圖 ----------
  const trendLabels = (r.trend || []).map((t) => t.month.slice(5) + '月')
  new Chart(document.getElementById('dash-revenue-chart'), {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [
        {
          label: '成交金額',
          data: (r.trend || []).map((t) => t.won_amount || 0),
          borderColor: '#3d604b',
          backgroundColor: 'rgba(61,96,75,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#3d604b'
        },
        {
          label: '報價金額',
          data: (r.trend || []).map((t) => t.created_amount || 0),
          borderColor: '#a8a495',
          borderDash: [4, 4],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0
        }
      ]
    },
    options: {
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
      scales: {
        y: { ticks: { callback: (v) => Fmt.compactNumber ? Fmt.compactNumber(v) : v, font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  })

  // ---------- 案件類型分布 ----------
  const catEl = document.getElementById('dash-category')
  const byCategory = r.by_category || []
  if (!byCategory.length) {
    catEl.innerHTML = `<p class="text-ink-400 text-center py-6 text-xs">尚無已成交案件資料</p>`
  } else {
    const maxAmt = Math.max(...byCategory.map((x) => x.amount || 0), 1)
    catEl.innerHTML = byCategory
      .slice(0, 6)
      .map((cat, i) => {
        const w = Math.max(6, Math.round(((cat.amount || 0) / maxAmt) * 100))
        const color = DASH_PALETTE[i % DASH_PALETTE.length]
        return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-ink-100 truncate">${Fmt.escapeHtml(cat.category)}</span>
          <span class="text-ink-400 font-medium">${cat.quote_count}</span>
        </div>
        <div class="h-2 rounded-full bg-surface-300 overflow-hidden">
          <div class="h-full rounded-full" style="width:${w}%;background:${color}"></div>
        </div>
      </div>`
      })
      .join('')
  }

  // ---------- 工地實況（Live Site Feed，無現場照片欄位，以漸層色卡呈現）----------
  const feedEl = document.getElementById('dash-sitefeed')
  if (!activeProjects.length) {
    feedEl.innerHTML = `<p class="col-span-full text-ink-400 text-center py-8 text-xs">目前沒有進行中的工地</p>`
  } else {
    feedEl.innerHTML = activeProjects
      .slice(0, 6)
      .map((p, i) => {
        const color = DASH_PALETTE[i % DASH_PALETTE.length]
        const phase = dashPhaseOf(p.progress_percent || 0)
        return `
      <a href="/projects/${p.id}" class="group relative rounded-lg overflow-hidden aspect-square flex items-end p-2"
         style="background:linear-gradient(155deg, ${color}CC 0%, ${color} 100%)">
        <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-good-500 shadow"></span>
        <div class="relative z-10">
          <p class="text-[11px] font-semibold text-white truncate drop-shadow">${Fmt.escapeHtml(p.company_name)}</p>
          <p class="text-[10px] text-white/70 truncate">${phase.label} · W${p.progress_percent || 0}%</p>
        </div>
      </a>`
      })
      .join('')
  }

  // ---------- 待辦跟進 ----------
  const tasksEl = document.getElementById('dash-tasks')
  if (!d.upcoming_tasks.length) {
    tasksEl.innerHTML = `<p class="text-ink-400 text-center py-6"><i class="fas fa-circle-check text-2xl block mb-2"></i>目前沒有待辦事項</p>`
  } else {
    tasksEl.innerHTML = d.upcoming_tasks
      .map(
        (t) => `
      <a href="/customers/${t.customer_id}" class="block p-3 rounded-lg bg-surface-200 hover:bg-surface-300">
        <p class="font-medium text-ink-50">${Fmt.escapeHtml(t.subject)}</p>
        <p class="text-ink-400 text-xs mt-0.5">${Fmt.escapeHtml(t.company_name)} · ${Fmt.date(t.activity_date)}</p>
      </a>`
      )
      .join('')
  }

  // ---------- 待審核報價（主管/管理員限定） ----------
  if (d.pending_approvals && d.pending_approvals.length) {
    document.getElementById('dash-approvals-section').classList.remove('hidden')
    document.getElementById('dash-approvals').innerHTML = d.pending_approvals
      .map(
        (q) => `
      <a href="/quotes/${q.id}" class="flex items-center justify-between p-3 rounded-lg bg-gold-500/10 hover:bg-gold-500/20">
        <div>
          <p class="font-medium text-ink-50">${Fmt.escapeHtml(q.quote_no)} · ${Fmt.escapeHtml(q.title || '')}</p>
          <p class="text-ink-400 text-xs mt-0.5">${Fmt.escapeHtml(q.company_name)} · 業務：${Fmt.escapeHtml(q.owner_name)}</p>
        </div>
        <span class="font-semibold text-ink-50">${Fmt.currency(q.total_amount)}</span>
      </a>`
      )
      .join('')
  }
}

// 依進度百分比推估目前施工階段標籤（工程資料未細分階段欄位，以進度區間近似呈現）
function dashPhaseOf(pct) {
  if (pct >= 100) return { label: '已完工・驗收', color: 'bg-good-500' }
  if (pct >= 75) return { label: '木作・完工階段', color: 'bg-primary-500' }
  if (pct >= 50) return { label: '系統櫃・油漆', color: 'bg-info-500' }
  if (pct >= 25) return { label: '水電進行中', color: 'bg-plum-500' }
  return { label: '拆除・整修', color: 'bg-bad-500' }
}

function dashCard({ icon, badge, badgeCls, label, sub2, value, extra }) {
  return `
  <div class="bg-surface-100 rounded-xl border border-line p-5">
    <div class="flex items-center justify-between mb-3">
      <div class="w-9 h-9 rounded-lg bg-surface-200 flex items-center justify-center text-primary-500">
        <i class="fas ${icon}"></i>
      </div>
      <span class="text-[10px] font-bold px-2 py-1 rounded-full ${badgeCls} tracking-label">${badge}</span>
    </div>
    <p class="text-xs text-ink-400">${label}</p>
    <p class="text-[10px] text-ink-500 tracking-label uppercase mb-1">${sub2}</p>
    <p class="text-2xl font-bold text-ink-50">${value}</p>
    ${extra || ''}
  </div>`
}
