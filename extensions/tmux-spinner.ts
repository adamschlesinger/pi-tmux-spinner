/**
 * Tmux Spinner Extension
 *
 * Animates the tmux window name while the agent is working, then
 * restores it cleanly when done. Silently skips if not in tmux.
 *
 * Lifecycle:
 *   agent_start      → start spinner
 *   agent_end        → stop spinner, strip prefix, restore clean name
 *   session_shutdown → stop spinner (handles Ctrl-C / reload)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";

const FRAMES = ["·", "✢", "✳", "✶", "✻", "✽"] as const;
const FRAME_RE = /^[·✢✳✶✻✽] /;
const INTERVAL_MS = 150;

// ── tmux helpers (async, non-blocking) ─────────────────────────────────────

function tmuxGet(target: string, format: string): Promise<string> {
  return new Promise((resolve) => {
    exec(`tmux display-message -p -t '${target}' '${format}'`, (err, stdout) =>
      resolve(err ? "" : stdout.trim()),
    );
  });
}

function tmuxRenameWindow(winId: string, name: string): void {
  // Escape single quotes in the window name so the shell command is valid.
  const safe = name.replace(/'/g, "'\\''");
  exec(`tmux rename-window -t '${winId}' '${safe}'`);
}

// ── extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Skip entirely when not inside tmux.
  if (!process.env.TMUX || !process.env.TMUX_PANE) return;

  const paneId = process.env.TMUX_PANE;
  let winId = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let frameIndex = 0;
  let running = false;

  // Resolve the window ID once; re-resolve on each agent_start in case the
  // user moved the pane to a different window between sessions.
  async function resolveWinId(): Promise<void> {
    winId = await tmuxGet(paneId, "#{window_id}");
  }

  // ── spinner loop (recursive setTimeout so ticks never overlap) ─────────

  async function tick(): Promise<void> {
    if (!running || !winId) return;

    const frame = FRAMES[frameIndex % FRAMES.length];
    frameIndex++;

    const curr = await tmuxGet(winId, "#{window_name}");
    if (curr) {
      const base = curr.replace(FRAME_RE, "");
      tmuxRenameWindow(winId, `${frame} ${base}`);
    }

    if (running) {
      timer = setTimeout(() => void tick(), INTERVAL_MS);
    }
  }

  // ── public controls ────────────────────────────────────────────────────

  function startSpinner(): void {
    if (!winId || running) return;
    running = true;
    frameIndex = 0;
    void tick();
  }

  function stopSpinner(): void {
    running = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    frameIndex = 0;

    if (!winId) return;

    // Strip spinner prefix from whatever the current window name is.
    // Read async then write; tiny window where a stale frame could land but
    // it self-corrects on the next user interaction / tmux_rename_window call.
    exec(`tmux display-message -p -t '${winId}' '#{window_name}'`, (err, stdout) => {
      if (err || !stdout.trim()) return;
      const clean = stdout.trim().replace(FRAME_RE, "");
      tmuxRenameWindow(winId, clean);
    });
  }

  // ── event hooks ────────────────────────────────────────────────────────

  pi.on("agent_start", async (_event, _ctx) => {
    await resolveWinId();
    startSpinner();
  });

  pi.on("agent_end", async (_event, _ctx) => {
    stopSpinner();
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    stopSpinner();
  });
}
