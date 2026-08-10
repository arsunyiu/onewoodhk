-- ============================================================
-- 一木工程  |  Migration 0010: 供應商銀行/FPS 轉帳資料
-- 將原本單一自由文字的「收款銀行帳戶」欄位擴充為結構化的
-- 銀行名稱／戶口名／戶口號碼／FPS 識別碼，方便直接用於轉帳/找數
-- （原 bank_account 欄位保留但不再使用，避免破壞既有資料）
-- ============================================================

ALTER TABLE suppliers ADD COLUMN bank_name TEXT;            -- 銀行名稱（如：滙豐、中銀香港、恒生）
ALTER TABLE suppliers ADD COLUMN bank_account_name TEXT;    -- 銀行戶口名（收款人姓名/公司名稱，須與銀行資料一致）
ALTER TABLE suppliers ADD COLUMN bank_account_no TEXT;      -- 銀行戶口號碼
ALTER TABLE suppliers ADD COLUMN fps_id TEXT;                -- FPS 識別碼（手機號碼／電郵／FPS ID，任一皆可）
