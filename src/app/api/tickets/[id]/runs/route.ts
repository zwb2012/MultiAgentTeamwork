import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/tickets/[id]/runs - 获取工单关联的流水线运行记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 查询与工单相关的流水线运行记录
    // 方式1: 通过input_data中的ticket.id查询
    const { data: runsByInput, error: error1 } = await client
      .from('pipeline_runs')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        total_nodes,
        completed_nodes,
        failed_nodes,
        created_at,
        pipeline_id,
        pipelines (
          id,
          name,
          description
        )
      `)
      .contains('input_data', { ticket: { id } })
      .order('created_at', { ascending: false });
    
    // 方式2: 通过logs中的工单ID查询
    // 由于logs是jsonb数组，需要使用更复杂的查询
    
    // 合并结果
    const runs = runsByInput || [];
    
    // 为每个运行记录添加智能体任务状态
    const enrichedRuns = await Promise.all((runs || []).map(async (run: any) => {
      // 获取该运行关联的智能体任务
      const { data: tasks } = await client
        .from('agent_tasks')
        .select('*')
        .eq('reference_id', run.id)
        .order('assigned_at', { ascending: false });
      
      return {
        ...run,
        pipeline_name: run.pipelines?.name,
        agent_tasks: tasks || []
      };
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: enrichedRuns 
    });
  } catch (error) {
    console.error('获取工单运行记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取运行记录失败' },
      { status: 500 }
    );
  }
}
