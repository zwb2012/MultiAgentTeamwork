import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Message } from '@/types/conversation';

// GET /api/conversations/[id]/messages - 获取会话消息列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`获取消息失败: ${error.message}`);
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

// POST /api/conversations/[id]/messages - 发送消息
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role, content, agent_id } = body;
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: '消息内容不能为空' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 创建消息
    const { data, error } = await client
      .from('messages')
      .insert({
        conversation_id: id,
        agent_id: agent_id || null,
        role: role || 'user',
        message_type: 'text',
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
