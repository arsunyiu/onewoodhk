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
- **報表分析**：新增 `GET /api/reports/summary?range=` 統計 API(依角色資料範圍過濾)，前端已完成**報表分析頁**：期間篩選(近30/90/180/365天/全部)、KPI總覽卡(期間報價數/成交金額/成交轉換率/平均成交金額)、近6個月報價建立量vs成交金額趨勢圖(Chart.js雙軸長條+線圖)、Pipeline即時狀態分布甜甜圈圖、業務業績排行表(依成交金額排序，含排名徽章與進度條)、客戶貢獻排行Top10(依累計成交金額，可點擊追溯客戶詳情)
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
| GET | /api/reports/summary | 報表統計摘要 `?range=30d\|90d\|180d\|365d\|all`（KPI/Pipeline快照/6個月趨勢/業務排行/客戶排行) | 需登入(依角色範圍) |

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
系統預設值依「一木工程有限公司 One Wood Limited」實際業務單據校正，統一定義於 `src/types/company.ts`(後端) 與 `public/static/js/companyInfo.js`(前端，兩處欄位需保持同步，無共用模組機制)：
- **公司名稱**：一木工程有限公司 / One Wood Limited
- **地址**：九龍紅磡黃埔新邨德民街德民大廈E2舖（Shop E2, Tak Man Building, Tak Man Street, Whampoa New Village, Hung Hom, Kowloon, Hong Kong）
- **電話**：+852 9555 5124
- **網頁**：onewood.com.hk
- **電郵**：sales@onewood.com.hk
- （舊有 `contactPerson`/`contactPhone`（Wa Tong / 6466-6293）欄位已移除，PDF 匯出的聯絡資訊行改為顯示電郵與網頁）
- **報價單號格式**：`Q-YYMMDDxxx`（如 `Q-260512001`），非之前誤植的 `Q20260701-0001` 格式
- **預設幣別**：HKD（港幣）— 香港無銷售稅(VAT/GST)，故**預設稅率為 0**
- **有效期限**：未指定時自動帶入建立日起 30 天
- **工程地址**：`quotes.site_address` 記錄實際施工地點，與客戶登記地址(`customers.address`，可能為辦公室/帳單地址)分開管理
- **收款銀行資訊**：華僑永享 OCBC，用於 PDF 匯出的「收款信息」區塊
- **報價單法律聲明**：「此報價單經雙方簽署後具有合約效力」，PDF 頁尾統一顯示

## 品牌識別 / 色調系統（參考 onewood.com.hk 官網校正）
- **系統 Logo**：採用 onewood.com.hk 官網之官方透明底 Logo（金色雙環徽章 + 「一木」燙金字 + 綠色葉枝 + ONE WOOD 文字），存放於 `public/static/images/logo.png`，已加入：
  - `pageShell()` 的 `<link rel="icon">` / `<link rel="apple-touch-icon">`(favicon)
  - 側邊選單頂部品牌區塊(`layout.js`)
  - 登入頁品牌區塊(`login.js`，取代原先的閃電圖示)
  - 報價單 PDF 匯出頁首(`quoteDetail.js` 的 `buildQuotePdfHtml`)
- **色調**：Tailwind `primary` 色階由原本的藍色系，改為 onewood.com.hk 官網主色「深綠」(`#1f5b45`/`#2a6a52`)，並新增 `wood` 木棕色階(`#7a5a3a`)作為次要強調色，統一定義於 `src/index.tsx` 的 `tailwind.config`。系統內所有頁面皆使用 `primary-*` Tailwind class（未使用寫死色碼），故此設定變更會自動套用至全系統(客戶/報價/產品/訂單/使用者/報表等頁面)
- 全域背景色由 `bg-gray-50` 調整為暖白 `#fbfaf7`，貼近官網質感
- 個別頁面原先寫死的 `blue-*`/`indigo-*`(未走 Tailwind 設定的硬編碼顏色)已手動改為 `primary-*`/`wood-*` 或對應色碼，包含：報價狀態徽章(`utils.js`)、Dashboard 統計卡與Pipeline漏斗圖(`dashboard.js`)、訂單狀態徽章(`orders.js`)、報表KPI卡與圖表配色(`reports.js`)、PDF匯出表頭底色(`quoteDetail.js`)

## 尚未實作功能 ❌ (下一階段規劃)
- Email 通知(報價寄送/審批結果) — 需使用者提供第三方服務(如 Resend) API Key
- 個人資料設定頁
- 聯絡人/跟進紀錄的編輯與刪除（後端目前僅提供 GET+POST，尚無 PUT/DELETE，如需此功能須先擴充 `customers.ts`）

## 建議下一步開發順序
1. ~~報價建立/編輯頁 + 明細項目編輯器~~ ✅ 已完成
2. ~~報價詳情頁 + 審批操作 + PDF匯出~~ ✅ 已完成
3. ~~客戶詳情頁 + 表單~~ ✅ 已完成
4. ~~產品目錄、訂單列表 UI~~ ✅ 已完成
5. ~~使用者管理 UI (admin)~~ ✅ 已完成
6. ~~報表分析頁~~ ✅ 已完成
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
/reports                報表分析 ✅（期間篩選/KPI總覽/6個月趨勢圖/Pipeline甜甜圈圖/業務排行/客戶排行，依角色資料範圍過濾）
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
│       ├── users.ts                # 使用者管理
│       └── reports.ts              # 報表分析統計摘要(KPI/Pipeline/趨勢/排行)
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
│           ├── reports.js          # 報表分析頁（KPI卡/趨勢圖/Pipeline圖/排行表）
│           └── placeholders.js     # 其餘頁面佔位（個人資料）
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
- **Platform**: Cloudflare Workers（Genspark Hosted Deploy，`gsk hosted *`）+ D1
- **Status**: ✅ 已正式部署
- **正式網址**: https://app.onewood.com.hk （自訂網域，綁定至 Hosted Worker）
- **Tech Stack**: Hono + TypeScript + Cloudflare D1 + Tailwind CSS(CDN) + Chart.js + Axios
- **Last Updated**: 2026-07-28

### ⚠️ 首次部署 / 重建 D1・Worker 後的固定檢查清單

**背景**：`gsk hosted deploy` 只會自動套用 D1 **migrations**（建表結構），
**不會**自動套用 `seed.sql`（測試/初始資料），也**不會**保留或建立
Worker 所需的 **secrets**（例如 `JWT_SECRET`）。若部署後跳過以下步驟，
正式站會出現「資料庫是空的（登入密碼一直錯）」或「登入時 500 錯誤」
（`JWT_SECRET` 未設定導致 sign/verify 失敗）等問題 —— 這是本專案曾
在正式環境（`app.onewood.com.hk`）實際發生過的兩個根因，已修復並將
其自動化，避免再次發生。

**每次「首次部署」或「重建 D1 / Worker」（`--rebuild_db` / `--recreate_worker`）之後，務必依序執行：**

```bash
cd /home/user/webapp

# 一次執行「套用 seed 資料」+「確認/設定 secrets」兩步驟
bash scripts/first_deploy_checklist.sh
```

或分別單獨執行：

```bash
# Step 1：將 seed.sql 逐句套用到正式 D1（INSERT OR IGNORE，可重複執行、不會覆蓋既有資料）
bash scripts/apply_seed_to_hosted.sh

# Step 2：確認/設定正式 Worker 所需的 secrets（預設不覆蓋已存在的 secret；
#         如需強制重新產生並讓所有現有登入 token 失效，加上 --force）
bash scripts/setup_hosted_secrets.sh
```

**Step 3（人工驗證，兩個腳本執行完畢後務必手動確認）：**
1. 用 `seed.sql` 內任一測試帳號（見上方「測試帳號」章節，密碼皆為 `OneWood2026#`）在正式網址登入
2. 確認 `/api/auth/me`、`/api/dashboard/summary`、`/api/reports/summary?range=90d` 皆回應 200 且資料正常

**腳本說明：**
| 腳本 | 用途 | 是否可重複執行 |
|---|---|---|
| `scripts/sql_split.py` | 將 `.sql` 檔案正確切分為個別可執行語句（處理字串內分號、`--` 註解） | 是（純解析，無副作用） |
| `scripts/apply_seed_to_hosted.sh` | 逐句透過 `gsk hosted d1_execute` 將 `seed.sql` 套用到正式 D1 | 是（`INSERT OR IGNORE`，已存在資料不會被覆蓋/報錯） |
| `scripts/setup_hosted_secrets.sh` | 檢查並設定正式 Worker 所需 secrets（目前僅 `JWT_SECRET`） | 是（預設偵測已存在則跳過；`--force` 才會覆蓋） |
| `scripts/first_deploy_checklist.sh` | 依序執行以上兩支腳本的便利入口 | 是 |

**⚠️ 注意事項：**
- `setup_hosted_secrets.sh` 若加上 `--force` 會產生新的 `JWT_SECRET` 並覆蓋舊值 —— 這會讓所有現有使用者的登入 token 立即失效（需重新登入），僅在懷疑 secret 洩漏或需要輪換時使用。
- Secrets 的值一經 `gsk hosted secret_put` 設定後無法再讀回（write-only），`gsk hosted secret_list` 只能看到名稱，看不到值。
- 一般日常重新部署（未加 `--rebuild_db` / `--recreate_worker`）通常不需要重跑本檢查清單，因為 D1 資料與既有 secrets 不會被清除；但若不確定，重新執行一次也是安全的（皆為 idempotent 設計）。
