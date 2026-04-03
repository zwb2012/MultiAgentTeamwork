/**
 * 流水线执行引擎
 * 处理流水线执行、节点流转、并行汇聚逻辑
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { 
  Pipeline, 
  PipelineNode, 
  PipelineRun, 
  PipelineNodeRun,
  RunStatus,
  NodeRunStatus,
  MergeStrategy
} from '@/types/pipeline';
import type { Conversation } from '@/types/conversation';

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 流水线执行引擎类
 */
export class PipelineEngine {
  private client = getSupabaseClient();
  
  /**
   * 运行流水线
   */
  async run(pipelineId: string, triggerBy: string = 'manual'): Promise<PipelineRun> {
    // 1. 获取流水线详情
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error('流水线不存在');
    }
    
    if (pipeline.status !== 'published') {
      throw new Error(`流水线状态为 ${pipeline.status}，无法执行`);
    }
    
    // 2. 创建群组会话
    const conversation = await this.createPipelineConversation(pipeline);
    
    // 3. 创建运行记录
    const run = await this.createRun(pipeline, conversation.id, triggerBy);
    
    // 4. 初始化节点运行状态
    await this.initializeNodeRuns(run.id, pipeline.nodes || []);
    
    // 5. 发送开始消息
    await this.sendSystemMessage(
      conversation.id,
      `🚀 流水线 "${pipeline.name}" 开始执行，共 ${pipeline.nodes?.length || 0} 个节点`
    );
    
    // 6. 异步执行流水线
    this.executeAsync(run.id, pipeline, conversation.id).catch(error => {
      console.error('流水线执行失败:', error);
    });
    
    return run;
  }
  
  /**
   * 获取流水线详情
   */
  private async getPipeline(pipelineId: string): Promise<Pipeline | null> {
    const { data, error } = await this.client
      .from('pipelines')
      .select(`
        *,
        pipeline_nodes (*)
      `)
      .eq('id', pipelineId)
      .single();
    
    if (error) {
      console.error('获取流水线失败:', error);
      return null;
    }
    
    return {
      ...data,
      nodes: data.pipeline_nodes?.sort((a: any, b: any) => a.order_index - b.order_index)
    };
  }
  
  /**
   * 创建流水线群组会话
   */
  private async createPipelineConversation(pipeline: Pipeline): Promise<Conversation> {
    // 提取所有参与的智能体
    const agentIds = new Set<string>();
    for (const node of pipeline.nodes || []) {
      if (node.agent_id) {
        agentIds.add(node.agent_id);
      }
    }
    
    const { data, error } = await this.client
      .from('conversations')
      .insert({
        title: `流水线: ${pipeline.name}`,
        type: 'pipeline',
        config: {
          pipeline_id: pipeline.id,
          auto_notify: true
        },
        status: 'active'
      })
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`创建会话失败: ${error?.message}`);
    }
    
    // 添加参与者
    if (agentIds.size > 0) {
      const participants = Array.from(agentIds).map(agentId => ({
        conversation_id: data.id,
        agent_id: agentId
      }));
      
      await this.client
        .from('conversation_participants')
        .insert(participants);
    }
    
    return data;
  }
  
  /**
   * 创建运行记录
   */
  private async createRun(
    pipeline: Pipeline, 
    conversationId: string, 
    triggerBy: string
  ): Promise<PipelineRun> {
    const { data, error } = await this.client
      .from('pipeline_runs')
      .insert({
        pipeline_id: pipeline.id,
        conversation_id: conversationId,
        status: 'running',
        trigger_by: triggerBy,
        total_nodes: pipeline.nodes?.length || 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`创建运行记录失败: ${error?.message}`);
    }
    
    return data;
  }
  
  /**
   * 初始化节点运行状态
   */
  private async initializeNodeRuns(runId: string, nodes: PipelineNode[]): Promise<void> {
    const nodeRuns = nodes.map(node => ({
      pipeline_run_id: runId,
      node_id: node.id,
      status: 'pending' as NodeRunStatus,
      retry_count: 0
    }));
    
    if (nodeRuns.length > 0) {
      await this.client
        .from('pipeline_node_runs')
        .insert(nodeRuns);
    }
  }
  
  /**
   * 异步执行流水线
   */
  private async executeAsync(
    runId: string, 
    pipeline: Pipeline, 
    conversationId: string
  ): Promise<void> {
    try {
      const nodes = pipeline.nodes || [];
      
      // 构建节点依赖图
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const nodeRunsMap = new Map<string, PipelineNodeRun>();
      
      // 获取所有节点运行记录
      const { data: nodeRuns } = await this.client
        .from('pipeline_node_runs')
        .select('*')
        .eq('pipeline_run_id', runId);
      
      (nodeRuns || []).forEach(nr => {
        nodeRunsMap.set(nr.node_id, nr);
      });
      
      // 找到开始节点
      const startNode = nodes.find(n => n.node_type === 'start');
      if (!startNode) {
        throw new Error('流水线缺少开始节点');
      }
      
      // 从开始节点执行
      await this.executeFromNode(
        runId,
        startNode.id,
        nodeMap,
        nodeRunsMap,
        conversationId,
        pipeline
      );
      
      // 标记完成
      await this.completeRun(runId, 'success');
      
      await this.sendSystemMessage(
        conversationId,
        `✅ 流水线执行完成`
      );
      
    } catch (error) {
      console.error('流水线执行失败:', error);
      await this.completeRun(runId, 'failed');
      
      await this.sendSystemMessage(
        conversationId,
        `❌ 流水线执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }
  
  /**
   * 从指定节点开始执行
   */
  private async executeFromNode(
    runId: string,
    nodeId: string,
    nodeMap: Map<string, PipelineNode>,
    nodeRunsMap: Map<string, PipelineNodeRun>,
    conversationId: string,
    pipeline: Pipeline
  ): Promise<void> {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    // 更新当前节点
    await this.client
      .from('pipeline_runs')
      .update({ current_node_id: nodeId })
      .eq('id', runId);
    
    // 执行当前节点
    await this.executeNode(runId, node, conversationId, pipeline);
    
    // 获取下游节点
    const downstreamNodes = this.findDownstreamNodes(nodeId, nodeMap);
    
    if (downstreamNodes.length === 0) {
      // 没有下游节点，执行结束
      return;
    }
    
    if (downstreamNodes.length === 1) {
      // 单个下游节点，直接执行
      await this.executeFromNode(
        runId,
        downstreamNodes[0].id,
        nodeMap,
        nodeRunsMap,
        conversationId,
        pipeline
      );
    } else {
      // 多个下游节点，并行执行
      await this.executeParallelNodes(
        runId,
        downstreamNodes,
        nodeMap,
        nodeRunsMap,
        conversationId,
        pipeline
      );
    }
  }
  
  /**
   * 执行单个节点
   */
  private async executeNode(
    runId: string,
    node: PipelineNode,
    conversationId: string,
    pipeline: Pipeline
  ): Promise<void> {
    // 获取节点运行记录
    const { data: nodeRun } = await this.client
      .from('pipeline_node_runs')
      .select('*')
      .eq('pipeline_run_id', runId)
      .eq('node_id', node.id)
      .single();
    
    if (!nodeRun) return;
    
    // 更新状态为运行中
    await this.updateNodeRunStatus(nodeRun.id, 'running');
    
    // 根据节点类型执行
    try {
      switch (node.node_type) {
        case 'start':
          await this.sendSystemMessage(
            conversationId,
            `🏁 流水线开始执行`
          );
          break;
          
        case 'end':
          await this.sendSystemMessage(
            conversationId,
            `🏁 流水线到达结束节点`
          );
          break;
          
        case 'gateway':
          if (node.gateway_type === 'parallel_split') {
            await this.sendSystemMessage(
              conversationId,
              `🔀 进入并行分叉节点: ${node.name}`
            );
          } else if (node.gateway_type === 'parallel_join') {
            await this.sendSystemMessage(
              conversationId,
              `🔀 进入并行汇聚节点: ${node.name}`
            );
          }
          break;
          
        case 'agent':
          // 执行智能体节点
          await this.executeAgentNode(runId, node, conversationId, pipeline);
          break;
          
        case 'delay':
          // 延迟节点
          const delaySeconds = node.timeout_seconds || 60;
          await this.sendSystemMessage(
            conversationId,
            `⏳ 延迟 ${delaySeconds} 秒...`
          );
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          break;
          
        default:
          console.log(`未处理的节点类型: ${node.node_type}`);
      }
      
      // 更新状态为成功
      await this.updateNodeRunStatus(nodeRun.id, 'success');
      
      // 更新运行计数
      const { data: allNodeRuns } = await this.client
        .from('pipeline_node_runs')
        .select('status')
        .eq('pipeline_run_id', runId);
      
      const completedCount = (allNodeRuns || []).filter(r => r.status === 'success').length;
      
      await this.client
        .from('pipeline_runs')
        .update({
          completed_nodes: completedCount
        })
        .eq('id', runId);
      
    } catch (error) {
      console.error(`节点 ${node.name} 执行失败:`, error);
      await this.updateNodeRunStatus(nodeRun.id, 'failed', error instanceof Error ? error.message : '未知错误');
      throw error;
    }
  }
  
  /**
   * 执行智能体节点
   */
  private async executeAgentNode(
    runId: string,
    node: PipelineNode,
    conversationId: string,
    pipeline: Pipeline
  ): Promise<void> {
    if (!node.agent_id) {
      throw new Error(`节点 ${node.name} 未配置智能体`);
    }
    
    // 获取智能体信息
    const { data: agent } = await this.client
      .from('agents')
      .select('*')
      .eq('id', node.agent_id)
      .single();
    
    if (!agent) {
      throw new Error(`智能体不存在: ${node.agent_id}`);
    }
    
    // 获取运行记录（包含工单信息）
    const { data: run } = await this.client
      .from('pipeline_runs')
      .select('input_data')
      .eq('id', runId)
      .single();
    
    const ticket = run?.input_data as any;
    
    // 获取上游节点的输出数据
    const upstreamOutputs = await this.getUpstreamOutputs(runId, node);
    
    // 构建输入数据
    const inputData: Record<string, any> = {
      node_name: node.name,
      node_id: node.id,
      upstream_outputs: upstreamOutputs,
      started_at: new Date().toISOString()
    };
    
    // 如果有工单信息，添加到输入数据
    if (ticket) {
      inputData.ticket = {
        id: ticket.ticket_id,
        type: ticket.ticket_type,
        title: ticket.ticket_title,
        description: ticket.ticket_description,
        priority: ticket.ticket_priority
      };
    }
    
    // 更新节点运行记录的输入数据
    await this.client
      .from('pipeline_node_runs')
      .update({ input_data: inputData })
      .eq('pipeline_run_id', runId)
      .eq('node_id', node.id);
    
    // 构建任务描述（包含工单信息）
    let taskDescription = `任务: ${node.name}`;
    if (ticket) {
      taskDescription += `\n\n📋 工单信息:\n`;
      taskDescription += `- 类型: ${ticket.ticket_type}\n`;
      taskDescription += `- 标题: ${ticket.ticket_title}\n`;
      if (ticket.ticket_description) {
        taskDescription += `- 描述: ${ticket.ticket_description}\n`;
      }
      taskDescription += `- 优先级: ${ticket.ticket_priority}`;
    }
    
    // 添加上游信息
    const upstreamSummary = Object.keys(upstreamOutputs).length > 0
      ? `\n\n📋 上游节点输出:\n${Object.entries(upstreamOutputs)
          .map(([nodeId, output]) => {
            const outputNode = pipeline.nodes?.find(n => n.id === nodeId);
            return `- ${outputNode?.name || nodeId}: ${(output as any)?.summary || '已完成'}`;
          })
          .join('\n')}`
      : '';
    
    const fullDescription = taskDescription + upstreamSummary;
    
    // 发送开始消息（包含工单信息）
    await this.sendMessage(
      conversationId,
      agent.id,
      'task_start',
      `🤖 ${agent.name} 开始执行:\n${fullDescription}`,
      { node_id: node.id, upstream_outputs: upstreamOutputs, ticket }
    );
    
    // 构建提示词
    const prompt = ticket
      ? `你是一个智能助手，请处理以下工单任务：\n\n${fullDescription}\n\n请根据你的角色和能力，协助完成这个任务。`
      : `你是一个智能助手，请完成以下任务：\n\n${fullDescription}`;
    
    // TODO: 实际调用智能体执行任务
    // 这里可以调用 /api/chat 接口或直接调用智能体
    // 目前模拟执行
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 构建输出数据
    const outputData = {
      agent_id: agent.id,
      agent_name: agent.name,
      status: 'completed',
      summary: ticket 
        ? `已处理工单 "${ticket.ticket_title}"`
        : `任务 "${node.name}" 执行完成`,
      timestamp: new Date().toISOString(),
      ticket_processed: !!ticket
    };
    
    // 更新节点运行记录的输出数据
    await this.client
      .from('pipeline_node_runs')
      .update({ output_data: outputData })
      .eq('pipeline_run_id', runId)
      .eq('node_id', node.id);
    
    // 发送完成消息
    await this.sendMessage(
      conversationId,
      agent.id,
      'task_complete',
      `✅ ${agent.name} 完成:\n${outputData.summary}`,
      { node_id: node.id, output: outputData }
    );
    
    // 通知下游节点
    await this.notifyDownstreamNodes(runId, node, pipeline, conversationId, outputData);
  }
  
  /**
   * 获取上游节点的输出数据
   */
  private async getUpstreamOutputs(
    runId: string,
    node: PipelineNode
  ): Promise<Record<string, any>> {
    const upstreamNodeIds = node.upstream_nodes as string[] || [];
    
    if (upstreamNodeIds.length === 0) {
      return {};
    }
    
    const { data: upstreamRuns } = await this.client
      .from('pipeline_node_runs')
      .select('node_id, output_data')
      .eq('pipeline_run_id', runId)
      .in('node_id', upstreamNodeIds);
    
    const outputs: Record<string, any> = {};
    
    for (const run of upstreamRuns || []) {
      if (run.output_data) {
        outputs[run.node_id] = run.output_data;
      }
    }
    
    return outputs;
  }
  
  /**
   * 通知下游节点
   */
  private async notifyDownstreamNodes(
    runId: string,
    completedNode: PipelineNode,
    pipeline: Pipeline,
    conversationId: string,
    outputData: Record<string, any>
  ): Promise<void> {
    const nodes = pipeline.nodes || [];
    
    // 查找下游节点
    const downstreamNodes = nodes.filter(n => {
      const upstreamIds = n.upstream_nodes as string[] || [];
      return upstreamIds.includes(completedNode.id);
    });
    
    for (const downstream of downstreamNodes) {
      if (downstream.agent_id) {
        const { data: downstreamAgent } = await this.client
          .from('agents')
          .select('*')
          .eq('id', downstream.agent_id)
          .single();
        
        if (downstreamAgent) {
          // 检查是否所有上游节点都已完成
          const upstreamIds = downstream.upstream_nodes as string[] || [];
          const { data: upstreamRuns } = await this.client
            .from('pipeline_node_runs')
            .select('node_id, status')
            .eq('pipeline_run_id', runId)
            .in('node_id', upstreamIds);
          
          const completedUpstreams = (upstreamRuns || [])
            .filter(r => r.status === 'success')
            .map(r => r.node_id);
          
          const allUpstreamCompleted = completedUpstreams.length === upstreamIds.length;
          
          if (allUpstreamCompleted) {
            // 所有上游节点都已完成，发送准备通知
            await this.sendMessage(
              conversationId,
              downstreamAgent.id,
              'notification',
              `📢 所有前置节点已完成，${downstreamAgent.name} 可以开始任务: ${downstream.name}`,
              {
                completed_node: completedNode.name,
                completed_node_id: completedNode.id,
                output: outputData
              }
            );
          } else {
            // 部分上游节点完成，发送进度通知
            await this.sendMessage(
              conversationId,
              downstreamAgent.id,
              'progress',
              `⏳ ${completedNode.name} 已完成 (${completedUpstreams.length}/${upstreamIds.length} 个前置节点)`,
              {
                completed_node: completedNode.name,
                completed_node_id: completedNode.id,
                progress: `${completedUpstreams.length}/${upstreamIds.length}`
              }
            );
          }
        }
      }
    }
  }
  
  /**
   * 并行执行多个节点
   */
  private async executeParallelNodes(
    runId: string,
    nodes: PipelineNode[],
    nodeMap: Map<string, PipelineNode>,
    nodeRunsMap: Map<string, PipelineNodeRun>,
    conversationId: string,
    pipeline: Pipeline
  ): Promise<void> {
    // 检查是否有汇聚网关
    const joinGateways = nodes.filter(n => 
      n.node_type === 'gateway' && 
      n.gateway_type === 'parallel_join'
    );
    
    if (joinGateways.length > 0) {
      // 有汇聚网关，需要等待
      // 先执行所有非汇聚节点
      const nonJoinNodes = nodes.filter(n => 
        !(n.node_type === 'gateway' && n.gateway_type === 'parallel_join')
      );
      
      // 并行执行
      await Promise.all(
        nonJoinNodes.map(node => 
          this.executeNode(runId, node, conversationId, pipeline)
        )
      );
      
      // 检查汇聚条件并执行汇聚网关
      for (const gateway of joinGateways) {
        await this.checkAndExecuteJoinGateway(
          runId,
          gateway,
          nodeMap,
          nodeRunsMap,
          conversationId,
          pipeline
        );
      }
    } else {
      // 没有汇聚网关，直接并行执行
      await Promise.all(
        nodes.map(node => 
          this.executeFromNode(
            runId,
            node.id,
            nodeMap,
            nodeRunsMap,
            conversationId,
            pipeline
          )
        )
      );
    }
  }
  
  /**
   * 检查并执行汇聚网关
   */
  private async checkAndExecuteJoinGateway(
    runId: string,
    gateway: PipelineNode,
    nodeMap: Map<string, PipelineNode>,
    nodeRunsMap: Map<string, PipelineNodeRun>,
    conversationId: string,
    pipeline: Pipeline
  ): Promise<void> {
    const upstreamNodeIds = gateway.upstream_nodes as string[] || [];
    const mergeStrategy: MergeStrategy = (gateway.merge_strategy as MergeStrategy) || 'all';
    
    // 更新汇聚网关状态为等待
    const { data: gatewayRun } = await this.client
      .from('pipeline_node_runs')
      .select('*')
      .eq('pipeline_run_id', runId)
      .eq('node_id', gateway.id)
      .single();
    
    if (gatewayRun) {
      await this.client
        .from('pipeline_node_runs')
        .update({
          status: 'waiting',
          wait_status: {
            required_nodes: upstreamNodeIds,
            completed_nodes: [],
            merge_strategy: mergeStrategy
          }
        })
        .eq('id', gatewayRun.id);
      
      await this.sendSystemMessage(
        conversationId,
        `⏳ 汇聚网关 "${gateway.name}" 等待中... (策略: ${mergeStrategy === 'all' ? '全部完成' : '任一完成'})`
      );
    }
    
    // 等待上游节点完成
    const checkInterval = 1000; // 1秒检查一次
    let completedUpstream: string[] = [];
    
    while (true) {
      // 获取上游节点运行状态
      const { data: upstreamRuns } = await this.client
        .from('pipeline_node_runs')
        .select('*')
        .eq('pipeline_run_id', runId)
        .in('node_id', upstreamNodeIds);
      
      completedUpstream = (upstreamRuns || [])
        .filter(r => r.status === 'success')
        .map(r => r.node_id);
      
      // 检查汇聚条件
      if (mergeStrategy === 'all') {
        if (completedUpstream.length === upstreamNodeIds.length) {
          // 所有上游节点完成
          break;
        }
      } else if (mergeStrategy === 'any') {
        if (completedUpstream.length > 0) {
          // 任一上游节点完成
          break;
        }
      }
      
      // 等待一段时间再检查
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // 汇聚条件满足，执行汇聚网关
    await this.sendSystemMessage(
      conversationId,
      `✅ 汇聚网关 "${gateway.name}" 条件满足，已完成的节点: ${completedUpstream.length}/${upstreamNodeIds.length}`
    );
    
    // 执行汇聚网关
    await this.executeNode(runId, gateway, conversationId, pipeline);
    
    // 继续执行下游节点
    const downstreamNodes = this.findDownstreamNodes(gateway.id, nodeMap);
    for (const downstream of downstreamNodes) {
      // 通知下游节点开始
      if (downstream.agent_id) {
        const { data: agent } = await this.client
          .from('agents')
          .select('*')
          .eq('id', downstream.agent_id)
          .single();
        
        if (agent) {
          await this.sendMessage(
            conversationId,
            agent.id,
            'notification',
            `📢 所有前置节点已完成，请开始任务: ${downstream.name}`
          );
        }
      }
      
      await this.executeFromNode(
        runId,
        downstream.id,
        nodeMap,
        nodeRunsMap,
        conversationId,
        pipeline
      );
    }
  }
  
  /**
   * 查找下游节点
   */
  private findDownstreamNodes(
    nodeId: string, 
    nodeMap: Map<string, PipelineNode>
  ): PipelineNode[] {
    const downstream: PipelineNode[] = [];
    
    for (const node of nodeMap.values()) {
      // 检查上游节点列表
      const upstreamNodes = node.upstream_nodes as string[] || [];
      if (upstreamNodes.includes(nodeId)) {
        downstream.push(node);
      }
      
      // 检查是否是顺序执行
      const currentNode = nodeMap.get(nodeId);
      if (currentNode && 
          node.order_index === currentNode.order_index + 1 && 
          node.node_type !== 'gateway') {
        // 相邻的顺序节点
        if (!downstream.find(n => n.id === node.id)) {
          downstream.push(node);
        }
      }
    }
    
    return downstream;
  }
  
  /**
   * 更新节点运行状态
   */
  private async updateNodeRunStatus(
    nodeRunId: string, 
    status: NodeRunStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      ...(status === 'running' && { started_at: new Date().toISOString() }),
      ...(status === 'success' && { completed_at: new Date().toISOString() }),
      ...(status === 'failed' && { 
        completed_at: new Date().toISOString(),
        error_message: errorMessage 
      })
    };
    
    await this.client
      .from('pipeline_node_runs')
      .update(updateData)
      .eq('id', nodeRunId);
  }
  
  /**
   * 完成运行
   */
  private async completeRun(runId: string, status: RunStatus): Promise<void> {
    await this.client
      .from('pipeline_runs')
      .update({
        status,
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);
  }
  
  /**
   * 发送系统消息
   */
  private async sendSystemMessage(
    conversationId: string,
    content: string
  ): Promise<void> {
    await this.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'system',
        message_type: 'system',
        content
      });
  }
  
  /**
   * 发送消息
   */
  private async sendMessage(
    conversationId: string,
    agentId: string,
    messageType: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        agent_id: agentId,
        role: 'assistant',
        message_type: messageType,
        content,
        metadata
      });
  }
}

// 导出单例
export const pipelineEngine = new PipelineEngine();
