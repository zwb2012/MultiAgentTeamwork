# 流水线状态管理迁移脚本

## 概述

本次迁移将流水线状态从单一状态字段升级为"定义状态 + 运行状态"双状态管理，支持完整的状态机流转。

## 状态说明

### 定义状态 (status)
- `draft`: 草稿状态，可以编辑，不能执行
- `published`: 已发布状态，可以执行
- `archived`: 已归档状态，停用

### 运行状态 (run_status)
- `idle`: 空闲，未运行
- `running`: 运行中
- `success`: 上次执行成功
- `failed`: 上次执行失败
- `cancelled`: 上次执行被取消

## 状态转换规则

```
draft → published (发布)
published → draft (撤回编辑)
published → running (开始执行，run_status 变化)
running → success/failed/cancelled (执行结束)
published → archived (归档)
archived → draft (恢复)
```

## 迁移 SQL

在 Supabase SQL Editor 中执行以下脚本：

```sql
-- 1. 添加新的运行状态字段
ALTER TABLE pipelines 
ADD COLUMN IF NOT EXISTS run_status VARCHAR(20) NOT NULL DEFAULT 'idle';

-- 2. 添加当前运行ID字段
ALTER TABLE pipelines 
ADD COLUMN IF NOT EXISTS current_run_id VARCHAR(36);

-- 3. 添加最后运行时间字段
ALTER TABLE pipelines 
ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

-- 4. 添加最后运行状态字段
ALTER TABLE pipelines 
ADD COLUMN IF NOT EXISTS last_run_status VARCHAR(20);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS pipelines_run_status_idx ON pipelines(run_status);

-- 6. 数据迁移：将旧的 active 状态转换为 published
UPDATE pipelines 
SET status = 'published' 
WHERE status = 'active';

-- 7. 数据迁移：将旧的 paused 状态转换为 draft
UPDATE pipelines 
SET status = 'draft' 
WHERE status = 'paused';

-- 8. 更新 pipeline_runs 表添加输入数据字段（如果不存在）
-- 用于存储工单信息
ALTER TABLE pipeline_runs 
ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(36);

ALTER TABLE pipeline_runs 
ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(20);

-- 9. 添加工单类型索引
CREATE INDEX IF NOT EXISTS pipeline_runs_ticket_id_idx ON pipeline_runs(ticket_id);
CREATE INDEX IF NOT EXISTS pipeline_runs_ticket_type_idx ON pipeline_runs(ticket_type);

-- 10. 验证迁移结果
SELECT 
  id,
  name,
  status,
  run_status,
  current_run_id,
  last_run_at,
  last_run_status
FROM pipelines
LIMIT 5;
```

## 回滚脚本

如果需要回滚：

```sql
-- 移除新增字段
ALTER TABLE pipelines DROP COLUMN IF EXISTS run_status;
ALTER TABLE pipelines DROP COLUMN IF EXISTS current_run_id;
ALTER TABLE pipelines DROP COLUMN IF EXISTS last_run_at;
ALTER TABLE pipelines DROP COLUMN IF EXISTS last_run_status;

-- 恢复旧状态值
UPDATE pipelines SET status = 'active' WHERE status = 'published';
UPDATE pipelines SET status = 'paused' WHERE status = 'draft';

-- 移除索引
DROP INDEX IF EXISTS pipelines_run_status_idx;
```

## 注意事项

1. 迁移前请先备份数据
2. 迁移后 `status` 字段的 `active` 值会变为 `published`
3. 迁移后 `status` 字段的 `paused` 值会变为 `draft`
4. `run_status` 默认为 `idle`，表示流水线当前未运行
