import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/dashboard/stats - 获取仪表盘统计数据
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    
    // 获取非模板智能体统计
    const { data: agents, error: agentsError } = await client
      .from('agents')
      .select('id, online_status, work_status, is_template')
      .eq('is_active', true)
      .eq('is_template', false);  // 排除模板
    
    if (agentsError) {
      throw new Error(`查询智能体失败: ${agentsError.message}`);
    }
    
    // 统计在线/离线
    const onlineCount = agents?.filter(a => a.online_status === 'online').length || 0;
    const offlineCount = agents?.filter(a => a.online_status === 'offline').length || 0;
    const unknownCount = agents?.filter(a => a.online_status === 'unknown' || !a.online_status).length || 0;
    
    // 统计工作状态
    const idleCount = agents?.filter(a => a.work_status === 'idle' || !a.work_status).length || 0;
    const workingCount = agents?.filter(a => a.work_status === 'working').length || 0;
    const errorCount = agents?.filter(a => a.work_status === 'error').length || 0;
    
    // 获取项目统计
    const { count: projectCount, error: projectError } = await client
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // 获取会话统计
    const { count: conversationCount, error: convError } = await client
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // 获取工单统计
    const { data: tickets, error: ticketsError } = await client
      .from('tickets')
      .select('status');
    
    const openTickets = tickets?.filter(t => t.status === 'open').length || 0;
    const inProgressTickets = tickets?.filter(t => t.status === 'in_progress').length || 0;
    
    // 获取流水线统计
    const { count: pipelineCount, error: pipelineError } = await client
      .from('pipelines')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    return NextResponse.json({
      success: true,
      data: {
        agents: {
          total: agents?.length || 0,
          online: onlineCount,
          offline: offlineCount,
          unknown: unknownCount,
          idle: idleCount,
          working: workingCount,
          error: errorCount
        },
        projects: {
          total: projectCount || 0
        },
        conversations: {
          total: conversationCount || 0
        },
        tickets: {
          total: tickets?.length || 0,
          open: openTickets,
          inProgress: inProgressTickets
        },
        pipelines: {
          total: pipelineCount || 0
        }
      }
    });
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
