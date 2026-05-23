# pi-tmux-spinner

A [pi coding agent](https://pi.dev) extension that animates the tmux window name while the agent is working, then restores it cleanly when done.

## Demo

While pi is processing, your tmux window title cycles through a configurable animation:

```
· pi spinner extension
✢ pi spinner extension
✳ pi spinner extension
```

When the agent finishes, the window name is restored cleanly.

## Install

```bash
pi install git:github.com/adamschlesinger/pi-tmux-spinner
```

Or from npm (if published):

```bash
pi install npm:pi-tmux-spinner
```

## Requirements

- [pi coding agent](https://pi.dev)
- tmux (the extension silently skips if `$TMUX` / `$TMUX_PANE` are not set)

## Configuration

Use the `/tmux-spinner` command to configure at runtime. Settings persist to `~/.pi/agent/tmux-spinner.json`.

```
/tmux-spinner                    Show current config
/tmux-spinner list               List all styles with previews
/tmux-spinner style <name>       Set animation style
/tmux-spinner speed <value>      Set speed: slow | normal | fast
/tmux-spinner enable             Enable the spinner
/tmux-spinner disable            Disable the spinner
```

### Styles

| Name | Preview |
|------|---------|
| `default` | · ✢ ✳ ✶ ✻ ✽ |
| `braille` | ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏ |
| `dots` | ⣾ ⣽ ⣻ ⢿ ⡿ ⣟ ⣯ ⣷ |
| `classic` | - \ \| / |
| `arrows` | ← ↖ ↑ ↗ → ↘ ↓ ↙ |
| `pipe` | ┤ ┘ ┴ └ ├ ┌ ┬ ┐ |
| `star` | ✶ ✸ ✹ ✺ ✹ ✸ |
| `moon` | 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 |
| `pulse` | · • ● • |

### Speeds

| Name | Interval |
|------|----------|
| `slow` | 300ms |
| `normal` | 150ms (default) |
| `fast` | 80ms |

## How it works

The extension hooks into pi lifecycle events:

| Event | Action |
|---|---|
| `agent_start` | Begin cycling spinner frames in the tmux window name |
| `agent_end` | Stop cycling, strip prefix, restore the clean name |
| `session_shutdown` | Stop on Ctrl-C / reload (no zombie processes) |

Each tick re-reads the current window name before writing, so pi's own
`tmux_rename_window` tool calls are always respected — the spinner just
wraps whatever name is currently set.

## Compatibility with pi-tmux-rename

Works alongside [`pi-tmux-rename`](https://www.npmjs.com/package/pi-tmux-rename). Topic renames are picked up automatically on the next spinner tick.

## License

MIT
