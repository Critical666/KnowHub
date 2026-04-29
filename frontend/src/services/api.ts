import type { 
  Task, 
  CreateTaskInput, 
  UpdateTaskInput,
  KnowledgeBase,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
  Document,
  ListResponse 
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
 * 带认证的 fetch 封装
 */
export async function fetchWithAuth<T>(
  endpoint: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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
// 任务相关 API
// ============================================

export async function getTasks(
  getToken: () => Promise<string | null>
): Promise<Task[]> {
  return fetchWithAuth<Task[]>('/api/tasks', getToken);
}

export async function getTask(
  getToken: () => Promise<string | null>,
  taskId: string
): Promise<Task> {
  return fetchWithAuth<Task>(`/api/tasks/${taskId}`, getToken);
}

export async function createTask(
  getToken: () => Promise<string | null>,
  task: CreateTaskInput
): Promise<Task> {
  return fetchWithAuth<Task>('/api/tasks', getToken, {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateTask(
  getToken: () => Promise<string | null>,
  taskId: string,
  task: UpdateTaskInput
): Promise<Task> {
  return fetchWithAuth<Task>(`/api/tasks/${taskId}`, getToken, {
    method: 'PUT',
    body: JSON.stringify(task),
  });
}

export async function deleteTask(
  getToken: () => Promise<string | null>,
  taskId: string
): Promise<void> {
  return fetchWithAuth<void>(`/api/tasks/${taskId}`, getToken, {
    method: 'DELETE',
  });
}

// ============================================
// 知识库相关 API
// ============================================

const KB_BASE = '/api/v1/knowledge-bases';

export async function getKnowledgeBases(
  getToken: () => Promise<string | null>
): Promise<ListResponse<KnowledgeBase>> {
  return fetchWithAuth<ListResponse<KnowledgeBase>>(KB_BASE, getToken);
}

export async function getKnowledgeBase(
  getToken: () => Promise<string | null>,
  kbId: string
): Promise<KnowledgeBase> {
  return fetchWithAuth<KnowledgeBase>(`${KB_BASE}/${kbId}`, getToken);
}

export async function createKnowledgeBase(
  getToken: () => Promise<string | null>,
  data: CreateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  return fetchWithAuth<KnowledgeBase>(KB_BASE, getToken, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateKnowledgeBase(
  getToken: () => Promise<string | null>,
  kbId: string,
  data: UpdateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  return fetchWithAuth<KnowledgeBase>(`${KB_BASE}/${kbId}`, getToken, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeBase(
  getToken: () => Promise<string | null>,
  kbId: string
): Promise<void> {
  return fetchWithAuth<void>(`${KB_BASE}/${kbId}`, getToken, {
    method: 'DELETE',
  });
}

// ============================================
// 文档相关 API
// ============================================

export async function getDocuments(
  getToken: () => Promise<string | null>,
  kbId: string
): Promise<ListResponse<Document>> {
  return fetchWithAuth<ListResponse<Document>>(
    `${KB_BASE}/${kbId}/documents`,
    getToken
  );
}

export async function uploadDocument(
  getToken: () => Promise<string | null>,
  kbId: string,
  file: File
): Promise<Document> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_URL}${KB_BASE}/${kbId}/documents/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || 'Upload failed');
  }

  return response.json();
}

export async function deleteDocument(
  getToken: () => Promise<string | null>,
  kbId: string,
  docId: string
): Promise<void> {
  return fetchWithAuth<void>(
    `${KB_BASE}/${kbId}/documents/${docId}`,
    getToken,
    { method: 'DELETE' }
  );
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
  getToken: () => Promise<string | null>,
  kbId: string,
  data: ChatMessageRequest
): Promise<ChatMessageResponse> {
  return fetchWithAuth<ChatMessageResponse>(
    `${KB_BASE}/${kbId}/chat`,
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export async function getChatMessages(
  getToken: () => Promise<string | null>,
  sessionId: string
): Promise<ChatMessageResponse[]> {
  return fetchWithAuth<ChatMessageResponse[]>(
    `/api/v1/chat-sessions/${sessionId}/messages`,
    getToken
  );
}
