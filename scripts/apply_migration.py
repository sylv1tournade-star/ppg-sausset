"""Applique supabase/schema.sql sur le projet Supabase PPG."""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import psycopg
except ImportError:
    print("Installez psycopg : pip install 'psycopg[binary]'")
    sys.exit(1)


def load_env_local() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"'))


def main() -> None:
    load_env_local()
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    project_ref = os.environ.get("SUPABASE_PROJECT_REF")
    if not password or not project_ref:
        print("Définissez SUPABASE_DB_PASSWORD et SUPABASE_PROJECT_REF dans .env.local")
        sys.exit(1)

    sql_path = Path(__file__).resolve().parents[1] / "supabase" / "schema.sql"
    sql = sql_path.read_text(encoding="utf-8")
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
            cur.execute(sql)
        conn.commit()

    print("Migration PPG appliquée.")


if __name__ == "__main__":
    main()
