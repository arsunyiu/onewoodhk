-- ============================================================
-- 一木工程  |  Migration 0009: 工程指派 (Project ↔ Supplier Assignment)
-- 將判頭/工人/供應商 (suppliers) 指派至特定工程 (projects)，
-- 記錄本次指派的工種、期間與狀態，供工程詳情頁與供應商詳情頁雙向查看
-- ============================================================

CREATE TABLE IF NOT EXISTS project_suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL,
  supplier_id   INTEGER NOT NULL,
  trade         TEXT,                 -- 本次指派的工種（可能與供應商預設工種不同，選填）
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  start_date    DATE,
  end_date      DATE,
  notes         TEXT,
  assigned_by   INTEGER NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_project_suppliers_project ON project_suppliers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_suppliers_supplier ON project_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_project_suppliers_status ON project_suppliers(status);
