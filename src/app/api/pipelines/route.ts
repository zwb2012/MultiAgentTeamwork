import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { pipelines, pipeline_nodes } from '@/storage/database/shared/schema';
import type { Pipeline, PipelineNode } from '@/types/agent';

// 获取流水线列表
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('pipelines')
      .select(`
        *,
        nodes:pipeline_nodes (
          id,
          name,
          node_type,
          order_index,
          agent_id,
          execution_mode,
          parallel_group
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('获取流水线列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取流水线列表失败' },
      { status: 500 }
    );
  }
}

// 创建流水线
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, trigger_type, trigger_config, config, nodes } = body;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: '流水线名称不能为空' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // 创建流水线
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .insert({
        name,
        description,
        trigger_type: trigger_type || 'manual',
        trigger_config: trigger_config || null,
        config: config || null,
        status: 'draft',
        is_active: true
      })
      .select()
      .single();
    
    if (pipelineError) {
      return NextResponse.json(
        { success: false, error: pipelineError.message },
        { status: 500 }
      );
    }
    
    // 如果有节点，创建节点
    if (nodes && nodes.length > 0) {
      const nodesToInsert = nodes.map((node: any, index: number) => ({
        pipeline_id: pipeline.id,
        name: node.name,
        description: node.description,
        node_type: node.node_type || 'agent',
        order_index: node.order_index ?? index,
        agent_id: node.agent_id || null,
        task_id: node.task_id || null,
        execution_mode: node.execution_mode || 'sequential',
        parallel_group: node.parallel_group || null,
        condition: node.condition || null,
        retry_count: node.retry_count || 0,
        timeout_seconds: node.timeout_seconds || null,
        input_config: node.input_config || null,
        output_config: node.output_config || null
      }));
      
      const { error: nodesError } = await supabase
        .from('pipeline_nodes')
        .insert(nodesToInsert);
      
      if (nodesError) {
        // 回滚：删除已创建的流水线
        await supabase.from('pipelines').delete().eq('id', pipeline.id);
        return NextResponse.json(
          { success: false, error: nodesError.message },
          { status: 500 }
        );
      }
    }
    
    // 获取完整数据
    const { data: fullPipeline } = await supabase
      .from('pipelines')
      .select(`
        *,
        nodes:pipeline_nodes (*)
      `)
      .eq('id', pipeline.id)
      .single();
    
    return NextResponse.json({ success: true, data: fullPipeline });
  } catch (error) {
    console.error('创建流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '创建流水线失败' },
      { status: 500 }
    );
  }
}
