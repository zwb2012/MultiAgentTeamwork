import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAgentSkills, configureAgentSkills } from '@/lib/skills/executor';
import { skillRegistry } from '@/lib/skills/registry';

/**
 * GET /api/agents/[id]/skills - 获取智能体的技能配置
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // 从数据库获取技能配置
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('agent_skills')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get agent skills:', error);
      return NextResponse.json(
        {
          success: false,
          error: '获取技能配置失败'
        },
        { status: 500 }
      );
    }

    // 获取所有可用技能
    const allSkills = Object.values(skillRegistry);

    // 获取已启用的技能详情
    const enabledSkills = data?.enabled_skills || [];
    const enabledSkillDetails = enabledSkills
      .map(id => skillRegistry[id])
      .filter(Boolean);

    // 按类别分组
    const skillsByCategory = {
      code: allSkills.filter(s => s.category === 'code'),
      text: allSkills.filter(s => s.category === 'text'),
      analysis: allSkills.filter(s => s.category === 'analysis'),
      design: allSkills.filter(s => s.category === 'design'),
      integration: allSkills.filter(s => s.category === 'integration')
    };

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        enabled_skills: enabledSkills,
        skill_priorities: data?.skill_priorities || {},
        skill_combinations: data?.skill_combinations || [],
        all_skills: allSkills,
        enabled_skill_details: enabledSkillDetails,
        skills_by_category: skillsByCategory
      }
    });
  } catch (error) {
    console.error('Failed to get agent skills:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取技能配置失败'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]/skills - 更新智能体的技能配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();

    const { enabled_skills, skill_priorities, skill_combinations } = body;

    // 验证技能ID是否有效
    if (enabled_skills && Array.isArray(enabled_skills)) {
      const invalidSkills = enabled_skills.filter(id => !skillRegistry[id]);
      if (invalidSkills.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `无效的技能ID: ${invalidSkills.join(', ')}`
          },
          { status: 400 }
        );
      }
    }

    // 更新配置
    await configureAgentSkills(agentId, {
      enabled_skills: enabled_skills || [],
      skill_priorities: skill_priorities || {},
      skill_combinations: skill_combinations || []
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        enabled_skills,
        skill_priorities,
        skill_combinations
      },
      message: '技能配置已更新'
    });
  } catch (error) {
    console.error('Failed to update agent skills:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新技能配置失败'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/skills/toggle - 切换技能启用状态
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { skill_id, enabled } = body;

    if (!skill_id || typeof enabled !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误'
        },
        { status: 400 }
      );
    }

    // 验证技能是否存在
    if (!skillRegistry[skill_id]) {
      return NextResponse.json(
        {
          success: false,
          error: '技能不存在'
        },
        { status: 404 }
      );
    }

    // 获取当前配置
    const client = getSupabaseClient();
    const { data: current } = await client
      .from('agent_skills')
      .select('enabled_skills')
      .eq('agent_id', agentId)
      .single();

    let enabledSkills = current?.enabled_skills || [];

    if (enabled) {
      // 启用技能
      if (!enabledSkills.includes(skill_id)) {
        enabledSkills.push(skill_id);
      }
    } else {
      // 禁用技能
      enabledSkills = enabledSkills.filter(id => id !== skill_id);
    }

    // 更新配置
    await configureAgentSkills(agentId, {
      enabled_skills: enabledSkills,
      skill_priorities: current?.skill_priorities || {},
      skill_combinations: current?.skill_combinations || []
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        skill_id,
        enabled,
        enabled_skills: enabledSkills
      },
      message: enabled ? '技能已启用' : '技能已禁用'
    });
  } catch (error) {
    console.error('Failed to toggle skill:', error);
    return NextResponse.json(
      {
        success: false,
        error: '切换技能状态失败'
      },
      { status: 500 }
    );
  }
}
