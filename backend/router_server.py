import base64
import shutil
import os
import zipfile
import json
import traceback
import io
import time
from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse, FileResponse
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

@app.get("/download/{job_id}")
async def download_job_output(job_id: int, db: Session = Depends(get_db)):
    """
    Download the ZIP for a previously-processed job.
    This avoids base64-in-JSON overhead and is much faster for large outputs.
    """
    job = db.query(RoutingJob).filter(RoutingJob.id == job_id).first()
    if not job:
        return JSONResponse(content={"error": "Job not found"}, status_code=404)
    if not job.output_path or not os.path.isfile(job.output_path):
        return JSONResponse(content={"error": "Output file missing on server"}, status_code=404)
    return FileResponse(
        path=job.output_path,
        filename=os.path.basename(job.output_path),
        media_type="application/zip",
    )

@app.post("/process-pcb") 
async def process_pcb(
    file: UploadFile = File(...),
    user_rules_json: str = Form(default="{}"),
    include_file_data: bool = Form(default=True),
    db: Session = Depends(get_db) # Injected database session
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        t0 = time.perf_counter()
        timings_ms = {}

        # 1. Parsing
        parser = KiCadParser(file_path)
        parsed_data = parser.parse_all()
        timings_ms["parse"] = round((time.perf_counter() - t0) * 1000, 2)
        
        # 2. Rule Processing
        t_rules = time.perf_counter()
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
        timings_ms["rules"] = round((time.perf_counter() - t_rules) * 1000, 2)

        # 3. Routing
        t_route = time.perf_counter()
        routing_result = route_all(parsed_data)
        timings_ms["routing"] = round((time.perf_counter() - t_route) * 1000, 2)

        # 4. Generate Output
        t_out = time.perf_counter()
        merger = KiCadMerger(file_path, routing_result)
        base_name = os.path.splitext(file.filename)[0]
        zip_path = os.path.join(OUTPUT_DIR, f"{base_name}_result.zip")
        
        # Build output files in-memory (faster than write->zip->read)
        csv_bytes = merger.generate_csv_bytes()
        kicad_text = merger.generate_kicad_board_text()

        zip_buf = io.BytesIO()
        try:
            zipf = zipfile.ZipFile(
                zip_buf,
                mode="w",
                compression=zipfile.ZIP_DEFLATED,
                compresslevel=1,  # speed > size
            )
        except TypeError:
            # Older Python without compresslevel support
            zipf = zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED)

        with zipf:
            zipf.writestr(f"{base_name}_routes.csv", csv_bytes)
            zipf.writestr(f"{base_name}_routed.kicad_pcb", kicad_text.encode("utf-8"))

        zip_bytes = zip_buf.getvalue()

        # Persist ZIP for history/download endpoint
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)

        timings_ms["output_zip_build"] = round((time.perf_counter() - t_out) * 1000, 2)

        # 5. DATABASE LOGGING
        t_db = time.perf_counter()
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
        timings_ms["db_commit"] = round((time.perf_counter() - t_db) * 1000, 2)

        # 6. Prepare Response
        t_resp = time.perf_counter()
        zip_b64 = None
        if include_file_data:
            zip_b64 = base64.b64encode(zip_bytes).decode("utf-8")
            timings_ms["base64"] = round((time.perf_counter() - t_resp) * 1000, 2)

        viz_data = {
            "boundary": parsed_data.get("board", {}).get("boundary", []),
            "pads": [o for o in parsed_data.get("obstacles", []) if o.get("type") == "pad"],
            "routes": routing_result.get("routes", []),
            "failed_connections": routing_result.get("failed_connections", []),
            "total_connections": total_nets
        }

        content = {
            "status": "success",
            "job_id": new_job.id, # Include the new DB ID
            "ai_suggestions": final_rules,
            "filename": f"{base_name}_routed.zip",
            "file_url": f"/download/{new_job.id}",
            "visualization": viz_data
        }
        if include_file_data:
            content["file_data"] = zip_b64
        content["timings_ms"] = timings_ms

        return JSONResponse(content=content)

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)