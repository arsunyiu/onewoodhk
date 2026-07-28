-- ============================================================
-- 一木工程  |  Migration 0003: 財務(訂單收款) + 會計(出入帳)
-- 財務：追蹤成交訂單(orders)的收款紀錄，計算已收/未收金額
-- 會計：管理公司整體出入帳，含工程支出、人工等分類支出與其他收入
-- ============================================================

-- 訂單收款紀錄（financial: 追蹤 orders 的收款）
CREATE TABLE IF NOT EXISTS order_payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL,
  amount        REAL NOT NULL,
  payment_date  DATE NOT NULL DEFAULT (date('now')),
  method        TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('cash','bank_transfer','cheque','other')),
  notes         TEXT,
  recorded_by   INTEGER NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_date ON order_payments(payment_date);

-- 會計出入帳（accounting: 公司整體收支，含工程支出/人工等分類）
CREATE TABLE IF NOT EXISTS accounting_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type    TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
  category      TEXT NOT NULL,
  amount        REAL NOT NULL,
  entry_date    DATE NOT NULL DEFAULT (date('now')),
  description   TEXT,
  order_id      INTEGER,
  recorded_by   INTEGER NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_type ON accounting_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON accounting_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_category ON accounting_entries(category);
