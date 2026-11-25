#!/usr/bin/env python3
"""Compile a UICreator HTML preview view into a Craftland Studio .ui draft asset via MCP.

Pipeline:
1. Run extract_craftland_plan.mjs (Playwright headless Chromium at 1500x750) to produce a
   deterministic craftland-ui-entity-plan/v2 JSON.
2. Resolve and validate all texture fileIds against <project_root>/Assets/**/*.png.meta
   and built-in lib://fftextures/WorkshopIconLibrary/... references.
3. In live mode (without --dry-run), connect to Craftland Studio's Streamable HTTP MCP
   server, create or update Assets/HUDs/_Draft/<Name>Draft.ui one entity at a time
   (preserving names, parent hierarchy, Y-up RectTransforms, fillType, tint, and text styles),
   save the asset, and audit the created entities via asset-get.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import tomllib
from typing import Any
import urllib.error
import urllib.request

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from build_gallery import detect_craftland_project_root


def slug_to_pascal_draft(slug: str) -> str:
    parts = [p for p in re.split(r"[-_\s]+", slug.strip()) if p]
    base = "".join(p[:1].upper() + p[1:] for p in parts) or "Preview"
    return base if base.endswith("Draft") else f"{base}Draft"


class CraftlandMcpClient:
    """Minimal stdlib Streamable HTTP MCP client for Craftland Studio."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.session_id: str | None = None
        self._req_id = 0

    def _post(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-03-26",
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        req = urllib.request.Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                self.session_id = resp.headers.get("Mcp-Session-Id") or self.session_id
                body = resp.read().decode("utf-8")
                ctype = resp.headers.get("Content-Type", "")
        except urllib.error.URLError as exc:
            raise RuntimeError(
                f"Cannot reach Craftland Studio MCP at {self.url} ({exc}). "
                "Please open Craftland Studio on the project first."
            ) from exc

        if not body.strip():
            return None
        if "text/event-stream" in ctype or body.lstrip().startswith("event:") or body.lstrip().startswith("data:"):
            data_lines = [
                line[5:].strip()
                for line in body.splitlines()
                if line.startswith("data:") and line[5:].strip()
            ]
            return json.loads(data_lines[-1]) if data_lines else None
        return json.loads(body)

    def rpc(self, method: str, params: dict[str, Any]) -> Any:
        self._req_id += 1
        msg = self._post({"jsonrpc": "2.0", "id": self._req_id, "method": method, "params": params})
        if msg is None:
            raise RuntimeError(f"Empty MCP response for {method}")
        if "error" in msg:
            err = msg["error"]
            err_msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
            raise RuntimeError(f"MCP {method} error: {err_msg}")
        return msg.get("result")

    def initialize(self) -> None:
        self.rpc(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "uicreator-craftland-exporter", "version": "2.0"},
            },
        )
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})

    def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        result = self.rpc("tools/call", {"name": name, "arguments": arguments})
        if not isinstance(result, dict):
            raise RuntimeError(f"Unexpected MCP response from {name}: {result}")
        if result.get("isError"):
            text = "".join(c.get("text", "") for c in result.get("content", []) if isinstance(c, dict))
            raise RuntimeError(f"Craftland MCP tool {name} failed: {text or result}")
        if result.get("structuredContent") is not None:
            return result["structuredContent"]
        values: list[Any] = []
        for item in result.get("content", []):
            if not isinstance(item, dict) or item.get("type") != "text":
                continue
            raw_text = item.get("text", "")
            try:
                values.append(json.loads(raw_text))
            except json.JSONDecodeError:
                values.append(raw_text)
        return values[0] if len(values) == 1 else values


class McpNotDetectedError(RuntimeError):
    """Raised when no Craftland Studio MCP server URL can be auto-detected."""


def _extract_url_from_mcp_mapping(servers: Any) -> str | None:
    """Extract a Craftland/Studio HTTP MCP URL from a dict of MCP server entries."""
    if not isinstance(servers, dict):
        return None

    def _entry_url(srv: Any) -> str | None:
        if not isinstance(srv, dict):
            return None
        for field in ("url", "serverUrl", "httpUrl"):
            val = srv.get(field)
            if isinstance(val, str) and val.strip():
                return val.strip()
        return None

    # Prefer Craftland / Studio / SpeedyRace named servers first
    priority_terms = ("craftland", "speedyrace", "studio")
    for key, srv in servers.items():
        if any(term in str(key).lower() for term in priority_terms):
            found = _entry_url(srv)
            if found:
                return found

    for srv in servers.values():
        found = _entry_url(srv)
        if found:
            return found
    return None


def discover_mcp_info(project_root: Path, override: str | None = None) -> tuple[str | None, str | None]:
    """Resolve (mcp_url, source_label) from override, env, .mcp.json, .codex, .cursor, .vscode, .craftland, or ~/.claude.json."""
    if override and override.strip():
        return override.strip(), "override"

    for env_key in ("CRAFTLAND_MCP_URL", "SPEEDYRACE_MCP_URL"):
        env_val = os.environ.get(env_key, "").strip()
        if env_val:
            return env_val, f"env:{env_key}"

    json_candidates = [
        (project_root / ".mcp.json", ".mcp.json"),
        (project_root / ".cursor" / "mcp.json", ".cursor/mcp.json"),
        (project_root / ".vscode" / "mcp.json", ".vscode/mcp.json"),
        (project_root / ".craftland" / "mcp.json", ".craftland/mcp.json"),
    ]
    for cfg_path, label in json_candidates:
        if not cfg_path.is_file():
            continue
        try:
            data = json.loads(cfg_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict):
            continue
        for top_key in ("mcpServers", "servers"):
            found = _extract_url_from_mcp_mapping(data.get(top_key))
            if found:
                return found, label
        direct_url = data.get("url") or data.get("serverUrl")
        if isinstance(direct_url, str) and direct_url.strip():
            return direct_url.strip(), label

    codex_cfg = project_root / ".codex" / "config.toml"
    if codex_cfg.is_file():
        try:
            with codex_cfg.open("rb") as f:
                data = tomllib.load(f)
            found = _extract_url_from_mcp_mapping(data.get("mcp_servers"))
            if found:
                return found, ".codex/config.toml"
        except (OSError, tomllib.TOMLDecodeError):
            pass

    claude_cfg = Path.home() / ".claude.json"
    if claude_cfg.is_file():
        try:
            data = json.loads(claude_cfg.read_text(encoding="utf-8"))
            norm_root = project_root.resolve().as_posix().lower()
            for proj_path, proj_obj in (data.get("projects") or {}).items():
                if str(proj_path).replace("\\", "/").rstrip("/").lower() == norm_root and isinstance(proj_obj, dict):
                    found = _extract_url_from_mcp_mapping(proj_obj.get("mcpServers"))
                    if found:
                        return found, "~/.claude.json"
        except (OSError, json.JSONDecodeError):
            pass

    return None, None


def discover_mcp_url(project_root: Path, override: str | None = None) -> str:
    """Resolve Craftland Studio MCP URL or raise McpNotDetectedError."""
    url, _ = discover_mcp_info(project_root, override=override)
    if url:
        return url
    raise McpNotDetectedError(
        f"No Craftland Studio MCP server detected for project {project_root.as_posix()}. "
        "Please provide a Craftland MCP URL (--mcp-url or CRAFTLAND_MCP_URL) and target output directory (--ui-directory)."
    )


def discover_ui_directories(project_root: Path) -> list[str]:
    """Find existing Craftland UI asset folders under Assets/ to suggest as output directories."""
    suggestions: list[str] = []
    seen: set[str] = set()

    def _add(rel_dir: str) -> None:
        norm = rel_dir.replace("\\", "/").strip("/")
        if norm and norm.lower() not in seen:
            seen.add(norm.lower())
            suggestions.append(norm)

    assets_dir = project_root / "Assets"
    if assets_dir.is_dir():
        for ui_path in sorted(assets_dir.rglob("*.ui")):
            if ui_path.is_file():
                try:
                    rel = ui_path.parent.resolve().relative_to(project_root.resolve()).as_posix()
                    _add(rel)
                except ValueError:
                    pass
        for common in ("Assets/HUDs/_Draft", "Assets/HUDs", "Assets/UI/_Draft", "Assets/UI"):
            if (project_root / common).is_dir():
                _add(common)

    _add("Assets/HUDs/_Draft")
    return suggestions


def save_mcp_url_to_project(project_root: Path, mcp_url: str, server_name: str = "craftland_studio") -> Path:
    """Save or update the Craftland MCP URL inside <project_root>/.mcp.json without clobbering other servers."""
    cfg_path = project_root / ".mcp.json"
    data: dict[str, Any] = {}
    if cfg_path.is_file():
        try:
            loaded = json.loads(cfg_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                data = loaded
        except (OSError, json.JSONDecodeError):
            data = {}

    servers = data.get("mcpServers")
    if not isinstance(servers, dict):
        servers = {}
        data["mcpServers"] = servers

    existing_entry = servers.get(server_name)
    if isinstance(existing_entry, dict):
        existing_entry["url"] = mcp_url.strip()
        existing_entry.setdefault("type", "http")
    else:
        servers[server_name] = {"type": "http", "url": mcp_url.strip()}

    cfg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return cfg_path


def build_project_texture_index(project_root: Path) -> dict[str, Any]:
    """Index all Assets/**/*.png.meta fileIds and lib:// fileIds from existing .ui files."""
    by_rel_path: dict[str, dict[str, Any]] = {}
    by_filename: dict[str, list[dict[str, Any]]] = {}
    by_snake_stem: dict[str, list[dict[str, Any]]] = {}
    lib_file_ids: dict[str, str] = {}

    ws_id_file = _SCRIPTS_DIR / "workshop_icon_library_ids.json"
    if ws_id_file.is_file():
        try:
            loaded_ws = json.loads(ws_id_file.read_text(encoding="utf-8"))
            if isinstance(loaded_ws, dict):
                for k, v in loaded_ws.items():
                    if isinstance(k, str) and isinstance(v, str):
                        lib_file_ids[k] = v
        except (OSError, json.JSONDecodeError):
            pass

    assets_dir = project_root / "Assets"
    if assets_dir.is_dir():
        for meta_path in sorted(assets_dir.rglob("*.meta")):
            if not meta_path.is_file():
                continue
            png_path = Path(str(meta_path)[:-5])
            if not png_path.is_file() or png_path.suffix.lower() != ".png":
                continue
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(meta, dict):
                continue
            file_id = str(meta.get("fileId") or "").strip()
            if not file_id:
                continue
            rel_posix = png_path.resolve().relative_to(project_root.resolve()).as_posix()
            b_top = max(0, int(meta.get("borderTop", 0) or 0))
            b_right = max(0, int(meta.get("borderRight", 0) or 0))
            b_bottom = max(0, int(meta.get("borderBottom", 0) or 0))
            b_left = max(0, int(meta.get("borderLeft", 0) or 0))
            slice_9 = [b_top, b_right, b_bottom, b_left] if (b_top or b_right or b_bottom or b_left) else None

            entry = {
                "fileId": file_id,
                "assetPath": rel_posix,
                "slice9": slice_9,
            }
            by_rel_path[rel_posix.lower()] = entry
            by_filename.setdefault(png_path.name.lower(), []).append(entry)

            s1 = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", png_path.stem)
            s2 = re.sub(r"([a-zA-Z])([0-9]+)", r"\1_\2", s1)
            snake = re.sub(r"[^a-zA-Z0-9]+", "_", s2.lower()).strip("_")
            by_snake_stem.setdefault(snake, []).append(entry)

        # Also harvest known lib://fftextures/... fileIds from existing .ui files
        for ui_path in sorted(assets_dir.rglob("*.ui")):
            if not ui_path.is_file():
                continue
            try:
                raw_ui = ui_path.read_text(encoding="utf-8")
            except OSError:
                continue
            for m in re.finditer(
                r'"fileId"\s*:\s*"([^"]+)"\s*,\s*"filePath"\s*:\s*"(lib://[^"]+)"',
                raw_ui,
            ):
                lib_file_ids[m.group(2)] = m.group(1)

    return {
        "by_rel_path": by_rel_path,
        "by_filename": by_filename,
        "by_snake_stem": by_snake_stem,
        "lib_file_ids": lib_file_ids,
    }


def resolve_plan_textures_on_disk(plan: dict[str, Any], project_root: Path) -> list[dict[str, Any]]:
    """Resolve and validate every image/button texture reference in plan against project_root."""
    tex_index = build_project_texture_index(project_root)
    by_rel_path = tex_index["by_rel_path"]
    by_filename = tex_index["by_filename"]
    by_snake_stem = tex_index["by_snake_stem"]
    lib_file_ids = tex_index["lib_file_ids"]

    warnings: list[dict[str, Any]] = list(plan.get("warnings") or [])

    def resolve_ref(comp: dict[str, Any], entity_name: str) -> None:
        raw_path = str(comp.get("assetPath") or "").replace("\\", "/").strip()
        raw_slice_id = str(comp.get("sliceId") or "").strip()
        raw_file_id = str(comp.get("fileId") or "").strip()

        # 1. Built-in WorkshopIconLibrary (lib://fftextures/WorkshopIconLibrary/...)
        if raw_path.startswith("lib://") or "workshopiconlibrary/" in raw_path.lower():
            if not raw_path.startswith("lib://"):
                fname = Path(raw_path).name
                raw_path = f"lib://fftextures/WorkshopIconLibrary/{fname}"
            comp["assetPath"] = raw_path
            known_id = lib_file_ids.get(raw_path)
            if known_id:
                comp["fileId"] = known_id
            else:
                comp["fileId"] = None
                warnings.append(
                    {
                        "type": "unverified-workshop-texture",
                        "entity": entity_name,
                        "sliceId": raw_slice_id,
                        "assetPath": raw_path,
                        "message": f'Texture "{raw_path}" on entity "{entity_name}" is not in the built-in OB51 lib://fftextures/WorkshopIconLibrary catalog; prefer a real project Assets/Sprites/ texture.',
                    }
                )
            return

        # 2. Exact relative path match under Assets/
        norm_rel = re.sub(r"^(\.\./)+", "", raw_path)
        if norm_rel.lower() in by_rel_path:
            hit = by_rel_path[norm_rel.lower()]
            comp["fileId"] = hit["fileId"]
            comp["assetPath"] = hit["assetPath"]
            return

        # 3. Match by filename
        if norm_rel:
            fname = Path(norm_rel).name.lower()
            if fname in by_filename and by_filename[fname]:
                hit = by_filename[fname][0]
                comp["fileId"] = hit["fileId"]
                comp["assetPath"] = hit["assetPath"]
                return

        # 4. Match by sliceId (stripping optional sr_ prefix)
        candidate_stems = []
        if raw_slice_id:
            candidate_stems.append(raw_slice_id.lower())
            if raw_slice_id.lower().startswith("sr_"):
                candidate_stems.append(raw_slice_id[3:].lower())
        if norm_rel:
            stem_raw = Path(norm_rel).stem
            if stem_raw.lower().startswith("sr_"):
                stem_raw = stem_raw[3:]
            candidate_stems.append(stem_raw.lower())

        for stem_key in candidate_stems:
            if stem_key in by_snake_stem and by_snake_stem[stem_key]:
                hit = by_snake_stem[stem_key][0]
                comp["fileId"] = hit["fileId"]
                comp["assetPath"] = hit["assetPath"]
                return

        if not comp.get("fileId"):
            warnings.append(
                {
                    "type": "unresolved-texture",
                    "entity": entity_name,
                    "sliceId": raw_slice_id,
                    "assetPath": raw_path,
                    "message": f'Could not resolve Craftland fileId for entity "{entity_name}" (sliceId={raw_slice_id!r}, path={raw_path!r}).',
                }
            )

    for ent in plan.get("entities") or []:
        if not isinstance(ent, dict):
            continue
        ename = str(ent.get("name") or ent.get("id") or "Widget")
        if isinstance(ent.get("image"), dict):
            resolve_ref(ent["image"], ename)
        if isinstance(ent.get("button"), dict):
            resolve_ref(ent["button"], ename)

    plan["warnings"] = warnings
    return warnings


def _find_node_exe() -> str:
    """Resolve node executable from PATH or standard Windows install locations."""
    import shutil

    found = shutil.which("node")
    if found:
        return found
    for cand in (
        Path(r"C:\Program Files\nodejs\node.exe"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "nodejs" / "node.exe",
    ):
        if cand.is_file():
            return str(cand)
    return "node"


def extract_plan_with_playwright(
    page_path: Path,
    view_id: str | None,
    width: int,
    height: int,
    out_plan_path: Path,
) -> dict[str, Any]:
    """Invoke extract_craftland_plan.mjs to extract the rendered DOM into out_plan_path."""
    extractor_script = _SCRIPTS_DIR / "extract_craftland_plan.mjs"
    if not extractor_script.is_file():
        raise FileNotFoundError(f"Extractor script not found: {extractor_script}")

    cmd = [
        _find_node_exe(),
        str(extractor_script),
        "--page",
        str(page_path),
        "--width",
        str(width),
        "--height",
        str(height),
        "--out",
        str(out_plan_path),
    ]
    if view_id:
        cmd.extend(["--view", view_id])

    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(
            f"extract_craftland_plan.mjs failed (exit {proc.returncode}):\n{proc.stderr or proc.stdout}"
        )
    return json.loads(out_plan_path.read_text(encoding="utf-8"))


def _extract_result_id(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("id", "entityId", "assetId", "fileId"):
            if isinstance(value.get(key), str) and value[key].strip():
                return value[key].strip()
        for child in value.values():
            try:
                return _extract_result_id(child)
            except LookupError:
                pass
    if isinstance(value, list):
        for child in value:
            try:
                return _extract_result_id(child)
            except LookupError:
                pass
    raise LookupError(f"No id found in Craftland MCP response: {value!r}")


def _find_created_entity_id(
    client: CraftlandMcpClient,
    ui_id: str,
    parent_id: str,
    temp_name: str,
    create_resp: Any,
) -> str:
    """Resolve the entityId of a newly created widget via asset-entity-search (matching UIDemo/studio-build-notes.md)."""
    try:
        found = client.call_tool(
            "asset-entity-search",
            {
                "assetId": ui_id,
                "parentId": parent_id,
                "name": temp_name,
                "fields": "brief",
                "pageSize": 5,
            },
        )
        if isinstance(found, dict):
            results = found.get("results")
            if isinstance(results, list) and results:
                first = results[0]
                if isinstance(first, dict) and isinstance(first.get("id"), str):
                    return first["id"]
            headers = found.get("headers")
            contents = found.get("contents")
            if isinstance(headers, list) and isinstance(contents, list) and contents and "id" in headers:
                idx = headers.index("id")
                row = contents[0]
                if isinstance(row, list) and idx < len(row) and isinstance(row[idx], str):
                    return row[idx]
    except Exception:
        pass
    return _extract_result_id(create_resp)


def _resolve_mcp_texture_source(
    client: CraftlandMcpClient,
    comp: dict[str, Any],
    cache: dict[str, Any],
) -> Any:
    """Resolve texture fileId for image.source / button.spriteName via Craftland MCP asset-get."""
    asset_path = str(comp.get("assetPath") or "").strip()
    file_id = str(comp.get("fileId") or "").strip()
    cache_key = asset_path or file_id
    if cache_key and cache_key in cache:
        return cache[cache_key]

    if asset_path:
        try:
            res = client.call_tool("asset-get", {"assetId": asset_path, "withEntities": "false"})
            resolved_id = _extract_result_id(res)
            if resolved_id:
                cache[cache_key] = resolved_id
                return resolved_id
        except Exception:
            pass

    if file_id:
        try:
            res = client.call_tool("asset-get", {"assetId": file_id, "withEntities": "false"})
            resolved_id = _extract_result_id(res)
            if resolved_id:
                cache[cache_key] = resolved_id
                return resolved_id
        except Exception:
            pass

    return None


def apply_plan_to_craftland_mcp(
    plan: dict[str, Any],
    client: CraftlandMcpClient,
    ui_directory: str,
    ui_name: str,
    take_snapshot: bool = False,
) -> dict[str, Any]:
    """Create or update <ui_directory>/<ui_name>.ui in Craftland Studio via MCP."""
    ui_rel_path = f"{ui_directory.rstrip('/')}/{ui_name}.ui"
    ui_id: str | None = None
    root_id: str | None = None

    # Check if the target Draft .ui asset already exists in Craftland Studio
    try:
        existing = client.call_tool("asset-get", {"assetId": ui_rel_path, "withEntities": "true"})
        if isinstance(existing, dict):
            ui_id = _extract_result_id(existing)
            entities_list = existing.get("entities") or []
            for ent in entities_list:
                if isinstance(ent, dict) and ent.get("entityType") == "UIRootEntity":
                    root_id = ent.get("id")
                    break
            # Clear existing direct children of UIRootEntity so re-exporting is clean & idempotent
            if ui_id and root_id:
                direct_child_ids = [
                    ent["id"]
                    for ent in entities_list
                    if isinstance(ent, dict)
                    and ent.get("parentId") == root_id
                    and isinstance(ent.get("id"), str)
                ]
                for cid in direct_child_ids:
                    client.call_tool(
                        "asset-entity-remove",
                        {"assetId": ui_id, "entityId": cid},
                    )
    except Exception:
        ui_id = None
        root_id = None

    if not ui_id or not root_id:
        created = client.call_tool("ui-create", {"directoryPath": ui_directory, "name": ui_name})
        ui_id = _extract_result_id(created)
        asset_info = client.call_tool("asset-get", {"assetId": ui_id, "withEntities": "true"})
        if not isinstance(asset_info, dict) or not isinstance(asset_info.get("entities"), list):
            raise RuntimeError(f"Could not read entities of newly created UI asset {ui_id}: {asset_info}")
        root_id = next(
            (e["id"] for e in asset_info["entities"] if isinstance(e, dict) and e.get("entityType") == "UIRootEntity"),
            None,
        )
        if not root_id:
            raise RuntimeError(f"No UIRootEntity found in newly created UI asset {ui_id}")

    plan_entities = plan.get("entities") or []
    plan_root = next((e for e in plan_entities if isinstance(e, dict) and e.get("entityType") == "UIRootEntity"), None)
    if not plan_root:
        raise RuntimeError("Plan JSON is missing UIRootEntity")

    id_map: dict[str, str] = {str(plan_root["id"]): root_id}
    tex_cache: dict[str, Any] = {}
    created_count = 0
    mcp_warnings: list[str] = []

    for ent in plan_entities:
        if not isinstance(ent, dict) or ent.get("entityType") == "UIRootEntity":
            continue

        plan_ent_id = str(ent["id"])
        plan_parent_id = str(ent.get("parentId") or plan_root["id"])
        parent_id = id_map.get(plan_parent_id, root_id)
        entity_type = str(ent.get("entityType") or "UIEmptyEntity")
        final_name = str(ent.get("name") or "Widget")
        temp_name = f"uic_{plan_ent_id}"

        create_resp = client.call_tool(
            "asset-entity-create",
            {
                "assetId": ui_id,
                "parentId": parent_id,
                "type": entity_type,
                "name": temp_name,
            },
        )
        created_id = _find_created_entity_id(client, ui_id, parent_id, temp_name, create_resp)
        id_map[plan_ent_id] = created_id
        created_count += 1

        tf = ent.get("transform") or {}
        props: dict[str, Any] = {
            "name": final_name,
            "transform.anchorMin": tf.get("anchorMin", {"x": 0, "y": 0}),
            "transform.anchorMax": tf.get("anchorMax", {"x": 0, "y": 0}),
            "transform.pivot": tf.get("pivot", {"x": 0, "y": 0}),
            "transform.sizeDelta": tf.get("sizeDelta", {"x": 100, "y": 100}),
            "transform.anchoredPosition": tf.get("anchoredPosition", {"x": 0, "y": 0}),
            "transform.rotate": tf.get("rotate", 0),
            "alpha": int(round(float(ent.get("alpha", 100)))),
            "priority": int(ent.get("priority", 0)),
        }

        if entity_type == "UITextEntity" and isinstance(ent.get("text"), dict):
            t = ent["text"]
            align = t.get("alignment") or {}
            has_shadow = bool(t.get("shadow", False) or t.get("outline", False))
            shadow_col = str(t.get("shadowColor") or t.get("outlineColor") or "#000000")
            props.update(
                {
                    "text.value": str(t.get("value") or " "),
                    "text.font": "Default",
                    "text.fontSize": int(round(float(t.get("fontSize", 24)))),
                    "text.color": str(t.get("color") or "#FFFFFF"),
                    "text.alignment.h": str(align.get("h") or "center"),
                    "text.alignment.v": str(align.get("v") or "middle"),
                    "text.shadow": has_shadow,
                    "text.shadowColor": shadow_col,
                    "text.overflow": int(t.get("overflow", 0)),
                }
            )

        elif entity_type == "UIImageEntity" and isinstance(ent.get("image"), dict):
            img = ent["image"]
            props["image.color"] = str(img.get("color") or "#FFFFFF")
            props["image.fillType"] = int(img.get("fillType", 0))
            rev = img.get("reverse")
            if isinstance(rev, dict):
                if rev.get("x"):
                    props["image.reverse.x"] = True
                if rev.get("y"):
                    props["image.reverse.y"] = True

            src_val = _resolve_mcp_texture_source(client, img, tex_cache)
            if src_val:
                props["image.source"] = src_val
            else:
                mcp_warnings.append(
                    f'Widget "{final_name}" texture could not be resolved in Craftland Studio (path={img.get("assetPath")!r}).'
                )

        elif entity_type == "UIButtonEntity" and isinstance(ent.get("button"), dict):
            btn = ent["button"]
            props["button.normal"] = str(btn.get("normal") or "#FFFFFF")
            props["button.highlight"] = str(btn.get("highlight") or "#FFFFFF")
            props["button.pressed"] = str(btn.get("pressed") or "#C5C5C5")
            props["button.disabled"] = str(btn.get("disabled") or "#808080")
            props["button.fillType"] = int(btn.get("fillType", 1))
            props["button.disableCollider"] = bool(btn.get("disableCollider", False))

            src_val = _resolve_mcp_texture_source(client, btn, tex_cache)
            if src_val:
                props["button.spriteName"] = src_val

        try:
            client.call_tool(
                "asset-entity-update",
                {"assetId": ui_id, "entityIds": created_id, "properties": props},
            )
        except Exception as exc:
            # If image.source / button.spriteName failed (e.g. lib:// texture id format), retry without texture and warn
            if "image.source" in props or "button.spriteName" in props:
                fallback_props = {
                    k: v for k, v in props.items() if k not in ("image.source", "button.spriteName")
                }
                client.call_tool(
                    "asset-entity-update",
                    {"assetId": ui_id, "entityIds": created_id, "properties": fallback_props},
                )
                mcp_warnings.append(
                    f'Widget "{final_name}" created, but texture assignment failed via MCP ({exc}).'
                )
            else:
                raise

    client.call_tool("asset-save", {"assetId": ui_id})

    # Readback audit via asset-get
    audit_info = client.call_tool("asset-get", {"assetId": ui_id, "withEntities": "true"})
    verified_entities = len(audit_info.get("entities") or []) if isinstance(audit_info, dict) else (created_count + 1)

    snapshot_bytes: bytes | None = None
    if take_snapshot:
        try:
            client.call_tool("asset-open", {"assetId": ui_rel_path})
            time.sleep(1.0)
            client.call_tool("asset-get", {"assetId": ui_id, "withEntities": "true"})
            raw_snap = client.rpc("tools/call", {"name": "ui-snapshot", "arguments": {}})
            if isinstance(raw_snap, dict):
                for item in raw_snap.get("content", []):
                    if isinstance(item, dict) and item.get("type") == "image" and item.get("data"):
                        snapshot_bytes = base64.b64decode(item["data"])
                        break
        except Exception as exc:
            mcp_warnings.append(f"ui-snapshot skipped/failed: {exc}")

    return {
        "uiId": ui_id,
        "uiPath": ui_rel_path,
        "createdWidgets": created_count,
        "verifiedEntityCount": verified_entities,
        "mcpWarnings": mcp_warnings,
        "snapshotBytes": snapshot_bytes,
    }


def run_export_pipeline(
    page_path: Path,
    project_root: Path | None = None,
    view_id: str | None = None,
    ui_name: str | None = None,
    ui_directory: str = "Assets/HUDs/_Draft",
    mcp_url_override: str | None = None,
    width: int = 1500,
    height: int = 750,
    plan_out_path: Path | None = None,
    existing_plan_path: Path | None = None,
    dry_run: bool = False,
    take_snapshot: bool = False,
    save_mcp_config: bool = False,
) -> dict[str, Any]:
    """End-to-end orchestration for CLI and Studio server POST /api/export-craftland-ui."""
    resolved_page = page_path.resolve()
    resolved_proj = (
        project_root.resolve()
        if project_root
        else (detect_craftland_project_root(resolved_page) or Path.cwd().resolve())
    )
    slug = resolved_page.parent.name
    target_ui_name = (ui_name or "").strip() or slug_to_pascal_draft(slug)
    if target_ui_name.lower().endswith(".ui"):
        target_ui_name = target_ui_name[:-3]

    clean_ui_directory = str(ui_directory or "").replace("\\", "/").strip().strip("/")
    if not clean_ui_directory:
        clean_ui_directory = "Assets/HUDs/_Draft"

    # Fail fast before Playwright extraction in live mode if no Craftland MCP is configured
    mcp_url: str | None = None
    if not dry_run:
        mcp_url = discover_mcp_url(resolved_proj, override=mcp_url_override)

    if existing_plan_path and existing_plan_path.is_file():
        plan = json.loads(existing_plan_path.read_text(encoding="utf-8"))
        out_plan = existing_plan_path.resolve()
    else:
        view_tag = (view_id or "active").strip() or "active"
        out_plan = (
            plan_out_path.resolve()
            if plan_out_path
            else (resolved_page.parent / "verification" / f"{view_tag}.craftland-plan.json").resolve()
        )
        plan = extract_plan_with_playwright(
            page_path=resolved_page,
            view_id=view_id,
            width=width,
            height=height,
            out_plan_path=out_plan,
        )

    warnings = resolve_plan_textures_on_disk(plan, resolved_proj)
    out_plan.parent.mkdir(parents=True, exist_ok=True)
    out_plan.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")

    try:
        plan_rel = out_plan.relative_to(resolved_proj).as_posix()
    except ValueError:
        plan_rel = out_plan.as_posix()

    ui_rel_path = f"{clean_ui_directory}/{target_ui_name}.ui"
    entity_count = len(plan.get("entities") or [])

    if dry_run:
        return {
            "dryRun": True,
            "uiId": None,
            "uiName": target_ui_name,
            "uiPath": ui_rel_path,
            "view": plan.get("view"),
            "entityCount": entity_count,
            "planPath": plan_rel,
            "warnings": warnings,
        }

    assert mcp_url is not None
    client = CraftlandMcpClient(mcp_url)
    client.initialize()

    saved_mcp_path: str | None = None
    if save_mcp_config and mcp_url_override and mcp_url_override.strip():
        try:
            saved_path = save_mcp_url_to_project(resolved_proj, mcp_url)
            saved_mcp_path = saved_path.relative_to(resolved_proj).as_posix()
        except Exception:
            saved_mcp_path = None

    mcp_res = apply_plan_to_craftland_mcp(
        plan=plan,
        client=client,
        ui_directory=clean_ui_directory,
        ui_name=target_ui_name,
        take_snapshot=take_snapshot,
    )
    all_warnings = list(warnings) + [{"type": "mcp-warning", "message": w} for w in mcp_res.get("mcpWarnings", [])]

    snapshot_rel: str | None = None
    snap_bytes = mcp_res.get("snapshotBytes")
    if isinstance(snap_bytes, (bytes, bytearray)) and snap_bytes:
        snap_out = out_plan.parent / f"{plan.get('view') or 'active'}.craftland-snapshot.png"
        snap_out.write_bytes(snap_bytes)
        try:
            snapshot_rel = snap_out.relative_to(resolved_proj).as_posix()
        except ValueError:
            snapshot_rel = snap_out.as_posix()

    return {
        "dryRun": False,
        "mcpUrl": mcp_url,
        "savedMcpPath": saved_mcp_path,
        "uiId": mcp_res["uiId"],
        "uiName": target_ui_name,
        "uiPath": mcp_res["uiPath"],
        "view": plan.get("view"),
        "entityCount": mcp_res["verifiedEntityCount"],
        "planPath": plan_rel,
        "warnings": all_warnings,
        "snapshotPath": snapshot_rel,
    }


def _prompt_for_mcp_and_output_dir(
    project_root: Path,
    current_ui_directory: str | None,
) -> tuple[str, str, bool]:
    """Interactively prompt the user for a Craftland MCP URL and target output directory."""
    print(
        f"\n[!] No Craftland Studio MCP configuration was detected in {project_root.as_posix()}.",
        file=sys.stderr,
    )
    print(
        "    Looked in: .mcp.json, .codex/config.toml, .cursor/mcp.json, .vscode/mcp.json, .craftland/mcp.json, ~/.claude.json",
        file=sys.stderr,
    )

    try:
        mcp_url = input("Enter Craftland Studio MCP URL (e.g. http://127.0.0.1:xxxx/mcp): ").strip()
    except EOFError:
        mcp_url = ""
    if not mcp_url:
        raise McpNotDetectedError("Export cancelled: no Craftland Studio MCP URL was provided.")

    if current_ui_directory and current_ui_directory.strip():
        chosen_dir = current_ui_directory.strip()
    else:
        suggested = discover_ui_directories(project_root)
        default_dir = suggested[0] if suggested else "Assets/HUDs/_Draft"
        if len(suggested) > 1:
            print(f"    Detected UI folders: {', '.join(suggested[:6])}", file=sys.stderr)
        try:
            raw_dir = input(f"Enter target output directory [{default_dir}]: ").strip()
        except EOFError:
            raw_dir = ""
        chosen_dir = raw_dir or default_dir

    save_cfg = False
    try:
        ans = input("Save this MCP URL to .mcp.json for future exports? [y/N]: ").strip().lower()
        save_cfg = ans in ("y", "yes")
    except EOFError:
        save_cfg = False

    return mcp_url, chosen_dir, save_cfg


def main() -> int:
    parser = argparse.ArgumentParser(description="Export a UICreator HTML preview view to a Craftland Studio .ui draft via MCP.")
    parser.add_argument("--page", required=True, help="Path to preview index.html (e.g. Tools/ui-previews/checkpoint-reward/index.html).")
    parser.add_argument("--view", default=None, help="Target [data-ui-view] ID to export (defaults to active view).")
    parser.add_argument("--ui-name", default=None, help="Target Craftland UI asset name (defaults to <PascalSlug>Draft).")
    parser.add_argument(
        "--ui-directory",
        default=None,
        help="Target Craftland output directory (prompted if no MCP is detected; default: Assets/HUDs/_Draft).",
    )
    parser.add_argument("--project-root", default=None, help="Explicit Craftland project root (auto-detected when omitted).")
    parser.add_argument("--mcp-url", default=None, help="Override Craftland Studio MCP URL.")
    parser.add_argument("--save-mcp", action="store_true", help="Save --mcp-url into <project_root>/.mcp.json after connecting.")
    parser.add_argument("--non-interactive", action="store_true", help="Fail without prompting if no MCP URL is detected.")
    parser.add_argument("--width", type=int, default=1500, help="Canvas width in Craftland units (default: 1500).")
    parser.add_argument("--height", type=int, default=750, help="Canvas height in Craftland units (default: 750).")
    parser.add_argument("--plan", default=None, help="Optional output path for the extracted craftland-ui-entity-plan/v2 JSON.")
    parser.add_argument("--use-plan", default=None, help="Skip Playwright extraction and use an existing plan JSON file.")
    parser.add_argument("--dry-run", action="store_true", help="Extract plan and verify texture fileIds offline without connecting to Craftland MCP.")
    parser.add_argument("--snapshot", action="store_true", help="Open the created .ui asset and capture a ui-snapshot via MCP.")
    args = parser.parse_args()

    resolved_page = Path(args.page).resolve()
    resolved_proj = (
        Path(args.project_root).resolve()
        if args.project_root
        else (detect_craftland_project_root(resolved_page) or Path.cwd().resolve())
    )
    mcp_url_override = args.mcp_url
    ui_directory = args.ui_directory
    save_mcp = bool(args.save_mcp)

    if not args.dry_run:
        detected_url, _ = discover_mcp_info(resolved_proj, override=mcp_url_override)
        if not detected_url:
            if sys.stdin.isatty() and not args.non_interactive:
                try:
                    mcp_url_override, ui_directory, prompt_save = _prompt_for_mcp_and_output_dir(
                        resolved_proj, ui_directory
                    )
                    save_mcp = save_mcp or prompt_save
                except McpNotDetectedError as exc:
                    print(f"[ERROR] {exc}", file=sys.stderr)
                    return 2
            else:
                print(
                    f"[ERROR] No Craftland Studio MCP server detected for project {resolved_proj.as_posix()}.\n"
                    "Please ask the user for:\n"
                    "  1. Craftland Studio MCP URL (--mcp-url \"http://127.0.0.1:<port>/mcp\")\n"
                    "  2. Target output directory (--ui-directory \"Assets/HUDs/_Draft\")",
                    file=sys.stderr,
                )
                return 2

    res = run_export_pipeline(
        page_path=resolved_page,
        project_root=resolved_proj,
        view_id=args.view,
        ui_name=args.ui_name,
        ui_directory=ui_directory or "Assets/HUDs/_Draft",
        mcp_url_override=mcp_url_override,
        width=args.width,
        height=args.height,
        plan_out_path=Path(args.plan) if args.plan else None,
        existing_plan_path=Path(args.use_plan) if args.use_plan else None,
        dry_run=args.dry_run,
        take_snapshot=args.snapshot,
        save_mcp_config=save_mcp,
    )

    if res["dryRun"]:
        print(
            f"[DRY-RUN OK] View '{res['view']}' -> {res['entityCount']} Craftland entities "
            f"(target: {res['uiPath']}, plan: {res['planPath']})"
        )
    else:
        print(
            f"[EXPORT OK] Created & saved {res['uiPath']} (assetId: {res['uiId']}, "
            f"entities: {res['entityCount']}, plan: {res['planPath']})"
        )
        if res.get("savedMcpPath"):
            print(f"[INFO] Saved MCP URL to {res['savedMcpPath']}")

    if res["warnings"]:
        print(f"Warnings ({len(res['warnings'])}):")
        for w in res["warnings"]:
            msg = w.get("message") if isinstance(w, dict) else str(w)
            print(f"  - {msg}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
