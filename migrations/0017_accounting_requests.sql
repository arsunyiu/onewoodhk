-- ============================================================
-- 會計申請及審批流程：任何已登入使用者皆可提交出入帳申請（如報銷、收款申請等），
-- 經 manager/admin 審批通過後，系統自動將其錄入 accounting_entries（會計管理）帳本。
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type      TEXT NOT NULL CHECK (request_type IN ('income','expense')),
  category          TEXT NOT NULL,
  amount            REAL NOT NULL,
  expected_date     DATE NOT NULL DEFAULT (date('now')),
  description       TEXT,
  counterparty_name TEXT,
  order_id          INTEGER,
  status            TEXT NOT NULL DEFAULT 'pending_approval'
                       CHECK (status IN ('pending_approval','approved','rejected','cancelled')),
  requested_by      INTEGER NOT NULL,
  approver_id       INTEGER,
  approved_at       DATETIME,
  rejected_reason   TEXT,
  entry_id          INTEGER,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id),
  FOREIGN KEY (entry_id) REFERENCES accounting_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_requests_status ON accounting_requests(status);
CREATE INDEX IF NOT EXISTS idx_accounting_requests_requested_by ON accounting_requests(requested_by);
