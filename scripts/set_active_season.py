"""Bascule la saison active vers une année de début donnée (défaut: 2026)."""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path


def load_env_local() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


def supabase_request(method: str, path: str, body: dict | list | None = None):
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {
        "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def thursday_dates(start_year: int) -> list[str]:
    cursor = date(start_year, 9, 1)
    while cursor.weekday() != 3:
        cursor = date.fromordinal(cursor.toordinal() + 1)
    end = date(start_year + 1, 6, 30)
    dates: list[str] = []
    while cursor <= end:
        dates.append(cursor.isoformat())
        cursor = date.fromordinal(cursor.toordinal() + 7)
    return dates


def main() -> None:
    load_env_local()
    start_year = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    label = f"{start_year}-{start_year + 1}"

    seasons = supabase_request("GET", "/rest/v1/ppg_seasons?select=id,label,is_active,start_year")
    for season in seasons or []:
        if season.get("is_active"):
            supabase_request(
                "PATCH",
                f"/rest/v1/ppg_seasons?id=eq.{season['id']}",
                {"is_active": False},
            )

    existing = next((season for season in (seasons or []) if season.get("start_year") == start_year), None)
    if existing:
        season = supabase_request(
            "PATCH",
            f"/rest/v1/ppg_seasons?id=eq.{existing['id']}",
            {"is_active": True},
        )[0]
        session_count = supabase_request(
            "GET",
            f"/rest/v1/ppg_sessions?season_id=eq.{season['id']}&select=id",
        )
        print(
            json.dumps(
                {
                    "status": "activated_existing",
                    "season": season,
                    "sessionCount": len(session_count or []),
                },
                ensure_ascii=False,
            )
        )
        return

    season = supabase_request(
        "POST",
        "/rest/v1/ppg_seasons",
        {
            "label": label,
            "start_year": start_year,
            "day_of_week": 4,
            "start_time": "19:00",
            "end_time": "20:00",
            "location": "Sausset-les-Pins",
            "is_active": True,
        },
    )[0]

    session_rows = [
        {"season_id": season["id"], "session_date": session_date, "status": "scheduled"}
        for session_date in thursday_dates(start_year)
    ]
    supabase_request("POST", "/rest/v1/ppg_sessions", session_rows)
    print(
        json.dumps(
            {
                "status": "created",
                "season": season,
                "sessionCount": len(session_rows),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
