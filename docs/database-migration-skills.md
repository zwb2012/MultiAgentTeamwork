# 技能系统数据库迁移脚本

在Supabase控制台的SQL Editor中执行以下SQL：

```sql
-- ==================== 智能体技能配置表 ====================
CREATE TABLE IF NOT EXISTS agent_skills (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- 启用的技能ID列表
  enabled_skills JSONB DEFAULT '[]',

  -- 技能优先级配置
  skill_priorities JSONB DEFAULT '{}',

  -- 技能组合配置（定义技能的协作规则）
  skill_combinations JSONB DEFAULT '[]',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS agent_skills_agent_id_idx ON agent_skills(agent_id);

-- 添加注释
COMMENT ON TABLE agent_skills IS '智能体技能配置表';
COMMENT ON COLUMN agent_skills.enabled_skills IS '启用的技能ID列表';
COMMENT ON COLUMN agent_skills.skill_priorities IS '技能优先级配置 {skill_id: priority}';
COMMENT ON COLUMN agent_skills.skill_combinations IS '技能组合配置 [{skills: [], name, description}]';

-- ==================== 技能执行日志表 ====================
CREATE TABLE IF NOT EXISTS skill_executions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id VARCHAR(100) NOT NULL,
  agent_id VARCHAR(36) REFERENCES agents(id) ON DELETE SET NULL,

  -- 执行参数
  params JSONB,

  -- 执行结果
  result JSONB,

  -- 执行元数据
  execution_time INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT false,

  -- 项目上下文（用于追溯）
  project_id VARCHAR(36) REFERENCES projects(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS skill_executions_skill_id_idx ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS skill_executions_agent_id_idx ON skill_executions(agent_id);
CREATE INDEX IF NOT EXISTS skill_executions_project_id_idx ON skill_executions(project_id);
CREATE INDEX IF NOT EXISTS skill_executions_created_at_idx ON skill_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS skill_executions_success_idx ON skill_executions(success);

-- 添加注释
COMMENT ON TABLE skill_executions IS '技能执行日志表';
COMMENT ON COLUMN skill_executions.skill_id IS '技能ID';
COMMENT ON COLUMN skill_executions.params IS '执行参数';
COMMENT ON COLUMN skill_executions.result IS '执行结果';
COMMENT ON COLUMN skill_executions.execution_time IS '执行时间（毫秒）';

-- ==================== 更新时间戳触发器 ====================

-- agent_skills表的更新时间戳
CREATE OR REPLACE FUNCTION update_agent_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_agent_skills_updated_at ON agent_skills;
CREATE TRIGGER trigger_update_agent_skills_updated_at
  BEFORE UPDATE ON agent_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_skills_updated_at();

-- ==================== 预设技能数据（可选）====================
-- 可以在这里插入一些预定义的技能配置示例
INSERT INTO agent_skills (agent_id, enabled_skills)
SELECT id, '["code-generation", "file-creation", "command-execution"]'
FROM agents
WHERE agent_type = 'llm'
AND is_active = true
ON CONFLICT DO NOTHING;
```

## 迁移说明

### 新增表

1. **agent_skills** - 智能体技能配置表
   - 关联到agents表
   - 存储每个智能体启用的技能列表
   - 支持技能优先级和组合配置

2. **skill_executions** - 技能执行日志表
   - 记录每次技能执行的详细信息
   - 包括参数、结果、执行时间等
   - 支持按智能体、技能、项目维度查询

### 字段说明

**agent_skills.enabled_skills**: JSONB数组，存储启用的技能ID
```json
["code-generation", "file-creation", "copywriting"]
```

**agent_skills.skill_priorities**: JSONB对象，存储技能优先级
```json
{
  "code-generation": 10,
  "file-creation": 5,
  "copywriting": 3
}
```

**agent_skills.skill_combinations**: JSONB数组，存储技能组合规则
```json
[
  {
    "name": "开发代码",
    "skills": ["requirement-analysis", "code-generation", "file-creation"],
    "description": "从需求分析到代码生成的完整流程"
  }
]
```

**skill_executions.params**: 执行参数，JSONB格式
**skill_executions.result**: 执行结果，JSONB格式，包含success、data、error、metadata等

### 索引优化

创建了以下索引以优化查询性能：
- agent_skills_agent_id_idx: 按智能体ID快速查询技能配置
- skill_executions_skill_id_idx: 按技能ID查询执行记录
- skill_executions_agent_id_idx: 按智能体ID查询执行记录
- skill_executions_project_id_idx: 按项目ID查询执行记录
- skill_executions_created_at_idx: 按时间倒序查询（用于日志查看）
- skill_executions_success_idx: 按执行成功/失败筛选

### 后续操作

迁移完成后，需要：
1. 更新Drizzle Schema（schema.ts）
2. 重启应用
3. 在技能管理页面为智能体配置技能
