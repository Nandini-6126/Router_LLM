import base64
import shutil
import os
import zipfile
import json
from fastapi import FastAPI, UploadFile, File, Form 
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback 

# Import Logic Modules
from parser_logic import KiCadParser
from router_logic import route_all
from writer import KiCadMerger
from llm_advisor import suggest_pcb_rules 

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.post("/process-pcb") 
async def process_pcb(
    file: UploadFile = File(...),
    user_rules_json: str = Form(default="{}") # Accepts stringified JSON from App.js
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 1. Parse the board file
        parser = KiCadParser(file_path)
        parsed_data = parser.parse_all()
        
        # 2. Rule Processing Logic
        try:
            user_input_rules = json.loads(user_rules_json)
        except json.JSONDecodeError:
            print("Invalid JSON in user rules, falling back to empty dict.")
            user_input_rules = {}

        final_rules = {}

        # Scenario A: User provided a full expert ruleset (contains netclasses)
        if user_input_rules and user_input_rules.get("netclasses"):
            print("Using FULL user JSON ruleset. Skipping AI calculation.")
            final_rules = user_input_rules
        else:
            # Scenario B: Hybrid Mode (AI + Simple Overrides)
            # Check if API Key exists for AI advisor
            if os.getenv("GEMINI_API_KEY"):
                print("Consulting AI for optimized design rules...")
                final_rules = suggest_pcb_rules(parsed_data)
            else:
                print("GEMINI_API_KEY not set. Using parser default rules as base.")
                final_rules = parsed_data.get("rules", {})

            # Merge simple user overrides (like clearance or trace_width from UI)
            if user_input_rules:
                print("Merging simple user overrides...")
                final_rules = {**final_rules, **user_input_rules}
                
                # Ensure global trace width applies to the 'Default' netclass as well
                if "trace_width" in user_input_rules:
                    if "netclasses" not in final_rules:
                        final_rules["netclasses"] = {}
                    if "Default" not in final_rules["netclasses"]:
                        final_rules["netclasses"]["Default"] = {}
                    final_rules["netclasses"]["Default"]["trace_width"] = user_input_rules["trace_width"]

        # Apply processed rules to the data object
        parsed_data["rules"] = final_rules

        # 3. Execute Routing
        print("Routing with configured parameters and tracking statistics...")
        # route_all returns {routes, failed_connections, total_connections, summary}
        routing_result = route_all(parsed_data)

        # 4. Generate Output Files
        merger = KiCadMerger(file_path, routing_result)
        base_name = os.path.splitext(file.filename)[0]
        csv_path = os.path.join(OUTPUT_DIR, f"{base_name}_routes.csv")
        kicad_out_path = os.path.join(OUTPUT_DIR, f"{base_name}_routed.kicad_pcb")
        zip_path = os.path.join(OUTPUT_DIR, f"{base_name}_result.zip")
        
        merger.generate_csv(csv_path)
        merger.generate_kicad_board(kicad_out_path)
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            zipf.write(csv_path, arcname=f"{base_name}_routes.csv")
            zipf.write(kicad_out_path, arcname=f"{base_name}_routed.kicad_pcb")

        # 5. Prepare Base64 response
        with open(zip_path, "rb") as f:
            zip_b64 = base64.b64encode(f.read()).decode('utf-8')

        # 6. Build Visualization Data (including stats for the React UI)
        viz_data = {
            "boundary": parsed_data.get("board", {}).get("boundary", []),
            "pads": [o for o in parsed_data.get("obstacles", []) if o.get("type") == "pad"],
            "routes": routing_result.get("routes", []),
            "failed_connections": routing_result.get("failed_connections", []),
            "total_connections": routing_result.get("total_connections", 0)
        }

        return JSONResponse(content={
            "status": "success",
            "ai_suggestions": final_rules,
            "filename": f"{base_name}_routed.zip",
            "file_data": zip_b64,
            "visualization": viz_data
        })

    except Exception as e:
        print("CRITICAL ERROR DURING PIPELINE EXECUTION.")
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)