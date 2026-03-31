import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, Message, ModelConfig } from '@/types/agent';

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
          status
        )
      `)
      .eq('conversation_id', conversation_id);
    
    if (partError || !participants || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: '会话没有参与者' },
        { status: 400 }
      );
    }
    
    // 智能识别目标智能体
    let targetAgent: any = null;
    
    if (agent_id) {
      // 明确指定了agent_id
      const found = participants.find((p: any) => p.agent_id === agent_id);
      if (found) {
        targetAgent = found.agents;
      }
    } else if (auto_detect !== false) {
      // 自动识别：检查消息中是否包含智能体名字
      const lowerMessage = user_message.toLowerCase();
      
      for (const p of participants) {
        const agent = p.agents as unknown as Agent;
        if (agent.name && lowerMessage.includes(agent.name.toLowerCase())) {
          targetAgent = agent;
          break;
        }
      }
      
      // 如果没有识别到，使用第一个空闲的智能体
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
    } else {
      // 不自动识别，使用第一个智能体
      targetAgent = participants[0].agents as unknown as Agent;
    }
    
    if (!targetAgent) {
      return NextResponse.json(
        { success: false, error: '未找到可用的智能体' },
        { status: 400 }
      );
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
      .update({ status: 'working', updated_at: new Date().toISOString() })
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
    
    // 构建消息数组
    const messages: any[] = [
      { role: 'system', content: targetAgent.system_prompt }
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
        content: user_message
      });
    
    // 初始化LLM客户端
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const llmClient = new LLMClient(config, customHeaders);
    
    // 获取模型配置
    const agentModelConfig = (targetAgent.model_config as ModelConfig) || {};
    
    // 如果有自定义API配置
    if (agentModelConfig.api_key || agentModelConfig.base_url) {
      // 注意：coze-coding-dev-sdk 暂不支持自定义base_url
      // 这里使用默认配置，实际使用时需要根据SDK支持情况调整
      console.log('使用自定义模型配置');
    }
    
    // 构建LLM配置
    const llmConfig = {
      model: targetAgent.model || 'doubao-seed-1-8-251228',
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
              metadata: {
                model: llmConfig.model,
                agent_name: targetAgent.name
              }
            });
          
          // 更新智能体状态为空闲
          await client
            .from('agents')
            .update({ status: 'idle', updated_at: new Date().toISOString() })
            .eq('id', targetAgent.id);
          
          // 发送完成信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('LLM流式输出错误:', error);
          
          // 更新智能体状态为空闲
          await client
            .from('agents')
            .update({ status: 'idle', updated_at: new Date().toISOString() })
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
