# AI-Library

本项目是一个由 React 与 Express 提供前后端支持，并集成 Ollama 本地大模型驱动的智能图书馆管理系统。系统不仅具备基础的图书借阅与管理功能，还创新性地融入了 AI 技术，提供个性化图书推荐和智能问答助手服务。

## 核心功能

- **用户认证**：支持安全的登录与注册。
- **图书管理**：管理员可进行图书的增删改查操作。
- **借阅系统**：用户可在线借阅图书并查看历史记录、数据。
- **AI 图书推荐**：基于用户借阅历史与偏好，利用算法提供个性化推荐。
- **AI 智能助手**：集成 Ollama 本地模型，提供关于图书、科技等领域的智能问答服务。
- **数据 ETL**：提供 Python 脚本用于图书与读者数据的清洗及测试借阅记录生成。
- **管理面板**：提供图书借阅统计、用户管理、数据导入等管理员功能。

## 技术栈

本项目采用前后端分离架构，并包含独立的数据处理模块：

### 前端 (Frontend)

- **框架**: React 19
- **构建工具**: Vite
- **UI 组件库**: Ant Design
- **状态管理**: Zustand
- **路由**: React Router
- **HTTP 客户端**: Axios

### 后端 (Backend)

- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: PostgreSQL
- **AI 集成**: Ollama
- **ORM/DB 客户端**: PostgreSQL

### 数据处理 (ETL)

- **语言**: Python
- **库**: Pandas, NumPy
- **功能**: 数据清洗、格式转换、虚拟数据生成

## 快速开始

### 环境准备

请确保本地已安装以下环境：

- Node.js (v16+)
- Python (v3.8+)
- PostgreSQL
- Ollama

### 1. 克隆项目

```bash
git clone https://github.com/isiou/AI-Library.git
cd AI-Library
```

### 2. 数据库配置

请确保 PostgreSQL 服务已启动，并创建一个新的数据库（例如 `ai_library`）。后续需在后端 `.env` 文件中配置连接信息。

### 3. 后端服务 (Backend)

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
# 复制 .env.example 为 .env 或新建 .env 并填入数据库和密钥配置
# cp .env.example .env

# 启动开发服务器
npm run dev
```

### 4. 前端应用 (Frontend)

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 5. 数据处理 (ETL)

如果需要初始化测试数据或清洗原始数据：

```bash
cd etl

# 安装依赖
pip install -r requirements.txt

# 运行初始化脚本
python initialize.py
```

### 6. Ollama 模型配置

本项目依赖 Ollama 提供 AI 能力。请确保 Ollama 已安装并运行。

```bash
# 拉取推荐使用的模型 (根据后端配置调整，例如 qwen 等)
ollama pull qwen3:1.7B
ollama pull deepseek-r1:1.5b

# 启动 Ollama 服务
ollama serve
```

## 目录结构

```
AI-Library/
├── backend/             # Express 后端服务
│   ├── src/
│   │   ├── services/    # 业务逻辑
│   │   ├── routes/      # API 路由
│   │   └── ...
├── frontend/            # React 前端应用
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # 通用组件
│   │   └── ...
└── etl/                 # 数据清洗与处理脚本
    ├── data/            # 数据文件
    └── src/             # 处理逻辑
```
