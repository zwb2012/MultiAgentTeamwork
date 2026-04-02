# 数据库迁移 - 创建流水线和工单相关表

## 说明
此脚本用于创建缺失的流水线和工单相关数据库表。

## 迁移SQL

```sql
-- ============================================
-- 1. 流水线表
-- ============================================

CREATE TABLE IF NOT EXISTS pipelines (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  description text,
  
  -- 项目关联
  project_id varchar(36),
  
  -- 流水线配置
  trigger_type varchar(20) DEFAULT 'manual',
  trigger_config jsonb,
  
  -- 全局配置
  config jsonb,
  
  -- 定义状态
  status varchar(20) NOT NULL DEFAULT 'draft',
  
  -- 运行状态
  run_status varchar(20) NOT NULL DEFAULT 'idle',
  
  -- 当前运行ID
  current_run_id varchar(36),
  
  -- 最后运行信息
  last_run_at timestamp with time zone,
  last_run_status varchar(20),
  
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone
);

-- 创建索引
CREATE INDEX IF NOT EXISTS pipelines_status_idx ON pipelines (status);
CREATE INDEX IF NOT EXISTS pipelines_run_status_idx ON pipelines (run_status);
CREATE INDEX IF NOT EXISTS pipelines_is_active_idx ON pipelines (is_active);
CREATE INDEX IF NOT EXISTS pipelines_created_at_idx ON pipelines (created_at);
CREATE INDEX IF NOT EXISTS pipelines_project_id_idx ON pipelines (project_id);

-- ============================================
-- 2. 流水线节点表
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_nodes (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id varchar(36) NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  
  -- 节点基本信息
  name varchar(255) NOT NULL,
  description text,
  node_type varchar(20) NOT NULL,
  
  -- 执行顺序
  order_index integer NOT NULL DEFAULT 0,
  
  -- 节点配置
  agent_id varchar(36),
  task_id varchar(36),
  
  -- 执行模式
  execution_mode varchar(20) NOT NULL DEFAULT 'sequential',
  parallel_group varchar(50),
  
  -- 网关配置
  gateway_type varchar(20),
  
  -- 汇聚配置
  merge_strategy varchar(20) DEFAULT 'all',
  upstream_nodes jsonb,
  downstream_nodes jsonb,
  custom_condition text,
  
  -- 执行条件
  condition jsonb,
  
  -- 重试和超时
  retry_count integer DEFAULT 0,
  timeout_seconds integer,
  
  -- 输入输出配置
  input_config jsonb,
  output_config jsonb,
  
  -- 可视化位置
  position jsonb,
  
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone
);

-- 创建索引
CREATE INDEX IF NOT EXISTS pipeline_nodes_pipeline_id_idx ON pipeline_nodes (pipeline_id);
CREATE INDEX IF NOT EXISTS pipeline_nodes_agent_id_idx ON pipeline_nodes (agent_id);
CREATE INDEX IF NOT EXISTS pipeline_nodes_task_id_idx ON pipeline_nodes (task_id);
CREATE INDEX IF NOT EXISTS pipeline_nodes_order_idx ON pipeline_nodes (order_index);
CREATE INDEX IF NOT EXISTS pipeline_nodes_parallel_group_idx ON pipeline_nodes (parallel_group);
CREATE INDEX IF NOT EXISTS pipeline_nodes_node_type_idx ON pipeline_nodes (node_type);
CREATE INDEX IF NOT EXISTS pipeline_nodes_gateway_type_idx ON pipeline_nodes (gateway_type);

-- ============================================
-- 3. 流水线运行记录表
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id varchar(36) NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  
  -- 运行状态
  status varchar(20) NOT NULL DEFAULT 'pending',
  current_node_id varchar(36),
  
  -- 关联会话
  conversation_id varchar(36),
  
  -- 运行配置
  trigger_by varchar(20) DEFAULT 'manual',
  trigger_user varchar(36),
  
  -- 执行结果
  total_nodes integer DEFAULT 0,
  completed_nodes integer DEFAULT 0,
  failed_nodes integer DEFAULT 0,
  
  -- 运行日志
  logs jsonb,
  
  -- 输入输出
  input_data jsonb,
  output_data jsonb,
  
  -- 时间记录
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS pipeline_runs_pipeline_id_idx ON pipeline_runs (pipeline_id);
CREATE INDEX IF NOT EXISTS pipeline_runs_status_idx ON pipeline_runs (status);
CREATE INDEX IF NOT EXISTS pipeline_runs_current_node_idx ON pipeline_runs (current_node_id);
CREATE INDEX IF NOT EXISTS pipeline_runs_conversation_id_idx ON pipeline_runs (conversation_id);
CREATE INDEX IF NOT EXISTS pipeline_runs_created_at_idx ON pipeline_runs (created_at);

-- ============================================
-- 4. 流水线节点执行记录表
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_node_runs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id varchar(36) NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  node_id varchar(36) NOT NULL,
  
  -- 执行状态
  status varchar(20) NOT NULL DEFAULT 'pending',
  
  -- 等待状态详情
  wait_status jsonb,
  
  -- 执行结果
  input_data jsonb,
  output_data jsonb,
  error_message text,
  
  -- 重试信息
  retry_count integer DEFAULT 0,
  
  -- 时间记录
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS pipeline_node_runs_run_id_idx ON pipeline_node_runs (pipeline_run_id);
CREATE INDEX IF NOT EXISTS pipeline_node_runs_node_id_idx ON pipeline_node_runs (node_id);
CREATE INDEX IF NOT EXISTS pipeline_node_runs_status_idx ON pipeline_node_runs (status);

-- ============================================
-- 5. 工单表
-- ============================================

CREATE TABLE IF NOT EXISTS tickets (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id varchar(36),
  
  -- 项目关联
  project_id varchar(36),
  
  type varchar(20) NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  priority varchar(20) NOT NULL DEFAULT 'medium',
  status varchar(20) NOT NULL DEFAULT 'open',
  assignee_id varchar(36),
  reporter_id varchar(36),
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- 创建索引
CREATE INDEX IF NOT EXISTS tickets_task_id_idx ON tickets (task_id);
CREATE INDEX IF NOT EXISTS tickets_type_idx ON tickets (type);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets (priority);
CREATE INDEX IF NOT EXISTS tickets_assignee_id_idx ON tickets (assignee_id);
CREATE INDEX IF NOT EXISTS tickets_reporter_id_idx ON tickets (reporter_id);
CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets (created_at);
CREATE INDEX IF NOT EXISTS tickets_project_id_idx ON tickets (project_id);

-- ============================================
-- 6. 工单流转历史表
-- ============================================

CREATE TABLE IF NOT EXISTS ticket_history (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id varchar(36) NOT NULL,
  from_status varchar(20),
  to_status varchar(20) NOT NULL,
  from_assignee_id varchar(36),
  to_assignee_id varchar(36),
  operator_id varchar(36),
  comment text,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS ticket_history_ticket_id_idx ON ticket_history (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_history_operator_id_idx ON ticket_history (operator_id);
CREATE INDEX IF NOT EXISTS ticket_history_created_at_idx ON ticket_history (created_at);

-- ============================================
-- 7. 添加外键约束（在表创建后）
-- ============================================

-- pipeline_runs 外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pipeline_runs_conversation_id_fkey' 
    AND table_name = 'pipeline_runs'
  ) THEN
    ALTER TABLE pipeline_runs 
    ADD CONSTRAINT pipeline_runs_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- pipeline_nodes 外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pipeline_nodes_agent_id_fkey' 
    AND table_name = 'pipeline_nodes'
  ) THEN
    ALTER TABLE pipeline_nodes 
    ADD CONSTRAINT pipeline_nodes_agent_id_fkey 
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- pipeline_node_runs 外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pipeline_node_runs_node_id_fkey' 
    AND table_name = 'pipeline_node_runs'
  ) THEN
    ALTER TABLE pipeline_node_runs 
    ADD CONSTRAINT pipeline_node_runs_node_id_fkey 
    FOREIGN KEY (node_id) REFERENCES pipeline_nodes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tickets 外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tickets_task_id_fkey' 
    AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets 
    ADD CONSTRAINT tickets_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tickets_assignee_id_fkey' 
    AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets 
    ADD CONSTRAINT tickets_assignee_id_fkey 
    FOREIGN KEY (assignee_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tickets_reporter_id_fkey' 
    AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets 
    ADD CONSTRAINT tickets_reporter_id_fkey 
    FOREIGN KEY (reporter_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ticket_history 外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_history_ticket_id_fkey' 
    AND table_name = 'ticket_history'
  ) THEN
    ALTER TABLE ticket_history 
    ADD CONSTRAINT ticket_history_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_history_from_assignee_id_fkey' 
    AND table_name = 'ticket_history'
  ) THEN
    ALTER TABLE ticket_history 
    ADD CONSTRAINT ticket_history_from_assignee_id_fkey 
    FOREIGN KEY (from_assignee_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_history_to_assignee_id_fkey' 
    AND table_name = 'ticket_history'
  ) THEN
    ALTER TABLE ticket_history 
    ADD CONSTRAINT ticket_history_to_assignee_id_fkey 
    FOREIGN KEY (to_assignee_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_history_operator_id_fkey' 
    AND table_name = 'ticket_history'
  ) THEN
    ALTER TABLE ticket_history 
    ADD CONSTRAINT ticket_history_operator_id_fkey 
    FOREIGN KEY (operator_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;
```

## 执行方式

### 方式一：Supabase 控制台（推荐）

1. 登录 Supabase 控制台
2. 进入 SQL Editor
3. 复制上面的完整迁移脚本
4. 执行

### 方式二：通过 API 执行

使用 exec_sql 工具执行（需要有相应权限）

## 验证

执行以下SQL验证表是否创建成功：

```sql
-- 检查所有表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('pipelines', 'pipeline_nodes', 'pipeline_runs', 'pipeline_node_runs', 'tickets', 'ticket_history');
```
