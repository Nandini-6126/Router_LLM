import base64
import shutil
import os
import zipfile
import json
from fastapi import FastAPI, UploadFile, File, Form 
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback 

# Import Modules
from parser_logic import KiCadParser
from router_logic import route_all
from writer import KiCadMerger
from llm_advisor import suggest_pcb_rules 

app = FastAPI()

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

# --- CORRECT ENDPOINT SIGNATURE ---
@app.post("/process-pcb") 
async def process_pcb(
    file: UploadFile = File(...),
    user_rules_json: str = Form(default="{}") # ACCEPT USER OVERRIDES
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 1. Parse (Gets raw data and base rules)
        parser = KiCadParser(file_path)
        parsed_data = parser.parse_all()
        
        # 2. Load User Overrides
        user_rules = json.loads(user_rules_json)
        
        # Determine if we should skip AI calculation
        skip_ai_calc = bool(user_rules.get("clearance") is not None or user_rules.get("trace_width") is not None)

        if skip_ai_calc:
            print("User provided critical parameters. Skipping AI and using parser defaults as base.")
            final_rules_used = parsed_data.get("rules", {}) # Base is parser's default
        else:
            # 2a. LLM Analysis (Only runs if user did NOT provide critical settings)
            print("Consulting AI for optimized design rules...")
            final_rules_used = suggest_pcb_rules(parsed_data)
        
        
        # 3. Apply User Override (High Priority Merge): User rules overwrite AI/PARSER defaults.
        if user_rules:
            print("Applying user overrides...")
            # Overwrite global rules with user input
            final_rules_used = {**final_rules_used, **user_rules}
            
            # If user set a global trace_width, apply it to the default netclass too
            if user_rules.get("trace_width") is not None and "Default" in final_rules_used.get("netclasses", {}):
                final_rules_used["netclasses"]["Default"]["trace_width"] = user_rules["trace_width"]

        # Apply the chosen ruleset
        parsed_data["rules"] = final_rules_used

        # 4. Route (Uses the chosen ruleset)
        print("Routing with configured parameters...")
        routing_result = route_all(parsed_data)

        # 5. Generate Output and Response
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

        # 6. Prepare Response
        with open(zip_path, "rb") as f:
            zip_b64 = base64.b64encode(f.read()).decode('utf-8')

        viz_data = {
            "boundary": parsed_data.get("board", {}).get("boundary", []),
            "pads": [o for o in parsed_data.get("obstacles", []) if o.get("type") == "pad"],
            "routes": routing_result.get("routes", [])
        }

        return JSONResponse(content={
            "status": "success",
            "ai_suggestions": final_rules_used,
            "filename": f"{base_name}_routed.zip",
            "file_data": zip_b64,
            "visualization": viz_data
        })

    except Exception as e:
        print("CRITICAL ERROR DURING PIPELINE EXECUTION.")
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)