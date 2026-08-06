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
  approved:          { label: '已核准',   color: 'bg-primary-100 text-primary-700' },
  rejected:          { label: '已拒絕',   color: 'bg-red-100 text-red-700' },
  sent:              { label: '已寄送',   color: 'bg-wood-100 text-wood-700' },
  won:               { label: '已成交',   color: 'bg-green-100 text-green-700' },
  lost:              { label: '已流失',   color: 'bg-gray-200 text-gray-500' }
}

const CustomerStatusMeta = {
  lead:     { label: '潛在客戶', color: 'bg-yellow-100 text-yellow-700' },
  active:   { label: '合作中',   color: 'bg-green-100 text-green-700' },
  inactive: { label: '停止合作', color: 'bg-gray-200 text-gray-500' }
}

// 工程分類（依裝修/水電行業常見分法整理；用於產品目錄分類篩選、報價項目分類、PDF分組）
// 顯示順序即為報價/發票 PDF 分組排列順序，亦為 A-Z 字母代號的編排順序
const PRODUCT_CATEGORIES = [
  '前期工程', '拆除及清潔工程', '泥水工程', '木器工程', '地板工程',
  '天花及鋁質工程', '油漆工程', '電力工程', '水喉工程', '防水工程',
  '窗戶工程', '設備安裝工程'
]

// 依 PRODUCT_CATEGORIES 陣列順序自動產生 A-Z 分類字母代號；
// 不在此陣列中的分類（如自訂分類）視為無代號，回傳空字串
function categoryLetter(category) {
  const idx = PRODUCT_CATEGORIES.indexOf(category)
  return idx >= 0 && idx < 26 ? String.fromCharCode(65 + idx) : ''
}
// 分類顯示文字（供分類篩選/下拉選單使用），如「A. 前期工程」；無代號則原樣顯示分類名稱
function categoryLabelWithLetter(category) {
  const letter = categoryLetter(category)
  return letter ? `${letter}. ${category}` : category
}
// 分類分組標題文字（供報價明細/PDF分類標題使用），如「A 前期工程」；無代號則原樣顯示分類名稱
function categoryHeaderWithLetter(category) {
  const letter = categoryLetter(category)
  return letter ? `${letter}  ${category}` : category
}
// 依「分類字母 + 分類內建立順序（產品id由小到大）」為產品編上 A1, A2, B1... 編號，
// 方便在產品目錄與報價單選用產品時尋找/對照。日後新增產品只會接在該分類最後一個編號之後，
// 不會打亂既有產品的編號；不在 PRODUCT_CATEGORIES 內的分類（自訂分類）歸入清單最後、不編字母代號。
// 回傳依 A-Z 排序好的新陣列（不修改原陣列），每個產品物件附加 product_code 欄位。
function sortProductsWithCode(products) {
  const withIdx = products.map((p) => {
    const idx = PRODUCT_CATEGORIES.indexOf(p.category || '')
    return { p, catIdx: idx >= 0 ? idx : 999 }
  })
  withIdx.sort((a, b) => (a.catIdx !== b.catIdx ? a.catIdx - b.catIdx : (a.p.id || 0) - (b.p.id || 0)))
  const counters = {}
  return withIdx.map(({ p, catIdx }) => {
    const letter = catIdx < 26 ? String.fromCharCode(65 + catIdx) : ''
    const key = letter || '_'
    counters[key] = (counters[key] || 0) + 1
    return Object.assign({}, p, { product_code: letter ? `${letter}${counters[key]}` : '' })
  })
}

function statusBadge(meta) {
  return `<span class="px-2 py-1 rounded-full text-xs font-medium ${meta.color}">${meta.label}</span>`
}
