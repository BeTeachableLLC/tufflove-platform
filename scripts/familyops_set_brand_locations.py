#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _import_app() -> Any:
    root = _repo_root()
    api_service_dir = root / "services" / "api"
    api_package_dir = root
    zeroclaw_dir = root / "packages" / "zeroclaw"

    if (api_service_dir / "app").exists():
        sys.path.insert(0, str(api_service_dir))
    elif (api_package_dir / "app").exists():
        sys.path.insert(0, str(api_package_dir))

    if zeroclaw_dir.exists():
        sys.path.insert(0, str(zeroclaw_dir))

    from fastapi.testclient import TestClient  # type: ignore
    from app.main import app  # type: ignore

    return TestClient, app


def _load_config(path: Path) -> tuple[str, list[dict[str, Any]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict):
        tenant_id = str(raw.get("tenant_id", "familyops")).strip() or "familyops"
        brands = raw.get("brands", [])
    elif isinstance(raw, list):
        tenant_id = "familyops"
        brands = raw
    else:
        raise ValueError("Config must be a JSON object or list")

    if not isinstance(brands, list):
        raise ValueError("brands must be a list")
    return tenant_id, [b for b in brands if isinstance(b, dict)]


def _row(cells: list[str], widths: list[int]) -> str:
    return " | ".join(cell.ljust(width) for cell, width in zip(cells, widths))


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch map FamilyOps brands to GHL locations via API TestClient")
    parser.add_argument(
        "--config",
        default=str(_repo_root() / "scripts" / "brand_locations.json"),
        help="Path to JSON config file",
    )
    parser.add_argument("--tenant", default=None, help="Override tenant id")
    parser.add_argument("--admin-token", default=os.getenv("ADMIN_TOKEN", "change_me"))
    parser.add_argument("--limit", type=int, default=None, help="Only process first N brand rows")
    args = parser.parse_args()

    config_path = Path(args.config).expanduser().resolve()
    if not config_path.exists():
        print(f"ERROR: config not found: {config_path}")
        return 1

    tenant_id, brands = _load_config(config_path)
    if args.tenant:
        tenant_id = args.tenant.strip() or tenant_id
    if args.limit is not None:
        brands = brands[: max(args.limit, 0)]

    TestClient, app = _import_app()
    headers = {"x-admin-token": args.admin_token}

    rows: list[list[str]] = []
    failures = 0

    with TestClient(app) as client:
        for item in brands:
            brand_id = str(item.get("brand_id", "")).strip()
            location_id = str(item.get("ghl_location_id", "")).strip()
            timezone = str(item.get("timezone", "America/New_York")).strip() or "America/New_York"
            status = str(item.get("status", "active")).strip() or "active"
            platforms_raw = item.get("default_platforms", [])
            default_platforms = [p.strip() for p in platforms_raw if isinstance(p, str) and p.strip()]

            if not brand_id:
                failures += 1
                rows.append(["<missing>", location_id[-6:] if location_id else "-", "skip", "missing_brand_id"])
                continue

            if brand_id.lower() == "corent" and (location_id or status == "active"):
                failures += 1
                rows.append([brand_id, location_id[-6:] if location_id else "-", "blocked", "corent_policy_violation"])
                continue

            payload = {
                "ghl_location_id": location_id or None,
                "timezone": timezone,
                "default_platforms": default_platforms,
                "status": status,
            }
            response = client.put(
                f"/v1/admin/brand/{tenant_id}/{brand_id}",
                headers=headers,
                json=payload,
            )
            if response.status_code == 200:
                rows.append([brand_id, location_id[-6:] if location_id else "-", "ok", "updated"])
            else:
                failures += 1
                detail = "http_error"
                try:
                    payload_json = response.json()
                    detail = str(payload_json.get("detail") or payload_json.get("error") or payload_json)
                except Exception:
                    detail = response.text.strip() or f"HTTP {response.status_code}"
                rows.append([brand_id, location_id[-6:] if location_id else "-", f"err:{response.status_code}", detail])

    headers_out = ["brand_id", "loc_tail", "result", "detail"]
    widths = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h) for i, h in enumerate(headers_out)]
    print(_row(headers_out, widths))
    print(_row(["-" * w for w in widths], widths))
    for row in rows:
        print(_row(row, widths))

    print(f"\nprocessed={len(rows)} failures={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
