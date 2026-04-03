import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/skills/migrate - 执行技能系统数据库迁移
 */
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    // 创建 agent_skills 表
    const { error: agentsSkillsError } = await client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_skills (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          enabled_skills JSONB DEFAULT '[]',
          skill_priorities JSONB DEFAULT '{}',
          skill_combinations JSONB DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS agent_skills_agent_id_idx ON agent_skills(agent_id);

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
      `
    });

    // 创建 skill_executions 表
    const { error: executionsError } = await client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS skill_executions (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          skill_id VARCHAR(100) NOT NULL,
          agent_id VARCHAR(36) REFERENCES agents(id) ON DELETE SET NULL,
          params JSONB,
          result JSONB,
          execution_time INTEGER DEFAULT 0,
          success BOOLEAN DEFAULT false,
          project_id VARCHAR(36),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE INDEX IF NOT EXISTS skill_executions_skill_id_idx ON skill_executions(skill_id);
        CREATE INDEX IF NOT EXISTS skill_executions_agent_id_idx ON skill_executions(agent_id);
        CREATE INDEX IF NOT EXISTS skill_executions_project_id_idx ON skill_executions(project_id);
        CREATE INDEX IF NOT EXISTS skill_executions_created_at_idx ON skill_executions(created_at DESC);
        CREATE INDEX IF NOT EXISTS skill_executions_success_idx ON skill_executions(success);
      `
    });

    // 检查表是否创建成功
    const { data: tables, error: checkError } = await client.rpc('get_tables');

    const agentSkillsExists = tables?.some((t: any) => t.table_name === 'agent_skills');
    const skillExecutionsExists = tables?.some((t: any) => t.table_name === 'skill_executions');

    return NextResponse.json({
      success: true,
      message: '数据库迁移已完成',
      data: {
        agent_skills: {
          created: agentSkillsExists,
          error: agentsSkillsError?.message
        },
        skill_executions: {
          created: skillExecutionsExists,
          error: executionsError?.message
        }
      }
    });
  } catch (error) {
    console.error('数据库迁移失败:', error);

    // 如果RPC方法不可用，提供手动执行的SQL
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '迁移失败',
      requires_manual: true,
      sql_script: `
-- 请在Supabase SQL Editor中手动执行以下SQL：

-- 1. 创建 agent_skills 表
CREATE TABLE IF NOT EXISTS agent_skills (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  enabled_skills JSONB DEFAULT '[]',
  skill_priorities JSONB DEFAULT '{}',
  skill_combinations JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS agent_skills_agent_id_idx ON agent_skills(agent_id);

-- 2. 创建更新时间戳触发器
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

-- 3. 创建 skill_executions 表
CREATE TABLE IF NOT EXISTS skill_executions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id VARCHAR(100) NOT NULL,
  agent_id VARCHAR(36) REFERENCES agents(id) ON DELETE SET NULL,
  params JSONB,
  result JSONB,
  execution_time INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT false,
  project_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS skill_executions_skill_id_idx ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS skill_executions_agent_id_idx ON skill_executions(agent_id);
CREATE INDEX IF NOT EXISTS skill_executions_project_id_idx ON skill_executions(project_id);
CREATE INDEX IF NOT EXISTS skill_executions_created_at_idx ON skill_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS skill_executions_success_idx ON skill_executions(success);
      `
    }, { status: 500 });
  }
}

/**
 * GET /api/skills/migrate - 检查迁移状态
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    // 尝试查询表以检查是否存在
    let agentSkillsExists = false;
    let skillExecutionsExists = false;

    try {
      await client.from('agent_skills').select('id').limit(1);
      agentSkillsExists = true;
    } catch (e) {
      // 表不存在
    }

    try {
      await client.from('skill_executions').select('id').limit(1);
      skillExecutionsExists = true;
    } catch (e) {
      // 表不存在
    }

    return NextResponse.json({
      success: true,
      data: {
        agent_skills_exists: agentSkillsExists,
        skill_executions_exists: skillExecutionsExists,
        migration_required: !agentSkillsExists || !skillExecutionsExists
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '检查失败'
    }, { status: 500 });
  }
}
