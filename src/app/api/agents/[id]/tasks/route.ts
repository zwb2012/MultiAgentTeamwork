import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { AgentTask, AgentTaskSummary, AgentTaskStatus, AgentTaskType } from '@/types/agent';

// GET /api/agents/[id]/tasks - 获取智能体的任务队列
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const client = getSupabaseClient();
    
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as AgentTaskStatus | null;
    const taskType = url.searchParams.get('task_type') as AgentTaskType | null;
    
    let query = client
      .from('agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .order('assigned_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (taskType) {
      query = query.eq('task_type', taskType);
    }
    
    const { data: tasks, error } = await query;
    
    if (error) {
      throw new Error(`查询任务失败: ${error.message}`);
    }
    
    // 计算任务摘要
    const summary: AgentTaskSummary = {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
      by_priority: {
        critical: tasks?.filter(t => t.priority === 'critical').length || 0,
        high: tasks?.filter(t => t.priority === 'high').length || 0,
        medium: tasks?.filter(t => t.priority === 'medium').length || 0,
        low: tasks?.filter(t => t.priority === 'low').length || 0,
      },
      by_type: {
        ticket: tasks?.filter(t => t.task_type === 'ticket').length || 0,
        conversation: tasks?.filter(t => t.task_type === 'conversation').length || 0,
        pipeline: tasks?.filter(t => t.task_type === 'pipeline').length || 0,
        mention: tasks?.filter(t => t.task_type === 'mention').length || 0,
      }
    };
    
    return NextResponse.json({
      success: true,
      data: {
        tasks: tasks || [],
        summary
      }
    });
  } catch (error) {
    console.error('获取智能体任务失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/tasks - 为智能体创建任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const client = getSupabaseClient();
    
    const body = await request.json();
    const { task_type, reference_id, title, description, priority, due_date, metadata } = body;
    
    if (!task_type || !reference_id || !title) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: task_type, reference_id, title' },
        { status: 400 }
      );
    }
    
    const { data: task, error } = await client
      .from('agent_tasks')
      .insert({
        agent_id: agentId,
        task_type,
        reference_id,
        title,
        description,
        priority: priority || 'medium',
        status: 'pending',
        metadata,
        due_date,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建任务失败: ${error.message}`);
    }
    
    return NextResponse.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('创建智能体任务失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[id]/tasks - 更新任务状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const client = getSupabaseClient();
    
    const body = await request.json();
    const { task_id, status, completed_at } = body;
    
    if (!task_id || !status) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: task_id, status' },
        { status: 400 }
      );
    }
    
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'completed') {
      updateData.completed_at = completed_at || new Date().toISOString();
    }
    
    const { data: task, error } = await client
      .from('agent_tasks')
      .update(updateData)
      .eq('id', task_id)
      .eq('agent_id', agentId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`更新任务失败: ${error.message}`);
    }
    
    return NextResponse.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('更新智能体任务失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
