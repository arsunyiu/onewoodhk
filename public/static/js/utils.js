// ============================================================
// 共用格式化/顯示工具
// ============================================================
const CURRENCY_SYMBOL = { HKD: 'HK$', TWD: 'NT$', USD: 'US$', CNY: 'RMB¥' }

const Fmt = {
  currency(amount, currency) {
    const n = Number(amount || 0)
    const symbol = CURRENCY_SYMBOL[currency] || CURRENCY_SYMBOL.HKD
    return symbol + ' ' + n.toLocaleString('zh-HK', { maximumFractionDigits: 0 })
  },
  date(d) {
    if (!d) return '-'
    return dayjs(d).format('YYYY-MM-DD')
  },
  datetime(d) {
    if (!d) return '-'
    return dayjs(d).format('YYYY-MM-DD HH:mm')
  },
  escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

const QuoteStatusMeta = {
  draft:             { label: '草稿',     color: 'bg-gray-100 text-gray-600' },
  pending_approval:  { label: '待審核',   color: 'bg-yellow-100 text-yellow-700' },
  approved:          { label: '已核准',   color: 'bg-blue-100 text-blue-700' },
  rejected:          { label: '已拒絕',   color: 'bg-red-100 text-red-700' },
  sent:              { label: '已寄送',   color: 'bg-indigo-100 text-indigo-700' },
  won:               { label: '已成交',   color: 'bg-green-100 text-green-700' },
  lost:              { label: '已流失',   color: 'bg-gray-200 text-gray-500' }
}

const CustomerStatusMeta = {
  lead:     { label: '潛在客戶', color: 'bg-yellow-100 text-yellow-700' },
  active:   { label: '合作中',   color: 'bg-green-100 text-green-700' },
  inactive: { label: '停止合作', color: 'bg-gray-200 text-gray-500' }
}

function statusBadge(meta) {
  return `<span class="px-2 py-1 rounded-full text-xs font-medium ${meta.color}">${meta.label}</span>`
}
