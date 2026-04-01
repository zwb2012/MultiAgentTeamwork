# 多AI Agent协同工作平台 - 部署流程

## 目录
- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [生产部署](#生产部署)
- [Docker部署](#docker部署)
- [环境变量配置](#环境变量配置)
- [数据库配置](#数据库配置)
- [常见问题](#常见问题)

---

## 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 18.x | 推荐 20.x 或 24.x |
| pnpm | >= 9.0.0 | 包管理器（必须） |
| PostgreSQL | >= 14.x | 数据库（推荐使用 Supabase） |
| Git | 最新版 | 版本控制 |

### 检查环境

```bash
# 检查 Node.js 版本
node -v  # 应该 >= 18.x

# 检查 pnpm 版本
pnpm -v  # 应该 >= 9.0.0

# 如果没有安装 pnpm
npm install -g pnpm
```

---

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/zwb2012/MultiAgentTeamwork.git
cd MultiAgentTeamwork
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑环境变量
vim .env.local
```

**必需的环境变量：**

```env
# 数据库配置（Supabase）
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_database_url

# LLM API 配置
LLM_DEFAULT_API_KEY=your_api_key
LLM_DEFAULT_BASE_URL=https://api.coze.cn
LLM_DEFAULT_MODEL=doubao-seed-1-8-251228

# 服务端口
DEPLOY_RUN_PORT=5000
```

### 4. 初始化数据库

```bash
# 运行数据库迁移
pnpm drizzle-kit push

# 或者使用 Supabase CLI
supabase db push
```

### 5. 启动开发服务

```bash
pnpm dev
```

访问 http://localhost:5000

---

## 生产部署

### 方式一：传统部署

#### 1. 构建项目

```bash
# 安装依赖
pnpm install

# 构建生产版本
pnpm build
```

#### 2. 启动服务

```bash
# 启动生产服务
pnpm start

# 或使用 PM2 管理进程
pm2 start pnpm --name "multi-agent" -- start
```

#### 3. Nginx 反向代理（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

### 方式二：Vercel 部署

#### 1. 安装 Vercel CLI

```bash
npm install -g vercel
```

#### 2. 部署

```bash
vercel --prod
```

#### 3. 配置环境变量

在 Vercel Dashboard 中配置以下环境变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `LLM_DEFAULT_API_KEY`
- `LLM_DEFAULT_BASE_URL`

---

## Docker部署

### 1. 创建 Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建
RUN pnpm build

# 生产镜像
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制必要文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# 环境变量
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["pnpm", "start"]
```

### 2. 构建镜像

```bash
docker build -t multi-agent-teamwork:latest .
```

### 3. 运行容器

```bash
docker run -d \
  --name multi-agent \
  -p 5000:5000 \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_ANON_KEY=your_key \
  -e DATABASE_URL=your_db_url \
  -e LLM_DEFAULT_API_KEY=your_api_key \
  multi-agent-teamwork:latest
```

### 4. Docker Compose（推荐）

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - LLM_DEFAULT_API_KEY=${LLM_DEFAULT_API_KEY}
      - LLM_DEFAULT_BASE_URL=${LLM_DEFAULT_BASE_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/config"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

---

## 环境变量配置

### 完整环境变量列表

```env
# ==================== 数据库配置 ====================
# Supabase 配置（推荐）
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 直接连接 PostgreSQL（可选）
DATABASE_URL=postgresql://user:password@host:5432/database

# ==================== LLM 配置 ====================
# 默认 API 配置
LLM_DEFAULT_API_KEY=your_api_key
LLM_DEFAULT_BASE_URL=https://api.coze.cn
LLM_DEFAULT_MODEL=doubao-seed-1-8-251228

# ==================== 服务配置 ====================
# 服务端口
DEPLOY_RUN_PORT=5000

# 运行环境
COZE_PROJECT_ENV=PROD  # PROD 或 DEV

# 域名（可选，用于生成回调URL）
COZE_PROJECT_DOMAIN_DEFAULT=https://your-domain.com

# ==================== 加密配置 ====================
# Git Token 加密密钥（32字节）
GIT_TOKEN_ENCRYPTION_KEY=your-32-byte-encryption-key-here

# ==================== 对象存储（可选） ====================
# AWS S3 兼容存储
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your_bucket
S3_REGION=auto
S3_ENDPOINT=https://your-s3-endpoint.com
```

---

## 数据库配置

### 方式一：使用 Supabase（推荐）

1. **创建 Supabase 项目**
   - 访问 https://supabase.com
   - 创建新项目
   - 获取项目 URL 和 Anon Key

2. **获取数据库连接字符串**
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

3. **运行数据库迁移**
   ```bash
   pnpm drizzle-kit push
   ```

### 方式二：自建 PostgreSQL

1. **安装 PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   ```

2. **创建数据库**
   ```sql
   CREATE DATABASE multi_agent;
   CREATE USER agent_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE multi_agent TO agent_user;
   ```

3. **运行迁移**
   ```bash
   pnpm drizzle-kit push
   ```

### 数据库表结构

项目启动时会自动创建以下表：

- `agents` - 智能体
- `agent_tasks` - 智能体任务队列
- `projects` - 项目
- `conversations` - 会话
- `conversation_participants` - 会话参与者
- `messages` - 消息
- `pipelines` - 流水线
- `pipeline_nodes` - 流水线节点
- `tickets` - 工单
- `tasks` - 任务

---

## 常见问题

### 1. 端口被占用

```bash
# 查找占用端口的进程
lsof -i :5000

# 杀掉进程
kill -9 <PID>

# 或修改端口
export DEPLOY_RUN_PORT=3000
pnpm start
```

### 2. 数据库连接失败

```bash
# 检查数据库连接
psql $DATABASE_URL

# 常见原因：
# - DATABASE_URL 格式错误
# - 数据库未启动
# - 防火墙阻止连接
# - SSL 配置问题（添加 ?sslmode=require）
```

### 3. 构建失败

```bash
# 清除缓存重新构建
rm -rf .next node_modules
pnpm install
pnpm build
```

### 4. LLM API 调用失败

- 检查 API Key 是否正确
- 检查 Base URL 是否可访问
- 检查模型名称是否正确

### 5. 健康检查

```bash
# 检查服务状态
curl http://localhost:5000/api/config

# 检查数据库
curl http://localhost:5000/api/dashboard/stats
```

---

## 监控与日志

### PM2 监控

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start pnpm --name "multi-agent" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs multi-agent

# 监控面板
pm2 monit
```

### 日志文件

```bash
# 应用日志
tail -f /app/work/logs/bypass/app.log

# 开发日志
tail -f /app/work/logs/bypass/dev.log

# 控制台日志
tail -f /app/work/logs/bypass/console.log
```

---

## 更新部署

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
pnpm install

# 运行数据库迁移（如有）
pnpm drizzle-kit push

# 重新构建
pnpm build

# 重启服务
pm2 restart multi-agent
# 或
docker-compose restart
```

---

## 安全建议

1. **环境变量保护**
   - 不要将 `.env` 文件提交到 Git
   - 生产环境使用密钥管理服务

2. **数据库安全**
   - 使用强密码
   - 启用 SSL 连接
   - 限制 IP 访问

3. **API Key 安全**
   - 定期轮换 API Key
   - 使用最小权限原则

4. **网络安全**
   - 使用 HTTPS
   - 配置防火墙规则
   - 启用 Rate Limiting

---

## 技术支持

- GitHub Issues: https://github.com/zwb2012/MultiAgentTeamwork/issues
- 文档: 项目 `docs/` 目录
