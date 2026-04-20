"""MinIO对象存储服务"""
from minio import Minio
from minio.error import S3Error
from typing import BinaryIO
import logging

logger = logging.getLogger(__name__)


class MinioStorageService:
    """MinIO存储服务封装"""
    
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False
    ):
        """
        初始化MinIO客户端
        
        Args:
            endpoint: MinIO服务端点 (如: localhost:9000)
            access_key: 访问密钥
            secret_key: 秘密密钥
            bucket: 默认存储桶名称
            secure: 是否使用HTTPS
        """
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
        self.bucket = bucket
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """确保存储桶存在"""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to check/create bucket: {e}")
            raise
    
    def upload_file(
        self,
        object_name: str,
        file_data: BinaryIO,
        content_type: str = "application/octet-stream",
        file_size: int = None
    ) -> str:
        """
        上传文件到MinIO
        
        Args:
            object_name: 对象名称（存储路径）
            file_data: 文件二进制数据
            content_type: 文件MIME类型
            file_size: 文件大小（字节）
            
        Returns:
            对象名称
        """
        try:
            # 如果没有提供file_size，尝试从file_data获取
            if file_size is None:
                file_data.seek(0, 2)  # 移动到文件末尾
                file_size = file_data.tell()
                file_data.seek(0)  # 重置到开头
            
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=file_data,
                length=file_size,
                content_type=content_type
            )
            logger.info(f"Uploaded file: {object_name}")
            return object_name
        except S3Error as e:
            logger.error(f"Failed to upload file: {e}")
            raise
    
    def download_file(self, object_name: str, file_path: str) -> None:
        """
        下载文件到本地路径
        
        Args:
            object_name: 对象名称
            file_path: 本地保存路径
        """
        try:
            self.client.fget_object(self.bucket, object_name, file_path)
            logger.info(f"Downloaded file: {object_name} -> {file_path}")
        except S3Error as e:
            logger.error(f"Failed to download file: {e}")
            raise
    
    def delete_file(self, object_name: str) -> None:
        """
        删除文件
        
        Args:
            object_name: 对象名称
        """
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"Deleted file: {object_name}")
        except S3Error as e:
            logger.error(f"Failed to delete file: {e}")
            raise
    
    def get_presigned_url(self, object_name: str, expires: int = 3600) -> str:
        """
        获取预签名URL（用于临时访问）
        
        Args:
            object_name: 对象名称
            expires: URL过期时间（秒）
            
        Returns:
            预签名URL
        """
        try:
            url = self.client.presigned_get_object(self.bucket, object_name, expires)
            return url
        except S3Error as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise
    
    def generate_object_name(self, org_id: str, kb_id: str, doc_id: str, filename: str) -> str:
        """
        生成对象存储路径
        
        格式: org_id/kb_id/doc_id/filename
        
        Args:
            org_id: 组织ID
            kb_id: 知识库ID
            doc_id: 文档ID
            filename: 原始文件名
            
        Returns:
            对象名称
        """
        return f"{org_id}/{kb_id}/{doc_id}/{filename}"
