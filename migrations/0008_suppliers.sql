-- ============================================================
-- 一木工程  |  Migration 0008: 供應商管理 (判頭 / 工人 / 物料供應商)
-- 維護分判商、自聘工人、物料供應商等外部協作方資料，並支援評分機制，
-- 方便日後挑選合作對象、追蹤合作品質
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,                 -- 判頭/工人姓名 或 供應商公司名稱
  type              TEXT NOT NULL DEFAULT 'subcontractor'
                    CHECK (type IN ('subcontractor','worker','supplier','other')),
                    -- subcontractor=分判/判頭, worker=自聘工人, supplier=物料供應商, other=其他
  trade             TEXT,                           -- 工種/專長分類（如：泥水、木工、電工、水喉、油漆等，自由文字）
  contact_person    TEXT,                           -- 聯絡人（供應商為公司時，判頭/工人本身即為聯絡人可留空）
  phone             TEXT,
  mobile            TEXT,
  id_number         TEXT,                           -- 身份證號/商業登記號（選填，供對帳/合約使用）
  address           TEXT,
  bank_account      TEXT,                           -- 收款銀行帳戶（選填，方便付款作業）
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes             TEXT,
  created_by        INTEGER NOT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(type);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- 評分紀錄：每次合作/工程完成後可對判頭/工人/供應商評分（1-5星），並可關聯至具體訂單/工程
CREATE TABLE IF NOT EXISTS supplier_ratings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id   INTEGER NOT NULL,
  order_id      INTEGER,                            -- 選填：關聯的成交訂單（用於追蹤是哪個工程的評分）
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  rated_by      INTEGER NOT NULL,
  rated_at      DATE NOT NULL DEFAULT (date('now')),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (rated_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_supplier ON supplier_ratings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_order ON supplier_ratings(order_id);
