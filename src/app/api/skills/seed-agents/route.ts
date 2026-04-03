import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/skills/seed-agents - 创建示例智能体并预配置技能
 */
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    // 示例智能体配置
    const sampleAgents = [
      {
        name: '代码助手',
        role: 'developer',
        system_prompt: '你是一位专业的代码助手，擅长编写、调试和优化代码。你可以生成高质量的各种编程语言的代码，并帮助用户解决编程问题。',
        agent_type: 'llm',
        model: 'doubao-seed-1-8-251228',
        model_config: {
          temperature: 0.7,
          thinking: 'disabled',
          caching: 'disabled'
        },
        is_template: true,
        enabled_skills: ['code-generation', 'file-creation', 'file-read', 'directory-creation', 'command-execution'],
        description: '擅长代码开发、文件操作和命令执行'
      },
      {
        name: '产品经理',
        role: 'product-manager',
        system_prompt: '你是一位经验丰富的产品经理，擅长需求分析、产品规划和PRD撰写。你可以帮助用户梳理需求、设计产品功能并撰写详细的产品需求文档。',
        agent_type: 'llm',
        model: 'doubao-seed-1-8-251228',
        model_config: {
          temperature: 0.6,
          thinking: 'disabled',
          caching: 'disabled'
        },
        is_template: true,
        enabled_skills: ['prd-design', 'requirement-analysis', 'copywriting'],
        description: '擅长需求分析、PRD设计和文案撰写'
      },
      {
        name: '全栈开发者',
        role: 'full-stack',
        system_prompt: '你是一位全栈开发专家，从前端到后端都能胜任。你熟悉现代Web技术栈，可以编写高质量的前端和后端代码，并处理复杂的业务逻辑。',
        agent_type: 'llm',
        model: 'doubao-seed-1-8-251228',
        model_config: {
          temperature: 0.7,
          thinking: 'disabled',
          caching: 'disabled'
        },
        is_template: true,
        enabled_skills: ['code-generation', 'file-creation', 'file-read', 'directory-creation', 'command-execution', 'prd-design'],
        description: '全栈开发能力，涵盖代码开发和产品设计'
      }
    ];

    const createdAgents = [];

    for (const agentConfig of sampleAgents) {
      // 检查是否已存在同名模板
      const { data: existing } = await client
        .from('agents')
        .select('id')
        .eq('name', agentConfig.name)
        .eq('is_template', true)
        .single();

      if (existing) {
        // 更新已有智能体的技能配置
        const { error: updateError } = await client
          .from('agent_skills')
          .upsert({
            agent_id: existing.id,
            enabled_skills: agentConfig.enabled_skills,
            skill_priorities: {},
            skill_combinations: []
          }, { onConflict: 'agent_id' });

        if (updateError) {
          console.error(`更新智能体 ${agentConfig.name} 技能失败:`, updateError);
        }

        // 无论是否成功，都返回结果（技能配置可能已存在）
        createdAgents.push({
          name: agentConfig.name,
          id: existing.id,
          action: 'updated',
          enabled_skills: agentConfig.enabled_skills
        });
      } else {
        // 创建新智能体
        const { data: newAgent, error: createError } = await client
          .from('agents')
          .insert({
            name: agentConfig.name,
            role: agentConfig.role,
            system_prompt: agentConfig.system_prompt,
            agent_type: agentConfig.agent_type,
            model: agentConfig.model,
            model_config: agentConfig.model_config,
            is_template: agentConfig.is_template,
            online_status: 'unknown',
            work_status: 'idle',
            status: 'idle',
            is_active: true
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`创建智能体 ${agentConfig.name} 失败:`, createError);
          continue;
        }

        // 配置技能
        const { error: skillsError } = await client
          .from('agent_skills')
          .upsert({
            agent_id: newAgent.id,
            enabled_skills: agentConfig.enabled_skills,
            skill_priorities: {},
            skill_combinations: []
          }, { onConflict: 'agent_id' });

        if (skillsError) {
          console.error(`配置智能体 ${agentConfig.name} 技能失败:`, skillsError);
          // 继续执行，不阻止流程
        }

        createdAgents.push({
          name: agentConfig.name,
          id: newAgent.id,
          action: 'created',
          enabled_skills: agentConfig.enabled_skills,
          description: agentConfig.description
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功创建/更新 ${createdAgents.length} 个示例智能体`,
      data: createdAgents
    });
  } catch (error) {
    console.error('创建示例智能体失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建失败'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/skills/seed-agents - 查看示例智能体状态
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    const { data: agents } = await client
      .from('agents')
      .select('id, name, role, is_template')
      .eq('is_template', true)
      .order('created_at', { ascending: false });

    const agentIds = agents?.map(a => a.id) || [];

    // 获取这些智能体的技能配置
    let agentSkills: any[] = [];
    if (agentIds.length > 0) {
      const { data: skills } = await client
        .from('agent_skills')
        .select('*')
        .in('agent_id', agentIds);

      agentSkills = skills || [];
    }

    const agentsWithSkills = agents?.map(agent => {
      const skillConfig = agentSkills.find(s => s.agent_id === agent.id);
      return {
        ...agent,
        enabled_skills: skillConfig?.enabled_skills || []
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: agentsWithSkills
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      },
      { status: 500 }
    );
  }
}
