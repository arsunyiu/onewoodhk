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
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <link href="/static/styles.css" rel="stylesheet">
  <script>
    // 色調參考 onewood.com.hk 官網品牌色：深綠 + 木棕
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eaf3ef',100:'#d3e6dd',500:'#2a6a52',600:'#1f5b45',700:'#163f30' },
            wood:    { 50:'#f7f3ee',100:'#ece2d4',500:'#7a5a3a',600:'#63472c',700:'#4f3823' }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-[#fbfaf7] text-gray-800">
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
  <script src="/static/pages/reports.js"></script>
  <script src="/static/pages/profile.js"></script>
  <script src="/static/pages/placeholders.js"></script>
  <script src="/static/js/main.js"></script>
</body>
</html>`
}

// 所有前端頁面路由都回傳同一個 shell，由 main.js 依路徑渲染畫面
const pageRoutes = ['/', '/login', '/customers', '/customers/new', '/customers/:id', '/customers/:id/edit',
  '/quotes', '/quotes/new', '/quotes/:id', '/quotes/:id/edit', '/products', '/orders', '/finance', '/finance/:id', '/accounting', '/projects', '/projects/:id', '/suppliers', '/suppliers/:id', '/users', '/roles', '/reports', '/settings/profile']

for (const route of pageRoutes) {
  app.get(route, (c) => c.html(pageShell('一木工程')))
}

export default app
