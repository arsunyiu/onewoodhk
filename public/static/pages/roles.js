// ============================================================
// 角色管理頁（僅管理員可用）：權限矩陣說明 + 組織架構 + 快速調整角色
// ============================================================
window.Pages = window.Pages || {}

const ROLE_PERMISSION_MATRIX = [
  { module: '客戶管理', sales: '僅可檢視/編輯自己負責的客戶', manager: '可檢視/指派團隊成員的客戶', admin: '可檢視/指派全公司所有客戶' },
  { module: '報價管理', sales: '僅可建立/編輯自己的報價，需送審核准', manager: '可核准/拒絕團隊報價，可指派負責人', admin: '可核准/拒絕全公司報價，可指派負責人' },
  { module: '成交訂單', sales: '僅可檢視自己的成交訂單', manager: '可檢視自己與團隊的成交訂單', admin: '可檢視全公司成交訂單' },
  { module: '產品目錄', sales: '僅可檢視、於報價中選用', manager: '可新增/編輯/下架產品', admin: '可新增/編輯/下架產品' },
  { module: '報表分析', sales: '僅可檢視自己的業績報表', manager: '可檢視自己與團隊的業績報表', admin: '可檢視全公司業績報表' },
  { module: '使用者管理', sales: '無權限', manager: '無權限', admin: '可新增使用者、調整角色與主管歸屬' }
]

const ROLE_ORDER = ['admin', 'manager', 'sales']
const ROLE_META = {
  admin:   { label: '管理員', color: 'bg-wood-100 text-wood-700', icon: 'fa-crown' },
  manager: { label: '主管',   color: 'bg-primary-100 text-primary-700', icon: 'fa-user-tie' },
  sales:   { label: '業務',   color: 'bg-gray-100 text-gray-600', icon: 'fa-user' }
}

let RolesUserCache = []

Pages.roles = async function () {
  mountLayout('roles')

  if (!Auth.isAdmin()) {
    setMainContent(`
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <i class="fas fa-lock text-2xl"></i>
        </div>
        <h1 class="text-lg font-bold text-gray-800 mb-1">權限不足</h1>
        <p class="text-sm text-gray-400 max-w-sm">角色管理頁面僅限管理員（Admin）存取。</p>
        <a href="/" class="mt-6 text-primary-600 text-sm hover:underline">回首頁總覽</a>
      </div>`)
    return
  }

  setMainContent(`
    <div class="flex items-center justify-center py-24 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> 載入中...
    </div>`)

  try {
    const res = await API.get('/users')
    RolesUserCache = res.data
    renderRoles(RolesUserCache)
  } catch (err) {
    setMainContent(`<div class="text-center py-20"><p class="text-red-400 mb-3">${err.message}</p></div>`)
  }
}

function renderRoles(list) {
  const counts = { admin: 0, manager: 0, sales: 0 }
  list.forEach((u) => { if (counts[u.role] !== undefined) counts[u.role]++ })

  const summaryCards = ROLE_ORDER.map((role) => {
    const meta = ROLE_META[role]
    return `
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div class="w-11 h-11 rounded-xl ${meta.color} flex items-center justify-center">
        <i class="fas ${meta.icon}"></i>
      </div>
      <div>
        <p class="text-2xl font-bold text-gray-800">${counts[role]}</p>
        <p class="text-xs text-gray-400">${meta.label}</p>
      </div>
    </div>`
  }).join('')

  const matrixRows = ROLE_PERMISSION_MATRIX.map((row) => `
    <tr class="border-b border-gray-50">
      <td class="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">${row.module}</td>
      <td class="px-4 py-3 text-gray-500">${row.sales}</td>
      <td class="px-4 py-3 text-gray-500">${row.manager}</td>
      <td class="px-4 py-3 text-gray-500">${row.admin}</td>
    </tr>`).join('')

  // 組織架構：以主管為分組，列出旗下業務；沒有主管的 admin/manager 獨立列出
  const managers = list.filter((u) => u.role === 'manager' || u.role === 'admin')
  const orgGroups = managers.map((mgr) => {
    const team = list.filter((u) => u.manager_id === mgr.id)
    if (!team.length) return ''
    const teamHtml = team.map((member) => renderOrgMemberRow(member, list)).join('')
    return `
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <i class="fas ${ROLE_META[mgr.role].icon} text-primary-600"></i>
        <span class="font-semibold text-gray-800">${Fmt.escapeHtml(mgr.name)}</span>
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_META[mgr.role].color}">${ROLE_META[mgr.role].label}</span>
        <span class="text-xs text-gray-400">（${team.length} 位團隊成員）</span>
      </div>
      <div class="pl-6 border-l-2 border-gray-100 space-y-1.5">${teamHtml}</div>
    </div>`
  }).join('')

  const noManagerUsers = list.filter((u) => !u.manager_id && u.role === 'sales')
  const noManagerHtml = noManagerUsers.length ? `
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <i class="fas fa-user-slash text-gray-400"></i>
        <span class="font-semibold text-gray-500">未指定主管</span>
      </div>
      <div class="pl-6 border-l-2 border-gray-100 space-y-1.5">
        ${noManagerUsers.map((m) => renderOrgMemberRow(m, list)).join('')}
      </div>
    </div>` : ''

  setMainContent(`
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-800">角色管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">檢視角色權限範圍與組織架構，並可快速調整成員角色</p>
      </div>
      <a href="/users" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
        <i class="fas fa-users-gear"></i> 前往使用者管理
      </a>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      ${summaryCards}
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
      <div class="px-5 py-4 border-b border-gray-100">
        <h2 class="text-base font-bold text-gray-800">角色權限矩陣</h2>
        <p class="text-xs text-gray-400 mt-0.5">各角色於系統各模組的操作範圍說明</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 border-b border-gray-100">
              <th class="px-4 py-3 font-medium">功能模組</th>
              <th class="px-4 py-3 font-medium">業務 (sales)</th>
              <th class="px-4 py-3 font-medium">主管 (manager)</th>
              <th class="px-4 py-3 font-medium">管理員 (admin)</th>
            </tr>
          </thead>
          <tbody>${matrixRows}</tbody>
        </table>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 class="text-base font-bold text-gray-800 mb-1">組織架構</h2>
      <p class="text-xs text-gray-400 mb-4">依主管歸屬分組顯示團隊成員，點擊「調整角色」可快速編輯</p>
      ${orgGroups || '<p class="text-sm text-gray-400 py-6 text-center">尚無主管/團隊資料</p>'}
      ${noManagerHtml}
    </div>
  `)

  document.querySelectorAll('.role-quick-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = RolesUserCache.find((x) => x.id === Number(btn.dataset.id))
      if (!user) return
      // 借用使用者管理頁的編輯彈窗（users.js 定義的全域函式），並同步使用者清單快取
      if (typeof openUserModal === 'function') {
        UserListCache = RolesUserCache
        openUserModal(user)
        const originalSubmit = document.getElementById('um-submit')
        if (originalSubmit) {
          originalSubmit.addEventListener('click', () => {
            // 提交成功後重新載入角色管理頁資料
            setTimeout(() => { Pages.roles() }, 300)
          })
        }
      } else {
        location.href = '/users'
      }
    })
  })
}

function renderOrgMemberRow(member, list) {
  const meta = ROLE_META[member.role] || ROLE_META.sales
  return `
  <div class="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold">
        ${Fmt.escapeHtml((member.name || '?').charAt(0))}
      </div>
      <span class="text-sm text-gray-700">${Fmt.escapeHtml(member.name)}</span>
      <span class="px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}">${meta.label}</span>
      ${member.is_active === 0 ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-500">已停用</span>' : ''}
    </div>
    <button class="role-quick-edit-btn text-primary-600 hover:underline text-xs" data-id="${member.id}">調整角色</button>
  </div>`
}
