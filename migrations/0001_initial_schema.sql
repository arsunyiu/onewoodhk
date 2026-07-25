-- ============================================================
-- 一木工程  |  Migration 0001: Initial Schema
-- B2B 報價管理 + CRM + 銷售管理 三合一系統
-- ============================================================

-- ---------------------------------------------------------
-- users：業務 / 主管 / 管理員
-- role: admin / manager / sales
-- manager_id：sales 歸屬的主管（用於團隊範圍查詢）
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin','manager','sales')),
  manager_id    INTEGER,                     -- 上層主管 (sales -> manager)
  phone         TEXT,
  avatar_url    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,  -- 1=啟用 0=停用
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------------------------------------------------------
-- customers：客戶（公司層級主檔）
-- owner_id：負責業務員，用於資料範圍過濾 (RLS-like)
-- status: lead(潛在) / active(合作中) / inactive(停止合作)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name    TEXT NOT NULL,
  tax_id          TEXT,                       -- 統一編號
  industry        TEXT,                       -- 產業類別
  status          TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','inactive')),
  source          TEXT,                       -- 客戶來源（陌生開發/轉介/官網詢問...）
  address         TEXT,
  city            TEXT,
  website         TEXT,
  credit_limit    REAL DEFAULT 0,              -- 信用額度
  notes           TEXT,
  owner_id        INTEGER NOT NULL,            -- 負責業務員 -> users.id
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);

-- ---------------------------------------------------------
-- contacts：客戶聯絡人（一個客戶可多筆）
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL,
  name          TEXT NOT NULL,
  title         TEXT,               -- 職稱
  phone         TEXT,
  mobile        TEXT,
  email         TEXT,
  is_primary    INTEGER NOT NULL DEFAULT 0,  -- 是否為主要聯絡人
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id);

-- ---------------------------------------------------------
-- activities：CRM 跟進紀錄 (call/meeting/email/note)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,        -- 建立者/執行者
  type          TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('call','meeting','email','note','task')),
  subject       TEXT NOT NULL,
  content       TEXT,
  activity_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_done       INTEGER NOT NULL DEFAULT 1, -- 對於 task 類型可標記待辦/完成
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);

-- ---------------------------------------------------------
-- products：產品/服務項目目錄
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sku           TEXT UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT,
  unit          TEXT DEFAULT '件',        -- 計價單位
  unit_price    REAL NOT NULL DEFAULT 0,  -- 標準售價
  cost_price    REAL DEFAULT 0,           -- 成本價（供利潤分析）
  description   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ---------------------------------------------------------
-- quotes：報價單主檔
-- status: draft / pending_approval / approved / rejected / sent / won / lost
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_no        TEXT UNIQUE NOT NULL,      -- 報價單號，如 Q20260725-0001
  customer_id     INTEGER NOT NULL,
  contact_id      INTEGER,                   -- 對應聯絡人
  owner_id        INTEGER NOT NULL,          -- 負責業務員
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending_approval','approved','rejected','sent','won','lost')),
  title           TEXT,                      -- 報價案名稱/標題
  currency        TEXT NOT NULL DEFAULT 'TWD',
  subtotal        REAL NOT NULL DEFAULT 0,   -- 未稅小計
  discount_type   TEXT DEFAULT 'amount' CHECK (discount_type IN ('amount','percent')),
  discount_value  REAL DEFAULT 0,
  tax_rate        REAL NOT NULL DEFAULT 0.05,  -- 稅率，預設 5%
  tax_amount      REAL NOT NULL DEFAULT 0,
  total_amount    REAL NOT NULL DEFAULT 0,    -- 含稅總金額
  valid_until     DATE,                       -- 報價有效期限
  approver_id     INTEGER,                    -- 審批主管
  approved_at     DATETIME,
  rejected_reason TEXT,
  sent_at         DATETIME,
  terms           TEXT,                       -- 條款/付款方式備註
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_owner ON quotes(owner_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_no ON quotes(quote_no);

-- ---------------------------------------------------------
-- quote_items：報價單明細
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id      INTEGER NOT NULL,
  product_id    INTEGER,                 -- 可為空（自訂項目）
  item_name     TEXT NOT NULL,           -- 快照名稱（避免產品異動影響歷史報價）
  description   TEXT,
  unit          TEXT DEFAULT '件',
  quantity      REAL NOT NULL DEFAULT 1,
  unit_price    REAL NOT NULL DEFAULT 0,
  discount_pct  REAL DEFAULT 0,          -- 單項折扣百分比
  line_total    REAL NOT NULL DEFAULT 0, -- quantity * unit_price * (1-discount_pct/100)
  sort_order    INTEGER DEFAULT 0,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- ---------------------------------------------------------
-- quote_approval_logs：審批歷程稽核軌跡
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_approval_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id      INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,        -- 操作者
  action        TEXT NOT NULL CHECK (action IN ('submit','approve','reject','send','win','lose','revise')),
  comment       TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_approval_logs_quote ON quote_approval_logs(quote_id);

-- ---------------------------------------------------------
-- orders：報價成交後轉換的訂單
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT UNIQUE NOT NULL,     -- 如 O20260725-0001
  quote_id      INTEGER NOT NULL,
  customer_id   INTEGER NOT NULL,
  owner_id      INTEGER NOT NULL,
  total_amount  REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','delivered','cancelled')),
  order_date    DATE DEFAULT (date('now')),
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_id);
