#!/usr/bin/env python3
"""
將一份 .sql 檔案分割為個別可獨立執行的語句(statement)清單。
會正確處理：
  - 單引號字串內的分號/註解符號(不誤判為語句結束)
  - 行內註解 `-- ...`(整行忽略，但字串內的 '--' 不受影響)
用途：讓 gsk hosted d1_execute 逐句執行 seed.sql，因為該 API 一次只接受一句 DML/DDL。
"""
import sys


def split_sql_statements(sql_text: str) -> list[str]:
    statements = []
    buf = []
    in_string = False
    i = 0
    n = len(sql_text)
    # 先移除整行只含註解的行沒必要；直接在掃描時跳過 -- 到行尾的部分(僅在非字串內時)
    while i < n:
        ch = sql_text[i]
        if in_string:
            buf.append(ch)
            if ch == "'":
                # 檢查是否為轉義的兩個單引號 ('')，SQLite 用兩個單引號表示字串內的單引號
                if i + 1 < n and sql_text[i + 1] == "'":
                    buf.append(sql_text[i + 1])
                    i += 2
                    continue
                in_string = False
            i += 1
            continue
        else:
            if ch == "'":
                in_string = True
                buf.append(ch)
                i += 1
                continue
            if ch == "-" and i + 1 < n and sql_text[i + 1] == "-":
                # 行內註解，跳到行尾
                while i < n and sql_text[i] != "\n":
                    i += 1
                continue
            if ch == ";":
                stmt = "".join(buf).strip()
                if stmt:
                    statements.append(stmt)
                buf = []
                i += 1
                continue
            buf.append(ch)
            i += 1
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: sql_split.py <path-to-sql-file>", file=sys.stderr)
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        content = f.read()
    stmts = split_sql_statements(content)
    for idx, s in enumerate(stmts):
        print(f"===STMT_{idx}_START===")
        print(s)
        print(f"===STMT_{idx}_END===")
