import httpx # 用于构建与Clerk认证服务交互的请求对象
# Depends实现依赖注入，HTTPException返还错误响应，Request获取原始请求对象，status提供HTTP状态码常量
from fastapi import Depends, HTTPException, Request, status
# Clerk官方SDK，其中AuthenticateRequestOptions用于配置认证选项
from clerk_backend_api.security import AuthenticateRequestOptions

from app.core.config import settings # 配置项，从.env中获取
from app.core.clerk import clerk

'''
AuthUser表示一个已认证且已选择组织的用户。

org_permissions 是当前组织下用户的权限列表（如 ["org:tasks:view", "org:tasks:edit"]）。
提供 has_permission 通用检查方法，以及四个便捷属性用于常见的任务操作权限。
这种设计使得在路由函数中可以直观地写 if user.can_edit: 而不必硬编码权限字符串。
'''
class AuthUser:
    def __init__(self, user_id: str, org_id: str, org_permissions: list):
        self.user_id = user_id
        self.org_id = org_id
        self.org_permissions = org_permissions

    def has_permission(self, permission: str) -> bool:
        return permission in self.org_permissions
    
    # @property 是一个内置装饰器，它可以将一个方法转变为只读属性，
    # 从而允许你像访问字段一样调用它（无需加括号）。
    @property
    def can_view(self) -> bool:
        return self.has_permission("org:tasks:view")
    
    @property
    def can_edit(self) -> bool:
        return self.has_permission("org:tasks:edit")
    
    @property
    def can_delete(self) -> bool:
        return self.has_permission("org:tasks:delete")
    
    @property
    def can_create(self) -> bool:
        return self.has_permission("org:tasks:create")

'''
作用：将 FastAPI 的 Request 对象转换为 httpx.Request 对象。
    因为 Clerk SDK 的 authenticate_request 方法要求传入 httpx.Request
    而不是 FastAPI 的原生请求。

'''
def convert_to_httpx_request(fastapi_request: Request) -> httpx.Request:
    return httpx.Request(
        method=fastapi_request.method,
        url=str(fastapi_request.url),
        headers=dict(fastapi_request.headers),
    )

'''
关键点：
    要求用户必须选择一个组织（org_id 不能为空），这是 SaaS 多租户场景的常见设计。
    权限信息从 JWT 中直接获取，无需额外数据库查询，性能较好。
'''
async def get_current_user(request: Request) -> AuthUser:
    # 1. 将 FastAPI 请求转换成 httpx.Request。
    httpx_request = convert_to_httpx_request(request)

    #2. 调用 Clerk 的 authenticate_request 方法，传入请求和认证选项
    #   （authorized_parties 用于防止子域名劫持，通常设置为前端域名）。
    request_state = clerk.authenticate_request(
        httpx_request,
        AuthenticateRequestOptions(authorized_parties=[settings.FRONTEND_URL])
    )

    # 3. 检查 is_signed_in，若未登录则返回 401。
    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail = 'Not authenticated'
        )

    '''
    4. 从 JWT payload（claims）中提取：
        sub：用户 ID
        org_id：当前选中的组织 ID（Clerk 支持多组织，用户必须选择一个活动组织）
        permissions 或 org_permissions：该用户在组织内的权限列表
    '''
    claims = request_state.payload
    user_id = claims.get("sub")
    org_id = claims.get("org_id")
    org_permissions = claims.get("permissions") or claims.get("org_permissions") or []

    # 5. 验证 user_id 和 org_id 都存在，否则分别返回 401 或 400。
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail = 'Not authenticated'
        )
    
    # 如果没有组织，使用 user_id 作为 org_id（个人模式）
    if not org_id:
        org_id = user_id

    # 6. 构造并返回 AuthUser 实例。
    return AuthUser(user_id=user_id, org_id=org_id, org_permissions=org_permissions)

def require_view(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not user.can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="View permission required"
        )
    
    return user

def require_create(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not user.can_create:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Create permission required"
        )
    
    return user

def require_delete(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not user.can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Delete permission required"
        )
    
    return user

def require_edit(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not user.can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Edit permission required"
        )
    
    return user