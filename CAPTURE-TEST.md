# CAPTURE-TEST

Result: capture works. Three separate Claude Code sessions each wrote a prompt and a response to `.agent-logs/` with no manual step. The hook fires on its own in every session, not only the one that created it.

## 1. Tool and model

| Item | Value |
|---|---|
| Tool | Claude Code, run from the Claude desktop app (Code tab, Local environment) |
| Model | `claude-sonnet-5-5` (Claude Sonnet 5.5). One model plans and executes; no separate planner is configured. |
| OS | Windows 10 (Git Bash reports `MINGW64_NT-10.0-19045`) |
| Local folder | `C:\Users\Admin\Desktop\Cartora` |
| Hook mechanism available | Yes: Claude Code lifecycle hooks in `.claude/settings.json` |

## 2. Mechanism

- Config file changed: `.claude/settings.json`
- `UserPromptSubmit` runs `capture.py prompt`, which writes the prompt verbatim.
- `Stop` runs `capture.py stop`, which reads the session transcript and writes only the final assistant text of the turn.
- Script: `.claude/hooks/capture.py`. It never writes thinking, tool calls or intermediate steps.
- Hook command used by the sessions below (commit `8e59700`): `python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/capture.py" <mode> || python "$CLAUDE_PROJECT_DIR/.claude/hooks/capture.py" <mode>`

## 3. Log files the canaries landed in

All in `.agent-logs/`, one file per session:

| Session | File |
|---|---|
| 1 | `2026-10-23_21-58-13_cc0f1651-ace3-4f87-8a10-db423beab252.md` |
| 2 | `2026-10-23_22-05-49_29ec614a-2156-47fe-b078-e8e3c445fa43.md` |
| 3 | `2026-10-23_22-09-50_5da2264b-4b03-4360-952e-e2e6d91a7a4c.md` |

File names use UTC. 21:58 UTC is 03:28 IST on 24 Oct 2026.

## 4. Canary entries, raw

Copied verbatim from `cat .agent-logs/*.md`. The committed files are the source of truth.

### Session 1 (`cc0f1651`)

```
[LOG_ENTRY type=PROMPT num=1 session=cc0f1651]
timestamp: 2026-10-23T21:58:13.051Z
model: unknown

CAPTURE TEST — 8x assignment, vishakha mane


[LOG_ENTRY type=RESPONSE num=1 session=cc0f1651]
timestamp: 2026-10-23T21:58:20.711Z
model: claude-sonnet-5-5

Capture test received. I haven't run any commands or changed any files for this message.

If the prompt/response hook is working, this exchange should now be logged in `.agent-logs`. I haven't checked that directory, so I can't confirm it from here. I can look at the latest log entry if you'd like.
```

### Session 2 (`29ec614a`)

```
[LOG_ENTRY type=PROMPT num=1 session=29ec614a]
timestamp: 2026-10-23T22:05:49.342Z
model: unknown

CAPTURE TEST — 8x assignment, vishakha mane


[LOG_ENTRY type=RESPONSE num=1 session=29ec614a]
timestamp: 2026-10-23T22:05:54.934Z
model: claude-sonnet-5-5

Capture test received. Nothing was changed or run.
```

Session 3 (`5da2264b`) is a further canary with the same prompt; its entries are in its file.

## 5. Known limitation

`model: unknown` appears on the first PROMPT of a session. The `UserPromptSubmit` hook input does not include the model, and no assistant message exists yet to read it from. The `RESPONSE` entry carries the real model, so a mid-build model switch is still visible. Prompts after the first in a session read the model from the transcript.

## 6. What did not work first

- **First setup in the wrong place.** I first set up the hook in a cloud workspace with no repo. A hook there only captures sessions that run there, so it proved nothing for local sessions.
- **Bash-only command under Windows.** The first hook command was `python3 "$CLAUDE_PROJECT_DIR/..."` with no fallback. Windows `python3` is the Microsoft Store stub ("Python was not found"), so I added the `|| python` fallback, plus UTF-8 stdin handling and LF line endings, in commit `8e59700`.
- **Two copies of the repo.** The app session used `Desktop\Cartora`, while my checks ran in `Documents\Cartora`. The logs were in the Desktop copy and I first looked in the wrong folder.
- **A shell-neutral command change (`c237970`) was untested** in the app and was reverted. The command that worked is the one in `8e59700`.
