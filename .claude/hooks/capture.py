#!/usr/bin/env python3
"""Append the user's prompt and the final response of each turn to .agent-logs/.

Usage (wired in .claude/settings.json):
    capture.py prompt   # UserPromptSubmit: logs the prompt verbatim
    capture.py stop     # Stop: logs the final response of the turn

Only the prompt and the final assistant text are written. No thinking,
tool calls or intermediate steps. Failures go to stderr and never block the turn.
"""
import glob
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

AUTHOR = "vishakhatiti"
PROJECT = "cartora"
TOOL = "claude-code"
ENTRY_RE = re.compile(r"^\[LOG_ENTRY type=(PROMPT|RESPONSE) num=(\d+) session=\S+\]$", re.M)


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
        f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def breadcrumb(message):
    """Diagnostics outside the repo so they never ship: shows whether the hook ran at all."""
    try:
        with open(Path.home() / ".cartora-capture-debug.log", "a", encoding="utf-8", newline="\n") as fh:
            fh.write(f"{now_iso()} {message}\n")
    except Exception:
        pass


def log_dir():
    root = os.environ.get("CLAUDE_PROJECT_DIR") or str(Path(__file__).resolve().parents[2])
    path = os.path.join(root, ".agent-logs")
    os.makedirs(path, exist_ok=True)
    return path


def find_session_file(directory, session_id):
    matches = glob.glob(os.path.join(directory, f"*_{session_id}.md"))
    return matches[0] if matches else None


def read_transcript(path):
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


def is_real_user_prompt(row):
    if row.get("type") != "user":
        return False
    content = row.get("message", {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return any(b.get("type") == "text" for b in content if isinstance(b, dict)) and \
            not any(b.get("type") == "tool_result" for b in content if isinstance(b, dict))
    return False


def final_response(rows):
    """Text of the last assistant message after the last real user prompt."""
    last_prompt_idx = -1
    for i, row in enumerate(rows):
        if is_real_user_prompt(row) and not row.get("isSidechain"):
            last_prompt_idx = i
    tail = [r for r in rows[last_prompt_idx + 1:]
            if r.get("type") == "assistant" and not r.get("isSidechain")]
    if not tail:
        return None, None
    last_id = tail[-1].get("message", {}).get("id")
    texts, model = [], None
    for row in tail:
        msg = row.get("message", {})
        if msg.get("id") != last_id:
            continue
        model = msg.get("model") or model
        content = msg.get("content")
        if isinstance(content, str):
            texts.append(content)
        else:
            texts.extend(b.get("text", "") for b in content or []
                         if isinstance(b, dict) and b.get("type") == "text")
    text = "\n".join(t for t in texts if t).strip()
    return (text or None), model


def update_front_matter(content, session_id, **fields):
    """Refresh only the header counters; log entries are never touched."""
    head, sep, body = content.partition("\n---\n\n# Session Log")
    if not sep:
        return content
    for key, value in fields.items():
        head = re.sub(rf"^{key}: .*$", f"{key}: {value}", head, flags=re.M)
    return head + sep + body


def new_session_file(directory, session_id, model, ts):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    path = os.path.join(directory, f"{stamp}_{session_id}.md")
    short = session_id[:8]
    header = (
        "---\n"
        f"session_id: {session_id}\n"
        f"date: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}\n"
        f"author: {AUTHOR}\n"
        f"model: {model}\n"
        f"tool: {TOOL}\n"
        f"project: {PROJECT}\n"
        "total_exchanges: 0\n"
        f"first_prompt_time: {ts}\n"
        f"last_prompt_time: {ts}\n"
        "---\n\n"
        f"# Session Log - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}\n\n"
        f"Session: `{short}` | Project: `{PROJECT}` | Author: `{AUTHOR}`\n\n"
        "---\n"
    )
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header)
    return path


def current_model(data):
    return data.get("model") or os.environ.get("ANTHROPIC_MODEL") or "unknown"


def model_from_transcript(path):
    try:
        for row in reversed(read_transcript(path)):
            m = row.get("message", {}).get("model") if row.get("type") == "assistant" else None
            if m:
                return m
    except Exception:
        pass
    return None


def handle_prompt(data):
    session_id = data["session_id"]
    prompt = data.get("prompt", "")
    ts = now_iso()
    directory = log_dir()
    path = find_session_file(directory, session_id)
    model = (model_from_transcript(data["transcript_path"]) if data.get("transcript_path") else None) \
        or current_model(data)
    if not path:
        path = new_session_file(directory, session_id, model, ts)
    with open(path, encoding="utf-8") as fh:
        content = fh.read()
    num = len(re.findall(r"type=PROMPT", content)) + 1
    entry = (
        f"\n[LOG_ENTRY type=PROMPT num={num} session={session_id[:8]}]\n"
        f"timestamp: {ts}\n"
        f"model: {model}\n\n"
        f"{prompt}\n\n"
    )
    content += entry
    content = update_front_matter(content, session_id, last_prompt_time=ts,
                                  total_exchanges=num, model=model)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)


def handle_stop(data):
    session_id = data["session_id"]
    directory = log_dir()
    path = find_session_file(directory, session_id)
    if not path:
        return
    with open(path, encoding="utf-8") as fh:
        content = fh.read()
    prompts = len(re.findall(r"type=PROMPT", content))
    responses = len(re.findall(r"type=RESPONSE", content))
    if prompts == 0 or responses >= prompts:
        return  # already logged this turn's response
    text, model = None, None
    for _ in range(10):  # the transcript can lag the hook by a moment
        try:
            text, model = final_response(read_transcript(data["transcript_path"]))
        except Exception:
            text = None
        if text:
            break
        time.sleep(0.3)
    if not text:
        sys.stderr.write("capture: no final response found in transcript\n")
        return
    entry = (
        f"\n[LOG_ENTRY type=RESPONSE num={prompts} session={session_id[:8]}]\n"
        f"timestamp: {now_iso()}\n"
        f"model: {model or current_model(data)}\n\n"
        f"{text}\n\n"
    )
    with open(path, "a", encoding="utf-8", newline="\n") as fh:
        fh.write(entry)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    breadcrumb(f"{mode} invoked cwd={os.getcwd()} project_dir={os.environ.get('CLAUDE_PROJECT_DIR')}")
    try:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        if mode == "prompt":
            handle_prompt(data)
        elif mode == "stop":
            handle_stop(data)
    except Exception as exc:  # never block the user's turn
        breadcrumb(f"{mode} FAILED: {exc!r}")
        sys.stderr.write(f"capture: {mode} failed: {exc!r}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
