# LeadChain — AI-Powered Intelligent Outreach Workflow Automation Engine

LeadChain is a comprehensive workflow-driven automation platform designed to execute highly personalized outreach sequences based on user-defined logic. Designed for sales and outreach teams, it features a visual drag-and-drop workflow builder, AI-generated messaging, intelligent delay mechanisms, and human-like behavioral simulation to test outreach strategies safely.

## A) Key Features

### 1. 🧠 Company Knowledge Base
Context is everything. The Knowledge Base module allows you to define your company's core messaging, value propositions, and perfect customer profile so the AI knows exactly how to sell your product.
*   **Three Input Modes:** Paste text directly, fill out a guided questionnaire, or upload documents (.pdf, .docx, .txt).
*   **AI Extraction:** Automatically extracts key structured parameters (description, product offering, target customers, value proposition, tone) from unstructured input.
*   **Persistent Storage:** Saves your company context to the database to be injected into automated outreach workflows.
<img width="1919" height="869" alt="image" src="https://github.com/user-attachments/assets/66887263-89e4-4b9e-9103-499f71854376" />


### 2. ⚡ Visual Workflow Designer
A powerful, React Flow-powered drag-and-drop canvas to build branching outreach sequences.
*   **12 specialized node types**, including:
    *   **Action Nodes:** Trigger, Load Lead, Send Message, Update Status.
    *   **Logic Nodes:** Delay (fixed or randomized), Check Reply, Condition (branching logic based on intent), Lead Score.
    *   **AI Nodes:** AI Compose (generate emails), AI Personalize (customize based on lead data), AI Analyze (intent detection), and Persona Simulation (simulate replies).
*   **Simulation Engine:** Test your workflows instantly using AI-simulated personas (e.g., "Skeptical CTO" or "Busy Founder") to see how your sequence performs before going live.
*   **State Persistence:** Save, load, update, and manage multiple unique workflows in the database.
<img width="1919" height="865" alt="image" src="https://github.com/user-attachments/assets/fe905203-4a3b-4397-a51b-8a56138d7acc" />


### 3. 🎯 Lead Intelligence
Manage your contacts and gain high-level demographic insights.
*   **Smart Ingestion:** Upload `.csv` or `.xlsx` files. The system idempotently handles ingestion, skipping duplicates.
*   **Analytics Dashboard:** Pandas-powered server-side aggregations visualize your leads by Top Industries, Top Countries, Job Titles, and Lead Sources.
*   **AI Campaign Ideas:** Generate personalized cold outreach campaign strategies automatically based on your current lead pool demographics.
<img width="1919" height="703" alt="image" src="https://github.com/user-attachments/assets/5b94f9fb-fcbe-46a8-9a02-7531f1d0d609" />


---

## B) Technology Stack

*   **Frontend:** React 18, TypeScript, Vite, `lucide-react` (icons), `@xyflow/react` (node canvas), `react-markdown` (AI output).
*   **Backend:** Python 3, FastAPI, SQLite (SQLAlchemy ORM), Pandas (analytics), OpenAI API (gpt-4o-mini).

---

## C) Local Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   An OpenAI API Key

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Environment Variables:
   Create a `.env` file in the `backend/` directory and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-real-openai-api-key-here
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will run at `http://localhost:8000`. It will automatically create the `coherence.db` SQLite database.

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the local URL (usually `http://localhost:5173`).

---

## D) How to Use the App (Workflow Guide)

**Step 1: Set the Context**
Navigate to the **Knowledge Base** page. Upload a company document or write a short description of your product. Click "Extract with AI", review the 5 generated parameters, and click **Save**. This context will be used by all AI nodes.

**Step 2: Ingest Leads**
Navigate to the **Lead Intelligence** page. Drag and drop a CSV containing your leads (must include at minimum an `email` column). Check the analytics dashboard to see your lead distribution. Optionally, use the "AI Campaign Ideas" feature to brainstorm outreach angles.

**Step 3: Build & Test a Workflow**
Navigate to the **Workflow Builder**.
*   Drag a **Trigger** node onto the canvas.
*   Connect it to an **AI Compose** node.
*   Connect that to a **Persona Sim** node.
*   Hit **Run Simulation**. The engine will execute the nodes sequentially on a simulated lead, generating a personalized email and simulating a human reply based on the chosen persona (e.g., "Skeptical CTO").
*   Use the **Log Timeline** on the right side to inspect the exact payload, AI intent analysis, and lead scoring at every step.
*   Name your workflow and click **Save**.

---


## ✨ What's New in Version 0.2.0

The "Workflow & Intelligence" update brings massive agentic capabilities:

1.  **AI Workflow Designer:** No more manual dragging. Describe your campaign goal in plain English (e.g., *"Build a 3-step reactivation sequence for inactive customers"*), and the AI will automatically construct the entire node-graph for you.
<img width="1919" height="859" alt="image" src="https://github.com/user-attachments/assets/d355c116-3f09-4607-82fc-ff1174b9c6f3" />
2.  **A/B Testing Hub:** Split-test your outreach messaging. Define two different prompt variants, run them against your workflows, and receive a side-by-side **AI Verdict** on which approach is more effective for conversion.
3.  **Real Data Integration:** Workflows now pull live data from your **Lead Database**. The "Load Lead" node features a dynamic picker to test sequences on actual contacts.
4.  **Markdown Powered Outputs:** All AI-generated campaigns and A/B test verdicts now render in rich Markdown for better readability.
5.  **Smart Personalization:** AI nodes are now natively integrated with your structured Knowledge Base (Company Description, Value Prop, etc.) for high-fidelity messaging.

---
*Built for the Coherence-26 Hackathon by Bay Harbor Coders.*
