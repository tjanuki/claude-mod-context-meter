# context-meter

A Claude Code mod (hooks module) that shows how full the main conversation's context window
is after every turn and, past a threshold, tells you it is time to write a hand-off document
and start a new session. Everything is driven by the `session.measure` event.

- Status line: `ctx 42%`, and from the warn threshold on `⚠ ctx 74% · hand-off time`.
- Band above the prompt, from the warn threshold on:
  `Context 74% — write a hand-off doc and start a new session.` with a `Draft hand-off`
  button that submits the hand-off prompt. The line is yellow from the warn threshold and red
  from the urgent threshold.
- A toast the first time the fill crosses the warn threshold, and once more the first time it
  crosses the urgent threshold.
- `/ctx` prints the current fill and the thresholds.

## Configuration

Set in `/config`, or in settings under `pluginConfigs["context-meter"].options`:

| Key             | Default | Meaning                                           |
| --------------- | ------- | ------------------------------------------------- |
| `warnPercent`   | `70`    | Fill at which the status line and band warn       |
| `urgentPercent` | `85`    | Fill at which the band line turns red             |
| `handoffPrompt` | (below) | The prompt the `Draft hand-off` button submits    |

Default prompt: "Context is getting large. Write a hand-off document for this session
following the project's hand-off conventions, so a new session can continue from it."

## Run

`claude --plugin-dir /Users/tjanuki/Codes/claude-mod-context-meter`

Validate: `claude plugin validate .`
Test: `claude plugin test .`
