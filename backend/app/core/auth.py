"""
免认证版本 - 所有用户共享一个默认组织
"""
from fastapi import Depends
from typing import Optional

class AuthUser:
    """默认用户，所有操作使用固定 org_id"""
    def __init__(self):
        self.user_id = "default_user"
        self.org_id = "default_org"
        self.org_permissions = [
            "org:tasks:view",
            "org:tasks:edit", 
            "org:tasks:delete",
            "org:tasks:create"
        ]

    def has_permission(self, permission: str) -> bool:
        return True
    
    @property
    def can_view(self) -> bool:
        return True
    
    @property
    def can_edit(self) -> bool:
        return True
    
    @property
    def can_delete(self) -> bool:
        return True
    
    @property
    def can_create(self) -> bool:
        return True

# 默认用户实例
default_user = AuthUser()

def get_current_user() -> AuthUser:
    """返回默认用户，无需认证"""
    return default_user

def require_view() -> AuthUser:
    return default_user

def require_create() -> AuthUser:
    return default_user

def require_delete() -> AuthUser:
    return default_user

def require_edit() -> AuthUser:
    return default_user
