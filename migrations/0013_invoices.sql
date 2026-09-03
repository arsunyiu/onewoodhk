-- ============================================================
-- 一木工程  |  Migration 0013: 新增發票資料表（支援單一報價單分期開立多張發票）
-- 因應「訂金 + 尾款」等分期收款情境，一張報價單需要能對應多張獨立發票，
-- 每張發票有自己的金額、備註（如「訂金 Deposit payment」）、發票編號與收款狀態，
-- 取代原本存在 quotes.invoice_remark 的單一備註欄位設計（該欄位僅假設一張報價單只需一張發票）
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id),
  invoice_no TEXT NOT NULL UNIQUE,      -- 如 INV-260822001-01
  seq INTEGER NOT NULL,                 -- 該報價單下第幾張發票（1, 2, 3...）
  amount REAL NOT NULL,                 -- 本張發票金額（手動輸入，不強制等於報價單總額）
  remark TEXT,                          -- 本張發票專屬備註（如「訂金 Deposit payment」）
  issue_date TEXT NOT NULL,             -- 發票日期
  is_paid INTEGER NOT NULL DEFAULT 0,   -- 是否已收款
  paid_at TEXT,                         -- 標記已收款的時間
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);
