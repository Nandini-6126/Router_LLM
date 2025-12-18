from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# 1. Setup Database Connection (SQLite creates a file named pcb_history.db)
DATABASE_URL = "sqlite:///./pcb_history.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. Define the Routing Job Table
class RoutingJob(Base):
    __tablename__ = "routing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)
    input_path = Column(String)
    output_path = Column(String)
    rules_used = Column(JSON)  # Stores the rules (AI + Overrides)
    total_nets = Column(Integer)
    success_rate = Column(Float)

# 3. Create the table in the .db file
Base.metadata.create_all(bind=engine)