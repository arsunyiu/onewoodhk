-- ============================================================
-- 一木工程  |  Migration 0005: 報價/發票項目 新增 工程分類(category) 及 位置(location)
-- 目的：報價單/發票 PDF 需依「工程分類」分組並顯示每組小計，仿照原始報價單
--       (QW260801-R0.pdf) 效果；location 記錄該項目所在房間/位置（例如：廚房、
--       主人浴室、全屋單位），與 item_name/description 一樣屬於下單當刻的快照
--       欄位，日後即使 products.category 有變動，也不影響已發出的報價/發票紀錄
-- ============================================================

ALTER TABLE quote_items ADD COLUMN category TEXT;
ALTER TABLE quote_items ADD COLUMN location TEXT;
