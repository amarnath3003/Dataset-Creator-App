#!/usr/bin/env python3
"""
Dataset Lab — One-Command Installer
Run: python install.py
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
import shutil
import json
from pathlib import Path

# ── ANSI colors (works on Windows 10+ and all Unix) ──────────────────────────
def _supports_color():
    if platform.system() == "Windows":
        # Enable VT processing on Windows
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            return True
        except Exception:
            return False
    return True

USE_COLOR = _supports_color()

def c(text, code):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

def GREEN(t):  return c(t, "92")
def YELLOW(t): return c(t, "93")
def CYAN(t):   return c(t, "96")
def RED(t):    return c(t, "91")
def BOLD(t):   return c(t, "1")
def DIM(t):    return c(t, "2")


# ── Helpers ───────────────────────────────────────────────────────────────────
def banner():
    print()
    print(BOLD(CYAN("╔══════════════════════════════════════════════════════╗")))
    print(BOLD(CYAN("║                                                      ║")))
    print(BOLD(CYAN("║           Dataset Lab  ─  Installer v1.0             ║")))
    print(BOLD(CYAN("║                                                      ║")))
    print(BOLD(CYAN("╚══════════════════════════════════════════════════════╝")))
    print()

def step(n, total, msg):
    print(f"\n{BOLD(CYAN(f'[{n}/{total}]'))} {BOLD(msg)}")

def ok(msg):
    print(f"  {GREEN('✔')}  {msg}")

def warn(msg):
    print(f"  {YELLOW('⚠')}  {msg}")

def fail(msg):
    print(f"\n  {RED('✖  ERROR:')}  {msg}")
    print(f"  {DIM('Please fix the issue above and re-run: python install.py')}\n")
    sys.exit(1)

def run(cmd, cwd=None, env=None, capture=False):
    """Run a shell command, streaming output unless capture=True."""
    kwargs = dict(cwd=cwd, env=env)
    if capture:
        kwargs["stdout"] = subprocess.PIPE
        kwargs["stderr"] = subprocess.PIPE
        result = subprocess.run(cmd, **kwargs, text=True)
        return result
    else:
        result = subprocess.run(cmd, **kwargs)
        return result

def ask(prompt, default=""):
    try:
        val = input(f"  {CYAN('?')}  {prompt} [{DIM(default)}]: ").strip()
        return val if val else default
    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(0)

def ask_yn(prompt, default="n"):
    yes = {"y", "yes"}
    try:
        val = input(f"  {CYAN('?')}  {prompt} [{BOLD('y/N')}]: ").strip().lower()
        return val in yes
    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(0)


# ─────────────────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).parent.resolve()
APP_DIR     = REPO_ROOT / "dataset-lab"
BACKEND_DIR = APP_DIR / "backend"
FRONTEND_DIR = APP_DIR / "frontend"
VENV_DIR    = APP_DIR / ".venv"
ENV_FILE    = APP_DIR / ".env"
TOTAL_STEPS = 7


def check_python():
    step(1, TOTAL_STEPS, "Checking Python version …")
    v = sys.version_info
    if v < (3, 9):
        fail(f"Python 3.9+ required. You have {v.major}.{v.minor}.{v.micro}.")
    ok(f"Python {v.major}.{v.minor}.{v.micro}  ✓")


def check_node():
    step(2, TOTAL_STEPS, "Checking Node.js version …")
    node = shutil.which("node")
    npm  = shutil.which("npm")
    if not node or not npm:
        fail(
            "Node.js / npm not found.\n"
            "  Download from: https://nodejs.org/en/download/"
        )
    r = run(["node", "--version"], capture=True)
    ver_str = r.stdout.strip().lstrip("v")
    major = int(ver_str.split(".")[0])
    if major < 18:
        fail(f"Node.js 18+ required. You have v{ver_str}.")
    ok(f"Node.js v{ver_str}  ✓")


def create_venv():
    step(3, TOTAL_STEPS, "Creating Python virtual environment …")
    if VENV_DIR.exists():
        warn(f".venv already exists at {VENV_DIR} — skipping creation.")
    else:
        result = run([sys.executable, "-m", "venv", str(VENV_DIR)])
        if result.returncode != 0:
            fail("Could not create virtual environment.")
        ok(f"Virtual environment created at {VENV_DIR}")


def install_backend():
    step(4, TOTAL_STEPS, "Installing backend Python dependencies …")
    # Resolve pip inside venv
    if platform.system() == "Windows":
        pip = VENV_DIR / "Scripts" / "pip.exe"
    else:
        pip = VENV_DIR / "bin" / "pip"

    if not pip.exists():
        fail(f"pip not found in venv ({pip}). Try deleting .venv and re-running.")

    req_file = BACKEND_DIR / "requirements.txt"
    if not req_file.exists():
        fail(f"requirements.txt not found at {req_file}")

    print(f"  {DIM('Running: pip install -r requirements.txt')}")
    result = run([str(pip), "install", "--upgrade", "pip", "-q"])
    result = run([str(pip), "install", "-r", str(req_file)])
    if result.returncode != 0:
        fail("pip install failed. Check the error above.")
    ok("Backend dependencies installed  ✓")


def install_frontend():
    step(5, TOTAL_STEPS, "Installing frontend Node dependencies …")
    if not FRONTEND_DIR.exists():
        fail(f"Frontend directory not found: {FRONTEND_DIR}")

    print(f"  {DIM('Running: npm install')}")
    npm = "npm.cmd" if platform.system() == "Windows" else "npm"
    result = run([npm, "install"], cwd=str(FRONTEND_DIR))
    if result.returncode != 0:
        fail("npm install failed. Check the error above.")
    ok("Frontend dependencies installed  ✓")


def setup_env():
    step(6, TOTAL_STEPS, "Configuring environment variables …")

    defaults = {
        "DEFAULT_CHUNK_SIZE": "800",
        "DEFAULT_CHUNK_OVERLAP": "100",
        "DEFAULT_SIMILARITY_THRESHOLD": "0.92",
        "OPENAI_API_KEY": "",
        "ANTHROPIC_API_KEY": "",
    }

    if ENV_FILE.exists():
        warn(f".env file already exists at {ENV_FILE} — skipping.")
        print(f"  {DIM('Delete it and re-run install.py to reconfigure.')}")
        return

    print(f"\n  {YELLOW('Optional:')} Configure API keys for cloud LLMs (press Enter to skip).\n")
    openai_key  = ask("OpenAI API key    (sk-...)", "")
    anthropic_key = ask("Anthropic API key (sk-ant-...)", "")

    lines = [
        "# Dataset Lab — Environment Configuration",
        "# Generated by install.py — edit as needed",
        "",
        "# Document Processing",
        f"DEFAULT_CHUNK_SIZE={defaults['DEFAULT_CHUNK_SIZE']}",
        f"DEFAULT_CHUNK_OVERLAP={defaults['DEFAULT_CHUNK_OVERLAP']}",
        f"DEFAULT_SIMILARITY_THRESHOLD={defaults['DEFAULT_SIMILARITY_THRESHOLD']}",
        "",
        "# Cloud LLM API Keys (optional)",
        f"OPENAI_API_KEY={openai_key}",
        f"ANTHROPIC_API_KEY={anthropic_key}",
    ]

    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    ok(f".env created at {ENV_FILE}  ✓")


def create_pid_dir():
    """Create a .pids directory inside dataset-lab for tracking server PIDs."""
    pid_dir = APP_DIR / ".pids"
    pid_dir.mkdir(exist_ok=True)


def success_banner():
    step(7, TOTAL_STEPS, "Finalising …")
    create_pid_dir()
    ok("Installation complete  ✓")

    print()
    print(BOLD(GREEN("╔══════════════════════════════════════════════════════╗")))
    print(BOLD(GREEN("║                                                      ║")))
    print(BOLD(GREEN("║           🎉  Dataset Lab is ready!                  ║")))
    print(BOLD(GREEN("║                                                      ║")))
    print(BOLD(GREEN("╚══════════════════════════════════════════════════════╝")))
    print()
    print(BOLD("  Next steps:"))
    print()
    print(f"    {GREEN('▶')}  Start everything:   {BOLD(CYAN('python datasetlab.py start'))}")
    print(f"    {GREEN('▶')}  Open the app:       {CYAN('http://localhost:5173')}")
    print(f"    {GREEN('▶')}  Backend API docs:   {CYAN('http://localhost:8000/docs')}")
    print(f"    {GREEN('▶')}  Stop servers:       {BOLD(CYAN('python datasetlab.py stop'))}")
    print()
    print(DIM("  Windows users: you can also double-click start.bat"))
    print()


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    banner()
    print(f"  Installing Dataset Lab into: {BOLD(str(REPO_ROOT))}")

    check_python()
    check_node()
    create_venv()
    install_backend()
    install_frontend()
    setup_env()
    success_banner()
