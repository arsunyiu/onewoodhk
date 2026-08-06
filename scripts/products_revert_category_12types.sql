-- ============================================================
-- 退回粗分類架構（12類），取消之前「房間+工程」34細分類合併
-- 分類：前期工程 / 拆除及清潔工程 / 泥水工程 / 木器工程 / 地板工程 /
--       天花及鋁質工程 / 油漆工程 / 電力工程 / 水喉工程 / 防水工程 /
--       窗戶工程 / 設備安裝工程
-- 房間/位置資訊改由 quote_items.location（每張報價單自行填寫）承載
-- ============================================================

UPDATE products SET category = '前期工程' WHERE id IN (1);

UPDATE products SET category = '拆除及清潔工程' WHERE id IN (6,10,11,12,13,14,15,16,17);

UPDATE products SET category = '泥水工程' WHERE id IN (18,19,20,21,22,23,24);

UPDATE products SET category = '木器工程' WHERE id IN (9,25,26,27,28,29,30,31,32,33,34);

UPDATE products SET category = '地板工程' WHERE id IN (35,36);

UPDATE products SET category = '天花及鋁質工程' WHERE id IN (37,38,39);

UPDATE products SET category = '油漆工程' WHERE id IN (8,40,41,42);

UPDATE products SET category = '電力工程' WHERE id IN (43,44,45,46,47,48,49,50,51,52);

UPDATE products SET category = '水喉工程' WHERE id IN (2,5,53,54,55,56);

UPDATE products SET category = '防水工程' WHERE id IN (3,7);

UPDATE products SET category = '窗戶工程' WHERE id IN (4);

UPDATE products SET category = '設備安裝工程' WHERE id IN (57,58,59,60);
