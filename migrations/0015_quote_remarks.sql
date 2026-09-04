-- 報價單新增「備註 Remarks」欄位：獨立於 terms（條款/付款方式）與 notes（內部備註），
-- 用於顯示客戶條款聲明（如材料/運輸範圍、不包含項目、變更需簽署確認等），會顯示於報價單PDF
ALTER TABLE quotes ADD COLUMN remarks TEXT;
