# 数据库迁移指南

## 背景
本次更新新增了智能体状态系统相关字段，需要对数据库进行迁移。

## 新增字段

### agents 表
- `online_status` (varchar(20)): 在线状态 (online/offline/unknown)
- `work_status` (varchar(20)): 工作状态 (idle/working/error)
- `last_health_check` (timestamptz): 最后健康检查时间
- `health_check_result` (jsonb): 健康检查结果

### 新增索引
- `agents_online_status_idx`: 在线状态索引

## 迁移方式

### 方式一：自动迁移（推荐）
当数据库网络连接正常时，执行以下命令：
```bash
npx drizzle-kit push
```

### 方式二：手动SQL执行
如果自动迁移失败（如网络超时），请登录 Supabase 控制台，在 SQL Editor 中执行以下SQL：

```sql
-- 添加新字段到 agents 表
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS online_status varchar(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS work_status varchar(20) DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS last_health_check timestamp with time zone,
ADD COLUMN IF NOT EXISTS health_check_result jsonb;

-- 创建索引
CREATE INDEX IF NOT EXISTS agents_online_status_idx ON agents USING btree (online_status);

-- 更新已有数据
UPDATE agents SET 
  online_status = 'unknown',
  work_status = 'idle'
WHERE online_status IS NULL;
```

### 方式三：重置数据库（开发环境）
如果是开发环境且数据可以丢弃，可以删除所有表后重新创建：

⚠️ **警告：此操作会清空所有数据！**

```bash
# 执行完整的建表SQL
# 参考 drizzle/0000_dashing_brother_voodoo.sql
```

## 验证迁移

迁移完成后，执行以下验证：

1. 检查字段是否添加成功：
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agents' 
  AND column_name IN ('online_status', 'work_status', 'last_health_check', 'health_check_result');
```

2. 测试创建智能体API：
```bash
curl -X POST http://localhost:5000/api/agents \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试智能体","role":"developer","system_prompt":"你是一个助手","agent_type":"llm","model":"doubao-seed-1-8-251228"}'
```

## 故障排除

### 迁移超时
- 检查数据库网络连接
- 确认 Supabase 项目未暂停
- 尝试使用 Supabase 控制台的 SQL Editor 手动执行

### 字段已存在错误
- 如果字段已存在，可以跳过对应的 ALTER TABLE 语句
- 使用 `IF NOT EXISTS` 子句避免重复创建

### 权限不足
- 确保数据库用户有 ALTER TABLE 权限
- 使用 Supabase 的 service_role key 或超级管理员账户
