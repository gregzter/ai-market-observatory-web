#!/usr/bin/env python3
"""Refresh public current OpenRouter/Kilo catalog projection from their public APIs."""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "router-catalogs.json"
SOURCES = {
    "openrouter": "https://openrouter.ai/api/v1/models?output_modalities=all",
    "kilo": "https://api.kilo.ai/api/gateway/models",
}
EXPLICIT_FREE_IDS = {"openrouter/free", "kilo-auto/free", "kilo/auto-free", "kilo-auto/auto-free"}


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "AI-Market-Observatory-Web/1.0",
    })
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def number(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def per_million(value):
    n = number(value)
    return None if n is None else round(n * 1_000_000, 12)


def explicit_free(model_id: str):
    if model_id in EXPLICIT_FREE_IDS:
        return True, "EXPLICIT_FREE_ROUTER"
    if model_id.lower().endswith(":free"):
        return True, "EXPLICIT_FREE_VARIANT"
    return False, None


def normalize(gateway: str, row: dict, source_url: str):
    model_id = row.get("id")
    if not isinstance(model_id, str) or not model_id:
        return None
    pricing = row.get("pricing") if isinstance(row.get("pricing"), dict) else {}
    arch = row.get("architecture") if isinstance(row.get("architecture"), dict) else {}
    top = row.get("top_provider") if isinstance(row.get("top_provider"), dict) else {}
    free_now, free_basis = explicit_free(model_id)
    owner = row.get("owned_by") or (model_id.split("/", 1)[0] if "/" in model_id else None)
    item = {
        "gateway": gateway,
        "model_id": model_id,
        "name": row.get("name") or model_id,
        "owned_by": owner,
        "context_length": row.get("context_length"),
        "max_completion_tokens": top.get("max_completion_tokens") or row.get("max_completion_tokens"),
        "input_modalities": arch.get("input_modalities") or row.get("input_modalities"),
        "output_modalities": arch.get("output_modalities") or row.get("output_modalities"),
        "prompt_per_1m": per_million(pricing.get("prompt")),
        "completion_per_1m": per_million(pricing.get("completion")),
        "cache_read_per_1m": per_million(pricing.get("input_cache_read")),
        "cache_write_per_1m": per_million(pricing.get("input_cache_write")),
        "request_price": number(pricing.get("request")),
        "image_price": number(pricing.get("image")),
        "web_search_price": number(pricing.get("web_search")),
        "free_now": free_now,
        "free_basis": free_basis,
        "expiration_date": row.get("expiration_date"),
        "source_url": source_url,
    }
    return {k: v for k, v in item.items() if v is not None}


def main():
    checked = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    models = []
    gateway_summary = {}
    for gateway, url in SOURCES.items():
        raw = fetch_json(url)
        rows = raw.get("data") if isinstance(raw, dict) else raw
        if not isinstance(rows, list):
            raise SystemExit(f"Unexpected {gateway} catalog shape")
        normalized = [normalize(gateway, r, url) for r in rows if isinstance(r, dict)]
        normalized = [r for r in normalized if r]
        if not normalized:
            raise SystemExit(f"Empty {gateway} catalog")
        models.extend(normalized)
        gateway_summary[gateway] = {
            "model_count": len(normalized),
            "free_model_count": sum(1 for r in normalized if r.get("free_now")),
            "qwen_model_count": sum(1 for r in normalized if "qwen" in f"{r.get('model_id','')} {r.get('name','')} {r.get('owned_by','')}".lower()),
            "source_url": url,
        }
    models.sort(key=lambda r: (r["gateway"], r["model_id"]))
    payload = {
        "schema_version": "1.0.0",
        "checked_at": checked,
        "gateways": gateway_summary,
        "totals": {
            "catalog_entries": len(models),
            "unique_model_ids": len({r["model_id"] for r in models}),
            "free_entries": sum(1 for r in models if r.get("free_now")),
            "qwen_entries": sum(1 for r in models if "qwen" in f"{r.get('model_id','')} {r.get('name','')} {r.get('owned_by','')}".lower()),
        },
        "models": models,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"checked_at": checked, **payload["totals"], "gateways": gateway_summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
