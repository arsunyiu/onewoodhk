-- 報價單新增「聯絡人電話」欄位：獨立於 contact_id（關聯聯絡人記錄），
-- 新增/編輯報價單時可自動帶入客戶主要聯絡人的電話作為預設值，並可自由編輯覆寫，
-- 亦會顯示於報價單 PDF 抬頭區，方便客戶簽收/核對聯絡方式
ALTER TABLE quotes ADD COLUMN contact_phone TEXT;
