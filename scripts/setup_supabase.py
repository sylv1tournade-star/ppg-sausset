import os
from pathlib import Path

try:
    import psycopg
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg[binary]", "-q"])
    import psycopg

ROOT = Path(__file__).resolve().parents[1]
env_path = ROOT / ".env.local"

for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

password = os.environ["SUPABASE_DB_PASSWORD"]
project_ref = os.environ["SUPABASE_PROJECT_REF"]

conninfo = psycopg.conninfo.make_conninfo(
    host=f"db.{project_ref}.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password=password,
    sslmode="require",
)

MIGRATIONS = [
    "migration_paid_members.sql",
    "migration_billing.sql",
    "migration_billing_v2.sql",
    "migration_rls.sql",
]

TABLES = [
    "ppg_seasons",
    "ppg_sessions",
    "ppg_participants",
    "ppg_registrations",
    "ppg_attendance",
    "ppg_paid_members",
    "ppg_treasurer_emails",
    "ppg_month_validations",
    "ppg_month_reminders",
]

with psycopg.connect(conninfo) as conn:
    with conn.cursor() as cur:
        print("=== Tables existantes ===")
        cur.execute(
            """
            select tablename from pg_tables
            where schemaname = 'public' and tablename like 'ppg_%'
            order by tablename
            """
        )
        existing = [row[0] for row in cur.fetchall()]
        for name in existing:
            print(f"  - {name}")

        for migration in MIGRATIONS:
            path = ROOT / "supabase" / migration
            if not path.exists():
                print(f"SKIP missing {migration}")
                continue
            print(f"\n=== Applying {migration} ===")
            cur.execute(path.read_text(encoding="utf-8"))
            conn.commit()
            print(f"OK {migration}")

        print("\n=== RLS status ===")
        cur.execute(
            """
            select c.relname, c.relrowsecurity, c.relforcerowsecurity
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = any(%s)
            order by c.relname
            """,
            (TABLES,),
        )
        for row in cur.fetchall():
            print(f"  {row[0]}: rls={'ON' if row[1] else 'OFF'} force={'ON' if row[2] else 'OFF'}")

        print("\n=== Counts ===")
        for table in TABLES:
            if table in existing or table in TABLES:
                try:
                    cur.execute(f"select count(*) from {table}")
                    print(f"  {table}: {cur.fetchone()[0]}")
                except Exception as exc:
                    conn.rollback()
                    print(f"  {table}: (absent or error: {exc})")

print("\nDone.")
