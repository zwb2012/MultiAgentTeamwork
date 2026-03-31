import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, AgentStatus, AgentConfig } from '@/types/agent';

// GET /api/agents/[id] - 获取单个智能体
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      throw new Error(`查询智能体失败: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Agent 
    });
  } catch (error) {
    console.error('获取智能体详情失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/[id] - 更新智能体
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, system_prompt, model, status, config } = body;
    
    const client = getSupabaseClient();
    
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (model !== undefined) updateData.model = model;
    if (status !== undefined) updateData.status = status as AgentStatus;
    if (config !== undefined) updateData.config = config as AgentConfig;
    
    const { data, error } = await client
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`更新智能体失败: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Agent 
    });
  } catch (error) {
    console.error('更新智能体失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - 删除智能体(软删除)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 软删除：设置 is_active = false
    const { data, error } = await client
      .from('agents')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`删除智能体失败: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '智能体已删除' 
    });
  } catch (error) {
    console.error('删除智能体失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
