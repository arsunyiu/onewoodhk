# 一木工程 — B2B 報價管理 × CRM × 銷售管理一體化平台

## Project Overview
- **Name**: 一木工程
- **Goal**: 為業務團隊提供三合一平台：客戶關係管理(CRM)、B2B 報價單建立與審批、銷售 Pipeline 追蹤，取代分散的 Excel/Email 作業流程。
- **主要使用者**: 業務(Sales)、銷售主管(Manager)、系統管理員(Admin)

## 目前已完成功能 ✅
- **登入 / 認證**：JWT 登入機制（PBKDF2 密碼雜湊，Web Crypto API，Workers 原生相容）
- **Dashboard 首頁**：客戶統計、Pipeline 漏斗圖(Chart.js)、本月成交金額、待審核報價提醒(主管視角)、待辦跟進清單
- **客戶管理 API**：客戶 CRUD、聯絡人(多筆)、跟進紀錄(activities)，前端已完成**客戶列表頁**(搜尋/狀態篩選/分頁)
- **報價管理 API**：報價 CRUD、明細項目(quote_items)、完整工作流程(送審/核准/拒絕/寄送/成交轉訂單/流失)、審批稽核軌跡，前端已完成**報價列表頁**(狀態Tab篩選/搜尋/分頁)
- **產品目錄 API**：產品/服務項目 CRUD（manager/admin 可編輯）
- **訂單 API**：報價成交後自動產生訂單記錄
- **使用者管理 API**：使用者列表、新增/編輯（admin only）
- **角色權限與資料範圍控制**：
  - `admin`：可見全公司所有資料
  - `manager`：可見自己 + 團隊(manager_id指向自己)成員的資料
  - `sales`：僅可見自己負責(owner_id)的客戶與報價

## API 端點總覽

| Method | Path | 說明 | 權限 |
|---|---|---|---|
| POST | /api/auth/login | 登入 | 公開 |
| GET | /api/auth/me | 取得當前使用者 | 需登入 |
| GET | /api/dashboard/summary | Dashboard 統計 | 需登入(依角色範圍) |
| GET | /api/customers | 客戶列表 `?search=&status=&owner_id=&page=&page_size=` | 需登入 |
| POST | /api/customers | 新增客戶 | 需登入 |
| GET/PUT/DELETE | /api/customers/:id | 客戶詳情/編輯/刪除 | 需登入+權限檢查 |
| GET/POST | /api/customers/:id/contacts | 聯絡人 | 需登入 |
| GET/POST | /api/customers/:id/activities | 跟進紀錄 | 需登入 |
| GET | /api/quotes | 報價列表 `?search=&status=&customer_id=&page=&page_size=` | 需登入(依角色範圍) |
| POST | /api/quotes | 新增報價(含明細) | 需登入 |
| GET/PUT/DELETE | /api/quotes/:id | 報價詳情/編輯(僅draft/rejected)/刪除(僅draft) | 需登入+權限檢查 |
| POST | /api/quotes/:id/submit | 送審 (draft→pending_approval) | owner |
| POST | /api/quotes/:id/approve | 核准 (pending_approval→approved) | manager/admin |
| POST | /api/quotes/:id/reject | 拒絕，需填原因 (pending_approval→rejected) | manager/admin |
| POST | /api/quotes/:id/send | 標記寄出 (approved→sent) | owner |
| POST | /api/quotes/:id/win | 成交，自動建立訂單 (sent→won) | owner |
| POST | /api/quotes/:id/lose | 標記流失 (sent/approved→lost) | owner |
| GET/POST | /api/products | 產品目錄 | 需登入(編輯限manager+) |
| PUT/DELETE | /api/products/:id | 編輯/下架產品 | manager/admin |
| GET | /api/orders | 訂單列表 | 需登入(依角色範圍) |
| GET | /api/users | 使用者列表 | 需登入 |
| POST/PUT | /api/users | 新增/編輯使用者 | admin |

統一回應格式：`{ success: true, data, pagination? }` 或 `{ success: false, error }`

## 資料庫 Schema (Cloudflare D1)
| 表 | 說明 |
|---|---|
| `users` | 業務/主管/管理員，`role`(admin/manager/sales)，`manager_id`建立團隊層級 |
| `customers` | 客戶主檔，`owner_id`歸屬業務，`status`(lead/active/inactive) |
| `contacts` | 客戶聯絡人(多筆) |
| `activities` | CRM跟進紀錄(call/meeting/email/note/task) |
| `products` | 產品/服務項目目錄 |
| `quotes` | 報價單主檔，`status`(draft/pending_approval/approved/rejected/sent/won/lost) |
| `quote_items` | 報價單明細(快照式，不受產品異動影響) |
| `quote_approval_logs` | 審批歷程稽核軌跡 |
| `orders` | 報價成交後自動產生的訂單 |

詳細欄位定義見 `migrations/0001_initial_schema.sql`

## 尚未實作功能 ❌ (下一階段規劃)
- 客戶新增/編輯表單頁、客戶詳情頁(含聯絡人/跟進紀錄/歷史報價 UI)
- 報價建立/編輯頁(含動態明細項目編輯器、即時金額試算)
- 報價詳情頁(審批按鈕操作、狀態時間軸、PDF匯出 - 建議用 jsPDF CDN 前端產生避免佔用 Workers CPU 時間)
- 產品目錄管理頁、訂單列表頁、使用者管理頁(前端UI)
- 報表分析頁(業績排行、轉換率、Pipeline趨勢圖)
- Email 通知(報價寄送/審批結果) — 需使用者提供第三方服務(如 Resend) API Key
- 個人資料設定頁

## 建議下一步開發順序
1. 報價建立/編輯頁 + 明細項目編輯器（核心業務流程，優先度最高）
2. 報價詳情頁 + 審批操作 + PDF匯出
3. 客戶詳情頁 + 表單
4. 產品目錄、訂單列表 UI
5. 報表分析頁
6. 使用者管理 UI (admin)

## 測試帳號 (本地開發，密碼皆為 `password123`)
| Email | 角色 | 說明 |
|---|---|---|
| admin@yimu.com.tw | admin | 系統管理員，可見全部資料 |
| manager@yimu.com.tw | manager | 陳經理，可見自己+團隊(alice, bob)資料 |
| alice@yimu.com.tw | sales | 王小美，僅可見自己客戶/報價 |
| bob@yimu.com.tw | sales | 林大同，僅可見自己客戶/報價 |

## 資料架構
- **儲存服務**：Cloudflare D1 (SQLite)，本地開發使用 `--local` 模式獨立 SQLite
- **認證**：JWT (HS256)，`hono/jwt`，密碼使用 Web Crypto PBKDF2(SHA-256, 100000 rounds) 雜湊
- **資料範圍隔離**：後端 middleware 依角色(admin/manager/sales)動態產生 SQL `owner_id IN (...)` 條件，非前端過濾

## 前端頁面樹
```
/login                  登入頁 ✅
/                       Dashboard 首頁 ✅
/customers              客戶列表 ✅
/customers/new          新增客戶 (佔位頁，待開發)
/customers/:id          客戶詳情 (佔位頁，待開發)
/quotes                 報價列表 ✅
/quotes/new             新增報價 (佔位頁，待開發)
/quotes/:id             報價詳情 (佔位頁，待開發)
/products               產品目錄 (佔位頁，待開發)
/orders                 成交訂單 (佔位頁，待開發)
/users                  使用者管理 (佔位頁，待開發，admin only)
/reports                報表分析 (佔位頁，待開發)
/settings/profile        個人資料 (佔位頁，待開發)
```

## 專案結構
```
webapp/
├── migrations/
│   └── 0001_initial_schema.sql   # D1 資料庫 schema
├── seed.sql                       # 測試資料 (含4個測試帳號、5個客戶、5筆報價)
├── src/
│   ├── index.tsx                  # 主入口，掛載 API routes + 頁面 shell
│   ├── types/index.ts             # 共用型別定義
│   ├── middleware/auth.ts         # JWT 驗證 + 角色守衛 middleware
│   ├── utils/
│   │   ├── crypto.ts              # PBKDF2 密碼雜湊工具
│   │   ├── response.ts            # 統一 API 回應格式
│   │   └── scope.ts                # 資料範圍過濾工具(依角色)
│   └── routes/
│       ├── auth.ts                # 登入、取得當前使用者
│       ├── dashboard.ts           # Dashboard 統計數據
│       ├── customers.ts           # 客戶 CRUD + 聯絡人 + 跟進紀錄
│       ├── quotes.ts              # 報價 CRUD + 工作流程操作
│       ├── products.ts            # 產品目錄 CRUD
│       ├── orders.ts              # 訂單列表
│       └── users.ts                # 使用者管理
├── public/
│   └── static/
│       ├── styles.css
│       ├── js/
│       │   ├── api.js              # Axios API client (自動帶JWT)
│       │   ├── auth.js             # 登入狀態管理
│       │   ├── utils.js            # 格式化工具、狀態標籤
│       │   ├── layout.js           # 側邊選單 + 頂部列
│       │   └── main.js             # 前端路由(SPA-like)
│       └── pages/
│           ├── login.js            # 登入頁
│           ├── dashboard.js        # Dashboard首頁
│           ├── customers.js        # 客戶列表頁
│           ├── quotes.js           # 報價列表頁
│           └── placeholders.js     # 其餘頁面佔位
├── wrangler.jsonc                  # Cloudflare Pages + D1 設定
├── ecosystem.config.cjs            # PM2 設定
└── package.json
```

## 本地開發
```bash
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000
```

## 部署
- **Platform**: Cloudflare Pages + D1
- **Status**: 🔧 開發中（尚未正式部署）
- **Tech Stack**: Hono + TypeScript + Cloudflare D1 + Tailwind CSS(CDN) + Chart.js + Axios
- **Last Updated**: 2026-07-25
