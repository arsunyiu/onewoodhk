-- ============================================================
-- 一木工程  |  Seed Data (測試資料)
-- 預設密碼皆為: password123
-- password_hash 使用 PBKDF2(SHA-256, 100000 rounds) 格式: salt:hash (hex)
-- 以下 hash 由 src/utils/crypto.ts 的 hashPassword('password123') 產生
-- ============================================================

-- Users -------------------------------------------------------
-- 1: admin@yimu.com.tw  (Admin)
-- 2: manager@yimu.com.tw (Manager，帶團隊)
-- 3: alice@yimu.com.tw  (Sales, manager_id=2)
-- 4: bob@yimu.com.tw    (Sales, manager_id=2)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, manager_id, phone, is_active) VALUES
  (1, '系統管理員', 'admin@yimu.com.tw',   '95438473e7c6f06872d6a1b7fa45905f:f0391f16cc8cb0735d1e5b86763f10f7d0ab39895c1318434ac64f4045026da1', 'admin',   NULL, '0900-000-001', 1),
  (2, '陳經理',     'manager@yimu.com.tw', '95438473e7c6f06872d6a1b7fa45905f:f0391f16cc8cb0735d1e5b86763f10f7d0ab39895c1318434ac64f4045026da1', 'manager', NULL, '0900-000-002', 1),
  (3, '王小美',     'alice@yimu.com.tw',   '95438473e7c6f06872d6a1b7fa45905f:f0391f16cc8cb0735d1e5b86763f10f7d0ab39895c1318434ac64f4045026da1', 'sales',   2,    '0900-000-003', 1),
  (4, '林大同',     'bob@yimu.com.tw',     '95438473e7c6f06872d6a1b7fa45905f:f0391f16cc8cb0735d1e5b86763f10f7d0ab39895c1318434ac64f4045026da1', 'sales',   2,    '0900-000-004', 1);

-- Customers -----------------------------------------------------
INSERT OR IGNORE INTO customers (id, company_name, tax_id, industry, status, source, address, city, website, credit_limit, owner_id) VALUES
  (1, '未來科技股份有限公司', '12345678', '軟體/科技', 'active', '官網詢問', '台北市信義區松高路1號', '台北市', 'https://future-tech.example.com', 500000, 3),
  (2, '晶采製造有限公司',     '23456789', '製造業',   'active', '陌生開發', '新北市三重區重新路5段',   '新北市', 'https://crystal-mfg.example.com', 300000, 3),
  (3, '雲端數據顧問',         '34567890', '顧問服務', 'lead',   '轉介',     '台中市西屯區台灣大道',   '台中市', NULL, 100000, 4),
  (4, '綠境生技',             '45678901', '生技/醫療', 'lead',   '展會',     '台南市東區長榮路',       '台南市', NULL, 150000, 4),
  (5, '晨光零售連鎖',         '56789012', '零售/流通', 'inactive', '陌生開發', '高雄市左營區博愛路',   '高雄市', NULL, 200000, 3);

-- Contacts --------------------------------------------------------
INSERT OR IGNORE INTO contacts (id, customer_id, name, title, phone, mobile, email, is_primary) VALUES
  (1, 1, '張志明', '採購經理', '02-2345-6789', '0912-345-678', 'zhang@future-tech.example.com', 1),
  (2, 1, '李佳穎', '財務主任', '02-2345-6790', '0912-345-679', 'li@future-tech.example.com', 0),
  (3, 2, '陳建宏', '總經理',   '02-8765-4321', '0922-111-222', 'chen@crystal-mfg.example.com', 1),
  (4, 3, '黃淑芬', '執行長',   '04-2345-6789', '0933-222-333', 'huang@cloud-data.example.com', 1),
  (5, 4, '吳俊傑', '研發總監', '06-1234-5678', '0955-333-444', 'wu@green-bio.example.com', 1);

-- Activities --------------------------------------------------------
INSERT OR IGNORE INTO activities (id, customer_id, user_id, type, subject, content, activity_date) VALUES
  (1, 1, 3, 'meeting', '需求討論會議', '確認導入時程與預算範圍，客戶希望Q3上線。', '2026-07-10 10:00:00'),
  (2, 1, 3, 'call', '報價後追蹤電話', '客戶反饋報價偏高，討論折扣空間。', '2026-07-18 14:30:00'),
  (3, 2, 3, 'email', '寄送產品資料', '已寄送產品規格書供內部評估。', '2026-07-15 09:15:00'),
  (4, 3, 4, 'note', '初次接觸紀錄', '透過展會交換名片，對雲端方案有興趣。', '2026-07-05 16:00:00'),
  (5, 4, 4, 'task', '待辦：安排Demo', '需在下週安排產品Demo會議。', '2026-07-28 09:00:00');

UPDATE activities SET is_done = 0 WHERE id = 5;

-- Products --------------------------------------------------------
INSERT OR IGNORE INTO products (id, sku, name, category, unit, unit_price, cost_price, description) VALUES
  (1, 'SW-001', '雲端CRM系統年費授權',   '軟體授權', '年', 120000, 60000, '含客戶管理、報價管理、報表分析模組'),
  (2, 'SW-002', '客製化開發服務',         '專業服務', '人天', 15000, 8000, '依需求規格進行客製化開發'),
  (3, 'SW-003', '系統導入輔導',           '專業服務', '案',  50000, 20000, '含資料轉移、教育訓練、上線輔導'),
  (4, 'HW-001', 'IoT感測器設備',          '硬體設備', '台',  8500,  5000, '工業級溫濕度感測器'),
  (5, 'SW-004', '年度維護保固服務',       '維護服務', '年',  30000, 10000, '含7x24技術支援與版本更新');

-- Quotes ------------------------------------------------------------
INSERT OR IGNORE INTO quotes (id, quote_no, customer_id, contact_id, owner_id, status, title, currency, subtotal, discount_type, discount_value, tax_rate, tax_amount, total_amount, valid_until, approver_id, approved_at, sent_at, terms) VALUES
  (1, 'Q20260701-0001', 1, 1, 3, 'won', '雲端CRM系統導入專案', 'TWD', 185000, 'amount', 5000, 0.05, 9000, 189000, '2026-08-01', 2, '2026-07-05 11:00:00', '2026-07-06 09:00:00', '簽約後7天內支付訂金50%，驗收後支付餘款。'),
  (2, 'Q20260710-0002', 2, 3, 3, 'sent', 'IoT感測設備採購案', 'TWD', 85000, 'percent', 5, 0.05, 4038, 84788, '2026-08-10', 2, '2026-07-12 15:00:00', '2026-07-13 10:00:00', '貨到付款，保固一年。'),
  (3, 'Q20260715-0003', 3, 4, 4, 'pending_approval', '雲端數據分析服務報價', 'TWD', 65000, 'amount', 0, 0.05, 3250, 68250, '2026-08-15', NULL, NULL, NULL, '月繳，首月享優惠價。'),
  (4, 'Q20260720-0004', 4, 5, 4, 'draft', '生技研發客製系統報價', 'TWD', 200000, 'amount', 10000, 0.05, 9500, 199500, '2026-08-20', NULL, NULL, NULL, NULL),
  (5, 'Q20260705-0005', 1, 2, 3, 'rejected', '維護保固加購方案', 'TWD', 30000, 'amount', 0, 0.05, 1500, 31500, '2026-07-25', 2, NULL, NULL, NULL);

UPDATE quotes SET rejected_reason = '客戶預算已於本期用盡，建議下期再議。' WHERE id = 5;

-- Quote Items --------------------------------------------------------
INSERT OR IGNORE INTO quote_items (id, quote_id, product_id, item_name, description, unit, quantity, unit_price, discount_pct, line_total, sort_order) VALUES
  (1, 1, 1, '雲端CRM系統年費授權', NULL, '年', 1, 120000, 0, 120000, 1),
  (2, 1, 3, '系統導入輔導', NULL, '案', 1, 50000, 0, 50000, 2),
  (3, 1, 2, '客製化開發服務', '報表模組客製', '人天', 1, 15000, 0, 15000, 3),
  (4, 2, 4, 'IoT感測器設備', NULL, '台', 10, 8500, 0, 85000, 1),
  (5, 3, 1, '雲端CRM系統年費授權', '數據分析模組', '年', 1, 65000, 0, 65000, 1),
  (6, 4, 2, '客製化開發服務', '研發系統客製', '人天', 10, 15000, 0, 150000, 1),
  (7, 4, 3, '系統導入輔導', NULL, '案', 1, 50000, 0, 50000, 2),
  (8, 5, 5, '年度維護保固服務', NULL, '年', 1, 30000, 0, 30000, 1);

-- Approval Logs --------------------------------------------------------
INSERT OR IGNORE INTO quote_approval_logs (id, quote_id, user_id, action, comment, created_at) VALUES
  (1, 1, 3, 'submit', '提交審核', '2026-07-02 09:00:00'),
  (2, 1, 2, 'approve', '同意此報價方案', '2026-07-05 11:00:00'),
  (3, 1, 3, 'send', '已寄送客戶', '2026-07-06 09:00:00'),
  (4, 1, 3, 'win', '客戶已簽約', '2026-07-08 14:00:00'),
  (5, 2, 3, 'submit', '提交審核', '2026-07-11 10:00:00'),
  (6, 2, 2, 'approve', '折扣範圍合理，核准', '2026-07-12 15:00:00'),
  (7, 2, 3, 'send', '已寄送客戶', '2026-07-13 10:00:00'),
  (8, 3, 4, 'submit', '提交審核，等待主管確認', '2026-07-16 09:00:00'),
  (9, 5, 3, 'submit', '提交審核', '2026-07-06 10:00:00'),
  (10, 5, 2, 'reject', '客戶預算已於本期用盡，建議下期再議。', '2026-07-07 10:00:00');

-- Orders --------------------------------------------------------
INSERT OR IGNORE INTO orders (id, order_no, quote_id, customer_id, owner_id, total_amount, status, order_date, notes) VALUES
  (1, 'O20260708-0001', 1, 1, 3, 189000, 'confirmed', '2026-07-08', '已簽訂正式合約，準備安排導入時程。');
