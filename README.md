# RAG Knowledge Base System

一个基于检索增强生成（RAG）技术的企业文档智能问答平台，展示全栈开发 + RAG 系统构建能力。

## 🎯 项目演示目的

本项目旨在演示以下技术能力：
- **全栈开发**：FastAPI 后端 + React 前端完整架构
- **RAG 系统**：从文档上传到智能问答的完整 RAG  pipeline
- **向量检索**：Embedding + 向量数据库的语义搜索实现
- **LLM 集成**：大语言模型与检索系统的结合

## ✨ 核心功能

- **📄 文档上传与管理**：支持 PDF、Word、TXT、Markdown 等多种格式
- **🧠 智能知识库构建**：基于 BGE Embedding 的向量检索，Milvus 向量数据库存储
- **🤖 AI 智能问答**：基于 Kimi 大模型的智能回答，答案可追溯原文出处

## 🏗️ 技术架构

### 后端
- **FastAPI** - 高性能 Python Web 框架
- **Milvus Lite** - 轻量级向量数据库
- **BGE-M3** - 文本 Embedding 模型
- **Kimi API** - 大语言模型
- **MinIO** - 对象存储
- **SQLite** - 元数据存储

### 前端
- **React 19** + **TypeScript**
- **Vite** - 构建工具
- **Ant Design** - UI 组件库
- **React Router** - 路由管理

## 🚀 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- Redis（可选，用于缓存）

### 后端启动
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写 Kimi API Key

# 启动服务
python start.py
```

### 前端启动
```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 即可使用。

## 📁 项目结构

```
B2B-SaaS/
├── backend/              # FastAPI 后端
│   ├── app/
│   │   ├── api/         # API 路由
│   │   ├── core/        # 配置、数据库
│   │   ├── models/      # 数据模型
│   │   ├── schemas/     # Pydantic 模型
│   │   └── services/    # 业务逻辑
│   │       └── rag/     # RAG 核心服务
│   └── model/           # 本地 Embedding 模型
├── frontend/            # React 前端
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   ├── hooks/       # 自定义 Hooks
│   │   └── styles/      # 样式文件
│   └── index.html
└── volumes/             # 数据卷（MinIO、Milvus）
```

## 📝 使用说明

1. 打开首页，点击"立即体验"
2. 创建知识库
3. 上传文档（支持 PDF、Word、TXT、Markdown）
4. 等待文档处理完成
5. 进入知识库聊天界面，开始提问

## 🔑 关键配置

在 `backend/.env` 中配置：
```env
KIMI_API_KEY=your_kimi_api_key
```

## 📄 许可证

MIT License
