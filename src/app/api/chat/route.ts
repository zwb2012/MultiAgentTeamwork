import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Message } from '@/types/agent';

// POST /api/chat - AI对话(流式输出)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, agent_id, user_message } = body;
    
    if (!conversation_id || !agent_id || !user_message) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: conversation_id, agent_id, user_message' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 获取智能体信息
    const { data: agent, error: agentError } = await client
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();
    
    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    // 更新智能体状态为工作中
    await client
      .from('agents')
      .update({ status: 'working', updated_at: new Date().toISOString() })
      .eq('id', agent_id);
    
    // 获取历史消息
    const { data: historyMessages, error: msgError } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20); // 限制上下文长度
    
    if (msgError) {
      console.error('获取历史消息失败:', msgError);
    }
    
    // 构建消息数组
    const messages: any[] = [
      { role: 'system', content: agent.system_prompt }
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
        agent_id,
        role: 'user',
        content: user_message
      });
    
    // 初始化LLM客户端
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const llmClient = new LLMClient(config, customHeaders);
    
    // 构建LLM配置
    const agentConfig = agent.config || {};
    const llmConfig = {
      model: agent.model || 'doubao-seed-1-8-251228',
      temperature: agentConfig.temperature || 0.7,
      thinking: agentConfig.thinking || 'disabled',
      caching: agentConfig.caching || 'disabled'
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
              const data = JSON.stringify({ content: text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          
          // 保存AI回复
          await client
            .from('messages')
            .insert({
              conversation_id,
              agent_id,
              role: 'assistant',
              content: fullResponse
            });
          
          // 更新智能体状态为空闲
          await client
            .from('agents')
            .update({ status: 'idle', updated_at: new Date().toISOString() })
            .eq('id', agent_id);
          
          // 发送完成信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('LLM流式输出错误:', error);
          
          // 更新智能体状态为空闲
          await client
            .from('agents')
            .update({ status: 'idle', updated_at: new Date().toISOString() })
            .eq('id', agent_id);
          
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
