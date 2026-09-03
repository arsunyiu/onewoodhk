import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'

import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import customerRoutes from './routes/customers'
import quoteRoutes from './routes/quotes'
import productRoutes from './routes/products'
import orderRoutes from './routes/orders'
import userRoutes from './routes/users'
import reportRoutes from './routes/reports'
import financeRoutes from './routes/finance'
import accountingRoutes from './routes/accounting'
import projectRoutes from './routes/projects'
import supplierRoutes from './routes/suppliers'
import auditRoutes from './routes/audit'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// ---- API Routes ----
app.route('/api/auth', authRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/customers', customerRoutes)
app.route('/api/quotes', quoteRoutes)
app.route('/api/products', productRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/users', userRoutes)
app.route('/api/reports', reportRoutes)
app.route('/api/finance', financeRoutes)
app.route('/api/accounting', accountingRoutes)
app.route('/api/projects', projectRoutes)
app.route('/api/suppliers', supplierRoutes)
app.route('/api/audit', auditRoutes)

// ---- Page Shell (SPA-like, 由前端 JS 依路徑渲染對應內容) ----
function pageShell(title: string) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 一木工程</title>
  <link rel="icon" type="image/png" href="/static/images/logo.png">
  <link rel="apple-touch-icon" href="/static/images/logo.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <link href="/static/styles.css" rel="stylesheet">
  <script>
    // 一木工程 MUI SUITE 米白紙感奢華配色（米色紙感底 + 白卡片 + 深綠主色 + 金色點綴）
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // 品牌深綠（互動/強調主色；50/100 為淺綠徽章底，500/600 為按鈕/Active狀態，700 為hover）
            primary: { 50:'#eaf0ea',100:'#d3e0d3',200:'#a8c2a9',300:'#6f9273',400:'#3f6549',500:'#2d4a35',600:'#1b3223',700:'#12241a' },
            // wood 改為金色/芥末金（用於管理員徽章、已寄送狀態等次要強調色）
            wood:    { 50:'#faf3e2',100:'#f3e4bf',500:'#cca969',600:'#b8934f',700:'#96753c' },
            // 卡片/面板背景（由白到米色，層次分明）
            surface: { 50:'#ffffff',100:'#ffffff',200:'#f7f6f0',300:'#f3f2eb',400:'#ebeae0' },
            // 邊框（暖灰米色）
            line: { DEFAULT:'#e1e0d5',light:'#ececdf' },
            // 文字（近黑標題 / 暖灰次要文字）
            ink: { 50:'#2c2c2c',100:'#4a4840',400:'#8d8a7d',500:'#726f63' },
            // 金色點綴（icon/強調背景，同 wood 色系）
            gold:  { 50:'#faf3e2',400:'#cca969',500:'#b8934f',600:'#96753c' },
            // 語意色（成功/警示/資訊/紫調），呼應參考畫面 Gantt 狀態標籤與案件分類色條
            good:  { 50:'#e8f0e9',400:'#3d604b',500:'#3d604b' },
            bad:   { 50:'#f5e9e9',400:'#8c3636',500:'#8c3636' },
            info:  { 50:'#e9eef2',400:'#41668c',500:'#41668c' },
            plum:  { 50:'#eeeaf2',400:'#4d3d75',500:'#4d3d75' },
            // 直接改寫全域 gray/red/green/yellow/blue 等 Tailwind 內建 scale，
            // 讓現有頁面沿用的既有 class（bg-white/text-gray-*/bg-red-100 等）
            // 不需逐一改寫，即可自動呈現米白紙感奢華風格
            gray: {
              50:'#f7f6f0', 100:'#f0efe6', 200:'#e5e3d6', 300:'#d6d3c2',
              400:'#a8a495', 500:'#8d8a7d', 600:'#6b6858', 700:'#4a4840',
              800:'#2f2e28', 900:'#1c1b17'
            },
            green: {
              50:'#e8f0e9', 100:'#d3e2d5', 600:'#3d604b', 700:'#2c4837'
            },
            red: {
              50:'#f5e9e9', 100:'#ecd5d5', 300:'#c98f8f', 400:'#b06e6e',
              500:'#8c3636', 600:'#7a2e2e', 700:'#642626'
            },
            yellow: {
              50:'#faf6e8', 100:'#f3e9c9', 200:'#e9d9a3', 500:'#cca969', 600:'#b8934f', 700:'#96753c'
            },
            orange: {
              50:'#faf1e5', 100:'#f3e0c4', 500:'#c17f3e', 600:'#a8692f'
            },
            blue: {
              50:'#e9eef2', 100:'#d3dfe8', 400:'#6a8caa', 600:'#41668c', 700:'#33506f'
            },
            purple: { 400:'#7c67a0', 600:'#4d3d75' },
            indigo: { 400:'#7c67a0', 600:'#4d3d75' },
            slate:  { 300:'#d6d3c2' },
            amber:  { 400:'#cca969', 500:'#b8934f' }
          }
        }
      }
    }
  </script>
  <style>
    .font-serif-cn { font-family: 'Noto Serif TC', 'PingFang TC', serif; }
    .tracking-label { letter-spacing: 0.15em; }
  </style>
</head>
<body class="bg-[#f3f2eb] text-ink-50">
  <div id="app"></div>
  <script src="/static/js/api.js"></script>
  <script src="/static/js/auth.js"></script>
  <script src="/static/js/utils.js"></script>
  <script src="/static/js/companyInfo.js"></script>
  <script src="/static/js/layout.js"></script>
  <script src="/static/pages/login.js"></script>
  <script src="/static/pages/dashboard.js"></script>
  <script src="/static/pages/customers.js"></script>
  <script src="/static/pages/customerDetail.js"></script>
  <script src="/static/pages/customerForm.js"></script>
  <script src="/static/pages/quotes.js"></script>
  <script src="/static/pages/quoteForm.js"></script>
  <script src="/static/pages/quoteDetail.js"></script>
  <script src="/static/pages/products.js"></script>
  <script src="/static/pages/orders.js"></script>
  <script src="/static/pages/finance.js"></script>
  <script src="/static/pages/accounting.js"></script>
  <script src="/static/pages/projects.js"></script>
  <script src="/static/pages/suppliers.js"></script>
  <script src="/static/pages/users.js"></script>
  <script src="/static/pages/roles.js"></script>
  <script src="/static/pages/auditLog.js"></script>
  <script src="/static/pages/reports.js"></script>
  <script src="/static/pages/profile.js"></script>
  <script src="/static/pages/placeholders.js"></script>
  <script src="/static/js/main.js"></script>
</body>
</html>`
}

// 所有前端頁面路由都回傳同一個 shell，由 main.js 依路徑渲染畫面
const pageRoutes = ['/', '/login', '/customers', '/customers/new', '/customers/:id', '/customers/:id/edit',
  '/quotes', '/quotes/new', '/quotes/:id', '/quotes/:id/edit', '/products', '/orders', '/finance', '/finance/:id', '/accounting', '/projects', '/projects/:id', '/suppliers', '/suppliers/:id', '/users', '/roles', '/audit-log', '/reports', '/settings/profile']

for (const route of pageRoutes) {
  app.get(route, (c) => c.html(pageShell('一木工程')))
}

export default app
