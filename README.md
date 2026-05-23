# pi-tmux-spinner

A [pi coding agent](https://pi.dev) extension that animates the tmux window name while the agent is working, then restores it cleanly when done.

## Demo

While pi is processing, your tmux window title cycles through:

```
· pi spinner extension
✢ pi spinner extension
✳ pi spinner extension
✶ pi spinner extension
✻ pi spinner extension
✽ pi spinner extension
```

When the agent finishes, the window name is restored cleanly (stripping the spinner prefix).

## Install

```bash
pi install git:gitea.necro.gg/adam/pi-tmux-spinner
```

Or from npm (if published):

```bash
pi install npm:pi-tmux-spinner
```

## Requirements

- [pi coding agent](https://pi.dev)
- tmux (the extension silently skips if `$TMUX` / `$TMUX_PANE` are not set)

## How it works

The extension hooks into two pi lifecycle events:

| Event | Action |
|---|---|
| `agent_start` | Begin cycling spinner frames in the tmux window name |
| `agent_end` | Stop cycling, strip the prefix, restore the clean name |
| `session_shutdown` | Stop cycling on Ctrl-C / reload (no zombie processes) |

Each tick re-reads the current window name before writing, so pi's own
`tmux_rename_window` tool calls are always respected — the spinner just
wraps whatever name is currently set.

## Compatibility with pi-tmux-rename

Works alongside [`pi-tmux-rename`](https://www.npmjs.com/package/pi-tmux-rename). The spinner wraps the current
window name each frame, so topic renames from `pi-tmux-rename` are
picked up automatically.

## License

MIT
