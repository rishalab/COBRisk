# ⬡ CORisk — COBOL Migration Risk Scorer

> Statically analyze your COBOL codebase and score each module across 5 risk dimensions — so your team migrates smart, not blind.

---

## 📁 Full Project Structure

```
CORisk/
├── backend/
│   ├── app.py              ← Flask API server (main entry point)
│   ├── analyzer.py         ← Core COBOL risk analysis engine
│   └── requirements.txt    ← Python dependencies
│
├── frontend/
│   ├── public/
│   │   └── index.html      ← HTML shell with Google Fonts
│   ├── src/
│   │   ├── index.js        ← React entry point
│   │   ├── index.css       ← Global CSS variables & theme
│   │   ├── App.js          ← Root component (page routing)
│   │   ├── pages/
│   │   │   ├── LandingPage.js          ← Upload page
│   │   │   ├── LandingPage.module.css
│   │   │   ├── DashboardPage.js        ← Results dashboard
│   │   │   └── DashboardPage.module.css
│   │   └── components/
│   │       ├── SummaryCards.js         ← KPI stat cards + donut chart
│   │       ├── SummaryCards.module.css
│   │       ├── ModuleTable.js          ← Sortable/filterable table
│   │       ├── ModuleTable.module.css
│   │       ├── ModuleDetail.js         ← Side panel with radar chart
│   │       ├── ModuleDetail.module.css
│   │       ├── DependencyGraph.js      ← D3 force-directed canvas graph
│   │       ├── DependencyGraph.module.css
│   │       ├── MigrationPlan.js        ← Phased roadmap + checklist
│   │       └── MigrationPlan.module.css
│   └── package.json
│
├── sample_cobol/
│   ├── CUSTPROC.cob        ← Customer processing (HIGH risk demo)
│   ├── VALCUST.cob         ← Validation utility (LOW risk demo)
│   └── RPTGEN.cob          ← Report generator (MEDIUM risk demo)
│
└── README.md
```

---

## ⚙️ Prerequisites

| Tool       | Version  | Install                              |
|------------|----------|--------------------------------------|
| Python     | 3.9+     | https://python.org                   |
| Node.js    | 18+      | https://nodejs.org                   |
| npm        | 9+       | Comes with Node.js                   |
| Git        | any      | https://git-scm.com                  |

Check your versions:
```bash
python --version
node --version
npm --version
```

---

## 🚀 Setup & Run (Step by Step)

### Step 1 — Clone / download the project
```bash
# If using git:
git clone <your-repo-url>
cd CORisk

# OR if you downloaded a zip, just extract and cd into it:
cd CORisk
```

---

### Step 2 — Set up the Backend (Python / Flask)

```bash
# Navigate to backend folder
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it:
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

✅ You should see:
```
* Running on http://127.0.0.1:5000
* Debug mode: on
```

Leave this terminal open!

---

### Step 3 — Set up the Frontend (React)

Open a **new terminal window**:

```bash
# From the CORisk root directory
cd frontend

# Install all npm packages (takes ~1-2 minutes first time)
npm install

# Start the React dev server
npm start
```

✅ Your browser will auto-open at:
```
http://localhost:3000
```

---

## 🧪 Using CORisk

### Option A — Try Sample Files
1. Open http://localhost:3000
2. Click **"Try Sample Files"**
3. The backend loads the 3 sample COBOL files from `sample_cobol/`
4. Results appear instantly on the Dashboard

### Option B — Upload Your Own COBOL Files
1. Open http://localhost:3000
2. Drag & drop your `.cob` / `.cbl` / `.cpy` files onto the dropzone
3. Click **"⚡ Analyze Risk"**
4. Explore the 4 dashboard tabs:
   - **📊 Overview** — Summary KPI cards + quick module list
   - **📋 Module Scores** — Full sortable table; click any row for detail panel
   - **🕸️ Dependency Graph** — Interactive force graph; drag nodes, click for details
   - **🗺️ Migration Plan** — Phase-by-phase roadmap + MRI bar chart + checklist

---

## 📊 The 5 Risk Metrics Explained

| Metric               | Weight | What It Measures                              |
|----------------------|--------|-----------------------------------------------|
| Coupling Density     | 30%    | Inbound CALLs + shared file operations        |
| Documentation Deficit| 25%    | Comment-to-code ratio (low = risky)           |
| Logic Volatility     | 20%    | GOTO count + paragraph count                  |
| Data Complexity      | 15%    | REDEFINES + COMP-3 + EBCDIC fields            |
| Dead Code Ratio      | 10%    | Paragraphs defined but never PERFORMed        |

**MRI (Migration Risk Index)** = weighted sum of all 5 metrics (0–100).

| MRI Range | Risk Tier | Action                         |
|-----------|-----------|--------------------------------|
| 0–34      | 🟢 LOW    | Safe to migrate now            |
| 35–59     | 🟡 MEDIUM | Migrate with caution           |
| 60–100    | 🔴 HIGH   | Do NOT migrate yet             |

---

## 🤖 AI Suggestions Setup (Groq)

AI suggestions are powered by **Groq's free LLM API** (llama3-8b-8192).  
The API key lives **only** in `backend/.env` — it is never sent to the frontend.

### Step 1 — Get your free Groq API key
1. Go to **https://console.groq.com/**
2. Sign up (free, no credit card needed)
3. Click **"API Keys"** → **"Create API Key"**
4. Copy the key

### Step 2 — Add it to your .env file
Open `backend/.env` and replace the placeholder:
```
GROQ_API_KEY=gsk_your_actual_key_here
GROQ_MODEL=llama3-8b-8192
```

### Step 3 — Restart the backend
```bash
# Stop the backend (Ctrl+C) then restart:
python app.py
```

### Step 4 — Verify it's working
```bash
curl http://localhost:5000/api/ai-status
# Should return: {"configured": true, ...}
```

✅ The dashboard header now shows **"🤖 AI Ready"** in green.

### How it works
- When you click **"Get AI Suggestions"** on a MEDIUM/HIGH risk module → backend calls Groq → returns structured JSON
- When you click **"Generate AI Suggestions for All Modules"** in the Migration Plan tab → batch call for all risky modules
- LOW risk modules are skipped automatically
- The API key is **never** exposed to the React frontend

### Available Groq models (all free)
| Model | Speed | Quality |
|---|---|---|
| `llama3-8b-8192` | ⚡ Fastest | Good (default) |
| `llama3-70b-8192` | Slower | Best quality |
| `mixtral-8x7b-32768` | Medium | Great for long context |

Change model in `backend/.env`:
```
GROQ_MODEL=llama3-70b-8192
```

---

## 🔌 API Endpoints (updated)

| Method | Endpoint             | Description                                    |
|--------|----------------------|------------------------------------------------|
| GET    | `/api/health`        | Health check + AI status                       |
| POST   | `/api/analyze`       | Upload and analyze COBOL files                 |
| GET    | `/api/analyze-sample`| Analyze built-in sample files                  |
| POST   | `/api/ai-suggest`    | Get AI suggestions for a single module         |
| POST   | `/api/ai-suggest-all`| Get AI suggestions for all MEDIUM+HIGH modules |
| GET    | `/api/ai-status`     | Check if Groq API key is configured            |



| Method | Endpoint             | Description                            |
|--------|----------------------|----------------------------------------|
| GET    | `/api/health`        | Health check                           |
| POST   | `/api/analyze`       | Upload and analyze COBOL files         |
| GET    | `/api/analyze-sample`| Analyze built-in sample files          |

### Example API call (curl):
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F "files=@CUSTPROC.cob" \
  -F "files=@VALCUST.cob"
```

---

## 🐛 Troubleshooting

### "CORS error" in browser
Make sure the Flask backend is running on port 5000.

### "No valid COBOL files found"
Ensure your files have `.cob`, `.cbl`, or `.cpy` extensions.

### Frontend shows "Analysis failed"
Backend is not running. Start it first with `python app.py`.

### Port 3000 already in use
```bash
# Kill whatever is on port 3000, or use a different port:
PORT=3001 npm start
```

### Port 5000 already in use (macOS AirPlay)
```bash
# Edit backend/app.py, change the last line to:
app.run(debug=True, port=5001)
# Then update frontend/package.json "proxy" to http://localhost:5001
```

---

## 🔬 Adding More COBOL Files

Just drop `.cob` or `.cbl` files into `sample_cobol/` to expand the sample dataset.
Or upload any number of files directly via the UI.

---

## 🏗️ Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Python 3 + Flask + Flask-CORS                   |
| Analysis | Pure Python regex + graph algorithms            |
| Frontend | React 18 + CSS Modules                         |
| Charts   | Recharts (radar, bar, radial)                   |
| Graph    | Canvas 2D API with custom force simulation      |
| Fonts    | Syne (display) + DM Sans (body) + DM Mono       |

---

## 📄 License
MIT — free to use, modify, and publish.

Built with ❤️ at RISHA Lab, IIT Tirupati.
