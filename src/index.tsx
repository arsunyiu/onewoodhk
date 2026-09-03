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
    // 一木工程 MUI SUITE 深色奢華配色（深綠黑底 + 金色點綴）— 已依回饋調亮整體層次
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // 品牌金色（取代原本的 primary，作為互動/強調主色；50/100 為深色徽章底，600/700 為淺金文字）
            primary: { 50:'#2c2416',100:'#3a2f1c',200:'#4d3f24',300:'#63512e',400:'#a68a52',500:'#d4b57e',600:'#e0c48f',700:'#ecd3a3' },
            // wood 改為古銅/琥珀色，與 primary 金色做出區隔（用於管理員徽章等次要強調色）
            wood:    { 50:'#2c2113',100:'#3a2c19',500:'#dcae5c',600:'#e6bc72',700:'#efcd8f' },
            // 卡片/面板背景（依層次由淺至深，整體較原方案調亮約 20%）
            surface: { 50:'#233530',100:'#1a2b25',200:'#152420',300:'#101d19',400:'#0c1614' },
            // 邊框
            line: { DEFAULT:'#2c3e37',light:'#3a4f47' },
            // 文字
            ink: { 50:'#f2f5f3',100:'#dbe3de',400:'#87998f',500:'#a3b3aa' },
            // 語意色（成功/警示/危險/資訊等），呼應參考畫面的多彩重點色
            gold:  { 50:'#f8f1e2',400:'#e0b864',500:'#d4b57e',600:'#c4a06a' },
            good:  { 50:'#173328',400:'#4fcf94',500:'#4fcf94' },
            bad:   { 50:'#3a201e',400:'#e69289',500:'#e69289' },
            info:  { 50:'#182b33',400:'#72a2bd',500:'#72a2bd' },
            plum:  { 50:'#292032',400:'#a893c2',500:'#a893c2' },
            // 直接改寫全域 gray/red/green/yellow/blue 等 Tailwind 內建 scale，
            // 讓現有頁面沿用的既有 class（bg-white/text-gray-*/bg-red-100 等）
            // 不需逐一改寫，即可自動呈現深色奢華風格（整體亮度較初版提升，避免過暗）
            white: '#1a2b25',
            gray: {
              50:'#223530', 100:'#2a4038', 200:'#33463c', 300:'#405b50',
              400:'#87998f', 500:'#a3b3aa', 600:'#bcc9c1', 700:'#d8e0da',
              800:'#f1f4f2', 900:'#ffffff'
            },
            green: {
              50:'#173328', 100:'#1f4635', 600:'#4fcf94', 700:'#6fdaa8'
            },
            red: {
              50:'#3a201e', 100:'#4a2a27', 300:'#e69289', 400:'#e69289',
              500:'#e69289', 600:'#eba9a1', 700:'#f0bfb9'
            },
            yellow: {
              50:'#3a2c14', 100:'#4a381c', 500:'#e0b864', 600:'#e0b864', 700:'#e9c885'
            },
            orange: {
              50:'#3a2c14', 100:'#4a381c', 500:'#e0b864', 600:'#e0b864'
            },
            blue: {
              50:'#182b33', 100:'#20363f', 400:'#72a2bd', 600:'#72a2bd', 700:'#8fb6cc'
            },
            purple: { 400:'#a893c2', 600:'#a893c2' },
            indigo: { 400:'#a893c2', 600:'#a893c2' },
            slate:  { 300:'#3a4f47' },
            amber:  { 400:'#e0b864', 500:'#e0b864' }
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
<body class="bg-[#0d1815] text-ink-50">
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
