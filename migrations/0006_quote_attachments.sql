-- ============================================================
-- 一木工程  |  Migration 0006: 報價單附件 (Quote Attachments)
-- 讓業務可在報價單上傳圖紙等附件檔案，儲存於 R2，DB 僅存 metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id      INTEGER NOT NULL,
  file_name     TEXT NOT NULL,       -- 原始檔名
  r2_key        TEXT NOT NULL UNIQUE, -- R2 object key
  content_type  TEXT,
  file_size     INTEGER NOT NULL DEFAULT 0,
  uploaded_by   INTEGER NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote ON quote_attachments(quote_id);
