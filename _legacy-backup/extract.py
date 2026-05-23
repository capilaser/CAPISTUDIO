"""Extrai conteúdo legível do DB legado para backup human-readable."""
import sqlite3, json, os, sys
from pathlib import Path

DB = Path(__file__).parent / "db" / "capi-studio-active.db"
OUT = Path(__file__).parent

con = sqlite3.connect(str(DB))
con.row_factory = sqlite3.Row

def dump_table(table, out_name):
    try:
        rows = [dict(r) for r in con.execute(f"SELECT * FROM {table}")]
    except sqlite3.OperationalError as e:
        print(f"  [skip {table}] {e}")
        return
    (OUT / f"{out_name}.json").write_text(
        json.dumps(rows, indent=2, default=str, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  {table}: {len(rows)} rows -> {out_name}.json")

print("Extracting tables from DB...")
for table, name in [
    ("orders", "orders"),
    ("order_items", "order-items"),
    ("order_revisions", "order-revisions"),
    ("patterns", "patterns"),
    ("logos", "logos-meta"),
    ("appliques", "appliques"),
    ("products", "products"),
    ("materials", "materials"),
    ("material_families", "material-families"),
    ("fonts", "fonts"),
    ("machines", "machines"),
    ("operations", "operations"),
    ("engravings", "engravings"),
    ("markings", "markings"),
]:
    dump_table(table, name)

# Tentar extrair SVG dos padrões (campo canvasJson tem geometria; vou só dumpar)
pat_dir = OUT / "patterns-svg"
pat_dir.mkdir(exist_ok=True)
try:
    rows = list(con.execute("SELECT id, name, canvas_json FROM patterns"))
    for r in rows:
        pid, pname, pjson = r
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in (pname or pid))[:60]
        (pat_dir / f"{safe}.canvas.json").write_text(
            pjson or "{}", encoding="utf-8"
        )
    print(f"Wrote {len(rows)} pattern canvas JSONs to patterns-svg/")
except sqlite3.OperationalError as e:
    print(f"[skip patterns canvasJson] {e}")

con.close()
print("Done.")
