/**
 * Tmux Spinner Extension
 *
 * Animates the tmux window name while the agent is working, then
 * restores it cleanly when done. Silently skips if not in tmux.
 *
 * Commands:
 *   /tmux-spinner                  Show current config
 *   /tmux-spinner list             List available styles with previews
 *   /tmux-spinner style <name>     Set animation style
 *   /tmux-spinner speed <value>    Set speed: slow | normal | fast
 *   /tmux-spinner enable           Enable the spinner
 *   /tmux-spinner disable          Disable the spinner
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

// ── Styles ─────────────────────────────────────────────────────────────────

const STYLES: Record<string, string[]> = {
  default: ["·", "✢", "✳", "✶", "✻", "✽"],
  braille: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  dots:    ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
  classic: ["-", "\\", "|", "/"],
  arrows:  ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
  pipe:    ["┤", "┘", "┴", "└", "├", "┌", "┬", "┐"],
  star:    ["✶", "✸", "✹", "✺", "✹", "✸"],
  moon:    ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"],
  pulse:   ["·", "•", "●", "•"],
};

const SPEEDS: Record<string, number> = {
  slow:   300,
  normal: 150,
  fast:    80,
};

// ── Config ─────────────────────────────────────────────────────────────────

interface Config {
  style:   string;
  speed:   string;
  enabled: boolean;
}

const DEFAULTS: Config = { style: "default", speed: "normal", enabled: true };
const FRAME_RE = /^(\S+ )/; // strips leading "FRAME " prefix

function configPath(): string {
  return join(getAgentDir(), "tmux-spinner.json");
}

function loadConfig(): Config {
  const p = configPath();
  if (!existsSync(p)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(p, "utf-8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(cfg: Config): void {
  try {
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  } catch (err) {
    console.error("[tmux-spinner] failed to save config:", err);
  }
}

// ── Tmux helpers ───────────────────────────────────────────────────────────

function tmuxGet(target: string, format: string): Promise<string> {
  return new Promise((resolve) => {
    exec(`tmux display-message -p -t '${target}' '${format}'`, (err, stdout) =>
      resolve(err ? "" : stdout.trim()),
    );
  });
}

function tmuxRenameWindow(winId: string, name: string): void {
  const safe = name.replace(/'/g, "'\\''");
  exec(`tmux rename-window -t '${winId}' '${safe}'`);
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  if (!process.env.TMUX || !process.env.TMUX_PANE) return;

  const paneId = process.env.TMUX_PANE;
  let config: Config = loadConfig();
  let winId = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let frameIndex = 0;
  let running = false;

  async function resolveWinId(): Promise<void> {
    winId = await tmuxGet(paneId, "#{window_id}");
  }

  // ── Spinner loop ─────────────────────────────────────────────────────────

  async function tick(): Promise<void> {
    if (!running || !winId) return;

    const frames = STYLES[config.style] ?? STYLES.default;
    const frame = frames[frameIndex % frames.length];
    frameIndex++;

    const curr = await tmuxGet(winId, "#{window_name}");
    if (curr) {
      const base = curr.replace(FRAME_RE, "");
      tmuxRenameWindow(winId, `${frame} ${base}`);
    }

    if (running) {
      const ms = SPEEDS[config.speed] ?? SPEEDS.normal;
      timer = setTimeout(() => void tick(), ms);
    }
  }

  function startSpinner(): void {
    if (!config.enabled || !winId || running) return;
    running = true;
    frameIndex = 0;
    void tick();
  }

  function stopSpinner(): void {
    running = false;
    if (timer !== null) { clearTimeout(timer); timer = null; }
    frameIndex = 0;
    if (!winId) return;

    exec(`tmux display-message -p -t '${winId}' '#{window_name}'`, (err, stdout) => {
      if (err || !stdout.trim()) return;
      const clean = stdout.trim().replace(FRAME_RE, "");
      tmuxRenameWindow(winId, clean);
    });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  pi.on("agent_start", async (_event, _ctx) => {
    await resolveWinId();
    startSpinner();
  });

  pi.on("agent_end", async (_event, _ctx) => {
    stopSpinner();
  });

  pi.on("session_start", async (_event, _ctx) => {
    config = loadConfig();
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    stopSpinner();
  });

  // ── Command ───────────────────────────────────────────────────────────────

  const STYLE_NAMES = Object.keys(STYLES);
  const SPEED_NAMES = Object.keys(SPEEDS);
  const SUBCOMMANDS = ["style", "speed", "enable", "disable", "list"];

  pi.registerCommand("tmux-spinner", {
    description: "Configure the tmux window-name spinner",

    getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
      const parts = prefix.split(" ");

      if (parts.length <= 1) {
        // Completing first word
        return SUBCOMMANDS
          .filter((s) => s.startsWith(parts[0] ?? ""))
          .map((s) => ({ value: s, label: s }));
      }

      if (parts[0] === "style" && parts.length === 2) {
        return STYLE_NAMES
          .filter((s) => s.startsWith(parts[1] ?? ""))
          .map((s) => ({ value: `style ${s}`, label: s, description: STYLES[s]!.join(" ") }));
      }

      if (parts[0] === "speed" && parts.length === 2) {
        return SPEED_NAMES
          .filter((s) => s.startsWith(parts[1] ?? ""))
          .map((s) => ({ value: `speed ${s}`, label: s, description: `${SPEEDS[s]}ms` }));
      }

      return null;
    },

    handler: async (args, ctx) => {
      const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = parts[0];

      // Show current config
      if (!sub) {
        const frames = STYLES[config.style] ?? STYLES.default;
        const ms = SPEEDS[config.speed] ?? SPEEDS.normal;
        ctx.ui.notify(
          `tmux-spinner: ${config.enabled ? "enabled" : "disabled"} | ` +
          `style: ${config.style} (${frames.join(" ")}) | ` +
          `speed: ${config.speed} (${ms}ms)`,
          "info",
        );
        return;
      }

      if (sub === "list") {
        const lines = STYLE_NAMES.map(
          (name) => `  ${name.padEnd(10)} ${STYLES[name]!.join(" ")}`,
        );
        ctx.ui.notify("Available styles:\n" + lines.join("\n"), "info");
        return;
      }

      if (sub === "enable") {
        config.enabled = true;
        saveConfig(config);
        ctx.ui.notify("tmux-spinner: enabled", "info");
        return;
      }

      if (sub === "disable") {
        stopSpinner();
        config.enabled = false;
        saveConfig(config);
        ctx.ui.notify("tmux-spinner: disabled", "info");
        return;
      }

      if (sub === "style") {
        const name = parts[1];
        if (!name || !STYLES[name]) {
          ctx.ui.notify(`Unknown style "${name ?? ""}". Use /tmux-spinner list to see options.`, "error");
          return;
        }
        config.style = name;
        saveConfig(config);
        ctx.ui.notify(`tmux-spinner style set to: ${name} (${STYLES[name]!.join(" ")})`, "info");
        return;
      }

      if (sub === "speed") {
        const name = parts[1];
        if (!name || !SPEEDS[name]) {
          ctx.ui.notify(
            `Unknown speed "${name ?? ""}". Options: ${SPEED_NAMES.join(", ")}`,
            "error",
          );
          return;
        }
        config.speed = name;
        saveConfig(config);
        ctx.ui.notify(`tmux-spinner speed set to: ${name} (${SPEEDS[name]}ms)`, "info");
        return;
      }

      ctx.ui.notify(
        "Usage: /tmux-spinner [list | style <name> | speed slow|normal|fast | enable | disable]",
        "error",
      );
    },
  });
}
