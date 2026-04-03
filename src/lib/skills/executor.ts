/**
 * 技能执行引擎
 * 负责技能路由、执行和协调
 */

import type {
  Skill,
  SkillResult,
  SkillRoutingResult,
  ProjectContext,
  AgentSkillConfig
} from '@/types/skill';
import { skillRegistry } from './registry';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 技能执行引擎
 */
export class SkillExecutor {
  private llmClient: any;
  private projectContext?: ProjectContext;
  private agentId?: string;

  constructor(llmClient?: any, projectContext?: ProjectContext, agentId?: string) {
    this.llmClient = llmClient;
    this.projectContext = projectContext;
    this.agentId = agentId;

    // 如果没有提供LLM客户端，初始化一个
    if (!this.llmClient) {
      this.initializeLLMClient();
    }
  }

  /**
   * 初始化LLM客户端
   */
  private async initializeLLMClient() {
    const { LLMClient, Config } = await import('coze-coding-dev-sdk');
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }

  /**
   * 执行单个技能
   */
  async executeSkill(skillId: string, params: any, context?: any): Promise<SkillResult> {
    const skill = skillRegistry[skillId];

    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${skillId}`,
        metadata: { execution_time: 0 }
      };
    }

    const startTime = Date.now();

    try {
      // 合并项目上下文
      const finalContext = {
        ...context,
        project_context: this.projectContext
      };

      // 如果需要LLM，确保LLM客户端已初始化
      if (skill.capabilities.requires_llm && !this.llmClient) {
        await this.initializeLLMClient();
      }

      // 执行技能
      let result: SkillResult;
      if (skill.capabilities.requires_local_execution) {
        // 本地执行
        result = await this.executeLocalSkill(skill, params, finalContext);
      } else if (skill.capabilities.requires_llm) {
        // LLM执行
        result = await this.executeLLMSkill(skill, params, finalContext);
      } else {
        // 直接执行
        result = await skill.capabilities.executor(params, finalContext);
      }

      const executionTime = Date.now() - startTime;

      // 记录执行日志
      await this.logSkillExecution(skillId, params, result, executionTime);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          execution_time: executionTime,
          skill_id: skillId
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      const errorResult: SkillResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Skill execution failed',
        metadata: {
          execution_time: executionTime,
          skill_id: skillId
        }
      };

      // 记录错误日志
      await this.logSkillExecution(skillId, params, errorResult, executionTime);

      return errorResult;
    }
  }

  /**
   * 执行本地技能（文件操作等）
   */
  private async executeLocalSkill(skill: Skill, params: any, context?: any): Promise<SkillResult> {
    return await skill.capabilities.executor(params, context);
  }

  /**
   * 执行LLM技能
   */
  private async executeLLMSkill(skill: Skill, params: any, context?: any): Promise<SkillResult> {
    return await skill.capabilities.executor(params, context);
  }

  /**
   * 智能路由：自动选择合适的技能
   */
  async routeAndExecute(task: string, context?: any): Promise<SkillResult> {
    try {
      // 1. 分析任务，确定需要的技能
      const routing = await this.analyzeTask(task);

      if (routing.skills.length === 0) {
        return {
          success: false,
          error: 'No suitable skills found for the task',
          metadata: { execution_time: 100, reasoning: routing.reasoning }
        };
      }

      // 2. 如果需要多个技能，按顺序执行
      if (routing.skills.length > 1) {
        return await this.executeSkillChain(routing.skills, task, context, routing.reasoning);
      }

      // 3. 单个技能执行
      const skill = routing.skills[0];
      const params = await this.extractParams(skill, task, context);

      const result = await this.executeSkill(skill.id, params, context);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          reasoning: routing.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Route and execute failed',
        metadata: { execution_time: 0 }
      };
    }
  }

  /**
   * 分析任务需要的技能
   */
  private async analyzeTask(task: string): Promise<SkillRoutingResult> {
    if (!this.llmClient) {
      await this.initializeLLMClient();
    }

    const allSkills = getAllSkills();
    const skillsList = allSkills.map(s => `- ${s.name} (${s.id}): ${s.description}`).join('\n');

    const systemPrompt = `你是一个智能任务路由器，负责分析任务并选择合适的技能。

可用技能列表：
${skillsList}

请分析以下任务，确定需要使用哪些技能。

返回JSON格式：
{
  "skills": ["skill-id-1", "skill-id-2"],
  "reasoning": "选择原因",
  "estimated_complexity": "low|medium|high"
}

规则：
1. 优先选择最少的技能完成任务
2. 如果需要多个步骤，返回多个技能ID
3. 技能顺序按照执行顺序排列
`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `任务描述：\n${task}` }
    ];

    const response = await this.llmClient.stream(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
      thinking: 'disabled' as const,
      caching: 'disabled' as const
    });

    let responseText = '';
    for await (const chunk of response) {
      if (chunk.content) {
        responseText += chunk.content.toString();
      }
    }

    // 提取JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // 无法解析，返回所有技能让用户选择
      return {
        skills: allSkills.slice(0, 3), // 返回前3个技能
        reasoning: '无法确定具体技能，返回可用技能列表'
      };
    }

    try {
      const result = JSON.parse(jsonMatch[0]);
      const skills = result.skills
        .map((id: string) => skillRegistry[id])
        .filter(Boolean);

      return {
        skills,
        reasoning: result.reasoning || 'Task analysis completed',
        estimated_complexity: result.estimated_complexity || 'medium'
      };
    } catch (error) {
      return {
        skills: [],
        reasoning: 'Failed to parse analysis result'
      };
    }
  }

  /**
   * 执行技能链
   */
  private async executeSkillChain(
    skills: Skill[],
    task: string,
    context?: any,
    reasoning?: string
  ): Promise<SkillResult> {
    const results: any[] = [];
    let currentContext = context || {};
    let allSuccess = true;

    for (const skill of skills) {
      // 上一个技能的结果作为下一个技能的输入
      const params = await this.extractParams(skill, task, currentContext);
      const result = await this.executeSkill(skill.id, params, currentContext);

      results.push({
        skill: skill.name,
        skill_id: skill.id,
        result: result
      });

      if (!result.success) {
        allSuccess = false;
        break;
      }

      // 更新上下文
      currentContext = {
        ...currentContext,
        [skill.id]: result.data,
        last_result: result.data
      };
    }

    return {
      success: allSuccess,
      data: {
        results,
        summary: `执行了${skills.length}个技能，${allSuccess ? '全部成功' : '部分失败'}`,
        context: currentContext
      },
      metadata: {
        execution_time: results.reduce((sum, r) => sum + (r.result.metadata?.execution_time || 0), 0),
        reasoning: reasoning || 'Multi-skill execution completed',
        skills_count: skills.length
      }
    };
  }

  /**
   * 从任务中提取参数
   */
  private async extractParams(skill: Skill, task: string, context?: any): Promise<any> {
    const { properties, required } = skill.capabilities.function_definition.parameters;

    // 如果上下文中已经包含所需参数，直接使用
    if (required && required.every(param => context && param in context)) {
      const params: any = {};
      for (const param of required) {
        params[param] = context[param];
      }
      return params;
    }

    // 否则使用LLM提取参数
    if (!this.llmClient) {
      await this.initializeLLMClient();
    }

    const systemPrompt = `你是一个参数提取器，负责从任务描述中提取技能所需的参数。

技能：${skill.name}
参数定义：${JSON.stringify(properties, null, 2)}

请从以下任务描述中提取参数值。

返回JSON格式（只返回JSON，不要包含其他文本）：
{
  "param1": "value1",
  "param2": "value2"
}

注意：
1. 如果某个参数无法从任务描述中提取，使用null
2. 数组类型的参数应该返回数组格式
3. 确保返回的值符合参数定义的类型
`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `任务描述：\n${task}\n\n上下文信息：\n${JSON.stringify(context || {}, null, 2)}` }
    ];

    const response = await this.llmClient.stream(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
      thinking: 'disabled' as const,
      caching: 'disabled' as const
    });

    let responseText = '';
    for await (const chunk of response) {
      if (chunk.content) {
        responseText += chunk.content.toString();
      }
    }

    // 提取JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // 无法解析，返回空对象
      return {};
    }

    try {
      const params = JSON.parse(jsonMatch[0]);

      // 添加项目上下文
      if (this.projectContext) {
        params.project_context = this.projectContext;
      }

      return params;
    } catch (error) {
      console.error('Failed to parse extracted params:', error);
      return {};
    }
  }

  /**
   * 记录技能执行日志
   */
  private async logSkillExecution(
    skillId: string,
    params: any,
    result: SkillResult,
    executionTime: number
  ): Promise<void> {
    try {
      const client = getSupabaseClient();

      await client.from('skill_executions').insert({
        skill_id: skillId,
        agent_id: this.agentId,
        params: params,
        result: result,
        execution_time: executionTime,
        success: result.success,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log skill execution:', error);
    }
  }

  /**
   * 设置项目上下文
   */
  setProjectContext(context: ProjectContext): void {
    this.projectContext = context;
  }

  /**
   * 设置智能体ID
   */
  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

  /**
   * 设置LLM客户端
   */
  setLLMClient(llmClient: any): void {
    this.llmClient = llmClient;
  }
}

/**
 * 获取智能体绑定的技能
 */
export async function getAgentSkills(agentId: string): Promise<Skill[]> {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('agent_skills')
      .select('enabled_skills')
      .eq('agent_id', agentId)
      .single();

    if (error || !data) {
      return [];
    }

    const skills: Skill[] = [];
    for (const skillId of data.enabled_skills || []) {
      const skill = skillRegistry[skillId];
      if (skill) {
        skills.push(skill);
      }
    }

    return skills;
  } catch (error) {
    console.error('Failed to get agent skills:', error);
    return [];
  }
}

/**
 * 配置智能体技能
 */
export async function configureAgentSkills(
  agentId: string,
  config: AgentSkillConfig
): Promise<void> {
  try {
    const client = getSupabaseClient();

    const { data: existing } = await client
      .from('agent_skills')
      .select('id')
      .eq('agent_id', agentId)
      .single();

    const skillConfig = {
      agent_id: agentId,
      enabled_skills: config.enabled_skills,
      skill_priorities: config.skill_priorities,
      skill_combinations: config.skill_combinations
    };

    if (existing) {
      // 更新
      await client
        .from('agent_skills')
        .update(skillConfig)
        .eq('agent_id', agentId);
    } else {
      // 创建
      await client.from('agent_skills').insert(skillConfig);
    }
  } catch (error) {
    console.error('Failed to configure agent skills:', error);
    throw error;
  }
}
