# context-meter

A Claude Code mod (hooks module) that shows how full the main conversation's context window
is after every turn and, past a threshold, tells you it is time to write a hand-off document
and start a new session. It never compacts the conversation: the idea is to carry the work
over explicitly rather than let auto-compact summarise it late. Everything is driven by the
`session.measure` event, so there is no polling.

- Status line: `ctx 55%` from the show threshold on, and `⚠ ctx 74% · hand-off time` from
  the warn threshold on.
- Band above the prompt, from the warn threshold on:
  `Context 74% — write a hand-off doc and start a new session.` with a `Draft hand-off`
  button that submits the hand-off prompt. The line is yellow from the warn threshold and red
  from the urgent threshold.
- A toast the first time the fill crosses the warn threshold, and once more the first time it
  crosses the urgent threshold.
- `/ctx` prints the current fill and the thresholds.

## Install

Requires a Claude Code build with mod support (`claude plugin validate` must exist).

Clone the repo anywhere, then either load it for one session:

```
claude --plugin-dir /path/to/claude-mod-context-meter
```

or load it in every session by adding the path to the `env` block of
`~/.claude/settings.json` (several paths are separated with `:` on macOS and Linux):

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claude-mod-context-meter"
  }
}
```

The folder is watched, so edits reload the mod at the end of the current turn.

## Configuration

Set in `/config`, or in settings under `pluginConfigs["context-meter"].options`:

| Key             | Default | Meaning                                           |
| --------------- | ------- | ------------------------------------------------- |
| `showPercent`   | `50`    | Fill from which the status line shows the percent |
| `warnPercent`   | `70`    | Fill at which the status line and band warn       |
| `urgentPercent` | `85`    | Fill at which the band line turns red             |
| `handoffPrompt` | (below) | The prompt the `Draft hand-off` button submits    |

Default prompt: "Context is getting large. Write a hand-off document for this session
following the project's hand-off conventions, so a new session can continue from it."

## Develop

- Validate: `claude plugin validate .`
- Type-check: `tsc -p .` (the engine writes `.claude-plugin/types/` on first load)
- Test: `claude plugin test .`
