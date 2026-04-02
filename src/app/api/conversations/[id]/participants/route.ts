import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/conversations/[id]/participants - 获取会话参与者
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 获取会话参与者及其智能体信息
    const { data, error } = await client
      .from('conversation_participants')
      .select(`
        agent_id,
        joined_at,
        agents (
          id,
          name,
          role,
          agent_type,
          model,
          model_config_id,
          online_status,
          work_status
        )
      `)
      .eq('conversation_id', id);
    
    if (error) {
      throw new Error(`查询参与者失败: ${error.message}`);
    }
    
    // 提取智能体信息
    const participants = (data || [])
      .filter((p: any) => p.agents)
      .map((p: any) => ({
        id: p.agents.id,
        name: p.agents.name,
        role: p.agents.role,
        agent_type: p.agents.agent_type,
        model: p.agents.model,
        model_config_id: p.agents.model_config_id,
        online_status: p.agents.online_status,
        work_status: p.agents.work_status,
        joined_at: p.joined_at
      }));
    
    return NextResponse.json({ success: true, data: participants });
  } catch (error) {
    console.error('获取参与者失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/conversations/[id]/participants - 添加参与者
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { agent_ids } = body;
    
    if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供要添加的智能体ID' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 检查会话是否存在
    const { data: conversation, error: convError } = await client
      .from('conversations')
      .select('id')
      .eq('id', id)
      .single();
    
    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      );
    }
    
    // 检查智能体是否存在
    const { data: agents, error: agentError } = await client
      .from('agents')
      .select('id')
      .in('id', agent_ids);
    
    if (agentError) {
      throw new Error(`查询智能体失败: ${agentError.message}`);
    }
    
    const existingAgentIds = (agents || []).map((a: any) => a.id);
    const invalidIds = agent_ids.filter((id: string) => !existingAgentIds.includes(id));
    
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { success: false, error: `智能体不存在: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }
    
    // 检查已存在的参与者，避免重复添加
    const { data: existingParticipants, error: existingError } = await client
      .from('conversation_participants')
      .select('agent_id')
      .eq('conversation_id', id)
      .in('agent_id', agent_ids);
    
    if (existingError) {
      throw new Error(`查询现有参与者失败: ${existingError.message}`);
    }
    
    const existingParticipantIds = (existingParticipants || []).map((p: any) => p.agent_id);
    const newAgentIds = agent_ids.filter((id: string) => !existingParticipantIds.includes(id));
    
    if (newAgentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '所选智能体已在此会话中' },
        { status: 400 }
      );
    }
    
    // 批量添加参与者
    const participantsToAdd = newAgentIds.map((agentId: string) => ({
      conversation_id: id,
      agent_id: agentId
    }));
    
    const { error: insertError } = await client
      .from('conversation_participants')
      .insert(participantsToAdd);
    
    if (insertError) {
      throw new Error(`添加参与者失败: ${insertError.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: { added: newAgentIds.length, agent_ids: newAgentIds }
    });
  } catch (error) {
    console.error('添加参与者失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id]/participants - 移除参与者
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { agent_id } = body;
    
    if (!agent_id) {
      return NextResponse.json(
        { success: false, error: '请提供要移除的智能体ID' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 移除参与者
    const { error } = await client
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', id)
      .eq('agent_id', agent_id);
    
    if (error) {
      throw new Error(`移除参与者失败: ${error.message}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('移除参与者失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
