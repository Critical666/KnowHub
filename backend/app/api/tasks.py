from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import (
    AuthUser,
    require_view,
    require_create,
    require_delete,
    require_edit,
)
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter(prefix='/api/tasks', tags=['tasks'])


@router.get('', response_model=List[TaskResponse])
def list_tasks(
    user: AuthUser = Depends(require_view),
    db: Session = Depends(get_db),
) -> List[Task]:
    """获取当前组织的所有任务"""
    tasks = db.query(Task).filter(Task.org_id == user.org_id).all()
    return tasks


@router.post('', response_model=TaskResponse)
def create_task(
    task_data: TaskCreate,
    user: AuthUser = Depends(require_create),
    db: Session = Depends(get_db),
) -> Task:
    """创建新任务"""
    task = Task(
        title=task_data.title,
        description=task_data.description,
        status=task_data.status,
        org_id=user.org_id,
        created_by=user.user_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get('/{task_id}', response_model=TaskResponse)
def get_task(
    task_id: str,
    user: AuthUser = Depends(require_view),
    db: Session = Depends(get_db),
) -> Task:
    """获取单个任务详情"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.org_id == user.org_id,
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Task not found',
        )

    return task


@router.put('/{task_id}', response_model=TaskResponse)
def update_task(
    task_id: str,
    task_data: TaskUpdate,
    user: AuthUser = Depends(require_edit),
    db: Session = Depends(get_db),
) -> Task:
    """更新任务"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.org_id == user.org_id,
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Task not found',
        )

    if task_data.title is not None:
        task.title = task_data.title
    if task_data.description is not None:
        task.description = task_data.description
    if task_data.status is not None:
        task.status = task_data.status

    db.commit()
    db.refresh(task)
    return task


@router.delete('/{task_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    user: AuthUser = Depends(require_delete),
    db: Session = Depends(get_db),
) -> None:
    """删除任务"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.org_id == user.org_id,
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Task not found',
        )

    db.delete(task)
    db.commit()
    return None
