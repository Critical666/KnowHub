"""知识库管理API"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user, AuthUser
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate, 
    KnowledgeBaseUpdate, 
    KnowledgeBaseResponse,
    KnowledgeBaseListResponse
)
from app.services.rag.vector_store import MilvusVectorStore
from app.core.config import settings

router = APIRouter(prefix="/api/v1/knowledge-bases", tags=["knowledge-bases"])


@router.get("", response_model=KnowledgeBaseListResponse)
def list_knowledge_bases(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取知识库列表
    """
    kbs = db.query(KnowledgeBase).filter(
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).order_by(KnowledgeBase.created_at.desc()).all()
    
    return KnowledgeBaseListResponse(
        items=[kb.to_dict() for kb in kbs],
        total=len(kbs)
    )


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    data: KnowledgeBaseCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建新知识库
    """
    kb = KnowledgeBase(
        name=data.name,
        description=data.description,
        org_id=user.org_id,
        created_by=user.user_id,
        status=KBStatus.ACTIVE
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    
    # 创建对应的Milvus Collection
    try:
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.create_collection(kb.id)
    except Exception as e:
        # 如果向量存储创建失败，回滚数据库操作
        db.delete(kb)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create vector collection: {str(e)}"
        )
    
    return kb.to_dict()


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(
    kb_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取知识库详情
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    return kb.to_dict()


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    kb_id: str,
    data: KnowledgeBaseUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新知识库信息
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    if data.name is not None:
        kb.name = data.name
    if data.description is not None:
        kb.description = data.description
    
    db.commit()
    db.refresh(kb)
    
    return kb.to_dict()


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    kb_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除知识库（软删除）
    同时删除关联的向量数据
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    # 软删除
    kb.status = KBStatus.DELETED
    db.commit()
    
    # 删除向量存储中的Collection
    try:
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.delete_collection(kb_id)
    except Exception as e:
        # 记录错误但不影响删除操作
        print(f"Warning: Failed to delete vector collection: {e}")
    
    return None
