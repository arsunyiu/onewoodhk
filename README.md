# 一木工程 — B2B 報價管理 × CRM × 銷售管理一體化平台

## Project Overview
- **Name**: 一木工程
- **Goal**: 為業務團隊提供三合一平台：客戶關係管理(CRM)、B2B 報價單建立與審批、銷售 Pipeline 追蹤，取代分散的 Excel/Email 作業流程。
- **主要使用者**: 業務(Sales)、銷售主管(Manager)、系統管理員(Admin)

## 目前已完成功能 ✅
- **登入 / 認證**：JWT 登入機制（PBKDF2 密碼雜湊，Web Crypto API，Workers 原生相容）
- **Dashboard 首頁**：客戶統計、Pipeline 漏斗圖(Chart.js)、本月成交金額、待審核報價提醒(主管視角)、待辦跟進清單
- **客戶管理**：客戶 CRUD API + 聯絡人(多筆)/跟進紀錄(activities) API，前端已完成**客戶列表頁**(搜尋/狀態篩選/分頁)、**客戶詳情頁**(基本資料/聯絡人清單/跟進紀錄時間軸/歷史報價，可於頁面內新增聯絡人與跟進紀錄)、**客戶新增/編輯表單頁**
- **報價管理**：報價 CRUD API、明細項目(quote_items)、完整工作流程(送審/核准/拒絕/寄送/成交轉訂單/流失)、審批稽核軌跡，前端已完成**報價列表頁**(狀態Tab篩選/搜尋/分頁)、**報價建立/編輯頁**(動態明細項目編輯器、即時金額試算、儲存草稿/送出審核、工程地址欄位)與**報價詳情頁**(完整報價顯示、角色守衛的審批操作按鈕、狀態時間軸、匯出報價單PDF、**已核准/已寄送/已成交狀態下可另外匯出正式發票PDF**)。PDF匯出改用瀏覽器原生渲染(HTML+html2canvas轉圖再拼入jsPDF頁面)，避免jsPDF內建字型不支援中文而產生亂碼
- **產品目錄**：產品/服務項目 CRUD API（manager/admin 可編輯，軟刪除下架），前端已完成**產品目錄頁**(搜尋/分類篩選/上架狀態篩選、manager+權限的新增/編輯Modal與下架操作，sales角色僅可檢視)
- **成交訂單**：報價成交後自動產生訂單記錄，前端已完成**訂單列表頁**(唯讀，分頁顯示，可點擊追溯來源報價單)
- **使用者管理**：使用者列表 API、新增/編輯 API（admin only），前端已完成**使用者管理頁**(admin only，含新增使用者、編輯角色/主管歸屬/電話/啟用狀態/重設密碼，非admin直接訪問會顯示權限不足提示)
- **角色管理**：前端新增**角色管理頁**(`/roles`，admin only)：權限矩陣表(6大模組×3角色)、團隊組織圖(依manager_id分組)、快速編輯(重用使用者管理頁的Modal)
- **個人資料設定**：`PUT /api/auth/me` 自助更新姓名/電話/大頭貼、密碼變更(需驗證舊密碼)，前端**個人資料頁**(`/settings/profile`，所有登入者可用)
- **報表分析**：新增 `GET /api/reports/summary?range=` 統計 API(依角色資料範圍過濾)，前端已完成**報表分析頁**：期間篩選(近30/90/180/365天/全部)、KPI總覽卡(期間報價數/成交金額/成交轉換率/平均成交金額)、近6個月報價建立量vs成交金額趨勢圖(Chart.js雙軸長條+線圖)、Pipeline即時狀態分布甜甜圈圖、業務業績排行表(依成交金額排序，含排名徽章與進度條)、客戶貢獻排行Top10(依累計成交金額，可點擊追溯客戶詳情)
- **財務管理(訂單收款追蹤)**：新增 `order_payments` 表記錄成交訂單的收款，前端**財務頁**(`/finance`，**僅admin/manager可用**，manager依團隊範圍過濾)：訂單收款總覽(訂單金額/已收金額/未收餘額/付款狀態)、**訂單收款詳情頁**(`/finance/:id`，收款紀錄列表 + manager/admin可登記新收款/刪除收款)。sales角色無法存取此模組(側邊選單不顯示、直接輸入網址會顯示權限不足頁面、後端API回傳403)
- **會計管理(公司出入帳)**：新增 `accounting_entries` 表記錄公司整體收入/支出(含工程支出、人工、材料採購等分類)，前端**會計頁**(`/accounting`，僅admin/manager可用)：收支總覽卡(近一年總收入/總支出/淨利)、近6個月收支趨勢圖(Chart.js)、分類統計、出入帳列表(可篩選類型/分類、新增/編輯/admin可刪除)
- **工程管理(施工進度追蹤)**：新增 `projects`(每張成交訂單對應一筆工程紀錄，1:1)+ `project_logs`(進度時間軸紀錄)表，報價成交(`/api/quotes/:id/win`)時自動建立對應工程紀錄(預設負責人為訂單業務、地址帶入報價工程地址)。前端**工程管理頁**(`/projects`，**所有角色皆可使用**，依角色資料範圍過濾，與財務/會計不同，非manager+限定)：工程總覽卡(依狀態統計數量)、工程列表(狀態篩選/分頁，可點擊追溯來源訂單)、**工程詳情頁**(`/projects/:id`)顯示工程基本資訊(狀態/進度百分比/預計及實際完工日/工地地址/負責人/備註)與進度時間軸；管理操作(編輯工程設定、新增/刪除時間軸紀錄)僅限 admin、manager(團隊範圍內)或**該訂單負責業務本人**，其餘使用者僅能檢視(無編輯表單)、非本人且非manager+訪問他人工程詳情會回傳404
- **共用元件**：新增輕量 Modal 元件(`openModal`/`closeModal`，於 `layout.js`)，供聯絡人/跟進紀錄/產品/使用者/會計的新增編輯表單共用
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
| PUT | /api/auth/me | 自助更新個人資料(姓名/電話/大頭貼)、變更密碼(需驗證舊密碼) | 需登入 |
| GET | /api/finance/summary | 訂單收款總覽(應收/已收/未收) | manager/admin |
| GET | /api/finance/orders | 訂單收款列表(含已收金額/未收餘額/付款狀態) `?page=&page_size=` | manager/admin |
| GET | /api/finance/orders/:id | 單筆訂單收款詳情(含收款紀錄) | manager/admin |
| POST | /api/finance/orders/:id/payments | 登記收款 | manager/admin |
| DELETE | /api/finance/payments/:id | 刪除收款紀錄 | admin |
| GET | /api/accounting/categories | 收入/支出分類選項 | manager/admin |
| GET | /api/accounting/summary | 收支總覽 `?range=` (總收入/總支出/淨利/分類統計/6個月趨勢) | manager/admin |
| GET | /api/accounting/entries | 出入帳列表 `?type=income\|expense&category=&page=&page_size=` | manager/admin |
| POST | /api/accounting/entries | 新增出入帳紀錄 | manager/admin |
| PUT | /api/accounting/entries/:id | 編輯出入帳紀錄 | manager/admin |
| DELETE | /api/accounting/entries/:id | 刪除出入帳紀錄 | admin |
| GET | /api/projects/summary | 工程進度總覽(依狀態統計數量，依角色範圍) | 需登入(依角色範圍) |
| GET | /api/projects | 工程列表 `?status=&page=&page_size=` | 需登入(依角色範圍) |
| GET | /api/projects/:id | 工程詳情(含進度時間軸、`can_manage`旗標) | 需登入+角色範圍檢查 |
| PUT | /api/projects/:id | 更新工程資訊(狀態/進度%/日期/地址/負責人/備註) | admin/manager(範圍內)或訂單負責業務本人 |
| POST | /api/projects/:id/logs | 新增進度時間軸紀錄 | admin/manager(範圍內)或訂單負責業務本人 |
| DELETE | /api/projects/logs/:logId | 刪除進度紀錄 | admin/manager(範圍內)或紀錄建立者本人 |

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
| `order_payments` | 訂單收款紀錄(`order_id`關聯orders，`amount`/`payment_date`/`method`/`recorded_by`) |
| `accounting_entries` | 公司出入帳紀錄(`entry_type`=income/expense，`category`如工程支出/人工/材料採購等，可選關聯`order_id`) |
| `projects` | 工程/施工進度主檔，`order_id`與`orders`一對一(UNIQUE)，`status`(not_started/in_progress/paused/completed/cancelled)，`progress_percent`(0-100)，`supervisor_id`關聯`users`(負責人) |
| `project_logs` | 工程進度時間軸紀錄，`project_id`關聯`projects`，`created_by`關聯`users`(紀錄建立者) |

`quotes` 表新增 `site_address`（工程地址，記錄實際施工地點，與客戶登記地址分開管理）。詳細欄位定義見 `migrations/0001_initial_schema.sql`、`migrations/0002_add_site_address.sql`、`migrations/0003_finance_accounting.sql`、`migrations/0004_projects.sql`

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
- **正式發票匯出**：報價單狀態為「已核准/已寄送/已成交」時，報價詳情頁會多顯示一個「匯出發票PDF」按鈕（草稿/待審核/拒絕/流失狀態不顯示，須先完成核准流程）。發票PDF與報價單PDF共用同一版面產生邏輯(`buildQuotePdfHtml(q, docType)`)，差異處：抬頭顯示「發票 INVOICE」、發票編號由報價單號自動轉換(`Q-260601001` → `INV-260601001`，方便追溯對應報價單)、發票日期為實際匯出當下日期(非報價單建立日)、內文以「對應報價單號」取代「有效期限」欄位、表頭底色改用木棕色(與報價單的深綠做視覺區隔)、頁尾聲明改為「此發票乃根據雙方已簽署之報價單開立，為正式收款憑證」。發票編號僅為前端顯示格式轉換，資料庫未另建發票號序列/資料表

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
- 聯絡人/跟進紀錄的編輯與刪除（後端目前僅提供 GET+POST，尚無 PUT/DELETE，如需此功能須先擴充 `customers.ts`）
- 財務/會計報表匯出(PDF/Excel)、會計分類的自訂管理介面(目前分類為程式碼內建清單)
- 訂單收款狀態未反向顯示於「成交訂單」列表頁(`orders.js`)，目前需另外進入「財務」頁查看

## 建議下一步開發順序
1. ~~報價建立/編輯頁 + 明細項目編輯器~~ ✅ 已完成
2. ~~報價詳情頁 + 審批操作 + PDF匯出~~ ✅ 已完成
3. ~~客戶詳情頁 + 表單~~ ✅ 已完成
4. ~~產品目錄、訂單列表 UI~~ ✅ 已完成
5. ~~使用者管理 UI (admin)~~ ✅ 已完成
6. ~~報表分析頁~~ ✅ 已完成
7. ~~個人資料設定頁 / 角色管理頁~~ ✅ 已完成
8. ~~財務(訂單收款追蹤) / 會計(出入帳管理)~~ ✅ 已完成
9. Email 通知 / 財務會計報表匯出

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
/finance                財務(訂單收款總覽) ✅（admin/manager only，非manager以上訪問顯示權限不足，manager依團隊範圍過濾）
/finance/:id             訂單收款詳情 ✅（admin/manager only，收款紀錄列表，可登記/刪除收款）
/accounting              會計(公司出入帳) ✅（admin/manager only，收支總覽/趨勢圖/分類統計/新增編輯刪除）
/users                  使用者管理 ✅（admin only，含新增/編輯，非admin訪問顯示權限不足）
/roles                  角色管理 ✅（admin only，權限矩陣/團隊組織圖/快速編輯，非admin訪問顯示權限不足）
/reports                報表分析 ✅（期間篩選/KPI總覽/6個月趨勢圖/Pipeline甜甜圈圖/業務排行/客戶排行，依角色資料範圍過濾）
/settings/profile        個人資料 ✅（所有登入者可用，基本資料編輯/密碼變更）
/projects                工程管理(施工進度總覽) ✅（所有角色皆可使用，依角色資料範圍過濾，可點擊追溯來源訂單）
/projects/:id            工程詳情 ✅（工程基本資訊+進度時間軸；編輯設定/新增刪除紀錄僅限admin/manager(範圍內)或訂單負責業務本人，其餘僅可檢視）
```

## 專案結構
```
webapp/
├── migrations/
│   ├── 0001_initial_schema.sql   # D1 資料庫 schema
│   ├── 0002_add_site_address.sql # 新增 quotes.site_address(工程地址)欄位
│   ├── 0003_finance_accounting.sql # 新增 order_payments(訂單收款) + accounting_entries(公司出入帳)
│   └── 0004_projects.sql          # 新增 projects(工程進度) + project_logs(進度時間軸) + 既有訂單回填
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
│       ├── reports.ts              # 報表分析統計摘要(KPI/Pipeline/趨勢/排行)
│       ├── finance.ts              # 財務：訂單收款CRUD + 收款總覽
│       ├── accounting.ts          # 會計：公司出入帳CRUD + 收支摘要(manager/admin only)
│       └── projects.ts             # 工程管理：工程CRUD + 進度時間軸(依角色範圍查看，管理限本人/manager+/admin)
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
│           ├── roles.js            # 角色管理頁（admin only，權限矩陣/團隊組織圖）
│           ├── reports.js          # 報表分析頁（KPI卡/趨勢圖/Pipeline圖/排行表）
│           ├── profile.js          # 個人資料設定頁（所有登入者）
│           ├── finance.js          # 財務頁（訂單收款總覽 + 收款詳情/登記收款）
│           ├── accounting.js      # 會計頁（公司出入帳，manager/admin only）
│           ├── projects.js         # 工程管理頁（工程總覽/列表 + 詳情頁進度時間軸，管理限本人/manager+/admin）
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
- **Platform**: Cloudflare Workers（Genspark Hosted Deploy，`gsk hosted *`）+ D1
- **Status**: ✅ 已正式部署
- **正式網址**: https://app.onewood.com.hk （自訂網域，綁定至 Hosted Worker）
- **Tech Stack**: Hono + TypeScript + Cloudflare D1 + Tailwind CSS(CDN) + Chart.js + Axios
- **Last Updated**: 2026-07-29（新增工程管理(施工進度追蹤)功能；財務/會計管理改為僅限主管與系統管理員使用）

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
