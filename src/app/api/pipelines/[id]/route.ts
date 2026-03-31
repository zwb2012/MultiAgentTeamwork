import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取流水线详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('pipelines')
      .select(`
        *,
        nodes:pipeline_nodes (
          *,
          agent:agents (
            id,
            name,
            role,
            agent_type
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '流水线不存在' },
        { status: 404 }
      );
    }
    
    // 按顺序排序节点
    if (data.nodes) {
      data.nodes.sort((a: any, b: any) => a.order_index - b.order_index);
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('获取流水线详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取流水线详情失败' },
      { status: 500 }
    );
  }
}

// 更新流水线
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, status, trigger_type, trigger_config, config, nodes } = body;
    
    const supabase = getSupabaseClient();
    
    // 更新流水线基本信息
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (trigger_type !== undefined) updateData.trigger_type = trigger_type;
    if (trigger_config !== undefined) updateData.trigger_config = trigger_config;
    if (config !== undefined) updateData.config = config;
    updateData.updated_at = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('pipelines')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }
    
    // 如果提供了节点，更新节点
    if (nodes !== undefined) {
      // 删除现有节点
      await supabase.from('pipeline_nodes').delete().eq('pipeline_id', id);
      
      // 插入新节点
      if (nodes.length > 0) {
        const nodesToInsert = nodes.map((node: any, index: number) => ({
          pipeline_id: id,
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
          return NextResponse.json(
            { success: false, error: nodesError.message },
            { status: 500 }
          );
        }
      }
    }
    
    // 获取更新后的数据
    const { data } = await supabase
      .from('pipelines')
      .select(`
        *,
        nodes:pipeline_nodes (*)
      `)
      .eq('id', id)
      .single();
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('更新流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '更新流水线失败' },
      { status: 500 }
    );
  }
}

// 删除流水线
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('pipelines')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '删除流水线失败' },
      { status: 500 }
    );
  }
}
