/**
 * 技能调用解析器
 * 使用LLM更精确地识别和解析技能调用
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import type { Skill } from '@/types/skill';

interface SkillCall {
  skill_id: string;
  skill_name: string;
  params: Record<string, any>;
  reasoning: string;
}

interface SkillCallResult {
  has_call: boolean;
  call?: SkillCall;
  normal_response?: string;
}

/**
 * 解析用户消息，判断是否需要调用技能
 */
export async function detectSkillCall(
  userMessage: string,
  availableSkills: Skill[],
  llmClient: LLMClient
): Promise<SkillCallResult> {
  if (availableSkills.length === 0) {
    return { has_call: false, normal_response: userMessage };
  }

  // 构建技能列表描述
  const skillsList = availableSkills
    .map(skill => {
      return `- ${skill.name} (${skill.id}): ${skill.description}
  函数: ${skill.capabilities.function_definition.name}
  参数: ${JSON.stringify(skill.capabilities.function_definition.parameters)}`;
    })
    .join('\n\n');

  const systemPrompt = `你是一个智能技能路由器，负责分析用户消息并判断是否需要调用技能。

可用技能列表：
${skillsList}

你的任务：
1. 分析用户消息，判断是否需要调用某个技能
2. 如果需要调用，提供具体的参数
3. 如果不需要调用，说明原因并生成正常回复

返回格式（必须是纯JSON，不要包含任何其他文字）：

需要调用技能时：
{
  "has_call": true,
  "skill_id": "技能ID",
  "skill_name": "技能名称",
  "params": {
    "参数名": "参数值"
  },
  "reasoning": "选择此技能的原因"
}

不需要调用技能时：
{
  "has_call": false,
  "normal_response": "对用户问题的正常回复"
}

注意事项：
1. 如果用户没有提供某些参数，可以设置为null，但在回复中询问用户
2. 参数值必须符合参数定义的类型
3. 如果多个技能都可能适用，选择最合适的一个`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage }
  ];

  try {
    const stream = llmClient.stream(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
      thinking: 'disabled',
      caching: 'disabled'
    });

    let responseText = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        responseText += chunk.content.toString();
      }
    }

    // 提取JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // 无法解析，返回正常响应
      return {
        has_call: false,
        normal_response: responseText || userMessage
      };
    }

    const result = JSON.parse(jsonMatch[0]);

    if (result.has_call && result.skill_id) {
      // 验证技能ID是否存在
      const skill = availableSkills.find(s => s.id === result.skill_id);
      if (!skill) {
        return {
          has_call: false,
          normal_response: `抱歉，未找到技能: ${result.skill_id}`
        };
      }

      return {
        has_call: true,
        call: {
          skill_id: result.skill_id,
          skill_name: result.skill_name || skill.name,
          params: result.params || {},
          reasoning: result.reasoning || ''
        }
      };
    }

    return {
      has_call: false,
      normal_response: result.normal_response || responseText
    };
  } catch (error) {
    console.error('解析技能调用失败:', error);
    return { has_call: false, normal_response: userMessage };
  }
}

/**
 * 生成技能执行后的总结
 */
export async function generateSkillSummary(
  originalTask: string,
  skillName: string,
  skillResult: any,
  llmClient: LLMClient
): Promise<string> {
  const systemPrompt = `你是一个专业的助手，负责总结技能执行结果。

你的任务：根据原始任务和技能执行结果，生成一个清晰、友好的总结。

要求：
1. 说明技能执行是否成功
2. 如果成功，简要说明结果
3. 如果失败，说明原因并提供建议
4. 使用友好、专业的语气`;

  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt
    },
    {
      role: 'user' as const,
      content: `原始任务：${originalTask}

执行的技能：${skillName}

执行结果：
${JSON.stringify(skillResult, null, 2)}

请生成总结。`
    }
  ];

  try {
    const stream = llmClient.stream(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
      thinking: 'disabled',
      caching: 'disabled'
    });

    let summary = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        summary += chunk.content.toString();
      }
    }

    return summary;
  } catch (error) {
    console.error('生成总结失败:', error);
    return `技能 ${skillName} 执行${skillResult.success ? '成功' : '失败'}。`;
  }
}
