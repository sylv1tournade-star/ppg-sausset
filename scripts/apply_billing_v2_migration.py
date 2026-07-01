import os
from pathlib import Path

try:
    import psycopg
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg[binary]", "-q"])
    import psycopg

env_path = Path(__file__).resolve().parents[1] / ".env.local"
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

password = os.environ["SUPABASE_DB_PASSWORD"]
project_ref = os.environ["SUPABASE_PROJECT_REF"]
sql_path = Path(__file__).resolve().parents[1] / "supabase" / "migration_billing_v2.sql"

conninfo = psycopg.conninfo.make_conninfo(
    host=f"db.{project_ref}.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password=password,
    sslmode="require",
)

with psycopg.connect(conninfo) as conn:
    with conn.cursor() as cur:
        cur.execute(sql_path.read_text(encoding="utf-8"))
    conn.commit()
    print("migration_billing_v2.sql applied")
