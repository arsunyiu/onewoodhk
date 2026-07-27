# 一木工程 — B2B 報價管理 × CRM × 銷售管理一體化平台

## Project Overview
- **Name**: 一木工程
- **Goal**: 為業務團隊提供三合一平台：客戶關係管理(CRM)、B2B 報價單建立與審批、銷售 Pipeline 追蹤，取代分散的 Excel/Email 作業流程。
- **主要使用者**: 業務(Sales)、銷售主管(Manager)、系統管理員(Admin)

## 目前已完成功能 ✅
- **登入 / 認證**：JWT 登入機制（PBKDF2 密碼雜湊，Web Crypto API，Workers 原生相容）
- **Dashboard 首頁**：客戶統計、Pipeline 漏斗圖(Chart.js)、本月成交金額、待審核報價提醒(主管視角)、待辦跟進清單
- **客戶管理**：客戶 CRUD API + 聯絡人(多筆)/跟進紀錄(activities) API，前端已完成**客戶列表頁**(搜尋/狀態篩選/分頁)、**客戶詳情頁**(基本資料/聯絡人清單/跟進紀錄時間軸/歷史報價，可於頁面內新增聯絡人與跟進紀錄)、**客戶新增/編輯表單頁**
- **報價管理**：報價 CRUD API、明細項目(quote_items)、完整工作流程(送審/核准/拒絕/寄送/成交轉訂單/流失)、審批稽核軌跡，前端已完成**報價列表頁**(狀態Tab篩選/搜尋/分頁)、**報價建立/編輯頁**(動態明細項目編輯器、即時金額試算、儲存草稿/送出審核、工程地址欄位)與**報價詳情頁**(完整報價顯示、角色守衛的審批操作按鈕、狀態時間軸、前端jsPDF匯出PDF比照實際業務單據樣式)
- **產品目錄**：產品/服務項目 CRUD API（manager/admin 可編輯，軟刪除下架），前端已完成**產品目錄頁**(搜尋/分類篩選/上架狀態篩選、manager+權限的新增/編輯Modal與下架操作，sales角色僅可檢視)
- **成交訂單**：報價成交後自動產生訂單記錄，前端已完成**訂單列表頁**(唯讀，分頁顯示，可點擊追溯來源報價單)
- **使用者管理**：使用者列表 API、新增/編輯 API（admin only），前端已完成**使用者管理頁**(admin only，含新增使用者、編輯角色/主管歸屬/電話/啟用狀態/重設密碼，非admin直接訪問會顯示權限不足提示)
- **共用元件**：新增輕量 Modal 元件(`openModal`/`closeModal`，於 `layout.js`)，供聯絡人/跟進紀錄/產品/使用者的新增編輯表單共用
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

`quotes` 表新增 `site_address`（工程地址，記錄實際施工地點，與客戶登記地址分開管理）。詳細欄位定義見 `migrations/0001_initial_schema.sql`、`migrations/0002_add_site_address.sql`

## 公司資訊／業務預設值（依實際報價單範本校正）
系統預設值依「一木工程有限公司 ONE WOOD LIMITED」實際業務單據校正，統一定義於 `src/types/company.ts`(後端) 與 `public/static/js/companyInfo.js`(前端)：
- **報價單號格式**：`Q-YYMMDDxxx`（如 `Q-260512001`），非之前誤植的 `Q20260701-0001` 格式
- **預設幣別**：HKD（港幣）— 香港無銷售稅(VAT/GST)，故**預設稅率為 0**
- **有效期限**：未指定時自動帶入建立日起 30 天
- **工程地址**：`quotes.site_address` 記錄實際施工地點，與客戶登記地址(`customers.address`，可能為辦公室/帳單地址)分開管理
- **收款銀行資訊**：華僑永享 OCBC，用於 PDF 匯出的「收款信息」區塊
- **報價單法律聲明**：「此報價單經雙方簽署後具有合約效力」，PDF 頁尾統一顯示

## 尚未實作功能 ❌ (下一階段規劃)
- 報表分析頁(業績排行、轉換率、Pipeline趨勢圖)
- Email 通知(報價寄送/審批結果) — 需使用者提供第三方服務(如 Resend) API Key
- 個人資料設定頁
- 聯絡人/跟進紀錄的編輯與刪除（後端目前僅提供 GET+POST，尚無 PUT/DELETE，如需此功能須先擴充 `customers.ts`）

## 建議下一步開發順序
1. ~~報價建立/編輯頁 + 明細項目編輯器~~ ✅ 已完成
2. ~~報價詳情頁 + 審批操作 + PDF匯出~~ ✅ 已完成
3. ~~客戶詳情頁 + 表單~~ ✅ 已完成
4. ~~產品目錄、訂單列表 UI~~ ✅ 已完成
5. ~~使用者管理 UI (admin)~~ ✅ 已完成
6. 報表分析頁
7. 個人資料設定頁 / Email 通知

## 測試帳號 (本地開發，密碼皆為 `OneWood2026#`)
| Email | 角色 | 說明 |
|---|---|---|
| admin@onewood.com.hk | admin | 系統管理員，可見全部資料 |
| manager@onewood.com.hk | manager | 陳經理，可見自己+團隊(Kenny Yip, Wah Tong, Joy Ng)資料 |
| kenny@onewood.com.hk | sales | Kenny Yip，僅可見自己客戶/報價 |
| wah@onewood.com.hk | sales | Wah Tong，僅可見自己客戶/報價 |
| joy@onewood.com.hk | sales | Joy Ng，僅可見自己客戶/報價 |

## 資料架構
- **儲存服務**：Cloudflare D1 (SQLite)，本地開發使用 `--local` 模式獨立 SQLite
- **認證**：JWT (HS256)，`hono/jwt`，密碼使用 Web Crypto PBKDF2(SHA-256, 100000 rounds) 雜湊
- **資料範圍隔離**：後端 middleware 依角色(admin/manager/sales)動態產生 SQL `owner_id IN (...)` 條件，非前端過濾
- **幣別**：預設 HKD(港幣)，另支援 TWD/USD/CNY，報價單各自記錄獨立幣別

## 前端頁面樹
```
/login                  登入頁 ✅
/                       Dashboard 首頁 ✅
/customers              客戶列表 ✅
/customers/new          新增客戶 ✅
/customers/:id          客戶詳情 ✅（基本資料/聯絡人/跟進紀錄時間軸/歷史報價，可新增聯絡人與跟進紀錄）
/customers/:id/edit      編輯客戶 ✅（重用建立頁表單，僅owner/manager+可編輯）
/quotes                 報價列表 ✅
/quotes/new             新增報價 ✅（動態明細編輯器、即時試算）
/quotes/:id             報價詳情 ✅（完整顯示、審批操作按鈕、狀態時間軸、PDF匯出）
/quotes/:id/edit        編輯報價 ✅（draft/rejected可編輯，重用建立頁表單）
/products               產品目錄 ✅（搜尋/分類/上架狀態篩選，manager+可新增/編輯/下架）
/orders                 成交訂單 ✅（唯讀列表，可點擊追溯來源報價）
/users                  使用者管理 ✅（admin only，含新增/編輯，非admin訪問顯示權限不足）
/reports                報表分析 (佔位頁，待開發)
/settings/profile        個人資料 (佔位頁，待開發)
```

## 專案結構
```
webapp/
├── migrations/
│   ├── 0001_initial_schema.sql   # D1 資料庫 schema
│   └── 0002_add_site_address.sql # 新增 quotes.site_address(工程地址)欄位
├── seed.sql                       # 測試資料（裝修/水電工程業務情境：5個測試帳號、5個客戶、4筆報價）
├── src/
│   ├── index.tsx                  # 主入口，掛載 API routes + 頁面 shell + jsPDF CDN
│   ├── types/
│   │   ├── index.ts               # 共用型別定義
│   │   └── company.ts             # 公司資訊常數(名稱/地址/電話/銀行/稅率/幣別預設值)
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
│       │   ├── companyInfo.js      # 公司資訊常數(前端，PDF匯出/詳情頁顯示用)
│       │   ├── layout.js           # 側邊選單 + 頂部列 + 共用Modal(openModal/closeModal)
│       │   └── main.js             # 前端路由(SPA-like)
│       └── pages/
│           ├── login.js            # 登入頁
│           ├── dashboard.js        # Dashboard首頁
│           ├── customers.js        # 客戶列表頁
│           ├── customerDetail.js   # 客戶詳情頁（聯絡人/跟進紀錄時間軸/歷史報價）
│           ├── customerForm.js     # 客戶新增/編輯表單頁
│           ├── quotes.js           # 報價列表頁
│           ├── quoteForm.js        # 報價建立/編輯頁（明細編輯器、工程地址欄位）
│           ├── quoteDetail.js      # 報價詳情頁（顯示/審批操作/時間軸/PDF匯出）
│           ├── products.js         # 產品目錄頁（manager+可新增/編輯/下架）
│           ├── orders.js           # 訂單列表頁（唯讀）
│           ├── users.js            # 使用者管理頁（admin only）
│           └── placeholders.js     # 其餘頁面佔位（報表分析/個人資料）
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
- **Last Updated**: 2026-07-26
