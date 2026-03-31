import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, AgentRole, AgentStatus, AgentType, ModelConfig, ProcessConfig } from '@/types/agent';

// GET /api/agents - 获取所有智能体
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const agentType = searchParams.get('agent_type');
    
    let query = client
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (role) {
      query = query.eq('role', role);
    }
    
    if (agentType) {
      query = query.eq('agent_type', agentType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询智能体失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Agent[] 
    });
  } catch (error) {
    console.error('获取智能体列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/agents - 创建智能体
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      role, 
      system_prompt, 
      agent_type,
      model, 
      model_config,
      process_config,
      config 
    } = body;
    
    // 参数校验
    if (!name || !role || !system_prompt || !agent_type) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: name, role, system_prompt, agent_type' },
        { status: 400 }
      );
    }
    
    // 根据类型校验
    if (agent_type === 'llm' && !model) {
      return NextResponse.json(
        { success: false, error: 'LLM类型智能体必须指定模型' },
        { status: 400 }
      );
    }
    
    if (agent_type === 'process' && !process_config?.command) {
      return NextResponse.json(
        { success: false, error: '进程类型智能体必须指定启动命令' },
        { status: 400 }
      );
    }
    
    // 替换系统提示词中的{name}占位符
    const finalSystemPrompt = system_prompt.replace(/{name}/g, name);
    
    const client = getSupabaseClient();
    
    const insertData: Record<string, any> = {
      name,
      role: role as AgentRole,
      system_prompt: finalSystemPrompt,
      agent_type: agent_type as AgentType,
      // 新状态系统
      online_status: 'unknown',
      work_status: 'idle',
      // 兼容旧版本
      status: 'idle' as AgentStatus,
      is_active: true
    };
    
    // LLM类型配置
    if (agent_type === 'llm') {
      insertData.model = model;
      if (model_config) {
        insertData.model_config = model_config as ModelConfig;
      }
    }
    
    // 进程类型配置
    if (agent_type === 'process' && process_config) {
      insertData.process_config = process_config as ProcessConfig;
    }
    
    // 其他配置
    if (config) {
      insertData.config = config;
    }
    
    const { data, error } = await client
      .from('agents')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建智能体失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Agent 
    });
  } catch (error) {
    console.error('创建智能体失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
