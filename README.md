# Dataset Lab (Dataset Creator App)

<img src="./dataset-lab/frontend/public/vite.svg" alt="Dataset Lab Logo" width="100"/>

**Dataset Lab** is a powerful, file-based dataset engineering system for creating, refining, and exporting high-quality instruction-style QA datasets. Built with Python/FastAPI (backend) and React/Vite (frontend).

---

## ✨ Features

- **🚀 Fully Automated Setup:** One-command installer configures everything (Python venv, pip, npm) automatically.
- **🛡️ Bulletproof CLI Runner:** Custom-built terminal interface that gracefully handles older Windows terminals (cmd/PowerShell) with safe unicode fallbacks—no more `UnicodeEncodeError` crashes!
- **🧠 Local & Cloud LLMs:** Seamlessly use local models via Ollama or cloud models via OpenAI/Anthropic APIs.
- **📂 File-based Engineering:** Ingest, chunk, generate, and refine high-quality datasets directly from your local documents.
- **🌐 Cross-Platform:** Works flawlessly on Windows, macOS, and Linux.

---

## 🚀 Quick Start

### Windows
```cmd
# 1. Clone the repository
git clone https://github.com/amarnath123456789/Dataset-Creator-App.git
cd Dataset-Creator-App

# 2. Run the quick-start batch file (handles installation & starting servers)
start.bat
```
> **Tip:** You can also just double-click **`start.bat`** from your File Explorer — no terminal needed!

### macOS / Linux
```bash
# 1. Clone the repository
git clone https://github.com/amarnath123456789/Dataset-Creator-App.git
cd Dataset-Creator-App

# 2. Run the quick-start shell script (handles installation & starting servers)
bash start.sh
```

The app will open automatically at **http://localhost:5173** 🎉

---

## 🖥️ CLI Reference

If you prefer to run the components manually, you can use the built-in python CLI runner:

```bash
python datasetlab.py <command>
```

| Command | Description |
|---------|-------------|
| `start` | Start the backend + frontend servers |
| `stop`  | Stop all running servers |
| `status`| Show live server status |
| `open`  | Open the app in your browser |
| `logs`  | Show recent server log output |

---

## 📖 Project Overview

1. **Upload & Chunking** — Ingest source documents and split into manageable chunks.
2. **Generation** — Use local or cloud LLMs to generate QA pairs.
3. **Refinement** — Clean, filter, and format the generated datasets.
4. **Export** — Export to JSON, JSONL, or CSV ready for fine-tuning.

---

## 💻 System Requirements

| Requirement | Details |
|-------------|---------|
| OS | Windows 10/11, macOS (M1/M2/Intel), Linux |
| Python | **3.9+** — [Download](https://www.python.org/downloads/) |
| Node.js | **18+** — [Download](https://nodejs.org/en/download/) |
| RAM | 8GB minimum (16GB+ recommended for local LLMs) |
| Disk | 2GB+ for app; 4–10GB per local model |
| Ollama | Optional — for offline local LLMs — [Download](https://ollama.com/download) |

`install.py` checks all of these for you automatically and will warn you if anything is missing.

---

## 🎞️ Screenshots

![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img1.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img2.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img3.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img4.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img5.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img6.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img7.png)
![Screenshot](/dataset-lab/frontend/src/assets/screenshots/dlab-img8.png)

---

## ⚙️ Configuration (Environment Variables)

The installer will create a `.env` file for you automatically. You can also edit it manually at `dataset-lab/.env`:

```env
# Document Processing
DEFAULT_CHUNK_SIZE=800
DEFAULT_CHUNK_OVERLAP=100
DEFAULT_SIMILARITY_THRESHOLD=0.92

# Cloud LLM API Keys (optional — only needed for cloud models)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 🤖 Using Local LLMs (Ollama)

1. Install Ollama from [ollama.com](https://ollama.com/)
2. Pull a model from your terminal:
   ```bash
   ollama run llama3
   ```
3. Dataset Lab auto-detects your local Ollama instance at `http://localhost:11434` automatically!

---

## 🏗️ Manual Setup (Advanced)

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

# Run backend (Terminal 1)
python -m backend.main

# Run frontend (Terminal 2)
npm run dev
```

---

## 📁 Folder Structure

```text
Dataset-Creator-App/
├── install.py          ← One-command installer
├── datasetlab.py       ← CLI runner (start/stop/status/open/logs)
├── start.bat           ← Windows double-click starter
├── start.sh            ← macOS/Linux shell starter
└── dataset-lab/
    ├── backend/        ← FastAPI backend
    │   ├── engines/    ← LLM & processing logic
    │   ├── routes/     ← API endpoints
    │   ├── main.py     ← Entry point
    │   └── requirements.txt
    ├── frontend/       ← React / Vite frontend
    │   ├── src/
    │   └── package.json
    ├── projects/       ← Generated project data
    ├── .venv/          ← Python virtual environment (created by installer)
    ├── .logs/          ← Server logs (created on start)
    └── .env            ← Your config (created by installer)
```

---

## 🚑 Troubleshooting

| Problem | Fix |
|---------|-----|
| `python install.py` fails | Ensure Python 3.9+ and Node 18+ are installed and on your PATH |
| Pipeline stuck in "Running" | Delete `.running` / `.stop` files in `dataset-lab/projects/<project>/` |
| Cannot connect to Ollama | Run `ollama run llama3` and verify it serves at `http://localhost:11434` |
| Port 8000/5173 in use | Stop the conflicting process or change the port in `backend/main.py` |
| Backend/frontend crashed | Run `python datasetlab.py logs` to see what went wrong |

---

## ❌ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ModuleNotFoundError` | Missing Python package | Run `python install.py` again |
| `CORS Error` | Frontend can't reach backend | Make sure backend is running (`python datasetlab.py status`) |
| `npm error: …` | Missing Node modules | Run `python install.py` again |

---

## 🤝 Contributing

1. Fork the repository.
2. Create a branch: `git checkout -b feature/awesome-feature`
3. Commit with clear messages.
4. Push and open a Pull Request.

---

*Thank you for using Dataset Lab! Found a bug? Open an issue on GitHub.*
