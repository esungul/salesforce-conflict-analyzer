# component_registry.py
from __future__ import annotations
import os
from functools import lru_cache
from typing import Optional, TypedDict, Literal,Iterable
import yaml  # pip install pyyaml
import re
from urllib.parse import unquote
import logging
reglog = logging.getLogger("component_registry")



Kind = Literal["single_file", "bundle"]
Domain = Literal["salesforce", "vlocity"]

GUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


class TypeInfo(TypedDict, total=False):
    domain: Domain
    kind: Kind
    folders: list[str]          # for single_file
    exts: list[str]             # for single_file
    folder_roots: list[str]     # for bundle
    primary_glob: str           # for bundle
    strip_type_prefix: bool

CONFIG_PATH = os.getenv("COMPONENT_TYPES_CONFIG", "component_types.yaml")
FEATURE_ON = os.getenv("FEATURE_COMPONENT_REGISTRY", "1").lower() in ("1", "true", "yes")

@lru_cache(maxsize=1)
def _load_cfg() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    cfg.setdefault("defaults", {})
    cfg.setdefault("types", {})
    return cfg

def _strip(name: str, tinfo: TypeInfo) -> str:
    n = name.strip()
    if (tinfo.get("strip_type_prefix")
        if "strip_type_prefix" in tinfo
        else _load_cfg().get("defaults", {}).get("strip_type_prefix", True)):
        if "." in n:
            n = n.split(".", 1)[1]
    for ext in tinfo.get("exts", []):
        if n.endswith(ext):
            n = n[: -len(ext)]
    return n

def get_type_info(component_type: str) -> Optional[TypeInfo]:
    if not FEATURE_ON:
        return None
    return _load_cfg()["types"].get((component_type or "").strip())

def is_bundle(component_type: str) -> bool:
    ti = get_type_info(component_type)
    return bool(ti and ti.get("kind") == "bundle")

def extract_guid(s: str) -> str | None:
    m = GUID_RE.search(s or "")
    return m.group(0) if m else None

def slugify(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s
# component_registry.py

def slugify_keep_underscore(s: str) -> str:
    s = (s or "").strip()
    s = s.replace(" ", "-")
    # keep letters, numbers, hyphens, underscores; collapse repeats of hyphen
    s = re.sub(r"[^A-Za-z0-9_-]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s






def vlocity_bundle_folder_candidates(component_type: str, component_name: str):
    ti = get_type_info(component_type)

    # Only log REG01 if type info is actually missing
    if not ti:
        reglog.info("[REG01] no type info: type=%s name=%s", component_type, component_name)
        return []

    if ti.get("kind") != "bundle":
        reglog.debug("[REG02] not bundle kind: type=%s", component_type)
        return []

    roots = (ti.get("folder_roots") or [])
    if not roots:
        reglog.info("[REG03] no folder_roots: type=%s", component_type)
        return []

    # 1) decode and strip "<Type>."
    raw_name = unquote(component_name or "")
    clean_name = _strip(raw_name, ti)  # e.g. "PRB2CAttributePricingMatrix v147" or "...-v147"

    # 2) split out version if present (handles either " v147" or "-v147"), case-insensitive
    m = re.search(r"[-\s]v(\d+)\s*$", clean_name, flags=re.I)
    ver_num = m.group(1) if m else None
    base_no_ver = clean_name[:m.start()].rstrip() if m else clean_name  # "PRB2CAttributePricingMatrix"

    # 3) prep pieces
    guid = extract_guid(clean_name)
    slug_no_ver = slugify(base_no_ver) if base_no_ver else None
    slug_full   = slugify(clean_name)
    
    ## --- OrchestrationItemDefinition: use the code inside trailing parentheses as folder, preserving underscores ---
    oid_code_folder = None
    if component_type == "OrchestrationItemDefinition":
        m_code = re.search(r"\(([^)]+)\)\s*$", clean_name)
        if m_code:
            # raw code (may contain spaces and underscores)
            oid_code_raw = m_code.group(1).strip()
            # preferred folder form: spaces -> hyphens, underscores kept
            oid_code_folder = slugify_keep_underscore(oid_code_raw)
    # --- PriceList: use the code inside trailing parentheses as folder ---
    pl_code_folder = None
    if component_type == "PriceList":
        m_pl = re.search(r"\(([^)]+)\)\s*$", clean_name)
        if m_pl:
            pl_code_folder = m_pl.group(1).strip()  # e.g., "PRB2C_PL"



    # 4) AttributeCategory: extract code in trailing parentheses, e.g. "(ATT_CAT_PRB2C_Mobile)"
    code_folder = None
    if component_type == "AttributeCategory":
        m_code = re.search(r"\(([^)]+)\)\s*$", clean_name)
        if m_code:
            code_folder = m_code.group(1).strip()  # -> "ATT_CAT_PRB2C_Mobile"

    bases = [r.rstrip("/") for r in roots]
    out, seen = [], set()

    reglog.info(
        "[REG10-imp] inputs: type=%s raw=%s clean=%s roots=%s guid=%s base_no_ver=%s ver=%s slug_no_ver=%s slug_full=%s code_folder=%s",
        component_type, raw_name, clean_name, bases, guid, base_no_ver, ver_num, slug_no_ver, slug_full, code_folder
    )

    for base in bases:
        # a) GUID-first if present
        if guid:
            cand = f"{base}/{guid}/"
            if cand not in seen:
                seen.add(cand); out.append(cand)

        # b) AttributeCategory: try code-in-parens folder FIRST
        if component_type == "AttributeCategory" and code_folder:
            cand = f"{base}/{code_folder}/"
            if cand not in seen:
                seen.add(cand); out.append(cand)

        
        # c) Versioned candidates (hyphen form preferred because repo uses it)
        if component_type == "CalculationMatrixVersion" and ver_num and base_no_ver:
            for cand in (
                f"{base}/{base_no_ver}-v{ver_num}/",
                f"{base}/{slug_no_ver}-v{ver_num}/" if slug_no_ver else None,
                f"{base}/{base_no_ver} v{ver_num}/",
                f"{base}/{slug_no_ver} v{ver_num}/" if slug_no_ver else None,
            ):
                if cand and cand not in seen:
                    seen.add(cand); out.append(cand)
        
        if component_type == "OrchestrationItemDefinition" and oid_code_folder:
            cand = f"{base}/{oid_code_folder}/"    # e.g., Assetize-MRC-Update_Wireless-Orchestration-Plan-to-Aria-MRC-Update/
            if cand not in seen:
                seen.add(cand); out.append(cand)

            # raw code as a fallback (API will URL-encode when calling Bitbucket)
            # e.g., "MultiLine Discount Charge - Wireless ... _Wireless Orchestration ..."
            cand = f"{base}/{m_code.group(1).strip()}/"
            if cand not in seen:
                seen.add(cand); out.append(cand)
        # --- PriceList: use the code inside trailing parentheses as folder ---
        
        # PriceList: code-in-parens folder FIRST
        if component_type == "PriceList" and pl_code_folder:
            cand = f"{base}/{pl_code_folder}/"
            if cand not in seen:
                seen.add(cand); out.append(cand)



        # d) Generic fallbacks
        for cand in (
            f"{base}/{slug_full}/" if slug_full else None,
            f"{base}/{clean_name}/" if clean_name else None,
        ):
            if cand and cand not in seen:
                seen.add(cand); out.append(cand)
            

    reglog.debug("[REG99] candidates: %s", out)
    print(f"I am catching {out}")  # keep your existing print if you want the quick console breadcrumb
    return out


def candidates_for_single_filebackup(component_name: str, component_type: str) -> list[str]:
    ti = get_type_info(component_type)
    if not ti or ti.get("kind") != "single_file":
        return []

    if component_type == "CustomMetadata":
        # Keep "<Object>.<Record>" intact. Remove only the leading "CustomMetadata." if present.
        base = component_name.strip()
        if base.startswith("CustomMetadata."):
            base = base[len("CustomMetadata."):]
    else:
        base = _strip(component_name, ti)  # your existing helper

    return [f"{fd}/{base}{ext}" for fd in ti.get("folders", []) for ext in ti.get("exts", [])]

def candidates_for_single_file(component_name: str, component_type: str) -> list[str]:
    ti = get_type_info(component_type)
    if not ti or ti.get("kind") != "single_file":
        return []

    # --- Special-cases kept simple and explicit ---
    if component_type == "CustomMetadata":
        # Keep "<Object>.<Record>" intact. Remove only the leading "CustomMetadata." if present.
        base = (component_name or "").strip()
        if base.startswith("CustomMetadata."):
            base = base[len("CustomMetadata."):]
        exts = ti.get("exts", [])
        folders = [f.rstrip("/") for f in ti.get("folders", [])]
        return [f"{fd}/{base}{ext}" for fd in folders for ext in exts]

    elif component_type == "CustomLabel":
        # All labels live in one file: CustomLabels.labels under known folders
        folders = [f.rstrip("/") for f in ti.get("folders", [])]
        filenames = ["CustomLabels.labels"]  # explicit, avoids relying on exts/base
        return [f"{fd}/{fn}" for fd in folders for fn in filenames]

    # --- Generic single-file types (existing behavior) ---
    base = _strip(component_name, ti)  # your existing helper
    exts = ti.get("exts", [""])
    folders = [f.rstrip("/") for f in ti.get("folders", [])]
    return [f"{fd}/{base}{ext}" for fd in folders for ext in exts]


def folder_for_bundle(component_name: str, component_type: str) -> Optional[str]:
    ti = get_type_info(component_type)
    if not ti or ti.get("kind") != "bundle":
        return None
    base = _strip(component_name, ti)
    roots = ti.get("folder_roots", [])
    if not roots:
        return None
    return f"{roots[0]}/{base}/"
