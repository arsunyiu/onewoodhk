// ============================================================
// 工程管理頁面：追蹤「成交訂單」對應的施工進度
// - 列表頁：/projects（工程進度總覽，依角色資料範圍過濾）
// - 詳情頁：/projects/:id（工程資訊 + 進度時間軸，訂單負責業務/manager/admin 可更新）
// ============================================================
window.Pages = window.Pages || {}

const PROJECT_STATUS_META = {
  not_started: { label: '未開始', color: 'bg-gray-200 text-gray-600' },
  in_progress: { label: '進行中', color: 'bg-primary-100 text-primary-700' },
  paused: { label: '暫停', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' }
}

const ProjectListState = { page: 1, pageSize: 20, status: '' }

Pages.projects = async function () {
  mountLayout('projects')
  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">工程管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">追蹤成交訂單對應的施工進度，掌握各工程狀態與完成度</p>
      </div>
      <select id="proj-status-filter" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option value="">全部狀態</option>
        <option value="not_started">未開始</option>
        <option value="in_progress">進行中</option>
        <option value="paused">暫停</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
      </select>
    </div>

    <div id="proj-summary" class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5"></div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">訂單編號</th>
              <th class="px-4 py-3 font-medium">客戶</th>
              <th class="px-4 py-3 font-medium">工地地址</th>
              <th class="px-4 py-3 font-medium">負責業務</th>
              <th class="px-4 py-3 font-medium">工程負責人</th>
              <th class="px-4 py-3 font-medium">進度</th>
              <th class="px-4 py-3 font-medium text-center">狀態</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody id="proj-table-body">
            <tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="proj-pagination" class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500"></div>
    </div>
  `)

  document.getElementById('proj-status-filter').addEventListener('change', (e) => {
    ProjectListState.status = e.target.value
    ProjectListState.page = 1
    loadProjectList()
  })

  loadProjectSummary()
  loadProjectList()
}

async function loadProjectSummary() {
  const el = document.getElementById('proj-summary')
  if (!el) return
  try {
    const res = await API.get('/projects/summary')
    const s = res.data
    const cards = [
      { label: '工程總數', value: s.total, color: 'text-gray-800' },
      { label: '未開始', value: s.not_started, color: 'text-gray-500' },
      { label: '進行中', value: s.in_progress, color: 'text-primary-600' },
      { label: '已完成', value: s.completed, color: 'text-green-600' },
      { label: '暫停/取消', value: Number(s.paused) + Number(s.cancelled), color: 'text-red-500' }
    ]
    el.innerHTML = cards
      .map(
        (c) => `
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p class="text-xs text-gray-400">${c.label}</p>
        <p class="text-2xl font-bold ${c.color} mt-1">${c.value}</p>
      </div>`
      )
      .join('')
  } catch (err) {
    el.innerHTML = `<div class="col-span-5 text-red-400 text-sm">${err.message}</div>`
  }
}

async function loadProjectList() {
  const tbody = document.getElementById('proj-table-body')
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>`
  try {
    const res = await API.get('/projects', {
      status: ProjectListState.status,
      page: ProjectListState.page,
      page_size: ProjectListState.pageSize
    })
    renderProjectTable(res.data)
    renderProjectPagination(res.pagination)
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-400">${err.message}</td></tr>`
  }
}

function progressBar(percent) {
  const p = Math.max(0, Math.min(100, Number(percent || 0)))
  return `
    <div class="flex items-center gap-2 min-w-[110px]">
      <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full bg-primary-500 rounded-full" style="width:${p}%"></div>
      </div>
      <span class="text-xs text-gray-500 w-8 text-right">${p}%</span>
    </div>`
}

function renderProjectTable(list) {
  const tbody = document.getElementById('proj-table-body')
  if (!tbody) return
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-400">尚無工程資料</td></tr>`
    return
  }
  tbody.innerHTML = list
    .map((p) => {
      const meta = PROJECT_STATUS_META[p.status] || PROJECT_STATUS_META.not_started
      return `
      <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="location.href='/projects/${p.id}'">
        <td class="px-4 py-3 font-medium text-gray-800">${Fmt.escapeHtml(p.order_no)}</td>
        <td class="px-4 py-3 text-gray-700">${Fmt.escapeHtml(p.company_name)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(p.site_address || '-')}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(p.owner_name)}</td>
        <td class="px-4 py-3 text-gray-500">${Fmt.escapeHtml(p.supervisor_name || '-')}</td>
        <td class="px-4 py-3">${progressBar(p.progress_percent)}</td>
        <td class="px-4 py-3 text-center">${statusBadge(meta)}</td>
        <td class="px-4 py-3 text-right">
          <a href="/projects/${p.id}" class="text-primary-600 hover:underline text-xs">查看詳情 <i class="fas fa-chevron-right text-[10px]"></i></a>
        </td>
      </tr>`
    })
    .join('')
}

function renderProjectPagination(p) {
  const el = document.getElementById('proj-pagination')
  if (!el) return
  if (!p) { el.innerHTML = ''; return }
  el.innerHTML = `
    <span>共 ${p.total} 筆，第 ${p.page} / ${p.total_pages} 頁</span>
    <div class="flex gap-2">
      <button ${p.page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeProjectPage(${p.page - 1})">上一頁</button>
      <button ${p.page >= p.total_pages ? 'disabled' : ''} class="px-3 py-1 rounded border border-gray-200 disabled:opacity-40" onclick="changeProjectPage(${p.page + 1})">下一頁</button>
    </div>`
}

function changeProjectPage(page) {
  ProjectListState.page = page
  loadProjectList()
}

// ------------------------------------------------------------
// 工程詳情頁
// ------------------------------------------------------------
let ProjectDetailId = null
let ProjectUserOptions = []

Pages.projectDetail = async function (id) {
  ProjectDetailId = id
  mountLayout('projects')
  setMainContent(`
    <div class="mb-5">
      <a href="/projects" class="text-sm text-gray-500 hover:text-primary-600"><i class="fas fa-arrow-left mr-1"></i> 返回工程列表</a>
    </div>
    <div id="proj-detail-content">
      <div class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</div>
    </div>
  `)
  await loadProjectDetail(id)
}

async function loadProjectDetail(id) {
  const el = document.getElementById('proj-detail-content')
  if (!el) return
  try {
    const res = await API.get(`/projects/${id}`)
    if (res.data.can_manage && !ProjectUserOptions.length) {
      try {
        const userRes = await API.get('/users')
        ProjectUserOptions = userRes.data
      } catch (e) {
        ProjectUserOptions = []
      }
    }
    renderProjectDetail(res.data)
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`
  }
}

function renderProjectDetail(d) {
  const el = document.getElementById('proj-detail-content')
  if (!el) return
  const p = d.project
  const meta = PROJECT_STATUS_META[p.status] || PROJECT_STATUS_META.not_started
  const canManage = d.can_manage

  el.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold text-gray-800">${Fmt.escapeHtml(p.order_no)}</h2>
              <p class="text-sm text-gray-500">${Fmt.escapeHtml(p.company_name)} · 負責業務：${Fmt.escapeHtml(p.owner_name)}</p>
            </div>
            ${statusBadge(meta)}
          </div>
          <div class="mb-4">${progressBar(p.progress_percent)}</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-gray-100 pt-4 text-sm">
            <div>
              <p class="text-xs text-gray-400">工地地址</p>
              <p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(p.site_address || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">工程負責人</p>
              <p class="text-gray-700 mt-0.5">${Fmt.escapeHtml(p.supervisor_name || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">開工日期</p>
              <p class="text-gray-700 mt-0.5">${Fmt.date(p.start_date)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">預計完工</p>
              <p class="text-gray-700 mt-0.5">${Fmt.date(p.expected_end_date)}</p>
            </div>
          </div>
          ${p.notes ? `<div class="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500"><i class="fas fa-note-sticky mr-1"></i> ${Fmt.escapeHtml(p.notes)}</div>` : ''}
        </div>

        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700">進度時間軸</h3>
          </div>
          <div class="space-y-4">
            ${
              d.logs.length
                ? d.logs
                    .map(
                      (log) => `
              <div class="flex gap-3 border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                <div class="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0"></div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <p class="text-sm text-gray-800">${Fmt.escapeHtml(log.description)}</p>
                    <button onclick="deleteProjectLog(${log.id})" class="text-red-300 hover:text-red-500 text-xs ml-2"><i class="fas fa-trash"></i></button>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">
                    ${Fmt.date(log.log_date)} · ${Fmt.escapeHtml(log.created_by_name || '-')}
                    ${log.progress_percent !== null && log.progress_percent !== undefined ? ` · 進度更新至 ${log.progress_percent}%` : ''}
                  </p>
                </div>
              </div>`
                    )
                    .join('')
                : `<p class="text-center text-gray-400 py-6 text-sm">尚無進度紀錄</p>`
            }
          </div>
        </div>
      </div>

      <div class="space-y-5">
        ${
          canManage
            ? `
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">新增進度紀錄</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-gray-500">紀錄日期</label>
              <input id="log-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-gray-500">進度說明</label>
              <textarea id="log-desc" rows="3" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="例：完成水電配線"></textarea>
            </div>
            <div>
              <label class="text-xs text-gray-500">更新進度百分比（選填）</label>
              <input id="log-percent" type="number" min="0" max="100" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0-100" />
            </div>
            <button id="log-submit" class="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-2 text-sm font-medium">
              <i class="fas fa-plus mr-1"></i> 新增紀錄
            </button>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">工程設定</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-gray-500">工程狀態</label>
              <select id="edit-status" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                ${Object.entries(PROJECT_STATUS_META)
                  .map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.label}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500">工程負責人</label>
              <select id="edit-supervisor" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">未指派</option>
                ${ProjectUserOptions.map(
                  (u) => `<option value="${u.id}" ${p.supervisor_id === u.id ? 'selected' : ''}>${Fmt.escapeHtml(u.name)}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500">工地地址</label>
              <input id="edit-site-address" type="text" value="${Fmt.escapeHtml(p.site_address || '')}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs text-gray-500">開工日期</label>
                <input id="edit-start-date" type="date" value="${p.start_date || ''}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="text-xs text-gray-500">預計完工</label>
                <input id="edit-expected-end" type="date" value="${p.expected_end_date || ''}" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500">備註</label>
              <textarea id="edit-notes" rows="2" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">${Fmt.escapeHtml(p.notes || '')}</textarea>
            </div>
            <button id="edit-submit" class="w-full bg-gray-800 hover:bg-gray-900 text-white rounded-lg py-2 text-sm font-medium">
              <i class="fas fa-save mr-1"></i> 儲存工程設定
            </button>
          </div>
        </div>`
            : ''
        }
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <a href="/finance/${p.order_id}" class="text-primary-600 hover:underline text-sm block mb-2"><i class="fas fa-hand-holding-dollar mr-1"></i> 查看訂單收款狀況</a>
          <a href="/quotes/${p.quote_id}" class="text-primary-600 hover:underline text-sm block"><i class="fas fa-file-invoice mr-1"></i> 查看來源報價單</a>
        </div>
      </div>
    </div>
  `

  if (canManage) {
    document.getElementById('log-submit').addEventListener('click', submitProjectLog)
    document.getElementById('edit-submit').addEventListener('click', submitProjectEdit)
  }
}

async function submitProjectLog() {
  const description = document.getElementById('log-desc').value.trim()
  if (!description) {
    showToast('請輸入進度說明', 'error')
    return
  }
  const percentRaw = document.getElementById('log-percent').value
  const payload = {
    log_date: document.getElementById('log-date').value,
    description,
    progress_percent: percentRaw === '' ? null : Number(percentRaw)
  }
  const btn = document.getElementById('log-submit')
  btn.disabled = true
  try {
    await API.post(`/projects/${ProjectDetailId}/logs`, payload)
    showToast('進度紀錄已新增')
    await loadProjectDetail(ProjectDetailId)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    btn.disabled = false
  }
}

async function submitProjectEdit() {
  const payload = {
    status: document.getElementById('edit-status').value,
    supervisor_id: document.getElementById('edit-supervisor').value || null,
    site_address: document.getElementById('edit-site-address').value.trim() || null,
    start_date: document.getElementById('edit-start-date').value || null,
    expected_end_date: document.getElementById('edit-expected-end').value || null,
    notes: document.getElementById('edit-notes').value.trim() || null
  }
  const btn = document.getElementById('edit-submit')
  btn.disabled = true
  try {
    await API.put(`/projects/${ProjectDetailId}`, payload)
    showToast('工程設定已更新')
    await loadProjectDetail(ProjectDetailId)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    btn.disabled = false
  }
}

async function deleteProjectLog(logId) {
  if (!confirm('確定要刪除此筆進度紀錄嗎？')) return
  try {
    await API.delete(`/projects/logs/${logId}`)
    showToast('已刪除進度紀錄')
    await loadProjectDetail(ProjectDetailId)
  } catch (err) {
    showToast(err.message, 'error')
  }
}
