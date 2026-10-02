-- ============================================================
-- 一木工程  |  Migration 0018: 會計申請附件 (Accounting Request Attachments)
-- 讓申請人可在會計申請上附上憑證/截圖等檔案，儲存於 R2，DB 僅存 metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting_request_attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id    INTEGER NOT NULL,
  file_name     TEXT NOT NULL,       -- 原始檔名
  r2_key        TEXT NOT NULL UNIQUE, -- R2 object key
  content_type  TEXT,
  file_size     INTEGER NOT NULL DEFAULT 0,
  uploaded_by   INTEGER NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES accounting_requests(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_request_attachments_request ON accounting_request_attachments(request_id);
