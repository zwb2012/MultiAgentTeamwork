import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, Message, ModelConfig } from '@/types/agent';
import { AGENT_ROLE_TEMPLATES } from '@/types/agent';
import { injectProjectContext, buildProjectContextFromProject } from '@/lib/project-context';
import { getAgentTasks, injectTaskContext } from '@/lib/agent-tasks';

// SDK 支持的模型列表
const SUPPORTED_MODELS = [
  'doubao-seed-2-0-pro-260215',
  'doubao-seed-2-0-lite-260215',
  'doubao-seed-2-0-mini-260215',
  'doubao-seed-1-8-251228',
  'doubao-seed-1-6-251015',
  'doubao-seed-1-6-vision-250815',
  'doubao-seed-1-6-lite-251015',
  'deepseek-v3-2-251201',
  'glm-4-7-251222',
  'deepseek-r1-250528',
  'kimi-k2-5-260127'
];

// 模型名称映射（将常见模型名映射到SDK支持的名称）
const MODEL_MAPPING: Record<string, string> = {
  'deepseek-chat': 'deepseek-v3-2-251201',
  'deepseek': 'deepseek-v3-2-251201',
  'doubao': 'doubao-seed-1-8-251228',
  'kimi': 'kimi-k2-5-260127',
  'glm': 'glm-4-7-251222'
};

// POST /api/chat - AI对话(流式输出)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, agent_id, user_message, auto_detect } = body;
    
    if (!conversation_id || !user_message) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: conversation_id, user_message' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 获取会话参与者
    const { data: participants, error: partError } = await client
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
          work_status,
          online_status
        )
      `)
      .eq('conversation_id', conversation_id);
    
    if (partError || !participants || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: '会话没有参与者' },
        { status: 400 }
      );
    }
    
    // 获取会话信息（包含项目ID）
    const { data: conversation, error: convError } = await client
      .from('conversations')
      .select('id, title, project_id')
      .eq('id', conversation_id)
      .single();
    
    // 获取项目上下文
    let projectContext = null;
    if (conversation?.project_id) {
      const { data: project } = await client
        .from('projects')
        .select('*')
        .eq('id', conversation.project_id)
        .single();
      
      if (project) {
        projectContext = buildProjectContextFromProject(project);
      }
    }
    
    // 获取智能体的角色名称（用于双重识别）
    const getAgentRoleName = (agent: Agent): string | null => {
      const roleTemplate = AGENT_ROLE_TEMPLATES.find(t => t.role === agent.role);
      return roleTemplate?.name || null;
    };

    // 智能识别目标智能体（支持多个@提及）
    let targetAgent: any = null;
    let mentionedAgents: Agent[] = []; // 存储所有@提及的智能体

    if (agent_id) {
      // 明确指定了agent_id，只使用单个智能体
      const found = participants.find((p: any) => p.agent_id === agent_id);
      if (found) {
        targetAgent = found.agents;
        mentionedAgents = [targetAgent];
      }
    } else if (auto_detect !== false) {
      // 自动识别：检查消息中是否包含 @智能体名称 或 @角色名称 格式
      const mentionMatch = user_message.match(/@([^\s@]+)/g);
      if (mentionMatch) {
        // 检测所有@提及的智能体
        for (const match of mentionMatch) {
          const mentionName = match.slice(1).toLowerCase(); // 去掉@符号
          for (const p of participants) {
            const agent = p.agents as unknown as Agent;
            // 支持名字和角色名称双重识别
            const agentName = agent.name?.toLowerCase();
            const roleName = getAgentRoleName(agent)?.toLowerCase();

            if ((agentName && agentName === mentionName) ||
                (roleName && roleName === mentionName)) {
              // 避免重复添加
              if (!mentionedAgents.find(a => a.id === agent.id)) {
                mentionedAgents.push(agent);
              }
            }
          }
        }
      }

      // 如果检测到多个智能体，使用协调者模式
      if (mentionedAgents.length > 1) {
        return await handleMultipleAgentsWithCoordinator(
          mentionedAgents,
          conversation_id,
          user_message,
          projectContext,
          participants,
          request
        );
      }

      // 如果只检测到一个智能体，使用原有逻辑
      if (mentionedAgents.length === 1) {
        targetAgent = mentionedAgents[0];
      } else {
        // 没有检测到@，检查消息中是否包含智能体名字或角色名称
        const lowerMessage = user_message.toLowerCase();

        for (const p of participants) {
          const agent = p.agents as unknown as Agent;
          const agentName = agent.name?.toLowerCase();
          const roleName = getAgentRoleName(agent)?.toLowerCase();

          // 支持名字和角色名称双重识别
          if ((agentName && lowerMessage.includes(agentName)) ||
              (roleName && lowerMessage.includes(roleName))) {
            targetAgent = agent;
            break;
          }
        }
      }
    }

    // 如果没有识别到任何智能体，使用第一个空闲的智能体
    if (!targetAgent) {
      const idleParticipant = participants.find((p: any) => {
        const agent = p.agents as unknown as Agent;
        return agent.status === 'idle' || agent.status === 'working';
      });
      if (idleParticipant) {
        targetAgent = idleParticipant.agents as unknown as Agent;
      } else {
        targetAgent = participants[0].agents as unknown as Agent;
      }
    }

    // 检查智能体类型
    if (targetAgent.agent_type === 'process') {
      return NextResponse.json(
        { success: false, error: '进程类型智能体不支持对话，请通过进程API交互' },
        { status: 400 }
      );
    }
    
    // 更新智能体状态为工作中
    await client
      .from('agents')
      .update({ 
        work_status: 'working', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', targetAgent.id);
    
    // 获取历史消息
    const { data: historyMessages, error: msgError } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20);
    
    if (msgError) {
      console.error('获取历史消息失败:', msgError);
    }
    
    // 构建消息数组 - 注入项目上下文和任务上下文
    let systemPrompt = injectProjectContext(
      targetAgent.system_prompt,
      projectContext
    );
    
    // 获取智能体待办任务
    const agentTasks = await getAgentTasks(targetAgent.id);
    systemPrompt = injectTaskContext(systemPrompt, agentTasks);
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // 添加历史消息
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }
    
    // 添加用户消息
    messages.push({ role: 'user', content: user_message });
    
    // 保存用户消息
    await client
      .from('messages')
      .insert({
        conversation_id,
        agent_id: targetAgent.id,
        role: 'user',
        content: user_message,
        message_type: 'text'
      });
    
    // 初始化LLM客户端
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const llmClient = new LLMClient(config, customHeaders);
    
    // 获取模型配置
    const agentModelConfig = (targetAgent.model_config as ModelConfig) || {};
    
    // 确定使用的模型
    let modelName = targetAgent.model || 'doubao-seed-1-8-251228';
    
    // 如果模型不在支持列表中，尝试映射
    if (!SUPPORTED_MODELS.includes(modelName)) {
      // 尝试通过映射找到支持的模型
      const mappedModel = MODEL_MAPPING[modelName];
      if (mappedModel) {
        console.log(`模型 ${modelName} 映射到 ${mappedModel}`);
        modelName = mappedModel;
      } else {
        // 使用默认模型
        console.log(`模型 ${modelName} 不支持，使用默认模型 doubao-seed-1-8-251228`);
        modelName = 'doubao-seed-1-8-251228';
      }
    }
    
    // 构建LLM配置
    const llmConfig = {
      model: modelName,
      temperature: agentModelConfig.temperature || 0.7,
      thinking: agentModelConfig.thinking || 'disabled',
      caching: agentModelConfig.caching || 'disabled'
    };
    
    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        let controllerClosed = false;
        
        // 标记 controller 为已关闭的函数
        const closeSafely = () => {
          if (!controllerClosed) {
            try {
              controller.close();
            } catch (e) {
              // 忽略重复关闭的错误
            }
            controllerClosed = true;
          }
        };
        
        try {
          const llmStream = llmClient.stream(messages, llmConfig);
          
          for await (const chunk of llmStream) {
            // 如果 controller 已关闭，停止处理
            if (controllerClosed) {
              break;
            }
            
            if (chunk.content) {
              const text = chunk.content.toString();
              fullResponse += text;
              
              // 安全地发送数据块
              try {
                const data = JSON.stringify({ 
                  content: text,
                  agent_id: targetAgent.id,
                  agent_name: targetAgent.name
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (e) {
                // 如果 controller 已关闭，停止处理
                if (e instanceof TypeError && e.message.includes('closed')) {
                  controllerClosed = true;
                  break;
                }
              }
            }
          }
          
          // 只有在正常结束时（非用户终止）才保存消息和更新状态
          if (!controllerClosed && fullResponse) {
            // 保存AI回复
            await client
              .from('messages')
              .insert({
                conversation_id,
                agent_id: targetAgent.id,
                role: 'assistant',
                content: fullResponse,
                message_type: 'text',
                metadata: {
                  model: llmConfig.model,
                  agent_name: targetAgent.name
                }
              });
            
            // 更新智能体状态为空闲
            await client
              .from('agents')
              .update({ work_status: 'idle', updated_at: new Date().toISOString() })
              .eq('id', targetAgent.id);
            
            // 发送完成信号
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            } catch (e) {
              // 忽略 controller 已关闭的错误
            }
          }
          
          closeSafely();
        } catch (error) {
          // 更新智能体状态为空闲
          await client
            .from('agents')
            .update({ work_status: 'idle', updated_at: new Date().toISOString() })
            .eq('id', targetAgent.id);
          
          // 尝试发送错误信息（如果 controller 还未关闭）
          if (!controllerClosed) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成回复失败' })}\n\n`));
            } catch (e) {
              // 忽略 controller 已关闭的错误
            }
          }
          
          closeSafely();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('对话失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 处理多智能体协调
 * 让每个智能体分别显示它们的回复，协调者负责调度和总结
 */
async function handleMultipleAgentsWithCoordinator(
  mentionedAgents: Agent[],
  conversation_id: string,
  user_message: string,
  projectContext: any,
  participants: any[],
  request: NextRequest
): Promise<Response> {
  const client = getSupabaseClient();
  const encoder = new TextEncoder();

  // 更新所有涉及的智能体状态为工作中
  await Promise.all(
    mentionedAgents.map(agent =>
      client
        .from('agents')
        .update({ work_status: 'working', updated_at: new Date().toISOString() })
        .eq('id', agent.id)
    )
  );

  // 保存用户消息（使用第一个智能体的ID）
  await client
    .from('messages')
    .insert({
      conversation_id,
      agent_id: mentionedAgents[0].id,
      role: 'user',
      content: user_message,
      message_type: 'text',
      metadata: {
        mentioned_agents: mentionedAgents.map(a => a.id)
      }
    });

  try {
    // 创建流式响应
    const wrapperStream = new ReadableStream({
      async start(controller) {
        try {
          // 步骤1: 协调者分析任务并发送开始消息
          const coordinatorPrompt = `你是一个智能体协调者。分析用户需求，决定需要哪些智能体参与以及调用的顺序。

可用智能体:
${mentionedAgents.map(a => `- ${a.name} (ID: ${a.id})`).join('\n')}

用户需求: ${user_message}

请以JSON格式输出分析结果，格式如下:
\`\`\`json
{
  "analysis": "任务分析",
  "calls": [
    {"agent_id": "xxx", "agent_name": "xxx", "query": "询问智能体的具体问题"}
  ]
}
\`\`\``;

          const { getEffectiveAPIConfig } = await import('@/lib/global-config');
          const config = new Config();
          const llmClient = new LLMClient(config);

          const coordinatorStream = llmClient.stream(
            [
              { role: 'system', content: coordinatorPrompt },
              { role: 'user', content: user_message }
            ],
            {
              model: 'doubao-seed-1-8-251228',
              temperature: 0.3,
              thinking: 'disabled',
              caching: 'disabled'
            }
          );

          let coordinatorAnalysis = '';
          for await (const chunk of coordinatorStream) {
            if (chunk.content) {
              coordinatorAnalysis += chunk.content.toString();
            }
          }

          // 解析协调者的分析
          const jsonMatch = coordinatorAnalysis.match(/```json\s*([\s\S]*?)```/);
          let agentCalls: any[] = [];

          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              agentCalls = parsed.calls || [];
            } catch (e) {
              console.error('解析协调者分析失败:', e);
            }
          }

          // 如果解析失败，默认调用所有智能体
          if (agentCalls.length === 0) {
            agentCalls = mentionedAgents.map(agent => ({
              agent_id: agent.id,
              agent_name: agent.name,
              query: user_message
            }));
          }

          // 协调者分析消息（不发送给前端，只在后台分析）
          const analysisMsg = `🤖 协调者正在协调 ${mentionedAgents.length} 个智能体...\n\n任务分析: ${coordinatorAnalysis.replace(/```json[\s\S]*?```/g, '').trim()}`;
          console.log('[协调者分析]', analysisMsg);

          // 步骤2: 并行调用所有智能体
          const agentPromises = agentCalls.map(async (call) => {
            const agent = mentionedAgents.find(a => a.id === call.agent_id);
            if (!agent) return null;

            let fullResponse = '';
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const msgId = `ai-agent-${timestamp}-${randomId}`;

            // 发送开始消息（创建消息卡片）
            try {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: 'agent_start',
                  agent_id: agent.id,
                  agent_name: agent.name,
                  project_id: agent.project_id,
                  role: agent.role,
                  msg_id: msgId,
                  content: '',
                  parallel_mode: true
                })}\n\n`
              ));
            } catch (e) {
              // 如果 controller 已关闭，跳过这个智能体
              return null;
            }

            // 调用智能体（传入流式回调）
            try {
              fullResponse = await callAgentWithStream(
                agent,
                call.query,
                projectContext,
                (chunk) => {
                  // 实时发送每个 chunk（安全地处理 controller 关闭的情况）
                  try {
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'agent_chunk',
                        agent_id: agent.id,
                        msg_id: msgId,
                        content: chunk
                      })}\n\n`
                    ));
                  } catch (e) {
                    // 如果 controller 已关闭，静默处理
                    // 这是正常的终止流程，不是错误
                  }
                }
              );
            } catch (e) {
              // 如果在调用过程中出错，跳过这个智能体
              console.error('调用智能体失败:', e);
              return null;
            }

            // 保存完整消息到数据库
            const { data: insertedMsg, error: insertError } = await client
              .from('messages')
              .insert({
                conversation_id,
                agent_id: agent.id,
                role: 'assistant',
                content: fullResponse,
                message_type: 'text',
                metadata: {
                  agent_name: agent.name,
                  project_id: agent.project_id,
                  role: agent.role,
                  parallel_mode: true
                }
              })
              .select()
              .single();

            if (insertError) {
              console.error('保存消息到数据库失败:', insertError);
            }

            // 发送完成标记（包含数据库生成的真实消息ID）
            // 注意：不返回数据库的content字段，直接使用本地累积的fullResponse确保一致性
            try {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: 'agent_done',
                  agent_id: agent.id,
                  msg_id: msgId,
                  db_msg_id: insertedMsg?.id // 只返回数据库生成的真实ID
                })}\n\n`
              ));
            } catch (e) {
              // 如果 controller 已关闭，静默处理
            }

            return { agent, response: fullResponse };
          });

          // 等待所有智能体完成（并行）
          await Promise.all(agentPromises);

          // 更新所有智能体状态为空闲
          await Promise.all(
            mentionedAgents.map(agent =>
              client
                .from('agents')
                .update({ work_status: 'idle', updated_at: new Date().toISOString() })
                .eq('id', agent.id)
            )
          );

          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (e) {
            // 如果 controller 已关闭，静默处理
          }
        } catch (error) {
          console.error('协调者处理失败:', error);

          // 更新所有智能体状态为空闲
          await Promise.all(
            mentionedAgents.map(agent =>
              client
                .from('agents')
                .update({ work_status: 'idle', updated_at: new Date().toISOString() })
                .eq('id', agent.id)
            )
          );

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: '协调者处理失败' })}\n\n`)
            );
            controller.close();
          } catch (e) {
            // 如果 controller 已关闭，静默处理
          }
        }
      }
    });

    return new Response(wrapperStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('协调者初始化失败:', error);

    // 更新所有智能体状态为空闲
    await Promise.all(
      mentionedAgents.map(agent =>
        client
          .from('agents')
          .update({ work_status: 'idle', updated_at: new Date().toISOString() })
          .eq('id', agent.id)
      )
    );

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 调用单个智能体
 */
async function callAgent(agent: Agent, query: string, projectContext: any): Promise<string> {
  const { getEffectiveAPIConfig } = await import('@/lib/global-config');
  const { injectProjectContext } = await import('@/lib/project-context');

  // 构建智能体的系统提示词
  let systemPrompt = agent.system_prompt || '';
  systemPrompt = injectProjectContext(systemPrompt, projectContext);

  // 获取模型配置
  const agentModelConfig = agent.model_config || {};
  const apiKey = agentModelConfig.api_key || getEffectiveAPIConfig().api_key;
  const baseUrl = agentModelConfig.base_url || getEffectiveAPIConfig().base_url;
  const modelName = agent.model || 'doubao-seed-1-8-251228';

  // 设置环境变量
  process.env.OPENAI_API_KEY = apiKey;
  if (baseUrl) {
    process.env.OPENAI_BASE_URL = baseUrl;
  }

  // 调用智能体LLM
  const config = new Config();
  const llmClient = new LLMClient(config);

  const stream = llmClient.stream(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ],
    {
      model: modelName,
      temperature: agentModelConfig.temperature || 0.7,
      thinking: agentModelConfig.thinking || 'disabled',
      caching: agentModelConfig.caching || 'disabled'
    }
  );

  let response = '';
  for await (const chunk of stream) {
    if (chunk.content) {
      response += chunk.content.toString();
    }
  }

  return response;
}

/**
 * 调用单个智能体（支持流式回调）
 */
async function callAgentWithStream(
  agent: Agent,
  query: string,
  projectContext: any,
  onChunk: (chunk: string) => void
): Promise<string> {
  const { getEffectiveAPIConfig } = await import('@/lib/global-config');
  const { injectProjectContext } = await import('@/lib/project-context');

  // 构建智能体的系统提示词
  let systemPrompt = agent.system_prompt || '';
  systemPrompt = injectProjectContext(systemPrompt, projectContext);

  // 获取模型配置
  const agentModelConfig = agent.model_config || {};
  const apiKey = agentModelConfig.api_key || getEffectiveAPIConfig().api_key;
  const baseUrl = agentModelConfig.base_url || getEffectiveAPIConfig().base_url;
  const modelName = agent.model || 'doubao-seed-1-8-251228';

  // 设置环境变量
  process.env.OPENAI_API_KEY = apiKey;
  if (baseUrl) {
    process.env.OPENAI_BASE_URL = baseUrl;
  }

  // 调用智能体LLM
  const config = new Config();
  const llmClient = new LLMClient(config);

  const stream = llmClient.stream(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ],
    {
      model: modelName,
      temperature: agentModelConfig.temperature || 0.7,
      thinking: agentModelConfig.thinking || 'disabled',
      caching: agentModelConfig.caching || 'disabled'
    }
  );

  let response = '';
  for await (const chunk of stream) {
    if (chunk.content) {
      const content = chunk.content.toString();
      response += content;
      onChunk(content); // 实时调用回调，将 chunk 发送到前端
    }
  }

  return response;
}
