from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    """创建任务请求模型"""
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING


class TaskUpdate(BaseModel):
    """更新任务请求模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None


class TaskResponse(BaseModel):
    """任务响应模型"""
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
