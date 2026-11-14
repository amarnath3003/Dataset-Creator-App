#!/usr/bin/env python3
"""
AI Training Pipeline — Unified Suite CLI Runner (Dataset Lab + Finetune Lab + Chat Lab)

Usage:
    python datasetlab.py start [--lab all|dataset|finetune|chat]
    python datasetlab.py stop  [--lab all|dataset|finetune|chat]
    python datasetlab.py restart [--lab all|dataset|finetune|chat]
    python datasetlab.py status [--lab all|dataset|finetune|chat]
    python datasetlab.py open [--lab dataset|finetune|chat]
    python datasetlab.py logs [--lab all|dataset|finetune|chat]
"""

import os
import sys

# Force UTF-8 encoding for standard output and error on Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
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
        for k, v in {
            "✔": "OK", "✖": "X", "⚠": "!!", "▶": ">", "●": "*",
            "○": "-", "🎉": "***", "…": "...", "╔": "+", "╗": "+",
            "╚": "+", "╝": "+", "═": "-", "║": "|", "─": "-", "→": "->",
        }.items():
            text = text.replace(k, v)
        encoding = getattr(sys.stdout, "encoding", None) or "ascii"
        text = text.encode(encoding, errors="replace").decode(encoding)
        _orig_print(text, end="")


print = _safe_print

import argparse
import platform
import signal
import socket
import subprocess
import time
import webbrowser
from pathlib import Path


def _enable_color():
    if platform.system() == "Windows":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(
                ctypes.windll.kernel32.GetStdHandle(-11), 7
            )
            return True
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


REPO_ROOT = Path(__file__).parent.resolve()
IS_WIN = platform.system() == "Windows"


def _pick_venv_python(lab_dir: Path) -> Path | None:
    """Resolve Python executable from lab-local .venv or repo root .venv."""
    candidates = [lab_dir / ".venv", REPO_ROOT / ".venv"]
    for venv in candidates:
        exe = venv / ("Scripts/python.exe" if IS_WIN else "bin/python")
        if exe.exists():
            return exe
    return Path(sys.executable)


LABS = {
    "dataset": {
        "name": "Dataset Lab",
        "dir": REPO_ROOT / "dataset-lab",
        "backend_cwd": REPO_ROOT / "dataset-lab",
        "backend_app": "backend.main:app",
        "backend_port": 8000,
        "frontend_port": 5173,
        "docs_url": "http://localhost:8000/docs",
        "frontend_url": "http://localhost:5173",
    },
    "finetune": {
        "name": "Finetune Lab",
        "dir": REPO_ROOT / "finetune-lab",
        "backend_cwd": REPO_ROOT / "finetune-lab" / "backend",
        "backend_app": "main:app",
        "backend_port": 8001,
        "frontend_port": 5174,
        "docs_url": "http://localhost:8001/docs",
        "frontend_url": "http://localhost:5174",
    },
    "chat": {
        "name": "Chat Lab",
        "dir": REPO_ROOT / "chat-lab",
        "backend_cwd": REPO_ROOT / "chat-lab" / "backend",
        "backend_app": "main:app",
        "backend_port": 8100,
        "frontend_port": 5273,
        "docs_url": "http://localhost:8100/docs",
        "frontend_url": "http://localhost:5273",
    },
}


def _pid_files(lab_key: str):
    pid_dir = LABS[lab_key]["dir"] / ".pids"
    return pid_dir, pid_dir / "backend.pid", pid_dir / "frontend.pid"


def _log_files(lab_key: str):
    log_dir = LABS[lab_key]["dir"] / ".logs"
    return log_dir, log_dir / "backend.log", log_dir / "frontend.log"


def _read_pid(pid_file: Path):
    if pid_file.exists():
        try:
            return int(pid_file.read_text(encoding="utf-8").strip())
        except ValueError:
            pass
    return None


def _write_pid(pid_file: Path, pid: int):
    pid_file.parent.mkdir(parents=True, exist_ok=True)
    pid_file.write_text(str(pid), encoding="utf-8")


def _process_alive(pid) -> bool:
    if pid is None:
        return False
    try:
        if IS_WIN:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True, text=True
            )
            return str(pid) in result.stdout
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError, OSError):
        return False


def _kill_pid(pid: int):
    try:
        if IS_WIN:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception:
        pass


def _port_open(port: int) -> bool:
    for h in ("127.0.0.1", "::1"):
        try:
            with socket.create_connection((h, port), timeout=0.4):
                return True
        except OSError:
            pass
    return False


def _tail_log(log_file: Path, lines: int = 25) -> str:
    if not log_file.exists():
        return "  (no log file found)"
    content = log_file.read_text(encoding="utf-8", errors="replace").strip()
    return "\n".join(content.splitlines()[-lines:]) if content else "  (log is empty)"


def _selected_labs(lab_arg: str) -> list[str]:
    if lab_arg == "all":
        return ["dataset", "finetune", "chat"]
    return [lab_arg]


def _start_lab(lab_key: str) -> bool:
    cfg = LABS[lab_key]
    app_dir = cfg["dir"]
    frontend_dir = app_dir / "frontend"
    node_modules = frontend_dir / "node_modules"
    if not node_modules.exists():
        print(RED(f"  ✖  {cfg['name']} frontend node_modules not found ({node_modules})."))
        return False

    pid_dir, back_pid_file, front_pid_file = _pid_files(lab_key)
    log_dir, back_log, front_log = _log_files(lab_key)
    pid_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    back_port = cfg["backend_port"]
    front_port = cfg["frontend_port"]

    if _port_open(back_port) and _port_open(front_port):
        print(YELLOW(f"  ⚠  {cfg['name']} already running on :{back_port} / :{front_port}"))
        return True

    python_bin = str(_pick_venv_python(app_dir))
    npm_bin = "npm.cmd" if IS_WIN else "npm"

    backend_env = os.environ.copy()
    backend_env["PYTHONUNBUFFERED"] = "1"
    backend_env["PYTHONWARNINGS"] = "ignore"
    for var in ("PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV", "__PYVENV_LAUNCHER__"):
        backend_env.pop(var, None)

    lab_name = cfg["name"]
    print(f"\n  {BOLD(CYAN('▶'))}  {BOLD(f'Starting {lab_name} …')}")

    win_flags = (
        subprocess.CREATE_NEW_PROCESS_GROUP | getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
        if IS_WIN
        else 0
    )

    if not _port_open(back_port):
        with open(back_log, "w", encoding="utf-8") as log:
            back_proc = subprocess.Popen(
                [
                    python_bin, "-m", "uvicorn", cfg["backend_app"],
                    "--host", "0.0.0.0", "--port", str(back_port),
                ],
                cwd=str(cfg["backend_cwd"]),
                env=backend_env,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=log,
                close_fds=not IS_WIN,
                creationflags=win_flags,
            )
        _write_pid(back_pid_file, back_proc.pid)
        print(f"  {GREEN('✔')}  Backend  PID {back_proc.pid} (:{back_port}) -> {DIM(str(back_log))}")
    else:
        back_proc = None
        print(f"  {YELLOW('⚠')}  Backend port :{back_port} already listening")

    if not _port_open(front_port):
        with open(front_log, "w", encoding="utf-8") as log:
            front_proc = subprocess.Popen(
                [npm_bin, "run", "dev", "--", "--port", str(front_port)],
                cwd=str(frontend_dir),
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=log,
                close_fds=not IS_WIN,
                creationflags=win_flags,
            )
        _write_pid(front_pid_file, front_proc.pid)
        print(f"  {GREEN('✔')}  Frontend PID {front_proc.pid} (:{front_port}) -> {DIM(str(front_log))}")
    else:
        front_proc = None
        print(f"  {YELLOW('⚠')}  Frontend port :{front_port} already listening")

    def wait_port(proc, port, timeout=60):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if _port_open(port):
                return True
            if proc is not None and proc.poll() is not None:
                return False
            time.sleep(0.75)
        return False

    back_ok = wait_port(back_proc, back_port, timeout=90)
    front_ok = wait_port(front_proc, front_port, timeout=60)

    status_icon = lambda ok: GREEN("✔ running") if ok else RED("✖ failed")
    print(f"     Backend   [ {status_icon(back_ok)} ]  {CYAN(cfg['docs_url'])}")
    print(f"     Frontend  [ {status_icon(front_ok)} ]  {CYAN(cfg['frontend_url'])}")

    if not back_ok:
        print(YELLOW(f"\n  ── {cfg['name']} Backend error (last 20 lines) ──"))
        print(DIM(_tail_log(back_log, 20)))
    if not front_ok:
        print(YELLOW(f"\n  ── {cfg['name']} Frontend error (last 20 lines) ──"))
        print(DIM(_tail_log(front_log, 20)))

    return back_ok and front_ok


def cmd_start(lab_arg: str, open_browser: bool = True):
    labs = _selected_labs(lab_arg)
    print()
    print(BOLD(CYAN("╔════════════════════════════════════════════════════════════╗")))
    print(BOLD(CYAN("║      AI Training Suite  ─  Starting Services               ║")))
    print(BOLD(CYAN("╚════════════════════════════════════════════════════════════╝")))

    all_ok = True
    for k in labs:
        if not _start_lab(k):
            all_ok = False

    if all_ok:
        print(f"\n  {BOLD(GREEN('🎉  All requested labs are live!'))}")
        if open_browser:
            webbrowser.open(LABS[labs[0]]["frontend_url"])
    else:
        print(f"\n  {RED('✖  One or more services failed to start.')} Run {BOLD(CYAN('python datasetlab.py logs'))} for details.")
    print(DIM("\n  Run 'python datasetlab.py stop' to shut down all managed servers.\n"))


def cmd_stop(lab_arg: str):
    print()
    stopped_any = False
    for k in _selected_labs(lab_arg):
        cfg = LABS[k]
        _, back_pid_file, front_pid_file = _pid_files(k)
        for label, pid_file in (("Backend", back_pid_file), ("Frontend", front_pid_file)):
            pid = _read_pid(pid_file)
            if _process_alive(pid):
                _kill_pid(pid)
                pid_file.unlink(missing_ok=True)
                print(f"  {GREEN('✔')}  {cfg['name']} {label} stopped (PID {pid})")
                stopped_any = True
            else:
                pid_file.unlink(missing_ok=True)
    if not stopped_any:
        print(f"  {YELLOW('⚠  No tracked lab processes were running.')}")
    else:
        print(f"\n  {BOLD(GREEN('Requested labs stopped.'))}")
    print()


def cmd_status(lab_arg: str):
    print()
    print(BOLD("  Lab            Service    Status       Info"))
    print("  " + "─" * 66)
    total = 0
    alive_total = 0
    for k in _selected_labs(lab_arg):
        cfg = LABS[k]
        _, back_pid_file, front_pid_file = _pid_files(k)
        for label, pid_file, port, url in (
            ("Backend", back_pid_file, cfg["backend_port"], cfg["docs_url"]),
            ("Frontend", front_pid_file, cfg["frontend_port"], cfg["frontend_url"]),
        ):
            total += 1
            pid = _read_pid(pid_file)
            pid_alive = _process_alive(pid)
            port_up = _port_open(port)
            alive = pid_alive or port_up
            if alive:
                alive_total += 1
            icon = GREEN("● running") if alive else RED("○ stopped")
            pid_s = f"PID {pid}" if pid_alive else (f":{port}" if port_up else f":{port} down")
            print(f"  {BOLD(cfg['name']):14s} {label:9s}  {icon}  {pid_s:10s}  {DIM(url)}")
    print()
    print(f"  {GREEN('All systems operational.') if alive_total == total else YELLOW(f'{alive_total}/{total} services active.')}\n")


def cmd_open(lab_arg: str):
    labs = _selected_labs(lab_arg)
    for k in labs:
        cfg = LABS[k]
        if _port_open(cfg["frontend_port"]):
            print(f"  {GREEN('✔')}  Opening {cfg['name']}: {CYAN(cfg['frontend_url'])}")
            webbrowser.open(cfg["frontend_url"])
        else:
            print(f"  {YELLOW('⚠')}  {cfg['name']} is not listening on :{cfg['frontend_port']}")


def cmd_logs(lab_arg: str):
    for k in _selected_labs(lab_arg):
        cfg = LABS[k]
        lab_name = cfg["name"]
        _, back_log, front_log = _log_files(k)
        print(f"\n{BOLD(CYAN(f'  ── {lab_name} Backend Log ──────────────────────────'))}")
        print(DIM(_tail_log(back_log, 40)))
        print(f"\n{BOLD(CYAN(f'  ── {lab_name} Frontend Log ─────────────────────────'))}")
        print(DIM(_tail_log(front_log, 40)))
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Unified CLI runner for Dataset Lab, Finetune Lab, and Chat Lab."
    )
    parser.add_argument(
        "command",
        choices=["start", "stop", "restart", "status", "open", "logs"],
        help="Action to perform",
    )
    parser.add_argument(
        "--lab",
        choices=["all", "dataset", "finetune", "chat"],
        default="all",
        help="Target lab (default: all)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not automatically open browser on start",
    )
    args = parser.parse_args()

    try:
        if args.command == "start":
            cmd_start(args.lab, open_browser=not args.no_browser)
        elif args.command == "stop":
            cmd_stop(args.lab)
        elif args.command == "restart":
            cmd_stop(args.lab)
            time.sleep(1)
            cmd_start(args.lab, open_browser=not args.no_browser)
        elif args.command == "status":
            cmd_status(args.lab)
        elif args.command == "open":
            cmd_open(args.lab)
        elif args.command == "logs":
            cmd_logs(args.lab)
    except KeyboardInterrupt:
        print("\n  Interrupted.\n")


if __name__ == "__main__":
    main()
