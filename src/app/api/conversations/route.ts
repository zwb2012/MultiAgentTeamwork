import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Conversation } from '@/types/agent';

// GET /api/conversations - 获取所有会话
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    
    let query = client
      .from('conversations')
      .select(`
        *,
        conversation_participants (
          agent_id,
          agents (
            id,
            name,
            role,
            status
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询会话失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data 
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - 创建会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent_ids } = body;
    
    if (!title || !agent_ids || agent_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: title, agent_ids' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 创建会话
    const { data: conversation, error: convError } = await client
      .from('conversations')
      .insert({
        title,
        description,
        status: 'active'
      })
      .select()
      .single();
    
    if (convError || !conversation) {
      throw new Error(`创建会话失败: ${convError?.message}`);
    }
    
    // 添加参与者
    const participants = agent_ids.map((agentId: string) => ({
      conversation_id: conversation.id,
      agent_id: agentId
    }));
    
    const { error: partError } = await client
      .from('conversation_participants')
      .insert(participants);
    
    if (partError) {
      throw new Error(`添加参与者失败: ${partError.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: conversation as Conversation 
    });
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
