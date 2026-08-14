-- 審計紀錄（Audit Log）：記錄登入紀錄與重要操作，僅限管理員查閱
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,               -- 操作者 user id（登入失敗、帳號不存在時可能為 NULL）
  user_name TEXT,                -- 操作者姓名快照（避免使用者被刪除/改名後失去紀錄）
  user_email TEXT,               -- 操作者 email 快照
  role TEXT,                     -- 操作者角色快照
  action TEXT NOT NULL,          -- login_success / login_failed / create / update / delete / approve / reject 等
  module TEXT NOT NULL,          -- auth / users / customers / quotes / products / accounting / finance / suppliers
  resource_id TEXT,              -- 被操作的資源 id（如有）
  description TEXT,              -- 人類可讀的說明文字
  ip_address TEXT,                -- 來源 IP（取自 CF-Connecting-IP）
  user_agent TEXT,                -- 瀏覽器 User-Agent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
