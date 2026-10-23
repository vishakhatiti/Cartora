#!/usr/bin/env python3
"""Append each prompt and its final response to .agent-logs/ (8x capture format).

Wired to two Claude Code hooks (see .claude/settings.json):
  UserPromptSubmit -> writes a PROMPT entry (the prompt, verbatim)
  Stop             -> writes a RESPONSE entry (the final reply of the turn)

Design rules:
  * Never break the session: every failure is swallowed, logged privately
    under .git/, and the script exits 0 with no stdout (stdout from a
    UserPromptSubmit hook would be injected into the model's context).
  * Log files are append-only. Only the front-matter counters are rewritten.
  * Repo root comes from this file's location, not from the session's cwd.
"""

import json
import re
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOG_DIR = REPO / ".agent-logs"
PRIVATE = REPO / ".git"  # never committed
PROJECT = "cartora"
AUTHOR = "vishakhatiti"
TOOL = "claude-code"
REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)


def now_iso():
    t = datetime.now(timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def private_log(name, text):
    try:
        with open(PRIVATE / name, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    except Exception:
        pass


def transcript_records(path):
    out = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    out.append(json.loads(line))
                except Exception:
                    continue
    except Exception:
        pass
    return out


def text_of(message):
    content = message.get("content")
    if isinstance(content, str):
        return content
    return "\n".join(b.get("text", "") for b in content or [] if b.get("type") == "text")


def last_model(records):
    for r in reversed(records):
        if r.get("type") == "assistant":
            m = (r.get("message") or {}).get("model")
            if m and not m.startswith("<"):
                return m
    return "unknown"


def final_response(records):
    """Text of the assistant message(s) after the last tool result / user turn."""
    parts = []
    for r in reversed(records):
        t = r.get("type")
        if t == "assistant":
            txt = text_of(r.get("message") or {}).strip()
            if txt:
                parts.append(txt)
            if any(b.get("type") == "tool_use" for b in (r.get("message") or {}).get("content") or []
                   if isinstance(b, dict)):
                break
        elif t == "user":
            break
    return "\n\n".join(reversed(parts))


def session_file(session_id, first_time):
    short = session_id[:8]
    existing = sorted(LOG_DIR.glob(f"*_{short}.md"))
    if existing:
        return existing[0], False
    stamp = first_time[:19].replace("T", "_").replace(":", "-")
    return LOG_DIR / f"{stamp}_{short}.md", True


def header(session_id, first, last, count, model):
    return (
        "---\n"
        f"session_id: {session_id}\n"
        f"date: {first[:10]}\n"
        f"author: {AUTHOR}\n"
        f"model: {model}\n"
        f"tool: {TOOL}\n"
        f"project: {PROJECT}\n"
        f"total_exchanges: {count}\n"
        f"first_prompt_time: {first}\n"
        f"last_prompt_time: {last}\n"
        "---\n\n"
        f"# Session Log - {first[:10]}\n\n"
        f"Session: `{session_id[:8]}` | Project: `{PROJECT}` | Author: `{AUTHOR}`\n\n"
        "---\n\n"
    )


def update_front_matter(path, **fields):
    text = path.read_text(encoding="utf-8")
    head, sep, rest = text.partition("\n---\n\n# Session Log")
    for key, value in fields.items():
        head = re.sub(rf"^{key}: .*$", f"{key}: {value}", head, flags=re.M)
    path.write_text(head + sep + rest, encoding="utf-8")


def append_entry(path, kind, num, session_id, ts, model, body):
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"[LOG_ENTRY type={kind} num={num} session={session_id[:8]}]\n")
        f.write(f"timestamp: {ts}\nmodel: {model}\n\n{body}\n\n\n")


def count(path, kind):
    return len(re.findall(rf"^\[LOG_ENTRY type={kind} ", path.read_text(encoding="utf-8"), flags=re.M))


def main():
    raw = sys.stdin.read()
    data = json.loads(raw)
    # Raw payloads are kept privately (inside .git, never committed) so the
    # real field names can be checked against what this script assumes.
    private_log("agent-capture-debug.jsonl", json.dumps({"seen": now_iso(), "payload": data}))

    event = data.get("hook_event_name")
    session_id = data.get("session_id") or "unknown-session"
    records = transcript_records(data.get("transcript_path", ""))
    LOG_DIR.mkdir(exist_ok=True)
    ts = now_iso()

    if event == "UserPromptSubmit":
        prompt = data.get("prompt")
        if prompt is None:
            raise KeyError(f"no 'prompt' field in payload; keys={sorted(data)}")
        prompt = REMINDER.sub("", prompt).strip("\n") if "<system-reminder>" in prompt else prompt
        model = last_model(records)
        path, created = session_file(session_id, ts)
        if created:
            path.write_text(header(session_id, ts, ts, 0, model), encoding="utf-8")
        num = count(path, "PROMPT") + 1
        append_entry(path, "PROMPT", num, session_id, ts, model, prompt)
        update_front_matter(path, total_exchanges=num, last_prompt_time=ts, model=model)

    elif event == "Stop":
        files = sorted(LOG_DIR.glob(f"*_{session_id[:8]}.md"))
        if not files:
            return
        path = files[0]
        prompts, responses = count(path, "PROMPT"), count(path, "RESPONSE")
        if responses >= prompts:
            return  # already answered, or a Stop with no matching prompt
        reply = data.get("last_assistant_message") or final_response(records)
        if not reply:
            raise ValueError("Stop fired but no final assistant text was found")
        append_entry(path, "RESPONSE", prompts, session_id, ts, last_model(records), reply)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        private_log("agent-capture-errors.log", f"[{now_iso()}] {traceback.format_exc()}")
    sys.exit(0)
