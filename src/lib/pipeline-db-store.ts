/**
 * 流水线数据库存储层
 * 使用 Supabase + Drizzle ORM
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { 
  Pipeline, 
  PipelineNode, 
  PipelineRun, 
  PipelineNodeRun,
  PipelineDefinitionStatus,
  PipelineRunStatus,
  TicketInput 
} from '@/types/pipeline';
import { PipelineEngine } from './pipeline-engine';

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 获取所有流水线
 * @param projectId - 可选，按项目ID过滤
 */
export async function getAllPipelines(projectId?: string): Promise<Pipeline[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from('pipelines')
    .select(`
      *,
      pipeline_nodes (*)
    `);
  
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取流水线列表失败:', error);
    return [];
  }
  
  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    project_id: p.project_id,
    trigger_type: p.trigger_type,
    trigger_config: p.trigger_config,
    config: p.config,
    status: p.status,
    run_status: p.run_status,
    current_run_id: p.current_run_id,
    last_run_at: p.last_run_at,
    last_run_status: p.last_run_status,
    is_active: p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
    nodes: p.pipeline_nodes?.sort((a: any, b: any) => a.order_index - b.order_index)
  }));
}

/**
 * 根据项目ID获取流水线列表
 */
export async function getPipelinesByProject(projectId: string): Promise<Pipeline[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('pipelines')
    .select(`
      *,
      pipeline_nodes (*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取项目流水线列表失败:', error);
    return [];
  }
  
  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    project_id: p.project_id,
    trigger_type: p.trigger_type,
    trigger_config: p.trigger_config,
    config: p.config,
    status: p.status,
    run_status: p.run_status,
    current_run_id: p.current_run_id,
    last_run_at: p.last_run_at,
    last_run_status: p.last_run_status,
    is_active: p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
    nodes: p.pipeline_nodes?.sort((a: any, b: any) => a.order_index - b.order_index)
  }));
}

/**
 * 获取流水线详情
 */
export async function getPipeline(id: string): Promise<Pipeline | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('pipelines')
    .select(`
      *,
      pipeline_nodes (*)
    `)
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    project_id: data.project_id,
    trigger_type: data.trigger_type,
    trigger_config: data.trigger_config,
    config: data.config,
    status: data.status,
    run_status: data.run_status,
    current_run_id: data.current_run_id,
    last_run_at: data.last_run_at,
    last_run_status: data.last_run_status,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
    nodes: data.pipeline_nodes?.sort((a: any, b: any) => a.order_index - b.order_index)
  };
}

/**
 * 创建流水线
 */
export async function createPipeline(input: {
  name: string;
  description?: string;
  project_id?: string;
  trigger_type?: string;
  nodes?: Partial<PipelineNode>[];
}): Promise<Pipeline> {
  const client = getSupabaseClient();
  const id = generateId();
  const now = new Date().toISOString();
  
  // 创建流水线
  const { data, error } = await client
    .from('pipelines')
    .insert({
      id,
      name: input.name,
      description: input.description,
      project_id: input.project_id,
      trigger_type: input.trigger_type || 'manual',
      status: 'draft',
      run_status: 'idle',
      is_active: true,
      created_at: now
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`创建流水线失败: ${error?.message}`);
  }
  
  // 创建节点
  if (input.nodes && input.nodes.length > 0) {
    const nodes = input.nodes.map((node, index) => ({
      id: node.id || generateId(),
      pipeline_id: id,
      name: node.name || '未命名节点',
      description: node.description,
      node_type: node.node_type || 'agent',
      order_index: index,
      agent_id: node.agent_id,
      execution_mode: node.execution_mode || 'sequential',
      parallel_group: node.parallel_group,
      gateway_type: node.gateway_type,
      merge_strategy: node.merge_strategy,
      upstream_nodes: node.upstream_nodes,
      downstream_nodes: node.downstream_nodes,
      retry_count: node.retry_count || 0,
      timeout_seconds: node.timeout_seconds,
      position: node.position,
      created_at: now
    }));
    
    const { error: nodesError } = await client
      .from('pipeline_nodes')
      .insert(nodes);
    
    if (nodesError) {
      console.error('创建流水线节点失败:', nodesError);
    }
  }
  
  return getPipeline(id) as Promise<Pipeline>;
}

/**
 * 更新流水线
 */
export async function updatePipeline(id: string, input: {
  name?: string;
  description?: string;
  project_id?: string;
  trigger_type?: string;
  status?: PipelineDefinitionStatus;
  run_status?: PipelineRunStatus;
  nodes?: PipelineNode[];
  last_run_at?: string;
  last_run_status?: string;
}): Promise<Pipeline | null> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();
  
  const updateData: Record<string, any> = {
    updated_at: now
  };
  
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.project_id !== undefined) updateData.project_id = input.project_id;
  if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.run_status !== undefined) updateData.run_status = input.run_status;
  if (input.last_run_at !== undefined) updateData.last_run_at = input.last_run_at;
  if (input.last_run_status !== undefined) updateData.last_run_status = input.last_run_status;
  
  const { error } = await client
    .from('pipelines')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('更新流水线失败:', error);
    return null;
  }
  
  // 更新节点
  if (input.nodes !== undefined) {
    // 先删除旧节点
    await client
      .from('pipeline_nodes')
      .delete()
      .eq('pipeline_id', id);
    
    // 再插入新节点
    if (input.nodes.length > 0) {
      const nodes = input.nodes.map((node, index) => ({
        id: node.id || generateId(),
        pipeline_id: id,
        name: node.name || '未命名节点',
        description: node.description,
        node_type: node.node_type || 'agent',
        order_index: index,
        agent_id: node.agent_id,
        execution_mode: node.execution_mode || 'sequential',
        parallel_group: node.parallel_group,
        gateway_type: node.gateway_type,
        merge_strategy: node.merge_strategy,
        upstream_nodes: node.upstream_nodes,
        downstream_nodes: node.downstream_nodes,
        retry_count: node.retry_count || 0,
        timeout_seconds: node.timeout_seconds,
        position: node.position,
        created_at: now
      }));
      
      await client
        .from('pipeline_nodes')
        .insert(nodes);
    }
  }
  
  return getPipeline(id);
}

/**
 * 删除流水线
 */
export async function deletePipeline(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('pipelines')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('删除流水线失败:', error);
    return false;
  }
  
  return true;
}

/**
 * 发布流水线
 */
export async function publishPipeline(id: string): Promise<Pipeline | null> {
  const pipeline = await getPipeline(id);
  if (!pipeline) return null;
  
  if (pipeline.status === 'archived') {
    throw new Error('已归档的流水线不能发布');
  }
  
  // 验证流水线是否有节点
  if (!pipeline.nodes || pipeline.nodes.length === 0) {
    throw new Error('流水线必须至少有一个节点才能发布');
  }
  
  // 验证是否有开始节点
  const hasStart = pipeline.nodes.some(n => n.node_type === 'start');
  if (!hasStart) {
    throw new Error('流水线必须有开始节点');
  }
  
  return updatePipeline(id, { status: 'published' });
}

/**
 * 撤回流水线（从已发布变为草稿）
 */
export async function unpublishPipeline(id: string): Promise<Pipeline | null> {
  const pipeline = await getPipeline(id);
  if (!pipeline) return null;
  
  if (pipeline.run_status === 'running') {
    throw new Error('运行中的流水线不能撤回');
  }
  
  return updatePipeline(id, { status: 'draft' });
}

/**
 * 归档流水线
 */
export async function archivePipeline(id: string): Promise<Pipeline | null> {
  const pipeline = await getPipeline(id);
  if (!pipeline) return null;
  
  if (pipeline.run_status === 'running') {
    throw new Error('运行中的流水线不能归档');
  }
  
  return updatePipeline(id, { status: 'archived' });
}

/**
 * 恢复流水线（从归档变为草稿）
 */
export async function restorePipeline(id: string): Promise<Pipeline | null> {
  return updatePipeline(id, { status: 'draft' });
}

/**
 * 运行流水线（支持工单输入）
 */
export async function runPipeline(id: string, ticket?: TicketInput): Promise<PipelineRun> {
  const pipeline = await getPipeline(id);
  if (!pipeline) {
    throw new Error('流水线不存在');
  }
  
  if (pipeline.status !== 'published') {
    throw new Error('只有已发布的流水线才能执行');
  }
  
  if (pipeline.run_status === 'running') {
    throw new Error('流水线正在运行中，请等待执行完成');
  }

  // 使用 PipelineEngine 执行流水线
  const engine = new PipelineEngine();
  const run = await engine.run(id, 'manual');
  
  // 如果有工单信息，更新运行记录
  if (ticket) {
    const client = getSupabaseClient();
    await client
      .from('pipeline_runs')
      .update({
        input_data: {
          ticket_id: ticket.id,
          ticket_type: ticket.type,
          ticket_title: ticket.title,
          ticket_description: ticket.description,
          ticket_priority: ticket.priority
        }
      })
      .eq('id', run.id);
  }
  
  return run;
}

/**
 * 获取流水线运行记录
 * @param pipelineIdOrProjectId - 可以是流水线ID或项目ID
 * @param filterType - 'pipeline' 或 'project'，默认 'pipeline'
 */
export async function getPipelineRuns(
  pipelineIdOrProjectId?: string,
  filterType: 'pipeline' | 'project' = 'pipeline'
): Promise<PipelineRun[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from('pipeline_runs')
    .select(`
      *,
      pipelines (
        id,
        name,
        project_id
      )
    `);
  
  if (pipelineIdOrProjectId) {
    if (filterType === 'pipeline') {
      query = query.eq('pipeline_id', pipelineIdOrProjectId);
    } else {
      query = query.eq('pipelines.project_id', pipelineIdOrProjectId);
    }
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取运行记录失败:', error);
    return [];
  }
  
  return (data || []).map(run => ({
    id: run.id,
    pipeline_id: run.pipeline_id,
    pipeline_name: run.pipelines?.name,
    project_id: run.pipelines?.project_id,
    status: run.status,
    trigger_by: run.trigger_by,
    conversation_id: run.conversation_id,
    total_nodes: run.total_nodes,
    completed_nodes: run.completed_nodes,
    failed_nodes: run.failed_nodes,
    started_at: run.started_at,
    completed_at: run.completed_at,
    created_at: run.created_at,
    input_data: run.input_data,
    output_data: run.output_data
  }));
}

/**
 * 获取单个运行记录
 */
export async function getPipelineRun(runId: string): Promise<PipelineRun | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('pipeline_runs')
    .select(`
      *,
      pipelines (
        id,
        name,
        description,
        status
      )
    `)
    .eq('id', runId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    id: data.id,
    pipeline_id: data.pipeline_id,
    status: data.status,
    trigger_by: data.trigger_by,
    conversation_id: data.conversation_id,
    total_nodes: data.total_nodes,
    completed_nodes: data.completed_nodes,
    failed_nodes: data.failed_nodes,
    started_at: data.started_at,
    completed_at: data.completed_at,
    created_at: data.created_at,
    input_data: data.input_data,
    output_data: data.output_data
  };
}

/**
 * 取消流水线运行
 */
export async function cancelPipelineRun(runId: string): Promise<PipelineRun | null> {
  const run = await getPipelineRun(runId);
  if (!run) {
    return null;
  }
  
  if (run.status !== 'running') {
    throw new Error('只有运行中的流水线才能取消');
  }
  
  const now = new Date().toISOString();
  const client = getSupabaseClient();
  
  // 更新运行状态
  const { data, error } = await client
    .from('pipeline_runs')
    .update({
      status: 'cancelled',
      completed_at: now
    })
    .eq('id', runId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`取消运行失败: ${error.message}`);
  }
  
  // 重置流水线的运行状态
  await updatePipeline(run.pipeline_id, { run_status: 'idle' });
  
  // 更新所有pending和running的节点为skipped
  await client
    .from('pipeline_node_runs')
    .update({ status: 'skipped' })
    .eq('pipeline_run_id', runId)
    .in('status', ['pending', 'running']);
  
  return {
    id: data.id,
    pipeline_id: data.pipeline_id,
    status: data.status,
    trigger_by: data.trigger_by,
    conversation_id: data.conversation_id,
    total_nodes: data.total_nodes,
    completed_nodes: data.completed_nodes,
    failed_nodes: data.failed_nodes,
    started_at: data.started_at,
    completed_at: data.completed_at,
    created_at: data.created_at,
    input_data: data.input_data,
    output_data: data.output_data
  };
}
