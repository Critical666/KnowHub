import type { 
  KnowledgeBase,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
  Document,
  ListResponse 
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.wuyuxuan.xyz';

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 基础 fetch 封装
 */
export async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// ============================================
// 知识库相关 API
// ============================================

const KB_BASE = '/api/v1/knowledge-bases';

export async function getKnowledgeBases(): Promise<ListResponse<KnowledgeBase>> {
  return fetchAPI<ListResponse<KnowledgeBase>>(KB_BASE);
}

export async function getKnowledgeBase(kbId: string): Promise<KnowledgeBase> {
  return fetchAPI<KnowledgeBase>(`${KB_BASE}/${kbId}`);
}

export async function createKnowledgeBase(
  data: CreateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  return fetchAPI<KnowledgeBase>(KB_BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateKnowledgeBase(
  kbId: string,
  data: UpdateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  return fetchAPI<KnowledgeBase>(`${KB_BASE}/${kbId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeBase(kbId: string): Promise<void> {
  return fetchAPI<void>(`${KB_BASE}/${kbId}`, {
    method: 'DELETE',
  });
}

// ============================================
// 文档相关 API
// ============================================

export async function getDocuments(kbId: string): Promise<ListResponse<Document>> {
  return fetchAPI<ListResponse<Document>>(`${KB_BASE}/${kbId}/documents`);
}

export async function uploadDocument(kbId: string, file: File, signal?: AbortSignal): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_URL}${KB_BASE}/${kbId}/documents/upload`,
    {
      method: 'POST',
      body: formData,
      signal, // 支持 AbortController 取消请求
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || 'Upload failed');
  }

  return response.json();
}

export async function deleteDocument(kbId: string, docId: string): Promise<void> {
  return fetchAPI<void>(`${KB_BASE}/${kbId}/documents/${docId}`, {
    method: 'DELETE',
  });
}

// ============================================
// 聊天相关 API
// ============================================

export interface ChatMessageRequest {
  message: string;
  session_id?: string;
}

export interface ChatMessageResponse {
  id: string;
  session_id: string;
  role: string;
  content: string;
  sources?: Array<{
    doc_id: string;
    content: string;
    score: number;
    chunk_index?: number;
  }>;
  created_at: string;
}

export async function sendChatMessage(
  kbId: string,
  data: ChatMessageRequest
): Promise<ChatMessageResponse> {
  return fetchAPI<ChatMessageResponse>(`${KB_BASE}/${kbId}/chat`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getChatMessages(sessionId: string): Promise<ChatMessageResponse[]> {
  return fetchAPI<ChatMessageResponse[]>(`/api/v1/chat-sessions/${sessionId}/messages`);
}
