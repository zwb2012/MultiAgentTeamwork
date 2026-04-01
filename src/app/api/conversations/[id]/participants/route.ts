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
