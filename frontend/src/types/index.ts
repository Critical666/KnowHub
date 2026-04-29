/**
 * 全局类型定义文件
 * 集中管理所有 TypeScript 类型
 */

// ============================================
// 知识库相关类型
// ============================================

export type KBStatus = 'active' | 'disabled' | 'deleted';

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  org_id: string;
  created_by: string;
  status: KBStatus;
  document_count: number;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
}

// ============================================
// 文档相关类型
// ============================================

export type DocStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  status: DocStatus;
  chunk_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 聊天相关类型
// ============================================

export type MessageRole = 'user' | 'assistant';

export interface SourceItem {
  doc_id: string;
  content: string;
  score: number;
  chunk_index?: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  sources?: SourceItem[];
}

export interface ChatSession {
  id: string;
  kb_id: string;
  title: string;
  created_at: string;
}

// ============================================
// API 相关类型
// ============================================

export interface ApiErrorResponse {
  detail: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ============================================
// 组件 Props 类型
// ============================================

export interface KnowledgeBaseCardProps {
  kb: KnowledgeBase;
  onEdit?: (kb: KnowledgeBase) => void;
  onDelete?: (id: string) => void;
  onChat?: (id: string) => void;
  onViewDocs?: (kb: KnowledgeBase) => void;
}
