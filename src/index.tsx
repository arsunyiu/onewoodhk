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
    // 一木工程 MUI SUITE 深色奢華配色（深綠黑底 + 金色點綴）— 第二次依回饋再調亮整體層次
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // 品牌金色（取代原本的 primary，作為互動/強調主色；50/100 為深色徽章底，600/700 為淺金文字）
            primary: { 50:'#332a1a',100:'#423521',200:'#57472a',300:'#6f5c35',400:'#b8985c',500:'#e0c090',600:'#e8ce9e',700:'#f0dbb0' },
            // wood 改為古銅/琥珀色，與 primary 金色做出區隔（用於管理員徽章等次要強調色）
            wood:    { 50:'#332615',100:'#43331d',500:'#e3ba6c',600:'#ecc880',700:'#f3d69a' },
            // 卡片/面板背景（依層次由淺至深，第二輪再調亮約 15%）
            surface: { 50:'#2c4038',100:'#23362f',200:'#1c2b25',300:'#16221d',400:'#111b17' },
            // 邊框
            line: { DEFAULT:'#3a4f47',light:'#4a6058' },
            // 文字
            ink: { 50:'#f7f9f7',100:'#e4eae6',400:'#9baaa1',500:'#b3c1b8' },
            // 語意色（成功/警示/危險/資訊等），呼應參考畫面的多彩重點色
            gold:  { 50:'#faf3e6',400:'#e6c274',500:'#e0c090',600:'#d0ac78' },
            good:  { 50:'#1d3d30',400:'#5fdba3',500:'#5fdba3' },
            bad:   { 50:'#432523',400:'#eea095',500:'#eea095' },
            info:  { 50:'#1e323b',400:'#82b0ca',500:'#82b0ca' },
            plum:  { 50:'#302539',400:'#b6a1cf',500:'#b6a1cf' },
            // 直接改寫全域 gray/red/green/yellow/blue 等 Tailwind 內建 scale，
            // 讓現有頁面沿用的既有 class（bg-white/text-gray-*/bg-red-100 等）
            // 不需逐一改寫，即可自動呈現深色奢華風格（第二輪再調亮，避免過暗）
            white: '#23362f',
            gray: {
              50:'#2c4038', 100:'#354a41', 200:'#405a4f', 300:'#4d6a5d',
              400:'#9baaa1', 500:'#b3c1b8', 600:'#c9d4cd', 700:'#e0e6e2',
              800:'#f4f6f4', 900:'#ffffff'
            },
            green: {
              50:'#1d3d30', 100:'#26503f', 600:'#5fdba3', 700:'#7fe4b3'
            },
            red: {
              50:'#432523', 100:'#54312d', 300:'#eea095', 400:'#eea095',
              500:'#eea095', 600:'#f2b3aa', 700:'#f5c7c0'
            },
            yellow: {
              50:'#433017', 100:'#543d20', 500:'#e6c274', 600:'#e6c274', 700:'#edd08e'
            },
            orange: {
              50:'#433017', 100:'#543d20', 500:'#e6c274', 600:'#e6c274'
            },
            blue: {
              50:'#1e323b', 100:'#273e48', 400:'#82b0ca', 600:'#82b0ca', 700:'#9cc2d8'
            },
            purple: { 400:'#b6a1cf', 600:'#b6a1cf' },
            indigo: { 400:'#b6a1cf', 600:'#b6a1cf' },
            slate:  { 300:'#4a6058' },
            amber:  { 400:'#e6c274', 500:'#e6c274' }
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
<body class="bg-[#152420] text-ink-50">
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
