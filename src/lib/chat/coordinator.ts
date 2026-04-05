/**
 * 智能体协调器
 * 负责协调多个智能体完成任务，整合多个智能体的响应
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import type { Agent } from '@/types/agent';

export interface AgentConsultation {
  agent_id: string;
  agent_name: string;
  query: string;
  response: string;
  success: boolean;
  error?: string;
}

export class AgentCoordinator {
  private client: LLMClient;
  private coordinatorPrompt: string;

  constructor(llmClient: LLMClient) {
    this.client = llmClient;
    this.coordinatorPrompt = this.buildCoordinatorPrompt();
  }

  /**
   * 协调多个智能体完成任务
   * @param userMessage 用户消息
   * @param mentionedAgents 被提及的智能体列表
   * @param projectContext 项目上下文
   * @param historyMessages 历史消息
   * @returns 流式响应
   */
  async coordinate(
    userMessage: string,
    mentionedAgents: Agent[],
    projectContext: any = null,
    historyMessages: any[] = []
  ): Promise<ReadableStream> {
    const encoder = new TextEncoder();

    // 构建上下文信息
    const contextInfo = this.buildContextInfo(mentionedAgents, projectContext);

    // 构建协调者消息
    const messages = [
      {
        role: 'system',
        content: `${this.coordinatorPrompt}\n\n${contextInfo}`
      },
      ...historyMessages.slice(-10), // 只取最近10条历史消息
      {
        role: 'user',
        content: userMessage
      }
    ];

    // 构建工具函数（让协调者可以调用其他Agent）
    const agentTools = this.buildAgentTools(mentionedAgents);

    // 捕获方法引用，避免在异步上下文中丢失this
    const llmClient = this.client;
    const parseToolCalls = this.parseToolCalls.bind(this);
    const executeToolCall = this.executeToolCall.bind(this);
    const formatToolResult = this.formatToolResult.bind(this);

    // 创建流式响应
    return new ReadableStream({
      async start(controller) {
        try {
          // 调用协调者LLM（不带工具，因为我们要自己实现工具调用）
          const stream = llmClient.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.7,
            thinking: 'disabled',
            caching: 'disabled'
          });

          // 读取协调者的输出
          let coordinatorOutput = '';
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              coordinatorOutput += text;

              // 检查是否有工具调用
              const toolCalls = parseToolCalls(text);

              if (toolCalls.length > 0) {
                // 执行工具调用
                for (const toolCall of toolCalls) {
                  try {
                    const result = await executeToolCall(toolCall, mentionedAgents, projectContext);
                    // 将工具结果追加到输出中
                    const formattedResult = formatToolResult(toolCall, result);
                    coordinatorOutput += formattedResult;
                    controller.enqueue(encoder.encode(formattedResult));
                  } catch (error) {
                    const errorMsg = `\n\n[工具调用失败: ${error instanceof Error ? error.message : '未知错误'}]`;
                    coordinatorOutput += errorMsg;
                    controller.enqueue(encoder.encode(errorMsg));
                  }
                }
              } else {
                // 普通文本输出
                controller.enqueue(encoder.encode(text));
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error('协调者执行失败:', error);
          controller.enqueue(
            encoder.encode(`\n\n[协调器错误: ${error instanceof Error ? error.message : '未知错误'}]`)
          );
          controller.close();
        }
      }
    });
  }

  /**
   * 构建协调者的系统提示词
   */
  private buildCoordinatorPrompt(): string {
    return `你是一个智能体协调者，负责协调多个专业智能体协作完成复杂任务。

你的职责:
1. 理解用户的需求
2. 确定需要哪些智能体参与
3. 按照合理的顺序调用相关智能体
4. 整合所有智能体的响应
5. 以清晰、结构化的方式输出最终结果

调用智能体的格式:
\`\`\`tool
{"tool": "consult_[智能体名称或ID]", "query": "要询问智能体的问题"}
\`\`\`

例如:
\`\`\`tool
{"tool": "consult_前端专家", "query": "请设计用户注册表单，包含字段验证"}
\`\`\`

输出格式要求:
1. 使用清晰的标题分隔不同智能体的输出
2. 为每个智能体的输出添加明确的标识（如"## 前端方案 (由前端专家提供)"）
3. 在最后提供总结，整合所有智能体的建议
4. 保持输出结构化、易于阅读

注意事项:
- 每次只能调用一个智能体
- 调用智能体后，等待其响应完成再继续
- 不要编造智能体的回复，必须真实调用
- 确保输出的连贯性和完整性`;
  }

  /**
   * 构建上下文信息
   */
  private buildContextInfo(agents: Agent[], projectContext: any): string {
    let info = '## 可用的智能体\n\n';
    info += agents.map(agent => {
      return `- ${agent.name} (ID: ${agent.id}): ${agent.system_prompt?.split('\n')[0] || agent.role}`;
    }).join('\n');

    if (projectContext) {
      info += '\n\n## 项目上下文\n\n';
      info += `- 项目名称: ${projectContext.name || '未命名'}\n`;
      info += `- 项目类型: ${projectContext.type || '通用'}\n`;
      if (projectContext.description) {
        info += `- 项目描述: ${projectContext.description}\n`;
      }
    }

    return info;
  }

  /**
   * 构建智能体工具
   */
  private buildAgentTools(agents: Agent[]): any[] {
    return agents.map(agent => ({
      name: `consult_${agent.name}`,
      description: `咨询${agent.name}的意见或请求其完成任务`,
      agent_id: agent.id,
      agent_name: agent.name
    }));
  }

  /**
   * 解析工具调用
   */
  private parseToolCalls(text: string): any[] {
    const toolCalls: any[] = [];
    const toolPattern = /```tool\s*\n([\s\S]*?)```/g;

    let match;
    while ((match = toolPattern.exec(text)) !== null) {
      try {
        const toolData = JSON.parse(match[1].trim());
        if (toolData.tool && toolData.query) {
          toolCalls.push(toolData);
        }
      } catch (error) {
        console.error('解析工具调用失败:', error);
      }
    }

    return toolCalls;
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(
    toolCall: any,
    agents: Agent[],
    projectContext: any
  ): Promise<string> {
    // 查找对应的智能体
    const toolName = toolCall.tool;
    const agent = agents.find(a =>
      toolName === `consult_${a.name}` ||
      toolName === `consult_${a.id}`
    );

    if (!agent) {
      throw new Error(`未找到智能体: ${toolName}`);
    }

    // 构建智能体调用的消息
    const agentMessages = [
      {
        role: 'system' as const,
        content: this.buildAgentSystemPrompt(agent, projectContext)
      },
      {
        role: 'user' as const,
        content: toolCall.query
      }
    ];

    // 调用智能体LLM
    const { getEffectiveAPIConfig } = await import('../global-config');
    const agentModelConfig = agent.model_config || {};
    const apiKey = agentModelConfig.api_key || getEffectiveAPIConfig().api_key;
    const baseUrl = agentModelConfig.base_url || getEffectiveAPIConfig().base_url;
    const modelName = agent.model || 'doubao-seed-1-8-251228';

    process.env.OPENAI_API_KEY = apiKey;
    if (baseUrl) {
      process.env.OPENAI_BASE_URL = baseUrl;
    }

    const config = new Config();
    const llmClient = new LLMClient(config);

    const llmConfig = {
      model: modelName,
      temperature: agentModelConfig.temperature || 0.7,
      thinking: agentModelConfig.thinking || 'disabled',
      caching: agentModelConfig.caching || 'disabled'
    };

    // 调用智能体
    const stream = llmClient.stream(agentMessages, llmConfig);
    let response = '';

    for await (const chunk of stream) {
      if (chunk.content) {
        response += chunk.content.toString();
      }
    }

    return response;
  }

  /**
   * 构建智能体的系统提示词
   */
  private buildAgentSystemPrompt(agent: Agent, projectContext: any): string {
    let prompt = agent.system_prompt || '';

    // 注入项目上下文
    if (projectContext) {
      const { injectProjectContext, buildProjectContextFromProject } = require('../project-context');
      prompt = injectProjectContext(prompt, projectContext);
    }

    return prompt;
  }

  /**
   * 格式化工具结果
   */
  private formatToolResult(toolCall: any, result: string): string {
    const toolName = toolCall.tool.replace('consult_', '');
    return `\n\n## ${toolName} 的回复\n\n${result}`;
  }
}
