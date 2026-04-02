import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/pipeline-runs/[id] - 获取流水线运行详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 1. 获取运行记录
    const { data: run, error: runError } = await client
      .from('pipeline_runs')
      .select(`
        *,
        pipelines (
          id,
          name,
          description,
          status
        ),
        conversations (
          id,
          title,
          type
        )
      `)
      .eq('id', id)
      .single();
    
    if (runError || !run) {
      return NextResponse.json(
        { success: false, error: '运行记录不存在' },
        { status: 404 }
      );
    }
    
    // 2. 获取节点执行记录
    const { data: nodeRuns, error: nodeRunsError } = await client
      .from('pipeline_node_runs')
      .select(`
        *,
        pipeline_nodes (
          id,
          name,
          node_type,
          agent_id,
          order_index
        )
      `)
      .eq('pipeline_run_id', id)
      .order('created_at', { ascending: true });
    
    if (nodeRunsError) {
      console.error('获取节点执行记录失败:', nodeRunsError);
    }
    
    // 3. 获取参与的智能体信息
    const agentIds = new Set<string>();
    for (const nodeRun of nodeRuns || []) {
      if (nodeRun.pipeline_nodes?.agent_id) {
        agentIds.add(nodeRun.pipeline_nodes.agent_id);
      }
    }
    
    let agents: any[] = [];
    if (agentIds.size > 0) {
      const { data: agentsData } = await client
        .from('agents')
        .select('id, name, role, online_status, work_status')
        .in('id', Array.from(agentIds));
      
      agents = agentsData || [];
    }
    
    // 4. 获取智能体任务状态
    let agentTasks: any[] = [];
    if (agentIds.size > 0) {
      const { data: tasksData } = await client
        .from('agent_tasks')
        .select('*')
        .in('agent_id', Array.from(agentIds))
        .eq('reference_id', id)
        .order('assigned_at', { ascending: false });
      
      agentTasks = tasksData || [];
    }
    
    // 5. 获取会话消息（最近的）
    let messages: any[] = [];
    if (run.conversation_id) {
      const { data: messagesData } = await client
        .from('messages')
        .select(`
          id,
          content,
          role,
          message_type,
          metadata,
          created_at,
          agents (
            id,
            name,
            role
          )
        `)
        .eq('conversation_id', run.conversation_id)
        .order('created_at', { ascending: true })
        .limit(100);
      
      messages = messagesData || [];
    }
    
    // 6. 构建返回数据
    const result = {
      run: {
        ...run,
        pipeline_name: run.pipelines?.name,
        pipeline_status: run.pipelines?.status,
        conversation_title: run.conversations?.title
      },
      node_runs: (nodeRuns || []).map((nr: any) => ({
        ...nr,
        node_name: nr.pipeline_nodes?.name,
        node_type: nr.pipeline_nodes?.node_type,
        agent_id: nr.pipeline_nodes?.agent_id,
        order_index: nr.pipeline_nodes?.order_index
      })),
      agents: agents,
      agent_tasks: agentTasks,
      messages: messages,
      summary: {
        total_nodes: run.total_nodes || 0,
        completed_nodes: run.completed_nodes || 0,
        failed_nodes: run.failed_nodes || 0,
        pending_nodes: (nodeRuns || []).filter((n: any) => n.status === 'pending').length,
        running_nodes: (nodeRuns || []).filter((n: any) => n.status === 'running').length,
        waiting_nodes: (nodeRuns || []).filter((n: any) => n.status === 'waiting').length
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('获取流水线运行详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取运行详情失败' },
      { status: 500 }
    );
  }
}
