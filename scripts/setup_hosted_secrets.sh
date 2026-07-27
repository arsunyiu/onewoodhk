#!/usr/bin/env bash
# ============================================================
# 設定正式 (Hosted) Worker 所需的 secrets（例如 JWT_SECRET）
# 用途：gsk hosted deploy 不會自動保留/建立 secrets，
#       首次部署或重建 worker 後，必須手動執行本腳本補上。
#
# 行為：
#   - 先用 gsk hosted secret_list 檢查是否已存在同名 secret
#   - 若已存在 → 預設「不覆蓋」(避免意外讓正式環境的 JWT 全部失效、
#     所有已登入 token 及使用者 session 被強制登出)
#   - 若不存在 → 自動產生一個安全隨機值並設定
#   - 可用 --force 強制覆蓋已存在的 secret（會使舊 JWT token 全部失效）
#
# 使用方式：
#   cd /home/user/webapp
#   bash scripts/setup_hosted_secrets.sh            # 只補缺少的 secret
#   bash scripts/setup_hosted_secrets.sh --force     # 強制重新產生並覆蓋
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

FORCE=0
if [ "${1:-}" == "--force" ]; then
  FORCE=1
fi

# 本專案正式環境需要的 secrets 清單（依 src/types/index.ts 的 Bindings 型別）
REQUIRED_SECRETS=("JWT_SECRET")

echo "🔍 查詢正式 Worker 目前已設定的 secrets..."
LIST_RESULT=$(gsk hosted secret_list 2>&1)
echo "$LIST_RESULT"

# 擷取第一個 '{' 之後的內容再解析 JSON（gsk CLI 會先印 [INFO] 日誌行）
EXISTING_NAMES=$(echo "$LIST_RESULT" | python3 -c "
import sys, json
text = sys.stdin.read()
start = text.find('{')
try:
    d = json.loads(text[start:]) if start != -1 else {}
    names = [s.get('name') for s in d.get('data', {}).get('result', {}).get('secrets', [])]
    print('\n'.join(names))
except Exception:
    pass
")

for NAME in "${REQUIRED_SECRETS[@]}"; do
  ALREADY_SET=0
  if echo "$EXISTING_NAMES" | grep -qx "$NAME"; then
    ALREADY_SET=1
  fi

  if [ "$ALREADY_SET" -eq 1 ] && [ "$FORCE" -eq 0 ]; then
    echo "✅ $NAME 已存在，略過（如需強制重新產生請加上 --force 參數）"
    continue
  fi

  if [ "$ALREADY_SET" -eq 1 ] && [ "$FORCE" -eq 1 ]; then
    echo "⚠️  $NAME 已存在，因指定 --force，將產生新值並覆蓋（注意：現有登入 token 將全部失效）"
  else
    echo "➕ $NAME 尚未設定，將產生新值並設定"
  fi

  VALUE=$(openssl rand -hex 32)
  echo "🔐 設定 $NAME ..."
  gsk hosted secret_put --name "$NAME" --value "$VALUE"
  echo "✅ $NAME 設定完成"
done

echo ""
echo "🔍 最終確認目前已設定的 secrets："
gsk hosted secret_list
