import { NextRequest, NextResponse } from 'next/server';
import { getPipelineRun, getPipeline, cancelPipelineRun } from '@/lib/pipeline-db-store';
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
    const run = await getPipelineRun(id);
    
    if (!run) {
      return NextResponse.json(
        { success: false, error: '运行记录不存在' },
        { status: 404 }
      );
    }
    
    // 2. 获取流水线信息
    const pipeline = await getPipeline(run.pipeline_id);
    
    // 3. 获取节点运行记录
    const { data: nodeRuns } = await client
      .from('pipeline_node_runs')
      .select('*')
      .eq('pipeline_run_id', id)
      .order('created_at', { ascending: true });
    
    // 4. 获取节点定义（补充节点名称、类型等信息）
    const nodeIds = nodeRuns?.map(nr => nr.node_id) || [];
    let nodeMap: Record<string, any> = {};
    
    if (nodeIds.length > 0) {
      const { data: nodes } = await client
        .from('pipeline_nodes')
        .select('*')
        .in('id', nodeIds);
      
      if (nodes) {
        nodeMap = nodes.reduce((acc, node) => {
          acc[node.id] = node;
          return acc;
        }, {} as Record<string, any>);
      }
    }
    
    // 5. 合并节点运行记录和节点定义
    const enrichedNodeRuns = (nodeRuns || []).map(nodeRun => {
      const nodeDef = nodeMap[nodeRun.node_id];
      return {
        id: nodeRun.id,
        node_id: nodeRun.node_id,
        node_name: nodeDef?.name || nodeRun.node_id,
        node_type: nodeDef?.node_type || 'task',
        agent_id: nodeDef?.agent_id,
        order_index: nodeDef?.order_index || 0,
        status: nodeRun.status,
        wait_status: nodeRun.wait_status,
        input_data: nodeRun.input_data,
        output_data: nodeRun.output_data,
        error_message: nodeRun.error_message,
        started_at: nodeRun.started_at,
        completed_at: nodeRun.completed_at,
        retry_count: nodeRun.retry_count || 0
      };
    });
    
    // 6. 获取参与的智能体
    const agentIds = enrichedNodeRuns
      .filter(nr => nr.agent_id)
      .map(nr => nr.agent_id);
    
    let agents: any[] = [];
    if (agentIds.length > 0) {
      const { data: agentData } = await client
        .from('agents')
        .select('*')
        .in('id', agentIds);
      
      if (agentData) {
        agents = agentData.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          online_status: agent.online_status || 'offline',
          work_status: agent.work_status || 'idle'
        }));
      }
    }
    
    // 7. 获取会话消息
    let messages: any[] = [];
    if (run.conversation_id) {
      const { data: messageData } = await client
        .from('messages')
        .select('*')
        .eq('conversation_id', run.conversation_id)
        .order('created_at', { ascending: true })
        .limit(50); // 限制消息数量
      
      if (messageData) {
        // 获取发送消息的智能体信息
        const messageAgentIds = messageData
          .filter(msg => msg.agent_id)
          .map(msg => msg.agent_id);
        
        const agentInfoMap: Record<string, any> = {};
        if (messageAgentIds.length > 0) {
          const { data: messageAgents } = await client
            .from('agents')
            .select('id, name, role')
            .in('id', messageAgentIds);
          
          if (messageAgents) {
            messageAgents.forEach(agent => {
              agentInfoMap[agent.id] = agent;
            });
          }
        }
        
        messages = messageData.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          message_type: msg.message_type || 'text',
          created_at: msg.created_at,
          agents: msg.agent_id ? agentInfoMap[msg.agent_id] : null
        }));
      }
    }
    
    // 8. 计算统计信息
    const totalNodes = enrichedNodeRuns.length;
    const completedNodes = enrichedNodeRuns.filter(nr => nr.status === 'success').length;
    const failedNodes = enrichedNodeRuns.filter(nr => nr.status === 'failed').length;
    const runningNodes = enrichedNodeRuns.filter(nr => nr.status === 'running').length;
    const waitingNodes = enrichedNodeRuns.filter(nr => nr.status === 'waiting').length;
    const pendingNodes = totalNodes - completedNodes - failedNodes - runningNodes - waitingNodes;
    
    // 9. 构建返回数据
    const result = {
      run: {
        ...run,
        pipeline_name: pipeline?.name || '未知流水线',
        pipeline_status: pipeline?.status,
        input_data: run.input_data,
        output_data: run.output_data
      },
      node_runs: enrichedNodeRuns,
      agents,
      agent_tasks: [], // 暂时为空，后续可以从相关表获取
      messages,
      summary: {
        total_nodes: totalNodes,
        completed_nodes: completedNodes,
        failed_nodes: failedNodes,
        pending_nodes: pendingNodes,
        running_nodes: runningNodes,
        waiting_nodes: waitingNodes
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

// POST /api/pipeline-runs/[id] - 其他操作（预留）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // 检查是否是取消操作
    if (body.action === 'cancel') {
      const run = await cancelPipelineRun(id);
      
      if (!run) {
        return NextResponse.json(
          { success: false, error: '运行记录不存在' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        data: run,
        message: '流水线运行已取消' 
      });
    }
    
    return NextResponse.json(
      { success: false, error: '未知操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('操作失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
