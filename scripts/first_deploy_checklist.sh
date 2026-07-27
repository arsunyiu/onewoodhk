#!/usr/bin/env bash
# ============================================================
# 首次部署（或重建 D1/Worker 後）的固定檢查清單腳本
# 依序執行：
#   1) 套用 seed 資料到正式 D1（scripts/apply_seed_to_hosted.sh）
#   2) 確認/設定正式 Worker 所需 secrets（scripts/setup_hosted_secrets.sh）
#
# 背景：gsk hosted deploy 只會自動套用 D1 migrations（建表結構），
#       不會自動套用 seed.sql（測試/初始資料），也不會保留/建立
#       secrets（例如 JWT_SECRET）。若跳過本清單，正式站會出現
#       「資料庫是空的」或「登入時 500 錯誤」等問題。
#
# 使用方式（在 gsk hosted deploy 成功後執行）：
#   cd /home/user/webapp
#   bash scripts/first_deploy_checklist.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "======================================================"
echo "  Step 1/2：套用 seed 資料到正式 D1"
echo "======================================================"
bash scripts/apply_seed_to_hosted.sh

echo ""
echo "======================================================"
echo "  Step 2/2：確認/設定正式 Worker secrets"
echo "======================================================"
bash scripts/setup_hosted_secrets.sh

echo ""
echo "🎉 首次部署檢查清單執行完畢。"
echo "👉 建議接著手動驗證：以 seed.sql 內任一帳號測試登入正式網址，"
echo "   並確認 /api/auth/me、/api/dashboard/summary 回應正常。"
