# Dataset Lab (Dataset Creator App)

<img src="../docs/brand/logo.svg" alt="Dataset Lab" width="90"/>

## 📖 Project Overview

**Dataset Lab** is a powerful, file-based dataset engineering system designed to help you create, refine, and export high-quality instruction-style Question Answering (QA) datasets. Built with a modern tech stack (Python/FastAPI for the backend and React/Vite for the frontend), it provides a seamless multi-stage pipeline:

1. **Upload & Chunking:** Ingest source documents and split them into manageable chunks.
2. **Generation:** Leverage powerful Large Language Models (LLMs)—both local and cloud-based—to generate relevant QA pairs.
3. **Refinement:** Clean, format, and filter the generated datasets.
4. **Export:** Export robust datasets in various formats (JSON, JSONL, CSV) ready for fine-tuning.

Dataset Lab ensures strict adherence to file-based state management, robust pipeline failure handling, and cross-platform compatibility.

---

## 💻 System Requirements

- **Operating System:** Windows 10/11, macOS (M1/M2/Intel), or Linux.
- **RAM:** Minimum 8GB. (16GB+ recommended if running local LLMs).
- **Disk Space:** At least 2GB for the application. Additional space required for datasets and local LLMs (typically 4GB-10GB per model).
- **Network:** Internet connection required for initial setup and downloading online models.

---

## 🛠️ Required Software Installations

Before proceeding, ensure you have the following installed on your machine:

1. **Python 3.9+**: For running the FastAPI backend. [Download Python](https://www.python.org/downloads/)
2. **Node.js 18+**: For running the React frontend. [Download Node.js](https://nodejs.org/en/download/)
3. **Ollama** (Optional but Recommended): For running local open-source LLMs entirely on your machine. [Download Ollama](https://ollama.com/download)

---

## 🚀 Environment Setup

### 1. Cloning the Repository

Start by cloning the repository to your local machine:

```bash
git clone https://github.com/your-username/dataset-lab.git
cd dataset-lab
```

*(Note: If you already have the source code downloaded, simply navigate to the `dataset-lab` root directory in your terminal).*

### 2. Installing Dependencies

You need to install dependencies for both the backend and frontend separately.

#### Backend Setup

Open a terminal in the root `dataset-lab` directory:

```bash
# Recommended: Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

#### Frontend Setup

Open a **new** terminal, and navigate to the frontend directory:

```bash
cd dataset-lab/frontend

# Install frontend dependencies
npm install
```

---

## 🤖 Model Setup and Serving Instructions

Dataset Lab supports both online (e.g., OpenAI) and local LLMs. For offline, privacy-first dataset generation, we recommend **Ollama**.

### Setting up Ollama
1. Install Ollama from [ollama.com](https://ollama.com/).
2. Open a terminal and download your preferred model. For example, to use Llama 3:
   ```bash
   ollama run llama3
   ```
   *This command downloads the model and starts the interactive prompt. You can type `/bye` to exit the prompt, but the Ollama service will remain running in the background.*
3. Ensure the Ollama service is running (usually it runs on `http://localhost:11434`). Dataset Lab will automatically connect to it.

---

## ⚙️ Configuration Steps & Environment Variables

Create a file named `.env` in the **root directory** of the project (`dataset-lab/.env`).

Here are the environment variables you can set:

```env
# Document Processing Settings
DEFAULT_CHUNK_SIZE=800
DEFAULT_CHUNK_OVERLAP=100
DEFAULT_SIMILARITY_THRESHOLD=0.92

# External API Keys (Optional, only if using online models)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Dataset Lab is designed to work out-of-the-box with default settings, but you can tweak these values to optimize your chunking logic.

---

## 🏃 Running the Application

To run Dataset Lab locally for development, you need to start both the backend and frontend servers.

### 1. Running the Backend

Open a terminal in the `dataset-lab` root directory, ensure your virtual environment is active, and run:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
You should see output indicating the API is running at `http://0.0.0.0:8000`.
You can view the interactive API documentation at `http://localhost:8000/docs`.

### 2. Running the Frontend

Open a **second terminal** in the `dataset-lab/frontend` directory and run:

```bash
npm run dev
```
You should see output indicating the frontend is running (typically at `http://localhost:5173`). Open this URL in your browser to access the Dataset Lab UI!

---

## 🏗️ Production Build Steps

When you are ready to deploy the application in a production environment:

1. **Frontend Build:**
   ```bash
   cd frontend
   npm run build
   ```
   This generates a `dist` folder containing the optimized static assets.

2. **Backend Execution:**
   Do **not** use the `--reload` flag in production.
   ```bash
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
   *(For high performance, consider using `gunicorn` with `uvicorn` workers).*

---

## 🌍 Deployment Instructions

1. **Frontend:** You can host the contents of the `frontend/dist` directory using any static file server like **Nginx**, **Apache**, **Vercel**, or **Netlify**.
2. **Backend:** Deploy the FastAPI backend to a server (e.g., AWS EC2, DigitalOcean, Render, or Railway). Ensure the backend server securely exposes port `8000` (or your configured port).
3. **CORS:** Update `backend/main.py` CORS settings to restrict `allow_origins` to your production frontend domain instead of `["*"]`.

---

## 🧪 Testing Instructions

Currently, testing relies on manual verification and API testing.

1. **API Testing:** Navigate to `http://localhost:8000/docs` while the backend is running. You can test all FastAPI endpoints directly from the Swagger UI.
2. **End-to-End Flow:**
   - Create a project in the UI.
   - Upload a text or PDF file.
   - Run the pipeline and ensure intermediate status indicators update.
   - Verify that generated outputs exist in the project's folder within `dataset-lab/projects/`.

---

## 🚑 Troubleshooting Section

**1. Pipeline gets stuck in the "Running" state indefinitely.**
- **Reason:** The server crashed mid-execution, and lock files were not cleanly removed.
- **Fix:** Navigate to `dataset-lab/projects/<your-project-name>`. Manually delete the `.running` or `.stop` hidden files. Restart the backend server.

**2. Cannot connect to Local LLMs (Ollama).**
- **Reason:** Ollama service isn't running, or it's not exposed on the expected port.
- **Fix:** Verify Ollama is running (`ollama run llama3` works). Ensure it is accessible at `http://localhost:11434`.

---

## ❌ Common Errors and Fixes

| Error Message | Cause | Solution |
| :--- | :--- | :--- |
| `[Errno 98] Address already in use` | Port 8000 or 5173 is occupied. | Kill the existing process holding the port or change the port (`--port 8080` for backend, `--port 3000` for frontend). |
| `CORS Error in Browser Console` | Frontend Cannot connect to Backend. | Ensure backend is running. If backend is hosted elsewhere, update the `API_URL` environment variable for the frontend. |
| `ModuleNotFoundError: No module named 'xyz'` | Missing Python package. | Make sure your virtual environment is activated and run `pip install -r backend/requirements.txt` again. |
| `React/Vite error during npm run dev` | Missing Node modules. | Run `npm install` inside the `frontend` directory. |

---

## 📁 Folder Structure Explanation

```text
dataset-lab/
├── backend/                # FastAPI backend code
│   ├── engines/            # LLM interaction & processing logic
│   ├── formats/            # Export format templates
│   ├── llm/                # LLM provider configurations
│   ├── prompts/            # System & user prompt templates
│   ├── routes/             # API endpoints (Projects, Pipeline, Export)
│   ├── config.py           # Application settings & environment parsing
│   ├── main.py             # FastAPI application entry point
│   ├── models.py           # Pydantic data models
│   └── requirements.txt    # Python dependencies
├── frontend/               # React / Vite frontend code
│   ├── public/             # Static public assets
│   ├── src/                # React source code
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Full page views (Dashboard, Workspace)
│   │   ├── index.css       # Global styles (Tailwind / Custom CSS)
│   │   └── main.jsx        # React application entry point
│   ├── package.json        # Node dependencies & scripts
│   └── tailwind.config.js  # Tailwind CSS configuration
├── projects/               # GENERATED by app: Stores all user project data files
├── .env                    # Environment variables (Create this manually)
└── README.md               # This documentation file
```

---

## 🤝 Contribution Guidelines

We welcome contributions to Dataset Lab! If you'd like to help improve the project, please follow these steps:

1. **Fork the repository.**
2. **Create a new branch** for your feature or bugfix (`git checkout -b feature/awesome-new-feature`).
3. **Commit your changes** with clear, descriptive commit messages.
4. **Push your branch** to your fork (`git push origin feature/awesome-new-feature`).
5. **Open a Pull Request** describing your changes in detail, why they were made, and how they solve the problem.
6. Ensure your code follows the existing style, and test thoroughly before submitting!

---

*Thank you for using Dataset Lab! If you encounter any bugs, please check the Troublsehooting section or run through to raise an issue.*
