
from __future__ import annotations
from typing import Dict, List, Optional
import subprocess, tempfile, os, pathlib, re

def _run_git(args: List[str], cwd: Optional[str] = None) -> str:
    p = subprocess.run(["git"] + args, cwd=cwd, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {p.stderr.strip()}")
    return p.stdout

def is_git_available() -> bool:
    try:
        subprocess.run(["git","--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return True
    except Exception:
        return False

def detect_repo_root(start_path: str) -> Optional[str]:
    try:
        out = _run_git(["rev-parse","--show-toplevel"], cwd=start_path)
        return out.strip()
    except Exception:
        return None

def unified_file_diff(repo_path: str, ref_a: str, ref_b: str, file_path: str, context: int = 3, algorithm: str = "patience") -> Dict:
    """
    Return {"format":"git_unified","hunks":[{"header":str,"lines":[str,...]}]}
    Uses: git -C repo diff --unified=N --diff-algorithm=ALGO ref_a ref_b -- path
    """
    args = [
        "-C", repo_path, "diff",
        f"--unified={context}",
        f"--diff-algorithm={algorithm}",
        "--find-renames","--find-copies",
        ref_a, ref_b, "--", file_path
    ]
    out = _run_git(args)
    hunks = []
    header = ""
    lines = []
    for ln in out.splitlines():
        if ln.startswith("@@"):
            if lines:
                hunks.append({"header": header, "lines": lines})
                lines = []
            header = ln
        elif ln.startswith("diff --git "):
            # boundary between files; ignore, single file expected
            continue
        elif ln.startswith("index ") or ln.startswith("--- ") or ln.startswith("+++ "):
            continue
        else:
            lines.append(ln)
    if header or lines:
        hunks.append({"header": header, "lines": lines})
    return {"format":"git_unified","hunks":hunks}

def word_diff_porcelain(repo_path: str, ref_a: str, ref_b: str, file_path: str, algorithm: str = "patience") -> Dict:
    """
    Return {"format":"git_word_porcelain","chunks":[{"type":"ctx|add|del","text":str}], "header": str}
    Uses: git -C repo diff --word-diff=porcelain --diff-algorithm=ALGO ref_a ref_b -- path
    """
    args = [
        "-C", repo_path, "diff",
        "--word-diff=porcelain",
        f"--diff-algorithm={algorithm}",
        "--find-renames","--find-copies",
        ref_a, ref_b, "--", file_path
    ]
    out = _run_git(args)
    # parse porcelain tokens: {+added+} [-deleted-] context plain text otherwise
    # We strip diff headers; keep only the content after the ---/+++ lines.
    content_started = False
    stream = ""
    for ln in out.splitlines(keepends=True):
        if not content_started:
            if ln.startswith("--- "):
                content_started = True
            continue
        stream += ln

    tokens = []
    i = 0
    while i < len(stream):
        if stream.startswith("{+", i):
            j = stream.find("+}", i+2)
            if j == -1: break
            tokens.append({"type":"add","text":stream[i+2:j]})
            i = j+2
        elif stream.startswith("[-", i):
            j = stream.find("-]", i+2)
            if j == -1: break
            tokens.append({"type":"del","text":stream[i+2:j]})
            i = j+2
        else:
            # read until next marker
            next_add = stream.find("{+", i)
            next_del = stream.find("[-", i)
            nxt = min([p for p in [next_add, next_del] if p != -1], default=len(stream))
            tokens.append({"type":"ctx","text":stream[i:nxt]})
            i = nxt
    return {"format":"git_word_porcelain","chunks":tokens}

def best_git_diff(repo_path: str, ref_a: str, ref_b: str, file_path: str, context: int = 3, algorithm: str = "patience", mode: str = "auto") -> Dict:
    """
    mode:
      - "unified": only unified
      - "word": word diff porcelain
      - "auto": prefer word diff for texty files; fallback to unified
    """
    ext = pathlib.Path(file_path).suffix.lower()
    try:
        if mode == "word" or (mode == "auto" and ext in {".cls",".js",".ts",".css",".md",".txt",".java",".py",".json",".xml",".html"}):
            return word_diff_porcelain(repo_path, ref_a, ref_b, file_path, algorithm=algorithm)
    except Exception:
        pass
    # fallback unified
    return unified_file_diff(repo_path, ref_a, ref_b, file_path, context=context, algorithm=algorithm)
