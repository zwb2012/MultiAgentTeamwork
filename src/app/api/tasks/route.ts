import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Task } from '@/types/agent';

// GET /api/tasks - 获取任务列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const conversationId = searchParams.get('conversation_id');
    
    let query = client
      .from('tasks')
      .select(`
        *,
        agents (
          id,
          name,
          role
        ),
        conversations (
          id,
          title
        )
      `)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询任务失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Task[] 
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - 创建任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, agent_id, title, description, priority } = body;
    
    if (!title) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: title' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('tasks')
      .insert({
        conversation_id,
        agent_id,
        title,
        description,
        priority: priority || 'medium',
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建任务失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Task 
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
