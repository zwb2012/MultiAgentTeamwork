import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 运行流水线
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { input_data } = body;
    
    const supabase = getSupabaseClient();
    
    // 获取流水线和节点信息
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select(`
        *,
        nodes:pipeline_nodes (
          *,
          agent:agents (*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (pipelineError || !pipeline) {
      return NextResponse.json(
        { success: false, error: '流水线不存在' },
        { status: 404 }
      );
    }
    
    // 按顺序排序节点
    if (pipeline.nodes) {
      pipeline.nodes.sort((a: any, b: any) => a.order_index - b.order_index);
    }
    
    // 创建运行记录
    const { data: run, error: runError } = await supabase
      .from('pipeline_runs')
      .insert({
        pipeline_id: id,
        status: 'running',
        trigger_by: 'manual',
        total_nodes: pipeline.nodes?.length || 0,
        completed_nodes: 0,
        failed_nodes: 0,
        input_data: input_data || null,
        logs: [],
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (runError) {
      return NextResponse.json(
        { success: false, error: runError.message },
        { status: 500 }
      );
    }
    
    // 异步执行流水线（实际生产环境应该用消息队列）
    executePipelineAsync(run.id, pipeline);
    
    return NextResponse.json({ 
      success: true, 
      data: run,
      message: '流水线已开始执行'
    });
  } catch (error) {
    console.error('运行流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '运行流水线失败' },
      { status: 500 }
    );
  }
}

// 异步执行流水线
async function executePipelineAsync(runId: string, pipeline: any) {
  const supabase = getSupabaseClient();
  const nodes = pipeline.nodes || [];
  const logs: any[] = [];
  let currentNodeIndex = 0;
  
  try {
    // 按并行组分组
    const parallelGroups: Record<string, any[]> = {};
    const sequentialNodes: any[] = [];
    
    for (const node of nodes) {
      if (node.execution_mode === 'parallel' && node.parallel_group) {
        if (!parallelGroups[node.parallel_group]) {
          parallelGroups[node.parallel_group] = [];
        }
        parallelGroups[node.parallel_group].push(node);
      } else {
        sequentialNodes.push(node);
      }
    }
    
    // 执行串行节点
    for (const node of sequentialNodes) {
      const nodeLog: any = {
        node_id: node.id,
        node_name: node.name,
        status: 'running',
        start_time: new Date().toISOString()
      };
      logs.push(nodeLog);
      
      // 更新当前节点
      await supabase
        .from('pipeline_runs')
        .update({
          current_node_id: node.id,
          logs
        })
        .eq('id', runId);
      
      // 创建节点运行记录
      await supabase
        .from('pipeline_node_runs')
        .insert({
          pipeline_run_id: runId,
          node_id: node.id,
          status: 'running',
          started_at: new Date().toISOString()
        });
      
      try {
        // 模拟执行（实际应该调用智能体或执行任务）
        await simulateNodeExecution(node);
        
        // 更新成功状态
        nodeLog.status = 'success';
        nodeLog.end_time = new Date().toISOString();
        
        await supabase
          .from('pipeline_node_runs')
          .update({
            status: 'success',
            completed_at: new Date().toISOString(),
            output_data: { result: 'success' }
          })
          .eq('pipeline_run_id', runId)
          .eq('node_id', node.id);
        
        await supabase
          .from('pipeline_runs')
          .update({
            completed_nodes: currentNodeIndex + 1,
            logs
          })
          .eq('id', runId);
        
      } catch (error) {
        nodeLog.status = 'failed';
        nodeLog.end_time = new Date().toISOString();
        nodeLog.error = String(error);
        
        await supabase
          .from('pipeline_node_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: String(error)
          })
          .eq('pipeline_run_id', runId)
          .eq('node_id', node.id);
        
        await supabase
          .from('pipeline_runs')
          .update({
            status: 'failed',
            failed_nodes: 1,
            logs,
            completed_at: new Date().toISOString()
          })
          .eq('id', runId);
        
        return; // 执行失败，停止
      }
      
      currentNodeIndex++;
    }
    
    // 执行并行组
    for (const [groupName, groupNodes] of Object.entries(parallelGroups)) {
      // 并行执行同组节点
      const results = await Promise.allSettled(
        groupNodes.map(async (node) => {
          const nodeLog: any = {
            node_id: node.id,
            node_name: node.name,
            status: 'running',
            start_time: new Date().toISOString()
          };
          logs.push(nodeLog);
          
          await supabase
            .from('pipeline_runs')
            .update({ current_node_id: node.id, logs })
            .eq('id', runId);
          
          await supabase
            .from('pipeline_node_runs')
            .insert({
              pipeline_run_id: runId,
              node_id: node.id,
              status: 'running',
              started_at: new Date().toISOString()
            });
          
          try {
            await simulateNodeExecution(node);
            
            nodeLog.status = 'success';
            nodeLog.end_time = new Date().toISOString();
            
            await supabase
              .from('pipeline_node_runs')
              .update({
                status: 'success',
                completed_at: new Date().toISOString(),
                output_data: { result: 'success' }
              })
              .eq('pipeline_run_id', runId)
              .eq('node_id', node.id);
            
            return { success: true, nodeId: node.id };
          } catch (error) {
            nodeLog.status = 'failed';
            nodeLog.end_time = new Date().toISOString();
            nodeLog.error = String(error);
            
            await supabase
              .from('pipeline_node_runs')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: String(error)
              })
              .eq('pipeline_run_id', runId)
              .eq('node_id', node.id);
            
            return { success: false, nodeId: node.id, error };
          }
        })
      );
      
      // 检查结果
      const failedCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
      if (failedCount > 0) {
        await supabase
          .from('pipeline_runs')
          .update({
            status: 'failed',
            failed_nodes: failedCount,
            logs,
            completed_at: new Date().toISOString()
          })
          .eq('id', runId);
        return;
      }
      
      currentNodeIndex += groupNodes.length;
    }
    
    // 全部完成
    await supabase
      .from('pipeline_runs')
      .update({
        status: 'success',
        completed_nodes: nodes.length,
        logs,
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);
    
  } catch (error) {
    console.error('流水线执行异常:', error);
    await supabase
      .from('pipeline_runs')
      .update({
        status: 'failed',
        logs: [...logs, { error: String(error), status: 'failed' }],
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);
  }
}

// 模拟节点执行
async function simulateNodeExecution(node: any): Promise<void> {
  // 模拟执行时间
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // 模拟随机失败（10%概率）
  if (Math.random() < 0.1) {
    throw new Error(`节点 ${node.name} 执行失败`);
  }
}
