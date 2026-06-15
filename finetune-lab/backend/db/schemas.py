from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TrainingRunBase(BaseModel):
    model: str
    dataset: str
    method: str

class TrainingRunCreate(TrainingRunBase):
    pass

class TrainingRun(TrainingRunBase):
    id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str

    class Config:
        from_attributes = True
