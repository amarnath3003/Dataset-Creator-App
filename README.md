<div align="center">
  <img src="./dataset-lab/frontend/public/vite.svg" alt="Dataset Lab Logo" width="120"/>

  # Dataset Lab

  **A powerful, file-based dataset engineering system for creating, refining, and exporting high-quality instruction-style QA datasets.**

  [![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/downloads/)
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-MIT-purple.svg)](#)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#)

  <p align="center">
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-project-overview">Overview</a> •
    <a href="#-screenshots">Screenshots</a> •
    <a href="#-troubleshooting--common-errors">Troubleshooting</a>
  </p>
</div>

---

## ✨ Features

- **🚀 Fully Automated Setup:** One-command installer configures everything (Python venv, pip, npm) automatically.
- **🛡️ Bulletproof CLI Runner:** Custom-built terminal interface that gracefully handles older Windows terminals with safe unicode fallbacks—no more `UnicodeEncodeError` crashes.
- **🧠 Local & Cloud LLMs:** Seamlessly use local models via Ollama or cloud models via OpenAI/Anthropic APIs.
- **📂 File-based Engineering:** Ingest, chunk, generate, and refine high-quality datasets directly from your local documents.
- **🌐 Cross-Platform:** Works flawlessly on Windows, macOS, and Linux.

---

## 🚀 Quick Start

Dataset Lab is designed to be as easy to start as possible. Choose your OS below:

### Windows
```cmd
:: 1. Clone the repository
git clone https://github.com/amarnath123456789/Dataset-Creator-App.git
cd Dataset-Creator-App

:: 2. Run the quick-start batch file
start.bat
```
> **Tip:** You can also simply double-click **`start.bat`** from your File Explorer to install dependencies and boot the servers without touching a terminal!

### macOS / Linux
```bash
# 1. Clone the repository
git clone https://github.com/amarnath123456789/Dataset-Creator-App.git
cd Dataset-Creator-App

# 2. Run the quick-start shell script
bash start.sh
```

**That's it!** The app will open automatically in your browser at `http://localhost:5173` 🎉.

---

## 🖥️ CLI Reference

If you prefer to run components manually or view logs, use the built-in Python CLI runner.

```bash
python datasetlab.py <command>
```

| Command | Description |
| :--- | :--- |
| `start` | Starts the backend and frontend servers. |
| `stop` | Gracefully stops all running servers. |
| `status`| Shows live status and PIDs for running servers. |
| `open`  | Opens the Dataset Lab dashboard in your default browser. |
| `logs`  | Tails the recent console output from the servers. |

---

## 📖 Project Overview

Creating a high-quality dataset is a multi-step pipeline. Dataset Lab streamlines this process into four intuitive stages:

1. **Upload & Chunking:** Ingest source documents (`.pdf`, `.txt`, `.docx`) and split them into context-aware chunks.
2. **Generation:** Leverage local LLMs (via Ollama) or Cloud APIs to automatically generate Question-Answer pairs based on the chunks.
3. **Refinement:** Clean, filter, edit, and format the generated records in an easy-to-use tabular UI.
4. **Export:** Export the finalized dataset to `.json`, `.jsonl`, or `.csv`, perfectly formatted for supervised fine-tuning.

---

## 💻 System Requirements

| Requirement | Details |
| :--- | :--- |
| **OS** | Windows 10/11, macOS (M1/M2/Intel), Linux |
| **Python** | **3.9+** — [Download](https://www.python.org/downloads/) |
| **Node.js** | **18+** — [Download](https://nodejs.org/en/download/) |
| **RAM** | 8GB minimum *(16GB+ recommended if running local LLMs)* |
| **Disk** | 2GB+ for the app *(Additional 4–10GB per local model)* |
| **Ollama** | *Optional* — Required for offline local LLMs — [Download](https://ollama.com/download) |

> ℹ️ **Note:** The `install.py` script automatically checks these requirements and will warn you if anything is missing.

---

## 🤖 Using Local LLMs (Ollama)

Dataset Lab has native integration with Ollama for 100% offline dataset generation.

1. Install Ollama from [ollama.com](https://ollama.com/).
2. Pull a model from your terminal:
   ```bash
   ollama run llama3
   ```
3. Dataset Lab will automatically detect your local Ollama instance running at `http://localhost:11434`.

---

## ⚙️ Configuration (Environment Variables)

The installer generates a `.env` file for you automatically. You can edit it manually at `dataset-lab/.env` if you need to tweak defaults or add API keys:

```env
# Document Processing Defaults
DEFAULT_CHUNK_SIZE=800
DEFAULT_CHUNK_OVERLAP=100
DEFAULT_SIMILARITY_THRESHOLD=0.92

# Cloud LLM API Keys (Optional — Only needed for Cloud generation)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 🎞️ Screenshots

<details>
<summary><b>Click to view Dashboard Screenshots</b></summary>
<br>

<div align="center">
  <img src="/dataset-lab/frontend/src/assets/screenshots/dlab-img1.png" width="48%">
  <img src="/dataset-lab/frontend/src/assets/screenshots/dlab-img2.png" width="48%">
  <img src="/dataset-lab/frontend/src/assets/screenshots/dlab-img3.png" width="48%">
  <img src="/dataset-lab/frontend/src/assets/screenshots/dlab-img4.png" width="48%">
  <img src="/dataset-lab/frontend/src/assets/screenshots/dlab-img5.png" width="48%">
  <img src="/dataset-lab/frontend/src/assets/screenshots/dlab-img6.png" width="48%">
</div>
</details>

---

## 🏗️ Manual Setup (Advanced)

<details>
<summary><b>View Manual Setup Instructions</b></summary>
<br>

If you prefer to bypass the installer and set up the servers manually:

```bash
# Backend Setup
cd dataset-lab
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux
pip install -r backend/requirements.txt

# Frontend Setup
cd frontend
npm install

# Run Backend (Terminal 1)
python -m backend.main

# Run Frontend (Terminal 2)
npm run dev
```
</details>

---

## 📁 Folder Structure

<details>
<summary><b>View Repository Structure</b></summary>
<br>

```text
Dataset-Creator-App/
├── install.py          ← One-command installer
├── datasetlab.py       ← CLI runner (start/stop/status/open/logs)
├── start.bat           ← Windows double-click starter
├── start.sh            ← macOS/Linux shell starter
└── dataset-lab/
    ├── backend/        ← FastAPI backend (LLM engines, API endpoints)
    ├── frontend/       ← React / Vite frontend
    ├── projects/       ← Generated project data
    ├── .venv/          ← Python virtual environment (Created by installer)
    ├── .logs/          ← Server logs (Created on start)
    └── .env            ← Global config (Created by installer)
```
</details>

---

## 🚑 Troubleshooting & Common Errors

| Error | Cause | Solution |
| :--- | :--- | :--- |
| **`python install.py` fails** | Missing Dependencies | Ensure Python 3.9+ and Node 18+ are installed and added to your system `PATH`. |
| **Pipeline stuck in "Running"** | Ghost Processes | Delete the `.running` or `.stop` files inside `dataset-lab/projects/<project>/`. |
| **Cannot connect to Ollama** | Engine Not Running | Run `ollama run llama3` in your terminal and verify it serves at `http://localhost:11434`. |
| **Port 8000/5173 in use** | Conflicting Process | Stop the conflicting process or change the port in `backend/main.py` and `vite.config.js`. |
| **`ModuleNotFoundError`** | Missing Python package | Run `python install.py` again to reinstall dependencies. |
| **`npm error: …`** | Missing Node modules | Run `python install.py` again to reinstall frontend packages. |

*If the backend or frontend crashes unexpectedly, run `python datasetlab.py logs` to see what went wrong.*

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/awesome-feature`
3. Commit your changes with clear messages.
4. Push to the branch and open a Pull Request.

<div align="center">
  <br>
  <i>Thank you for using Dataset Lab! Found a bug? <a href="https://github.com/amarnath123456789/Dataset-Creator-App/issues">Open an issue</a>.</i>
</div>
