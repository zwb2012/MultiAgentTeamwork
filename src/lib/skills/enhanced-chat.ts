/**
 * 技能增强的聊天逻辑
 * 为智能体对话集成技能调用能力
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { SkillExecutor, getAgentSkills } from './executor';
import { skillRegistry } from './registry';
import { detectSkillCall, generateSkillSummary } from './parser';
import type { ProjectContext } from '@/types/skill';

/**
 * 技能增强的聊天工具
 */
export class SkillEnhancedChat {
  private llmClient: LLMClient;
  private client: any;
  private skillExecutor: SkillExecutor;

  constructor(requestHeaders: Headers) {
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(requestHeaders);
    this.llmClient = new LLMClient(config, customHeaders);
    this.client = getSupabaseClient();
  }

  /**
   * 处理消息（集成技能）
   */
  async processMessage(params: {
    conversation_id: string;
    agent_id?: string;
    user_message: string;
    auto_detect?: boolean;
  }): Promise<ReadableStream> {
    const { conversation_id, agent_id, user_message, auto_detect } = params;

    // 1. 获取会话和智能体信息
    const { targetAgent, conversation, participants } = await this.getConversationInfo(
      conversation_id,
      agent_id,
      auto_detect
    );

    // 2. 获取项目上下文
    const projectContext = await this.getProjectContext(conversation.project_id);

    // 3. 获取智能体的技能配置
    const agentSkills = await getAgentSkills(targetAgent.id);

    // 4. 初始化技能执行器
    this.skillExecutor = new SkillExecutor(this.llmClient, projectContext, targetAgent.id);

    // 5. 构建增强的消息（包含技能信息）
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      targetAgent.system_prompt,
      agentSkills,
      projectContext
    );

    // 6. 获取历史消息
    const historyMessages = await this.getHistoryMessages(conversation_id);

    // 7. 构建消息数组
    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
      ...historyMessages,
      { role: 'user', content: user_message }
    ];

    // 8. 更新智能体状态
    await this.updateAgentStatus(targetAgent.id, 'working');

    // 9. 保存用户消息
    await this.saveMessage(conversation_id, targetAgent.id, 'user', user_message);

    // 10. 创建流式响应
    return this.createStreamingResponse(
      messages,
      conversation_id,
      targetAgent,
      agentSkills
    );
  }

  /**
   * 获取会话和智能体信息
   */
  private async getConversationInfo(
    conversation_id: string,
    agent_id?: string,
    auto_detect?: boolean
  ) {
    // 获取会话参与者
    const { data: participants, error: partError } = await this.client
      .from('conversation_participants')
      .select(`
        agent_id,
        agents (
          id,
          name,
          role,
          system_prompt,
          model,
          model_config,
          agent_type,
          status,
          work_status
        )
      `)
      .eq('conversation_id', conversation_id);

    if (partError || !participants || participants.length === 0) {
      throw new Error('会话没有参与者');
    }

    // 获取会话信息
    const { data: conversation } = await this.client
      .from('conversations')
      .select('id, project_id')
      .eq('id', conversation_id)
      .single();

    // 智能识别目标智能体
    let targetAgent = participants[0].agents;
    if (agent_id) {
      const found = participants.find((p: any) => p.agent_id === agent_id);
      if (found) {
        targetAgent = found.agents;
      }
    }

    return { targetAgent, conversation, participants };
  }

  /**
   * 获取项目上下文
   */
  private async getProjectContext(projectId: string | null): Promise<ProjectContext | null> {
    if (!projectId) return null;

    const { data: project } = await this.client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) return null;

    return {
      project_id: project.id,
      project_name: project.name,
      description: project.description,
      git_repo: project.git_repo,
      local_path: project.local_path
    };
  }

  /**
   * 构建增强的系统提示词
   */
  private buildEnhancedSystemPrompt(
    basePrompt: string,
    agentSkills: any[],
    projectContext: ProjectContext | null
  ): string {
    let enhancedPrompt = basePrompt;

    // 如果有技能，添加技能描述
    if (agentSkills && agentSkills.length > 0) {
      enhancedPrompt += '\n\n【可用技能】\n';
      enhancedPrompt += '你具备以下专业能力，可以根据需要主动调用：\n\n';

      agentSkills.forEach(skill => {
        enhancedPrompt += `${skill.icon} ${skill.name}\n`;
        enhancedPrompt += `  描述: ${skill.description}\n`;
        enhancedPrompt += `  函数: ${skill.capabilities.function_definition.name}\n`;
        enhancedPrompt += `  参数: ${JSON.stringify(skill.capabilities.function_definition.parameters, null, 2)}\n\n`;
      });

      enhancedPrompt += '【技能调用规则】\n';
      enhancedPrompt += '1. 当任务需要使用某个技能时，请在回复中明确说明需要调用哪个技能\n';
      enhancedPrompt += '2. 提供所需的参数（如果用户没有提供，可以询问或合理推断）\n';
      enhancedPrompt += '3. 技能执行完成后，根据结果继续回答用户问题\n\n';
    }

    // 添加项目上下文
    if (projectContext) {
      enhancedPrompt += '\n【项目上下文】\n';
      enhancedPrompt += `项目名称: ${projectContext.project_name}\n`;
      if (projectContext.description) {
        enhancedPrompt += `项目描述: ${projectContext.description}\n`;
      }
      if (projectContext.git_repo) {
        enhancedPrompt += `Git仓库: ${projectContext.git_repo}\n`;
      }
      if (projectContext.local_path) {
        enhancedPrompt += `本地路径: ${projectContext.local_path}\n`;
      }
      enhancedPrompt += '\n';
    }

    return enhancedPrompt;
  }

  /**
   * 获取历史消息
   */
  private async getHistoryMessages(conversation_id: string): Promise<any[]> {
    const { data: historyMessages } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20);

    if (!historyMessages) return [];

    return historyMessages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * 更新智能体状态
   */
  private async updateAgentStatus(agentId: string, status: string) {
    await this.client
      .from('agents')
      .update({
        work_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);
  }

  /**
   * 保存消息
   */
  private async saveMessage(
    conversation_id: string,
    agent_id: string,
    role: string,
    content: string,
    message_type: string = 'text',
    metadata?: any
  ) {
    await this.client.from('messages').insert({
      conversation_id,
      agent_id,
      role,
      content,
      message_type,
      metadata
    });
  }

  /**
   * 创建流式响应
   */
  private async createStreamingResponse(
    messages: any[],
    conversation_id: string,
    targetAgent: any,
    agentSkills: any[]
  ): Promise<ReadableStream> {
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        try {
          // 第一轮：让LLM分析并生成回复
          const llmStream = this.llmClient.stream(messages, {
            model: targetAgent.model || 'doubao-seed-1-8-251228',
            temperature: targetAgent.model_config?.temperature || 0.7,
            thinking: 'disabled',
            caching: 'disabled'
          });

          let llmResponse = '';
          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              llmResponse += text;
              fullResponse += text;

              // 发送数据块
              const data = JSON.stringify({
                content: text,
                agent_id: targetAgent.id,
                agent_name: targetAgent.name
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // 检查是否需要调用技能（使用优化的解析器）
          const lastUserMessage = messages[messages.length - 1]?.content || '';
          const skillDetection = await detectSkillCall(lastUserMessage, agentSkills, this.llmClient);

          if (skillDetection.has_call && skillDetection.call) {
            const skillCall = skillDetection.call;
            const skill = agentSkills.find((s: any) => s.id === skillCall.skill_id);

            if (skill) {
              // 发送技能调用通知
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'skill_call',
                    skill_name: skill.name,
                    skill_id: skill.id,
                    reasoning: skillCall.reasoning
                  })}\n\n`
                )
              );

              // 执行技能
              const skillResult = await this.skillExecutor.executeSkill(
                skill.id,
                skillCall.params
              );

              // 发送技能结果
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'skill_result',
                    success: skillResult.success,
                    result: skillResult.data,
                    error: skillResult.error
                  })}\n\n`
                )
              );

              // 生成技能执行总结
              if (skillResult.success && skillResult.data) {
                const summary = await generateSkillSummary(
                  lastUserMessage,
                  skill.name,
                  skillResult.data,
                  this.llmClient
                );

                // 流式输出总结
                for (const char of summary) {
                  fullResponse += char;
                  const data = JSON.stringify({
                    content: char,
                    agent_id: targetAgent.id,
                    agent_name: targetAgent.name
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
          }

          // 保存AI回复
          await this.saveMessage(
            conversation_id,
            targetAgent.id,
            'assistant',
            fullResponse,
            'text',
            {
              model: targetAgent.model,
              agent_name: targetAgent.name
            }
          );

          // 更新智能体状态
          await this.updateAgentStatus(targetAgent.id, 'idle');

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('技能增强聊天错误:', error);

          await this.updateAgentStatus(targetAgent.id, 'idle');

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '生成回复失败' })}\n\n`)
          );
          controller.close();
        }
      }
    });
  }
}
