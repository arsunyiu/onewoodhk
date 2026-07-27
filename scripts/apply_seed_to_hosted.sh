#!/usr/bin/env bash
# ============================================================
# 將 seed.sql 逐句套用到正式 (Hosted) D1 資料庫
# 用途：gsk hosted deploy 只會套用 migrations(建表結構)，
#       不會自動套用 seed.sql(測試/初始資料)，需手動執行本腳本。
# 使用方式：
#   cd /home/user/webapp
#   bash scripts/apply_seed_to_hosted.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

SEED_FILE="seed.sql"
if [ ! -f "$SEED_FILE" ]; then
  echo "❌ 找不到 $SEED_FILE" >&2
  exit 1
fi

echo "📄 解析 $SEED_FILE 為個別語句..."
STATEMENTS_RAW=$(python3 scripts/sql_split.py "$SEED_FILE")

# 用 awk 依 STMT_n_START/END 標記切出每一句，寫入暫存檔陣列
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

python3 - "$SEED_FILE" "$TMP_DIR" <<'PYEOF'
import sys
sys.path.insert(0, "scripts")
from sql_split import split_sql_statements

seed_path, tmp_dir = sys.argv[1], sys.argv[2]
with open(seed_path, "r", encoding="utf-8") as f:
    content = f.read()
stmts = split_sql_statements(content)
for idx, s in enumerate(stmts):
    with open(f"{tmp_dir}/stmt_{idx:03d}.sql", "w", encoding="utf-8") as out:
        out.write(s)
print(f"共 {len(stmts)} 句語句已切分")
PYEOF

COUNT=$(ls "$TMP_DIR"/stmt_*.sql | wc -l)
echo "✅ 共 $COUNT 句語句，開始逐句套用到正式 D1..."

FAIL=0
for f in "$TMP_DIR"/stmt_*.sql; do
  SQL=$(cat "$f")
  NAME=$(basename "$f")
  echo "--- 執行 $NAME ---"
  RESULT=$(gsk hosted d1_execute --sql "$SQL" 2>&1)
  # gsk CLI 會在 JSON 前輸出 [INFO] ... 這類日誌行，需先擷取第一個 '{' 之後的內容才能正確解析 JSON
  CODE=$(echo "$RESULT" | python3 -c "
import sys, json
text = sys.stdin.read()
start = text.find('{')
try:
    d = json.loads(text[start:]) if start != -1 else {}
    print(d.get('data', {}).get('code', '?'))
except Exception:
    print('parse_error')
")
  if [ "$CODE" != "completed" ]; then
    echo "⚠️  $NAME 執行結果非 completed (code=$CODE)，可能是 INSERT OR IGNORE 已存在資料，或需人工檢查："
    echo "$RESULT"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "🎉 全部語句套用完成，無錯誤。"
else
  echo "⚠️  部分語句執行結果需人工確認，請檢視上方輸出。"
fi

echo ""
echo "📊 驗證資料筆數："
gsk hosted d1_query --sql "SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM customers) as customers, (SELECT COUNT(*) FROM quotes) as quotes"
