import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Message } from '@/types/agent';

// GET /api/messages - 获取会话消息
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversation_id');
    
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: '缺少参数: conversation_id' },
        { status: 400 }
      );
    }
    
    const { data, error } = await client
      .from('messages')
      .select(`
        *,
        agents (
          id,
          name,
          role
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`查询消息失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Message[] 
    });
  } catch (error) {
    console.error('获取消息列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/messages - 发送消息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, agent_id, role, content } = body;
    
    if (!conversation_id || !role || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: conversation_id, role, content' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('messages')
      .insert({
        conversation_id,
        agent_id,
        role,
        content
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`发送消息失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Message 
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
