import base64
import shutil
import os
import zipfile
import json
import traceback
from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Import Logic Modules
from parser_logic import KiCadParser
from router_logic import route_all
from writer import KiCadMerger
from llm_advisor import suggest_pcb_rules 

# Import Database Modules (From your code snippet)
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# --- DATABASE SETUP ---
DATABASE_URL = "sqlite:///./pcb_history.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class RoutingJob(Base):
    __tablename__ = "routing_jobs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)
    input_path = Column(String)
    output_path = Column(String)
    rules_used = Column(JSON)  
    total_nets = Column(Integer)
    success_rate = Column(Float)

Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- APP INITIALIZATION ---
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

@app.get("/history")
async def get_history(db: Session = Depends(get_db)):
    """Fetch recent routing jobs from the database"""
    return db.query(RoutingJob).order_by(RoutingJob.timestamp.desc()).limit(10).all()

@app.post("/process-pcb") 
async def process_pcb(
    file: UploadFile = File(...),
    user_rules_json: str = Form(default="{}"),
    db: Session = Depends(get_db) # Injected database session
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 1. Parsing
        parser = KiCadParser(file_path)
        parsed_data = parser.parse_all()
        
        # 2. Rule Processing
        try:
            user_input_rules = json.loads(user_rules_json)
        except json.JSONDecodeError:
            user_input_rules = {}

        final_rules = {}
        if user_input_rules and user_input_rules.get("netclasses"):
            final_rules = user_input_rules
        else:
            if os.getenv("GEMINI_API_KEY"):
                final_rules = suggest_pcb_rules(parsed_data)
            else:
                final_rules = parsed_data.get("rules", {})

            if user_input_rules:
                final_rules = {**final_rules, **user_input_rules}

        parsed_data["rules"] = final_rules

        # 3. Routing
        routing_result = route_all(parsed_data)

        # 4. Generate Output
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

        # 5. DATABASE LOGGING
        total_nets = routing_result.get("total_connections", 0)
        success_count = len(routing_result.get("routes", []))
        success_rate = (success_count / total_nets) if total_nets > 0 else 0

        new_job = RoutingJob(
            filename=file.filename,
            input_path=file_path,
            output_path=zip_path,
            rules_used=final_rules,
            total_nets=total_nets,
            success_rate=success_rate
        )
        db.add(new_job)
        db.commit() # Save to pcb_history.db

        # 6. Prepare Response
        with open(zip_path, "rb") as f:
            zip_b64 = base64.b64encode(f.read()).decode('utf-8')

        viz_data = {
            "boundary": parsed_data.get("board", {}).get("boundary", []),
            "pads": [o for o in parsed_data.get("obstacles", []) if o.get("type") == "pad"],
            "routes": routing_result.get("routes", []),
            "failed_connections": routing_result.get("failed_connections", []),
            "total_connections": total_nets
        }

        return JSONResponse(content={
            "status": "success",
            "job_id": new_job.id, # Include the new DB ID
            "ai_suggestions": final_rules,
            "filename": f"{base_name}_routed.zip",
            "file_data": zip_b64,
            "visualization": viz_data
        })

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)