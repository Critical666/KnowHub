from pymilvus import MilvusClient
from typing import Collection, List, Dict, Optional, Any
import os
import logging

logger = logging.getLogger(__name__)

class MilvusVectorStore:
    '''Milvus Lite 向量存储操作类'''

    def __init__(self, db_path:str = "./milvus_data/knowhub.db", dim: int = 1024):
        '''
        初始化Milvus Lite客户端

        Args:
            db_path: 本地数据库文件路径
            dim: 向量维度（BGE-M3为1024）
        '''
        self.db_path = db_path
        self.dim = dim

        # 确保目录存在
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        # 创建客户端（自动创建文件，如果不存在）
        self.client = MilvusClient(db_path)
        logger.info(f"Milvus Lite initialized: {db_path}")

    def _get_collention_name(self, kb_id:str) -> str:
        "生成Collention名称"
        return f"kb_{kb_id}"

    def create_collention(self, kb_id: str) -> bool:
        """
        为知识库创建Collection

        Args:
            kb_id:知识库ID
        
        Returns:
            是否成功
        """

        collection_name = self._get_collention_name(kb_id)

        # 检查是否已经存在
        if self.client.has_collention(collection_name):
            logger.info(f"Collection {collection_name} already exists")
            return True
        
        # 创建Collection （注意 Milvus Lite简化了Schema定义）
        self.client.create_collention(
            collection_name = collection_name,
            dimension = self.dim,
            metric_type = "COSINE",
            primary_field = "id",
            vector_field = "embedding"
        )

        logger.info(f"Create colloction {collection_name} with dim = {self.dim}")
        return True
    
    def insert_chunks(self, kb_id:str, chunks: List[Dict[str, Any]]) -> None:
        """
        批量插入chunks

        Args:
            kb_id: 知识库ID
            chunks: chunk列表,每个片段包括
                - id: 片段ID
                - doc_id: 文档ID
                - chunk_index: 片段序号
                - content: 文本内容
                - metadata: 元数据字典
                - embedding: 向量(List[float])
        """
        if not chunks:
            logger.warning("No chunks to insert")
            return
        
        collection_name = self._get_collention_name(kb_id)

        # 确保Collection存在
        if not self.client.has_collection(collection_name):
            self.create_collention(kb_id)

        # 准备数据 （注意 Milvus Lite采用了更加简单的格式）
        data = []
        for chunk in chunks:
            data.append({
                "id": chunk["id"],
                "doc_id": chunk["doc_id"] ,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"], 
                "metadata": chunk.get("metadata", {}), 
                "embedding": chunk["embedding"]
            })
        
        # 批量插入
        self.client.insert(collection_name, data)
        logger.info(f"Inserted {len(chunks)} chunks into {collection_name}")

    def search(
        self,
        kb_id:str,
        query_embedding:List[float],
        top_k:int = 5,
        score_threshold: float = 0.0,
        doc_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
            向量相似度检索

        Args:
            kb_id: 知识库ID
            query_embedding: 查询向量
            top_k: 返回结果数量
            score_threshold: 相似度阈值
            doc_ids: 指定文档ID列表(可选)
            
        Returns:
            检索结果列表
        """
        collection_name = self._get_collention_name(kb_id)
        
        # 检查collention是否存在
        if not self.client.has_collection(collection_name):
            logger.warning(f"Collection {collection_name} does not exist")
            return []
        
        # 构建过滤条件（Milvus Lite支持简单的过滤）
        filter_expr = None
        if doc_ids:
            # Milvus Lite的过滤语法
            doc_id_list = ", ".join([f'"{doc_id}"' for doc_id in doc_ids])
            filter_expr = f"doc_id in [{doc_id_list}]"

        # 执行搜索
        results = self.client.search(
            collection_name=collection_name,
            data=[query_embedding],
            limit=top_k,
            output_fields=["doc_id", "content", "metadata", "chunk_index"],
            filter=filter_expr
        )

        # 解析结果
        hits = []
        for result in results[0]:  # 取第一个查询的结果
            hit = {
                "id": result["id"],
                "doc_id": result["doc_id"],
                "content": result["content"],
                "metadata": result["metadata"],
                "chunk_index": result["chunk_index"],
                "score": result["distance"]  # Milvus Lite使用distance字段
            }
            # 应用分数阈值过滤（注意：Milvus Lite返回的是距离，余弦相似度=1-距离）
            similarity = 1 - hit["score"]
            if score_threshold <= 0 or similarity >= score_threshold:
                hit["score"] = similarity  # 转换为相似度
                hits.append(hit)
        
        logger.info(f"Search in {collection_name} returned {len(hits)} results")
        return hits

    def delete_by_doc_id(self, kb_id: str, doc_id: str) -> None:
        """删除指定文档的所有片段"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            return
        
        # Milvus Lite删除语法
        self.client.delete(collection_name, filter=f"doc_id == '{doc_id}'")
        logger.info(f"Deleted chunks for doc {doc_id} from {collection_name}")
        
    def delete_collection(self, kb_id: str) -> None:
        """删除整个知识库的Collection"""
        collection_name = self._get_collection_name(kb_id)
        
        if self.client.has_collection(collection_name):
            self.client.drop_collection(collection_name)
            logger.info(f"Dropped collection {collection_name}")
    
    def get_stats(self, kb_id: str) -> Dict[str, int]:
        """获取知识库统计信息"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            return {"total": 0}
        
        stats = self.client.get_collection_stats(collection_name)
        return {"total": stats.get("row_count", 0)}