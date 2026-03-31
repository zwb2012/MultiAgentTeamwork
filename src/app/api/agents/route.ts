import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, AgentRole, AgentStatus, AgentConfig } from '@/types/agent';

// GET /api/agents - 获取所有智能体
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    
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
    const { name, role, system_prompt, model, config } = body;
    
    // 参数校验
    if (!name || !role || !system_prompt) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: name, role, system_prompt' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agents')
      .insert({
        name,
        role: role as AgentRole,
        system_prompt,
        model: model || 'doubao-seed-1-8-251228',
        status: 'idle' as AgentStatus,
        config: config as AgentConfig,
        is_active: true
      })
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
