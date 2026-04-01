import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// DELETE /api/conversations/[id] - 删除会话
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 先删除消息
    await client
      .from('messages')
      .delete()
      .eq('conversation_id', id);
    
    // 删除参与者
    await client
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', id);
    
    // 删除会话
    const { error } = await client
      .from('conversations')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`删除会话失败: ${error.message}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// GET /api/conversations/[id] - 获取单个会话
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('conversations')
      .select(`
        *,
        conversation_participants (
          agent_id,
          joined_at,
          agents (
            id,
            name,
            role,
            online_status,
            work_status
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`查询会话失败: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('获取会话失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
