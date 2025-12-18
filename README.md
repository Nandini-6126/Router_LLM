An intelligent PCB design tool that leverages Gemini 2.0 Flash to analyze KiCad electrical nets and generate optimized routing rules. It features a FastAPI backend for complex A* routing logic and a React-based dashboard for real-time visualization and statistics.

Features
AI-Driven Net Analysis: Automatically classifies nets (Power, Data, Sensitive) to suggest optimal trace widths and clearances.

Advanced A Router*: High-efficiency pathfinding that accounts for pad density and global design constraints.

Manual Overrides: Hybrid mode allowing users to specify expert rules that bypass AI suggestions.

Real-time Dashboard: Live tracking of routing efficiency, successful connections, and failed net statistics.

Tech Stack
Backend: Python 3.10+, FastAPI, Uvicorn.

Frontend: React.js, Tailwind CSS, Axios.

AI Integration: Google Gemini 2.0 Flash API.

PCB Processing: KiCad file parsing and merging logic.

Getting Started for Testing
Prerequisites
Python 3.9+ and Node.js/npm must be installed.

A Google AI Studio API Key is required for the AI Advisor.

1. Environment Configuration
To keep the API key secure, set it as an environment variable in your terminal.

Windows (PowerShell): $env:GEMINI_API_KEY="your_api_key_here"

Mac/Linux: export GEMINI_API_KEY="your_api_key_here"

2. Backend Setup
Navigate to the backend directory: cd backend.

Create and activate a virtual environment:

Windows: python -m venv venv followed by .\venv\Scripts\activate

Mac/Linux: python3 -m venv venv followed by source venv/bin/activate

Install dependencies: pip install fastapi uvicorn requests python-multipart.

Start the server: python -m uvicorn router_server:app --reload.

3. Frontend Setup
Open a new terminal and navigate to the frontend: cd frontend.

Install Node packages: npm install.

Launch the application: npm start.

Access the UI at http://localhost:3000.

📍 How to Run a Test
Prepare File: Have a .kicad_pcb file ready for upload.

Set Rules: Use the "Design Rules" card in the UI to enter optional manual constraints (Clearance, Trace Width).

Run AI Advisor: Click "Run Auto-Router." The backend will first call the Gemini API to analyze your nets.

Review Stats: Once finished, check the dashboard for Routing Efficiency and Total Connections.

Download: The routed board will automatically download as a .zip containing the new .kicad_pcb and routing CSV.
