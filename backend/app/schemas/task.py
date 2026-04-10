from datetime import datetime
from pyclbr import Class
import string
from pydantic import BaseModel
from typing import Optional
from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    title: str
    description: Optional[str]
    status: TaskStatus = TaskStatus.PENDING


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description : Optional[str] = None
    status : Optional[TaskStatus] = None


class TaskStatusUpdate(BaseModel):
    status : TaskStatus


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: TaskStatus
    org_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True