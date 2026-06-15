#!/usr/bin/env python3
"""
Dataset Lab — CLI runner
Usage:
    python datasetlab.py start    Start backend + frontend
    python datasetlab.py stop     Stop running servers
    python datasetlab.py status   Show server status
    python datasetlab.py open     Open the app in your browser
    python datasetlab.py logs     Tail live server logs
"""

import os
import sys

# Force UTF-8 encoding for standard output and error to avoid UnicodeEncodeError on Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)
except Exception:
    pass

import builtins
_orig_print = builtins.print
def _safe_print(*args, **kwargs):
    try:
        _orig_print(*args, **kwargs)
    except UnicodeEncodeError:
        sep = kwargs.get("sep", " ")
        end = kwargs.get("end", "\n")
        text = sep.join(map(str, args)) + end
        text = text.replace('✔', 'OK').replace('✖', 'X').replace('⚠', '!!').replace('▶', '>').replace('●', '*').replace('○', '-').replace('🎉', '***').replace('…', '...')
        text = text.replace('╔', '+').replace('╗', '+').replace('╚', '+').replace('╝', '+').replace('═', '-').replace('║', '|').replace('─', '-')
        encoding = getattr(sys.stdout, 'encoding', None) or 'ascii'
        text = text.encode(encoding, errors='replace').decode(encoding)
        _orig_print(text, end="")
print = _safe_print

import subprocess
import platform
import time
import socket
import signal
import webbrowser
from pathlib import Path

# ── ANSI helpers ──────────────────────────────────────────────────────────────
def _enable_color():
    if platform.system() == "Windows":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(
                ctypes.windll.kernel32.GetStdHandle(-11), 7
            )
        except Exception:
            return False
    return True

USE_COLOR = _enable_color()

def c(text, code):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

def GREEN(t):  return c(t, "92")
def YELLOW(t): return c(t, "93")
def CYAN(t):   return c(t, "96")
def RED(t):    return c(t, "91")
def BOLD(t):   return c(t, "1")
def DIM(t):    return c(t, "2")

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT    = Path(__file__).parent.resolve()
APP_DIR      = REPO_ROOT / "dataset-lab"
BACKEND_DIR  = APP_DIR / "backend"
FRONTEND_DIR = APP_DIR / "frontend"
VENV_DIR     = APP_DIR / ".venv"
PID_DIR      = APP_DIR / ".pids"
LOG_DIR      = APP_DIR / ".logs"

BACKEND_PID  = PID_DIR / "backend.pid"
FRONTEND_PID = PID_DIR / "frontend.pid"
BACKEND_LOG  = LOG_DIR / "backend.log"
FRONTEND_LOG = LOG_DIR / "frontend.log"

BACKEND_URL  = "http://localhost:8000/docs"
FRONTEND_URL = "http://localhost:5173"

IS_WIN = platform.system() == "Windows"


# ── Utilities ─────────────────────────────────────────────────────────────────
def _resolve_venv_bin(name: str) -> Path:
    """Resolve path to an executable inside the venv."""
    if IS_WIN:
        return VENV_DIR / "Scripts" / (name + ".exe")
    return VENV_DIR / "bin" / name


def _ensure_installed():
    python_bin = _resolve_venv_bin("python")
    if not python_bin.exists():
        print(RED("  ✖  Virtual environment not found."))
        print(f"  {DIM('Run:  python install.py  first.')}")
        sys.exit(1)
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print(RED("  ✖  Frontend node_modules not found."))
        print(f"  {DIM('Run:  python install.py  first.')}")
        sys.exit(1)


def _read_pid(pid_file: Path):
    if pid_file.exists():
        try:
            return int(pid_file.read_text().strip())
        except ValueError:
            pass
    return None


def _process_alive(pid) -> bool:
    """Check if a process with the given PID is running."""
    if pid is None:
        return False
    try:
        if IS_WIN:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True, text=True
            )
            return str(pid) in result.stdout
        else:
            os.kill(pid, 0)
            return True
    except (ProcessLookupError, PermissionError, OSError):
        return False


def _kill_pid(pid: int):
    try:
        if IS_WIN:
            subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                           capture_output=True)
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception:
        pass


def _write_pid(pid_file: Path, pid: int):
    PID_DIR.mkdir(exist_ok=True)
    pid_file.write_text(str(pid))


def _port_open(port: int, host: str = "127.0.0.1") -> bool:
    """Instant check — is the port currently accepting connections?
    Tries both IPv4 (127.0.0.1) and IPv6 (::1) since Vite on newer
    Node versions may bind to IPv6 by default on Windows.
    """
    for h in ("127.0.0.1", "::1"):
        try:
            with socket.create_connection((h, port), timeout=0.5):
                return True
        except OSError:
            pass
    return False


def _wait_for_port(port: int, host: str = "127.0.0.1", timeout: int = 30) -> bool:
    """Poll a TCP port until it accepts connections or timeout is reached.
    Tries both IPv4 and IPv6 for compatibility with Vite on Windows.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        for h in ("127.0.0.1", "::1"):
            try:
                with socket.create_connection((h, port), timeout=1):
                    return True
            except OSError:
                pass
        time.sleep(1)
    return False


def _tail_log(log_file: Path, lines: int = 25) -> str:
    """Return the last N lines of a log file as a string."""
    if not log_file.exists():
        return "  (no log file found)"
    content = log_file.read_text(encoding="utf-8", errors="replace").strip()
    return "\n".join(content.splitlines()[-lines:]) if content else "  (log is empty)"


def _banner_line(msg: str):
    print(f"\n  {BOLD(CYAN('▶'))}  {BOLD(msg)}")


# ── Commands ──────────────────────────────────────────────────────────────────
def cmd_start():
    _ensure_installed()
    LOG_DIR.mkdir(exist_ok=True)
    PID_DIR.mkdir(exist_ok=True)

    # ── Check if already running via PID ──────────────────────────────────────
    back_pid  = _read_pid(BACKEND_PID)
    front_pid = _read_pid(FRONTEND_PID)
    if _process_alive(back_pid) and _process_alive(front_pid):
        print(YELLOW("\n  ⚠  Dataset Lab is already running."))
        print(f"  {DIM(f'Backend:   {BACKEND_URL}')}")
        print(f"  {DIM(f'Frontend:  {FRONTEND_URL}')}")
        print(f"\n  Run {BOLD(CYAN('python datasetlab.py stop'))} to stop it first.\n")
        return

    # ── Early port conflict check ──────────────────────────────────────────────
    # Do this BEFORE spawning processes so the user gets a clear, actionable error.
    for port, name in [(8000, "Backend (port 8000)"), (5173, "Frontend (port 5173)")]:
        if _port_open(port):
            print(YELLOW(f"\n  ⚠  {name} port is already in use by another process."))
            print(f"  You likely have a dev server already running in another terminal.")
            print(f"\n  To find and kill the process on port {port}:")
            print(f"    {BOLD(f'netstat -ano | findstr :{port}')}")
            print(f"    {BOLD('taskkill /PID <pid> /F')}")
            print(f"\n  Or stop Dataset Lab's own servers first:")
            print(f"    {BOLD(CYAN('python datasetlab.py stop'))}\n")
            return

    print()
    print(BOLD(CYAN("╔══════════════════════════════════════════════════════╗")))
    print(BOLD(CYAN("║            Dataset Lab  ─  Starting…                 ║")))
    print(BOLD(CYAN("╚══════════════════════════════════════════════════════╝")))

    python_bin = str(_resolve_venv_bin("python"))
    npm_bin    = "npm.cmd" if IS_WIN else "npm"

    # ── Start Backend ──────────────────────────────────────────────────────────
    # IMPORTANT: Launch uvicorn directly (no --reload flag).
    # Running `python -m backend.main` uses reload=True which spawns child workers
    # then the parent exits — making PID tracking think the server died.
    _banner_line("Starting backend …")
    
    # Isolate environment to prevent parent shell Python paths from breaking the venv
    backend_env = os.environ.copy()
    backend_env["PYTHONUNBUFFERED"] = "1"
    backend_env["PYTHONWARNINGS"] = "ignore"  # Hide non-fatal dependency warnings
    for var in ["PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV", "__PYVENV_LAUNCHER__"]:
        backend_env.pop(var, None)
        
    with open(BACKEND_LOG, "w") as log:
        back_proc = subprocess.Popen(
            [python_bin, "-m", "uvicorn", "backend.main:app",
             "--host", "0.0.0.0", "--port", "8000"],
            cwd=str(APP_DIR),
            env=backend_env,
            stdout=log,
            stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if IS_WIN else 0,
        )
    _write_pid(BACKEND_PID, back_proc.pid)
    print(f"  {GREEN('✔')}  Backend  PID {back_proc.pid}  →  {DIM(str(BACKEND_LOG))}")

    # ── Start Frontend ─────────────────────────────────────────────────────────
    _banner_line("Starting frontend …")
    with open(FRONTEND_LOG, "w") as log:
        front_proc = subprocess.Popen(
            [npm_bin, "run", "dev"],
            cwd=str(FRONTEND_DIR),
            stdout=log,
            stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if IS_WIN else 0,
        )
    _write_pid(FRONTEND_PID, front_proc.pid)
    print(f"  {GREEN('✔')}  Frontend PID {front_proc.pid}  →  {DIM(str(FRONTEND_LOG))}")

    # ── Wait with crash detection ──────────────────────────────────────────────
    # sentence-transformers + chromadb can take up to 2 mins to download/import
    # on cold start, so we poll instead of sleeping a fixed duration.
    print(f"\n  {DIM('Waiting for servers to come up (up to 120s)…')}")

    def wait_with_crash_detect(proc, port, timeout=120):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if _port_open(port):
                return True
            if proc.poll() is not None:   # process exited early = crash
                return False
            time.sleep(1)
        return False

    back_ok  = wait_with_crash_detect(back_proc,  8000)
    front_ok = wait_with_crash_detect(front_proc, 5173, timeout=60)

    print()
    status_icon = lambda ok: GREEN("✔ running") if ok else RED("✖ failed")
    print(f"  Backend   [ {status_icon(back_ok)} ]   {CYAN(BACKEND_URL)}")
    print(f"  Frontend  [ {status_icon(front_ok)} ]   {CYAN(FRONTEND_URL)}")

    if back_ok and front_ok:
        print()
        print(BOLD(GREEN("  🎉  Dataset Lab is live!  Opening browser…")))
        time.sleep(1)
        webbrowser.open(FRONTEND_URL)
    else:
        print()
        print(RED("  ✖  One or more servers failed to start."))
        if not back_ok:
            print(f"\n  {BOLD(YELLOW('── Backend error (last 25 lines) ─────────────────────────'))}")
            print(DIM(_tail_log(BACKEND_LOG)))
        if not front_ok:
            print(f"\n  {BOLD(YELLOW('── Frontend error (last 25 lines) ────────────────────────'))}")
            print(DIM(_tail_log(FRONTEND_LOG)))
        print(f"\n  Full logs:  {BOLD(CYAN('python datasetlab.py logs'))}")

    print()
    print(DIM("  Press Ctrl+C or run 'python datasetlab.py stop' to stop.\n"))


def cmd_stop():
    print()
    back_pid  = _read_pid(BACKEND_PID)
    front_pid = _read_pid(FRONTEND_PID)

    stopped_any = False

    if _process_alive(back_pid):
        _kill_pid(back_pid)
        BACKEND_PID.unlink(missing_ok=True)
        print(f"  {GREEN('✔')}  Backend stopped  (PID {back_pid})")
        stopped_any = True
    else:
        print(f"  {DIM('Backend not running — skipping.')}")

    if _process_alive(front_pid):
        _kill_pid(front_pid)
        FRONTEND_PID.unlink(missing_ok=True)
        print(f"  {GREEN('✔')}  Frontend stopped  (PID {front_pid})")
        stopped_any = True
    else:
        print(f"  {DIM('Frontend not running — skipping.')}")

    if stopped_any:
        print(f"\n  {BOLD(GREEN('Dataset Lab stopped.'))}\n")
    else:
        print(f"\n  {YELLOW('⚠  Nothing was running.')}\n")


def cmd_status():
    print()
    back_pid  = _read_pid(BACKEND_PID)
    front_pid = _read_pid(FRONTEND_PID)

    def row(name, pid, port, url):
        pid_alive = _process_alive(pid)
        port_up   = _port_open(port)
        alive = pid_alive or port_up
        icon  = GREEN("● running") if alive else RED("○ stopped")
        pid_s = f"(PID {pid})" if pid_alive else ("(port open)" if port_up else "")
        print(f"  {BOLD(name):12s}  {icon}  {pid_s}  {DIM(url)}")
        return alive

    print(BOLD("  Service     Status"))
    print("  " + "─" * 54)
    back_alive  = row("Backend",  back_pid,  8000, BACKEND_URL)
    front_alive = row("Frontend", front_pid, 5173, FRONTEND_URL)

    alive_count = sum([back_alive, front_alive])
    print()
    if alive_count == 2:
        print(f"  {GREEN('All systems operational.')}")
    elif alive_count == 0:
        print(f"  {YELLOW('Servers are not running.')}")
        print(f"  Start with:  {BOLD(CYAN('python datasetlab.py start'))}")
    else:
        print(f"  {YELLOW('⚠  Some servers are not running.')}")
        print(f"  Try restarting with:  {BOLD(CYAN('python datasetlab.py start'))}")
    print()


def cmd_open():
    if not _port_open(5173):
        print(YELLOW(f"\n  ⚠  Frontend server doesn't appear to be running."))
        print(f"  Start it with:  {BOLD(CYAN('python datasetlab.py start'))}\n")
        return
    print(f"\n  {GREEN('✔')}  Opening {CYAN(FRONTEND_URL)} …\n")
    webbrowser.open(FRONTEND_URL)


def cmd_logs():
    """Print backend and frontend log tails."""
    print()
    print(BOLD(CYAN("  ── Backend Log ─────────────────────────────────────")))
    if BACKEND_LOG.exists():
        print(DIM(BACKEND_LOG.read_text(encoding="utf-8", errors="replace")[-6000:]))
    else:
        print(DIM("  (no log file yet — run 'python datasetlab.py start' first)"))

    print()
    print(BOLD(CYAN("  ── Frontend Log ────────────────────────────────────")))
    if FRONTEND_LOG.exists():
        print(DIM(FRONTEND_LOG.read_text(encoding="utf-8", errors="replace")[-6000:]))
    else:
        print(DIM("  (no log file yet — run 'python datasetlab.py start' first)"))
    print()


HELP_TEXT = f"""
{BOLD(CYAN('Dataset Lab CLI'))}

Usage:
  {BOLD('python datasetlab.py <command>')}

Commands:
  {BOLD(GREEN('start'))}    Start the backend and frontend servers
  {BOLD(GREEN('stop'))}     Stop all running servers
  {BOLD(GREEN('status'))}   Show current server status
  {BOLD(GREEN('open'))}     Open the app in your default browser
  {BOLD(GREEN('logs'))}     Show recent output from server logs

Examples:
  python datasetlab.py start
  python datasetlab.py stop
  python datasetlab.py status
"""


def main():
    if len(sys.argv) < 2:
        print(HELP_TEXT)
        return

    cmd = sys.argv[1].lower()
    dispatch = {
        "start":  cmd_start,
        "stop":   cmd_stop,
        "status": cmd_status,
        "open":   cmd_open,
        "logs":   cmd_logs,
    }

    if cmd not in dispatch:
        print(RED(f"\n  Unknown command: '{cmd}'\n"))
        print(HELP_TEXT)
        sys.exit(1)

    try:
        dispatch[cmd]()
    except KeyboardInterrupt:
        print("\n  Interrupted.\n")


if __name__ == "__main__":
    main()
