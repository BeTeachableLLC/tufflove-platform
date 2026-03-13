from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable

from app.db import (
    append_regenerated_version,
    claim_regeneration_job,
    complete_regeneration_job,
    fail_regeneration_job,
    get_approval,
    get_brand,
    get_content_item_for_publish,
    get_content_item_for_regeneration,
    get_ghl_connection,
    replace_knowledge_source,
)

DEFAULT_TEXT_EXTENSIONS = {".md", ".txt", ".markdown", ".csv", ".json"}
DEFAULT_BINARY_META_EXTENSIONS = {".mp3", ".wav", ".m4a", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".zip"}
DEFAULT_SCAN_EXTENSIONS = DEFAULT_TEXT_EXTENSIONS | DEFAULT_BINARY_META_EXTENSIONS
INGEST_ROOT = Path(os.getenv("INGEST_ROOT", "/app")).resolve()


def _normalize_extensions(raw: Any) -> set[str]:
    if not isinstance(raw, list) or not raw:
        return set(DEFAULT_SCAN_EXTENSIONS)

    normalized: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            continue
        ext = item.strip().lower()
        if not ext:
            continue
        if not ext.startswith("."):
            ext = f".{ext}"
        normalized.add(ext)
    return normalized or set(DEFAULT_SCAN_EXTENSIONS)


def _chunk_text(text: str, *, chunk_size: int = 1200, overlap: int = 150) -> list[str]:
    cleaned = " ".join(text.split()).strip()
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]

    chunks: list[str] = []
    step = max(chunk_size - overlap, 200)
    for start in range(0, len(cleaned), step):
        chunk = cleaned[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _resolve_safe_path(source: str) -> Path:
    candidate = (INGEST_ROOT / source).resolve()
    candidate.relative_to(INGEST_ROOT)
    return candidate


def _file_to_chunks(path: Path, source_display: str) -> list[str]:
    ext = path.suffix.lower()
    if ext in DEFAULT_TEXT_EXTENSIONS:
        text = path.read_text(encoding="utf-8", errors="ignore")
        return _chunk_text(text)

    if ext in DEFAULT_BINARY_META_EXTENSIONS:
        stat = path.stat()
        meta = (
            f"Asset metadata. source={source_display} filename={path.name} extension={ext} "
            f"size_bytes={stat.st_size}. Binary file; text transcription/extraction pending."
        )
        return [meta]

    return []


def _ingest_single_file(tenant_id: str, relative_path: str) -> dict[str, Any]:
    path = _resolve_safe_path(relative_path)
    if not path.exists() or not path.is_file():
        return {"ok": False, "note": "file_not_found", "file_path": relative_path}

    source_display = str(path.relative_to(INGEST_ROOT))
    chunks = _file_to_chunks(path, source_display)
    count = replace_knowledge_source(tenant_id=tenant_id, source_path=source_display, chunks=chunks)
    return {"ok": True, "file_path": source_display, "chunks": count}


def handle_embed_ingest(payload: dict[str, Any]) -> dict[str, Any]:
    tenant_id = str(payload.get("tenant_id", "")).strip()
    if not tenant_id:
        return {"ok": False, "note": "tenant_id_missing"}

    mode = str(payload.get("mode", "single")).strip().lower()

    try:
        if mode == "scan":
            source_root = str(payload.get("source_root", "assets")).strip()
            max_files_raw = payload.get("max_files", 100)
            max_files = int(max_files_raw) if isinstance(max_files_raw, (int, str)) else 100
            max_files = min(max(max_files, 1), 5000)
            allowed_extensions = _normalize_extensions(payload.get("extensions"))

            root = _resolve_safe_path(source_root)
            if not root.exists() or not root.is_dir():
                return {"ok": False, "note": "source_root_not_found", "source_root": source_root}

            scanned = 0
            ingested_files = 0
            ingested_chunks = 0
            skipped = 0
            errors: list[str] = []
            samples: list[dict[str, Any]] = []

            for file_path in root.rglob("*"):
                if not file_path.is_file():
                    continue
                scanned += 1
                if ingested_files >= max_files:
                    break
                ext = file_path.suffix.lower()
                if ext not in allowed_extensions:
                    skipped += 1
                    continue

                source_display = str(file_path.relative_to(INGEST_ROOT))
                try:
                    chunks = _file_to_chunks(file_path, source_display)
                    count = replace_knowledge_source(
                        tenant_id=tenant_id,
                        source_path=source_display,
                        chunks=chunks,
                    )
                    ingested_files += 1
                    ingested_chunks += count
                    if len(samples) < 10:
                        samples.append({"source_path": source_display, "chunks": count})
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"{source_display}: {exc}")

            return {
                "ok": True,
                "mode": "scan",
                "source_root": str(root.relative_to(INGEST_ROOT)),
                "scanned_files": scanned,
                "ingested_files": ingested_files,
                "ingested_chunks": ingested_chunks,
                "skipped_files": skipped,
                "errors": errors[:20],
                "samples": samples,
            }

        file_path = str(payload.get("file_path", "")).strip()
        if not file_path:
            return {"ok": False, "note": "file_path_missing"}
        single = _ingest_single_file(tenant_id=tenant_id, relative_path=file_path)
        return {"mode": "single", **single}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "note": "ingest_failed", "error": str(exc)}


def handle_ghl_social_plan(payload: dict[str, Any]) -> dict[str, Any]:
    topic = payload.get("topic", "Untitled")
    platforms = payload.get("platforms", ["fb"])
    return {
        "ok": True,
        "plan": {
            "topic": topic,
            "platforms": platforms,
            "outline": [
                {"step": 1, "title": "Hook", "description": f"Lead with a sharp insight about {topic}."},
                {"step": 2, "title": "Value", "description": "Share one actionable takeaway and one caution."},
                {"step": 3, "title": "CTA", "description": "Prompt comments with a clear next-step question."},
            ],
        },
    }


def handle_ghl_social_schedule(payload: dict[str, Any]) -> dict[str, Any]:
    topic = payload.get("topic", "Untitled")
    platforms = payload.get("platforms", ["fb", "ig"])
    return {
        "ok": True,
        "schedule": {
            "topic": topic,
            "timezone": payload.get("timezone", "America/Chicago"),
            "posts": [
                {"day": "Monday", "platforms": platforms, "time_local": "09:00"},
                {"day": "Wednesday", "platforms": platforms, "time_local": "12:00"},
                {"day": "Friday", "platforms": platforms, "time_local": "17:00"},
            ],
        },
    }


def _normalize_allowed_publishers(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    normalized: set[str] = set()
    for item in value:
        if isinstance(item, str) and item.strip():
            normalized.add(item.strip())
    return normalized


def handle_ghl_social_publish(payload: dict[str, Any]) -> dict[str, Any]:
    task_id = payload.get("task_id")
    if not task_id:
        return {"ok": False, "note": "approval_required", "status": "blocked", "reason": "missing_task_id"}

    approval = get_approval(str(task_id))
    if approval is None or approval.get("status") != "approved":
        return {"ok": False, "note": "approval_required", "status": "blocked"}

    tenant_id = str(payload.get("tenant_id", "")).strip()
    brand_id = str(payload.get("brand_id", "")).strip()
    location_id = str(payload.get("location_id", "")).strip()
    if not brand_id or not location_id:
        return {"ok": False, "note": "missing_brand_or_location", "status": "failed"}

    brand = get_brand(tenant_id, brand_id) if tenant_id else None
    if brand is None or brand.get("status") != "active":
        return {"ok": False, "note": "brand_inactive_or_missing", "status": "failed", "brand_id": brand_id}

    content_item_id = str(payload.get("content_item_id") or "").strip()
    content_item = None
    if content_item_id:
        content_item = get_content_item_for_publish(tenant_id, content_item_id)
        if content_item is None:
            return {
                "ok": False,
                "note": "content_item_missing",
                "status": "failed",
                "content_item_id": content_item_id,
            }
        if content_item.get("brand_id") != brand_id:
            return {
                "ok": False,
                "note": "content_brand_mismatch",
                "status": "failed",
                "content_item_id": content_item_id,
                "brand_id": brand_id,
                "content_brand_id": content_item.get("brand_id"),
            }
        if content_item.get("brand_status") != "active":
            return {
                "ok": False,
                "note": "brand_inactive_or_missing",
                "status": "failed",
                "brand_id": brand_id,
                "content_item_id": content_item_id,
            }
        if content_item.get("subaccount_status") != "active":
            return {
                "ok": False,
                "note": "subaccount_inactive_or_missing",
                "status": "failed",
                "content_item_id": content_item_id,
                "subaccount_id": content_item.get("subaccount_id"),
            }
        if content_item.get("status") not in {"approved", "scheduled"}:
            return {
                "ok": False,
                "note": "content_not_approved",
                "status": "failed",
                "content_item_id": content_item_id,
                "content_status": content_item.get("status"),
            }
        if not content_item.get("current_version_id"):
            return {
                "ok": False,
                "note": "content_version_missing",
                "status": "failed",
                "content_item_id": content_item_id,
            }
        allowed_publishers = _normalize_allowed_publishers(content_item.get("allowed_publishers"))
        if "ghl.social.publish" not in allowed_publishers:
            return {
                "ok": False,
                "note": "brand_publisher_not_allowed",
                "status": "failed",
                "content_item_id": content_item_id,
                "brand_id": brand_id,
            }

    configured_location = str(brand.get("ghl_location_id") or "").strip()
    if configured_location and configured_location != location_id:
        return {
            "ok": False,
            "note": "brand_location_mismatch",
            "status": "failed",
            "brand_id": brand_id,
            "location_id": location_id,
            "expected_location_id": configured_location,
        }

    connection = get_ghl_connection(tenant_id, location_id) if tenant_id else None
    if connection is None:
        return {
            "ok": False,
            "note": "missing_ghl_connection",
            "status": "failed",
            "brand_id": brand_id,
            "location_id": location_id,
        }

    platforms = payload.get("platforms")
    if not isinstance(platforms, list) or not platforms:
        platforms = brand.get("default_platforms") or ["fb"]

    payload_to_send = {
        "tenant_id": tenant_id,
        "brand_id": brand_id,
        "location_id": location_id,
        "task_id": str(task_id),
        "platforms": platforms,
        "timezone": payload.get("timezone") or brand.get("timezone"),
        "content": (
            payload.get("content")
            or payload.get("message")
            or (content_item.get("current_content_text") if content_item else None)
            or payload.get("topic")
        ),
        "media_urls": payload.get("media_urls", []),
        "scheduled_at": payload.get("scheduled_at"),
        "dry_run": True,
    }
    return {
        "ok": True,
        "note": "ghl_dry_run",
        "status": "would_publish",
        "brand_id": brand_id,
        "location_id": location_id,
        "payload_to_send": payload_to_send,
    }


def handle_content_ai_regenerate(payload: dict[str, Any]) -> dict[str, Any]:
    requested_job_id = str(payload.get("regeneration_job_id") or "").strip() or None
    requested_item_id = str(payload.get("content_item_id") or "").strip() or None
    if not requested_job_id and not requested_item_id:
        return {"ok": False, "status": "failed", "note": "missing_regeneration_target"}

    job = claim_regeneration_job(job_id=requested_job_id, content_item_id=requested_item_id)
    if job is None:
        return {"ok": False, "status": "failed", "note": "regeneration_job_not_found_or_not_due"}

    try:
        item = get_content_item_for_regeneration(job["content_item_id"])
        if item is None:
            raise KeyError("content_item_not_found")

        generated_by = str(payload.get("user_id") or job.get("requested_by") or "ai-system")
        version = append_regenerated_version(
            content_item_id=job["content_item_id"],
            generated_by=generated_by,
            revision_note=job.get("revision_note") or str(payload.get("note") or ""),
            source_job_id=job["id"],
        )
        completed_job = complete_regeneration_job(
            job["id"],
            result_json={
                "content_item_id": job["content_item_id"],
                "new_version_id": version["id"],
                "new_version_number": version["version_number"],
                "status": "ready_for_review",
            },
        )
        return {
            "ok": True,
            "status": "completed",
            "note": "regenerated",
            "content_item_id": job["content_item_id"],
            "job_id": job["id"],
            "version": version,
            "job": completed_job,
        }
    except Exception as exc:  # noqa: BLE001
        failed_job = fail_regeneration_job(
            job["id"],
            error=str(exc),
            attempt_count=int(job.get("attempt_count") or 1),
        )
        return {
            "ok": False,
            "status": "failed",
            "note": "regeneration_failed",
            "error": str(exc),
            "job": failed_job,
        }


handler_map: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "embed.ingest": handle_embed_ingest,
    "ghl.social.plan": handle_ghl_social_plan,
    "ghl.social.schedule": handle_ghl_social_schedule,
    "ghl.social.publish": handle_ghl_social_publish,
    "content.ai.regenerate": handle_content_ai_regenerate,
}
