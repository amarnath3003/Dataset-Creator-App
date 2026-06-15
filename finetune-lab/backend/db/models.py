from sqlalchemy import Column, Integer, String, Float, DateTime
from db.database import Base
from datetime import datetime

class TrainingRun(Base):
    __tablename__ = "training_runs"

    id = Column(String, primary_key=True, index=True)
    model = Column(String, index=True)
    dataset = Column(String, index=True)
    method = Column(String)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String)

class TrainingConfig(Base):
    __tablename__ = "training_configs"

    run_id = Column(String, primary_key=True, index=True)
    lr = Column(Float)
    batch_size = Column(Integer)
    epochs = Column(Integer)
    optimizer = Column(String)
    scheduler = Column(String)

class Metric(Base):
    __tablename__ = "metrics"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    run_id = Column(String, index=True)
    step = Column(Integer)
    loss = Column(Float)
    learning_rate = Column(Float)
    gpu_util = Column(Float)
    vram = Column(Float)
