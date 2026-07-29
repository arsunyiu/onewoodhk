-- ============================================================
-- 一木工程  |  Migration 0004: 工程管理 (Project / Construction Progress Tracking)
-- 每張成交訂單 (orders) 對應一個工程專案，追蹤施工進度
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id            INTEGER NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started','in_progress','paused','completed','cancelled')),
  progress_percent    INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  start_date          DATE,
  expected_end_date   DATE,
  actual_end_date     DATE,
  site_address        TEXT,
  supervisor_id       INTEGER,           -- 負責工程進度的人員（預設為訂單負責業務，可另指派）
  notes               TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_projects_order ON projects(order_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_supervisor ON projects(supervisor_id);

-- 工程進度時間軸紀錄
CREATE TABLE IF NOT EXISTS project_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL,
  log_date          DATE NOT NULL DEFAULT (date('now')),
  progress_percent  INTEGER,            -- 該次紀錄時的進度快照（選填）
  description       TEXT NOT NULL,
  created_by        INTEGER NOT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_project_logs_project ON project_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_logs_date ON project_logs(log_date);

-- 回填：既有訂單（在此 migration 套用前已成交）補建對應工程紀錄
INSERT OR IGNORE INTO projects (order_id, status, progress_percent, site_address, supervisor_id)
SELECT o.id, 'not_started', 0, q.site_address, o.owner_id
FROM orders o
LEFT JOIN quotes q ON q.id = o.quote_id
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.order_id = o.id);
