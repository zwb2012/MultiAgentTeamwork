# 数据库迁移指南 v2

## 本次更新内容

### 1. 会话类型扩展
**conversations 表新增字段：**
- `type` (varchar(20)): 会话类型 (lobby/private/group/pipeline)
- `config` (jsonb): 会话配置

### 2. 消息类型扩展
**messages 表新增字段：**
- `message_type` (varchar(20)): 消息类型 (text/system/task_start/task_complete/notification/node_transfer)

### 3. 流水线节点汇聚配置
**pipeline_nodes 表新增字段：**
- `gateway_type` (varchar(20)): 网关类型 (parallel_split/parallel_join/exclusive/inclusive)
- `merge_strategy` (varchar(20)): 汇聚策略 (all/any/custom)
- `upstream_nodes` (jsonb): 上游节点ID列表
- `downstream_nodes` (jsonb): 下游节点ID列表
- `custom_condition` (text): 自定义条件表达式
- `position` (jsonb): 可视化位置 { x, y }

### 4. 流水线运行关联会话
**pipeline_runs 表新增字段：**
- `conversation_id` (varchar(36)): 关联的群组会话ID

### 5. 节点运行等待状态
**pipeline_node_runs 表新增字段：**
- `wait_status` (jsonb): 等待状态详情

---

## 迁移SQL

### 完整迁移脚本

```sql
-- ============================================
-- 1. 会话类型扩展
-- ============================================

-- 添加 type 字段
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS type varchar(20) NOT NULL DEFAULT 'private';

-- 添加 config 字段
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS config jsonb;

-- 创建索引
CREATE INDEX IF NOT EXISTS conversations_type_idx ON conversations (type);

-- 更新已有数据（可选）
UPDATE conversations SET type = 'group' WHERE type = 'private' AND id IN (
  SELECT DISTINCT conversation_id 
  FROM conversation_participants 
  GROUP BY conversation_id 
  HAVING COUNT(*) > 2
);

-- ============================================
-- 2. 消息类型扩展
-- ============================================

-- 添加 message_type 字段
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type varchar(20) DEFAULT 'text';

-- 创建索引
CREATE INDEX IF NOT EXISTS messages_message_type_idx ON messages (message_type);

-- 更新已有数据
UPDATE messages SET message_type = 'text' WHERE message_type IS NULL;

-- ============================================
-- 3. 智能体状态字段（之前的迁移）
-- ============================================

ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS online_status varchar(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS work_status varchar(20) DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS last_health_check timestamp with time zone,
ADD COLUMN IF NOT EXISTS health_check_result jsonb;

CREATE INDEX IF NOT EXISTS agents_online_status_idx ON agents (online_status);

UPDATE agents SET 
  online_status = 'unknown',
  work_status = 'idle'
WHERE online_status IS NULL;

-- ============================================
-- 4. 流水线节点汇聚配置
-- ============================================

-- 添加网关类型
ALTER TABLE pipeline_nodes 
ADD COLUMN IF NOT EXISTS gateway_type varchar(20);

-- 添加汇聚策略
ALTER TABLE pipeline_nodes 
ADD COLUMN IF NOT EXISTS merge_strategy varchar(20) DEFAULT 'all';

-- 添加上游节点列表
ALTER TABLE pipeline_nodes 
ADD COLUMN IF NOT EXISTS upstream_nodes jsonb;

-- 添加下游节点列表
ALTER TABLE pipeline_nodes 
ADD COLUMN IF NOT EXISTS downstream_nodes jsonb;

-- 添加自定义条件
ALTER TABLE pipeline_nodes 
ADD COLUMN IF NOT EXISTS custom_condition text;

-- 添加可视化位置
ALTER TABLE pipeline_nodes 
ADD COLUMN IF NOT EXISTS position jsonb;

-- 创建索引
CREATE INDEX IF NOT EXISTS pipeline_nodes_node_type_idx ON pipeline_nodes (node_type);
CREATE INDEX IF NOT EXISTS pipeline_nodes_gateway_type_idx ON pipeline_nodes (gateway_type);

-- ============================================
-- 5. 流水线运行关联会话
-- ============================================

-- 添加会话ID
ALTER TABLE pipeline_runs 
ADD COLUMN IF NOT EXISTS conversation_id varchar(36) REFERENCES conversations(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS pipeline_runs_conversation_id_idx ON pipeline_runs (conversation_id);

-- ============================================
-- 6. 节点运行等待状态
-- ============================================

-- 添加等待状态
ALTER TABLE pipeline_node_runs 
ADD COLUMN IF NOT EXISTS wait_status jsonb;

-- ============================================
-- 7. 更新节点类型枚举值
-- ============================================

-- 更新 node_type 字段以支持新类型
-- 注意：PostgreSQL 的 varchar 字段不需要修改，只需确保插入的值正确
-- 新增类型: start, end, gateway
```

---

## 迁移方式

### 方式一：Supabase 控制台（推荐）

1. 登录 Supabase 控制台
2. 进入 SQL Editor
3. 复制上面的完整迁移脚本
4. 执行

### 方式二：命令行

```bash
# 生成迁移文件
npx drizzle-kit generate

# 推送到数据库（需要数据库网络可达）
npx drizzle-kit push
```

---

## 验证迁移

执行以下SQL验证字段是否添加成功：

```sql
-- 检查 conversations 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
  AND column_name IN ('type', 'config');

-- 检查 messages 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
  AND column_name IN ('message_type');

-- 检查 pipeline_nodes 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pipeline_nodes' 
  AND column_name IN ('gateway_type', 'merge_strategy', 'upstream_nodes', 'downstream_nodes', 'position');

-- 检查 pipeline_runs 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pipeline_runs' 
  AND column_name IN ('conversation_id');

-- 检查 pipeline_node_runs 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pipeline_node_runs' 
  AND column_name IN ('wait_status');

-- 检查 agents 表
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agents' 
  AND column_name IN ('online_status', 'work_status', 'last_health_check', 'health_check_result');
```

---

## 功能说明

### 1. 会话类型
- `lobby`: 大厅模式，所有智能体参与，所有人可见
- `private`: 私聊模式，1对1对话
- `group`: 群组模式，多智能体协作
- `pipeline`: 流水线专属，流水线执行时的协作会话

### 2. 消息类型
- `text`: 普通文本消息
- `system`: 系统消息
- `task_start`: 任务开始通知
- `task_complete`: 任务完成通知
- `task_failed`: 任务失败通知
- `notification`: 通用通知
- `node_transfer`: 节点流转通知

### 3. 网关类型
- `parallel_split`: 并行分叉，将流程分为多个并行分支
- `parallel_join`: 并行汇聚，等待多个分支完成
- `exclusive`: 排他网关，条件分支
- `inclusive`: 包容网关

### 4. 汇聚策略
- `all`: 所有上游节点完成（默认）
- `any`: 任一上游节点完成
- `custom`: 自定义条件
