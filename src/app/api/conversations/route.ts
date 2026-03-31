import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Conversation, ConversationType } from '@/types/conversation';

// GET /api/conversations - 获取会话列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as ConversationType | null;
    const status = searchParams.get('status');
    const projectId = searchParams.get('project_id');  // 新增：按项目过滤
    
    let query = client
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
      .order('created_at', { ascending: false });
    
    if (type) {
      query = query.eq('type', type);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // 按项目过滤
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询会话失败: ${error.message}`);
    }
    
    // 获取每个会话的最后消息
    const conversationsWithLastMessage = await Promise.all(
      (data || []).map(async (conv) => {
        const { data: lastMsg } = await client
          .from('messages')
          .select('content, created_at, agent_id, agents(name)')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        return {
          ...conv,
          last_message: lastMsg ? {
            content: lastMsg.content,
            agent_name: Array.isArray(lastMsg.agents) 
              ? (lastMsg.agents[0]?.name || '系统')
              : (lastMsg.agents as any)?.name || '系统',
            created_at: lastMsg.created_at
          } : null
        };
      })
    );
    
    return NextResponse.json({ 
      success: true, 
      data: conversationsWithLastMessage 
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
    const { 
      title, 
      description, 
      type = 'private', 
      agent_ids,
      project_id,  // 新增：绑定项目
      config = {}
    } = body;
    
    // 验证参数
    if (!title) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: title' },
        { status: 400 }
      );
    }
    
    // 大厅模式不需要指定参与者
    if (type !== 'lobby' && (!agent_ids || agent_ids.length === 0)) {
      return NextResponse.json(
        { success: false, error: '非大厅模式需要指定参与者: agent_ids' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 检查是否已存在大厅
    if (type === 'lobby') {
      const { data: existingLobby } = await client
        .from('conversations')
        .select('id')
        .eq('type', 'lobby')
        .eq('status', 'active')
        .single();
      
      if (existingLobby) {
        return NextResponse.json(
          { success: false, error: '已存在活跃的大厅会话，每个系统只能有一个大厅' },
          { status: 400 }
        );
      }
    }
    
    // 创建会话（包含项目绑定）
    const { data: conversation, error: convError } = await client
      .from('conversations')
      .insert({
        title,
        description,
        type,
        project_id,  // 绑定项目
        config,
        status: 'active'
      })
      .select()
      .single();
    
    if (convError || !conversation) {
      throw new Error(`创建会话失败: ${convError?.message}`);
    }
    
    // 添加参与者（大厅模式需要添加所有活跃智能体）
    let participantsToAdd: string[] = [];
    
    if (type === 'lobby') {
      // 大厅模式：获取所有活跃智能体
      const { data: activeAgents } = await client
        .from('agents')
        .select('id')
        .eq('is_active', true);
      
      participantsToAdd = (activeAgents || []).map(a => a.id);
    } else {
      participantsToAdd = agent_ids;
    }
    
    if (participantsToAdd.length > 0) {
      const participants = participantsToAdd.map((agentId: string) => ({
        conversation_id: conversation.id,
        agent_id: agentId
      }));
      
      const { error: partError } = await client
        .from('conversation_participants')
        .insert(participants);
      
      if (partError) {
        throw new Error(`添加参与者失败: ${partError.message}`);
      }
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
