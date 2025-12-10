AI PCB Router: Intelligent Design Rule Generation and Autorouting
Overview

The AI PCB Router is a full-stack application designed to automate and optimize the process of Printed Circuit Board (PCB) routing. It uses a Large Language Model (LLM) to intelligently analyze a KiCad netlist, generate expert-level design rules (e.g., trace widths, clearances), and then execute an A-star algorithm to route the board.

The system is built on a stable three-tier architecture: React frontend, FastAPI Python backend, and specialized Python logic modules.

### Key Features
Intelligent Rule Generation: Uses the Gemini API to analyze net names (`VCC`, `GND`, `SPI`, etc.) and generate optimal, net-class-specific routing parameters.
User Override Priority:** Allows the user to skip the AI suggestion and provide their own high-priority global rules (Clearance, Trace Width).
Autorouting: Executes a local A-star algorithm using the generated or user-provided rules.
Visualization: Displays the routed board outline, pads, and traces directly in the web browser.
Output: Generates a downloadable ZIP file containing the final routed `.kicad_pcb` and a routing `.csv` log.

### Local Setup Guide

Follow these steps precisely to set up and run the application.

#### **Prerequisites**

  * Python 3.10+
  * Node.js and npm
  * A Gemini API Key (Set up billing to ensure continuous service.)

#### A. Backend Setup (FastAPI/Python)

1.  Navigate to Backend:

    ```bash
    cd backend
    ```

2.  **Create and Activate Virtual Environment (Crucial Step):**

    ```bash
    python -m venv venv
    .\venv\Scripts\Activate.ps1
    ```

3.  **Install Dependencies:**

      * *Note: We use `requests` for the LLM due to environment conflicts with the SDK.*

    <!-- end list -->

    ```bash
    .\venv\Scripts\pip.exe install fastapi uvicorn python-multipart requests
    ```

4.  **Set API Key (MUST BE DONE BEFORE STARTING THE SERVER):**

      * Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key.

    <!-- end list -->

    ```powershell
    $env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```

5.  **Start the Backend Server (Using Full Path):**

      * *This ensures the correct Python interpreter is used, resolving environment errors.*

    <!-- end list -->

    ```powershell
    .\venv\Scripts\python.exe -m uvicorn main:app --reload
    ```

    The server should start on `http://127.0.0.1:8000`.

#### **B. Frontend Setup (React)**

1.  **Navigate to Frontend:**

    ```bash
    cd ../frontend
    ```

2.  **Install Node Dependencies:**

    ```bash
    npm install
    ```

3.  **Start the Frontend Server:**

    ```bash
    npm start
    ```

    The application will open in your browser on `http://localhost:3000`.

### 🚀 Usage

1.  Ensure both backend and frontend terminals are running.
2.  In your browser, upload a `.kicad_pcb` file.
3.  (Optional): Enter a custom value (e.g., `0.3`) in the **Design Rule Override** fields to skip the AI calculation.
4.  Click **"Run Auto-Router"**.
5.  The backend will execute the pipeline, and the routed board will appear in the preview window, with the final routed ZIP file downloading automatically.

Project Structure


AI_PCB_Router/
├── backend/
│   ├── main.py               # FastAPI server, orchestrates the entire pipeline.
│   ├── llm_advisor.py        # Connects to Gemini API (via direct HTTP/requests).
│   ├── parser_logic.py       # Reads KiCad file and extracts data (nets, obstacles).
│   ├── router_logic.py       # A-star algorithm for pathfinding.
│   ├── writer.py             # Formats the output (final .kicad_pcb and CSV).
│   └── venv/                 # Python Virtual Environment (ignored by Git)
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component, handles UI and API calls.
│   │   └── PCBViewer.js      # Component for visualizing the board graphics.
│   └── node_modules/         # Node Dependencies (ignored by Git)
└── README.md
```
