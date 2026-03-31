# 数据库迁移指南 v3 - 项目管理模块

## 本次更新内容

### 1. 项目管理表

**projects 表：**
- `id` (varchar): 主键，UUID
- `name` (varchar): 项目名称
- `description` (text): 项目描述
- `git_url` (varchar): Git 仓库地址
- `git_branch` (varchar): Git 分支，默认 main
- `git_token` (text): 加密存储的访问令牌
- `sync_enabled` (boolean): 是否启用自动同步
- `sync_interval` (integer): 同步间隔（秒），默认 300
- `last_sync_at` (timestamp): 最后同步时间
- `next_sync_at` (timestamp): 下次同步时间
- `sync_status` (varchar): 同步状态
- `sync_error` (text): 同步错误信息
- `last_commit_sha` (varchar): 最后同步的 commit SHA
- `local_path` (varchar): 本地存储路径
- `config` (jsonb): 项目配置
- `is_active` (boolean): 是否激活
- `created_at` (timestamp): 创建时间
- `updated_at` (timestamp): 更新时间

### 2. 项目同步历史表

**project_sync_history 表：**
- `id` (varchar): 主键，UUID
- `project_id` (varchar): 项目ID，外键
- `sync_type` (varchar): 同步类型（auto/manual/webhook）
- `status` (varchar): 同步状态（running/success/failed）
- `before_commit_sha` (varchar): 同步前 commit SHA
- `after_commit_sha` (varchar): 同步后 commit SHA
- `commits_count` (integer): 提交数量
- `changes` (jsonb): 变更详情
- `error_message` (text): 错误信息
- `started_at` (timestamp): 开始时间
- `completed_at` (timestamp): 完成时间

---

## 迁移SQL

```sql
-- ============================================
-- 项目管理表
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name varchar(255) NOT NULL,
  description text,
  
  -- Git 仓库配置
  git_url varchar(512) NOT NULL,
  git_branch varchar(128) DEFAULT 'main',
  git_token text,
  
  -- 同步配置
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_interval integer DEFAULT 300,
  last_sync_at timestamp with time zone,
  next_sync_at timestamp with time zone,
  
  -- 同步状态
  sync_status varchar(20) DEFAULT 'pending',
  sync_error text,
  last_commit_sha varchar(64),
  
  -- 本地存储路径
  local_path varchar(512),
  
  -- 项目配置
  config jsonb,
  
  -- 状态
  is_active boolean NOT NULL DEFAULT true,
  
  -- 时间戳
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone
);

-- 创建索引
CREATE INDEX IF NOT EXISTS projects_name_idx ON projects (name);
CREATE INDEX IF NOT EXISTS projects_sync_status_idx ON projects (sync_status);
CREATE INDEX IF NOT EXISTS projects_is_active_idx ON projects (is_active);
CREATE INDEX IF NOT EXISTS projects_next_sync_at_idx ON projects (next_sync_at);

-- ============================================
-- 项目同步历史表
-- ============================================

CREATE TABLE IF NOT EXISTS project_sync_history (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- 同步类型
  sync_type varchar(20) NOT NULL,
  
  -- 同步状态
  status varchar(20) NOT NULL,
  
  -- Git 信息
  before_commit_sha varchar(64),
  after_commit_sha varchar(64),
  commits_count integer DEFAULT 0,
  
  -- 同步详情
  changes jsonb,
  error_message text,
  
  -- 时间记录
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- 创建索引
CREATE INDEX IF NOT EXISTS project_sync_history_project_id_idx ON project_sync_history (project_id);
CREATE INDEX IF NOT EXISTS project_sync_history_status_idx ON project_sync_history (status);
CREATE INDEX IF NOT EXISTS project_sync_history_started_at_idx ON project_sync_history (started_at);
```

---

## 验证迁移

```sql
-- 检查 projects 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects';

-- 检查 project_sync_history 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_sync_history';
```

---

## 功能说明

### 1. Git 令牌加密

项目的 `git_token` 字段使用 AES-256-GCM 加密存储。需要配置环境变量：

```bash
ENCRYPTION_KEY=your-secret-key-here
```

### 2. 同步间隔选项

- 1分钟
- 5分钟（默认）
- 10分钟
- 30分钟
- 1小时
- 6小时
- 12小时
- 24小时

### 3. 同步状态

- `pending`: 待同步
- `syncing`: 同步中
- `success`: 同步成功
- `failed`: 同步失败

### 4. 同步类型

- `auto`: 自动同步（定时触发）
- `manual`: 手动同步
- `webhook`: Webhook 触发

---

## API 接口

### 项目管理

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/[id]` - 获取项目详情
- `PUT /api/projects/[id]` - 更新项目
- `DELETE /api/projects/[id]` - 删除项目（软删除）

### 同步管理

- `GET /api/projects/[id]/sync` - 获取同步状态
- `POST /api/projects/[id]/sync` - 手动触发同步
