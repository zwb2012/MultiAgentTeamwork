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
        
        try {
          const llmStream = llmClient.stream(messages, llmConfig);
          
          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
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
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('LLM流式输出错误:', error);
          
          // 更新智能体状态为空闲
          await client
            .from('agents')
            .update({ work_status: 'idle', updated_at: new Date().toISOString() })
            .eq('id', targetAgent.id);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成回复失败' })}\n\n`));
          controller.close();
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
 * 使用协调者模式，让协调者LLM串行调用其他智能体并整合输出
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

  // 获取历史消息
  const { data: historyMessages } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .limit(10);

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
        mentioned_agents: mentionedAgents.map(a => a.id),
        coordinator_mode: true
      }
    });

  try {
    // 创建协调者
    const { AgentCoordinator } = await import('@/lib/chat/coordinator');
    const { getEffectiveAPIConfig } = await import('@/lib/global-config');

    // 初始化LLM客户端
    const config = new Config();
    const customHeaders = {}; // 不需要转发headers，因为我们在调用时会设置环境变量
    const llmClient = new LLMClient(config, customHeaders);

    const coordinator = new AgentCoordinator(llmClient);

    // 使用协调者协调多个智能体
    const stream = await coordinator.coordinate(
      user_message,
      mentionedAgents,
      projectContext,
      historyMessages || []
    );

    // 创建包装流，用于保存响应和更新状态
    const wrapperStream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        try {
          const reader = stream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
              const text = value.toString();
              fullResponse += text;
              // 转换为SSE格式
              const sseData = JSON.stringify({
                content: text,
                agent_id: mentionedAgents[0].id,
                agent_name: '协调者',
                coordinator_mode: true
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          // 保存协调者的响应
          await client
            .from('messages')
            .insert({
              conversation_id,
              agent_id: mentionedAgents[0].id,
              role: 'assistant',
              content: fullResponse,
              message_type: 'text',
              metadata: {
                agent_name: '协调者',
                mentioned_agents: mentionedAgents.map(a => a.id),
                coordinator_mode: true
              }
            });

          // 更新所有智能体状态为空闲
          await Promise.all(
            mentionedAgents.map(agent =>
              client
                .from('agents')
                .update({ work_status: 'idle', updated_at: new Date().toISOString() })
                .eq('id', agent.id)
            )
          );

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
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

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '协调者处理失败' })}\n\n`)
          );
          controller.close();
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
