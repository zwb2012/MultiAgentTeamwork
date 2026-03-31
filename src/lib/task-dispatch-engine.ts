/**
 * 任务分发引擎
 * 
 * 负责根据节点的输出映射配置，将任务精准分发给对应的下游智能体
 */

import type { OutputMapping, TaskType } from '@/types/pipeline';
import type { Agent, CapabilityTag } from '@/types/agent';

// 任务类型到能力标签的映射
const TASK_TYPE_TO_CAPABILITY: Record<TaskType, CapabilityTag[]> = {
  frontend: ['frontend'],
  backend: ['backend'],
  testing: ['testing'],
  review: ['review'],
  architecture: ['architecture'],
  general: ['general']
};

/**
 * 分发任务给下游节点
 */
export interface DispatchContext {
  pipelineId: string;
  nodeId: string;
  upstreamOutput: string;
  outputMappings: OutputMapping[];
  downstreamNodes: Array<{
    id: string;
    agentId?: string;
    name: string;
  }>;
  agents: Agent[];
}

export interface DispatchResult {
  success: boolean;
  dispatches: Array<{
    targetNodeId: string;
    targetAgentId?: string;
    taskType: TaskType;
    message: string;
    matched: boolean;
    matchReason?: string;
  }>;
  errors: string[];
}

/**
 * 任务分发引擎
 */
export class TaskDispatchEngine {
  private agents: Map<string, Agent>;

  constructor(agents: Agent[]) {
    this.agents = new Map(agents.map(a => [a.id, a]));
  }

  /**
   * 分发任务给下游节点
   */
  dispatch(context: DispatchContext): DispatchResult {
    const result: DispatchResult = {
      success: true,
      dispatches: [],
      errors: []
    };

    // 如果没有配置输出映射，使用智能匹配
    if (!context.outputMappings || context.outputMappings.length === 0) {
      return this.smartDispatch(context);
    }

    // 根据配置的输出映射分发
    for (const mapping of context.outputMappings) {
      const downstreamNode = context.downstreamNodes.find(n => n.id === mapping.targetNodeId);
      
      if (!downstreamNode) {
        result.errors.push(`目标节点 ${mapping.targetNodeId} 不存在`);
        continue;
      }

      // 构建消息
      const message = this.buildMessage(context.upstreamOutput, mapping);

      // 检查智能体能力匹配
      const agent = downstreamNode.agentId ? this.agents.get(downstreamNode.agentId) : undefined;
      const matchResult = this.checkCapabilityMatch(agent, mapping.taskType);

      result.dispatches.push({
        targetNodeId: mapping.targetNodeId,
        targetAgentId: downstreamNode.agentId,
        taskType: mapping.taskType,
        message,
        matched: matchResult.matched,
        matchReason: matchResult.reason
      });
    }

    // 检查是否有未映射的下游节点
    const mappedNodeIds = new Set(context.outputMappings.map(m => m.targetNodeId));
    for (const node of context.downstreamNodes) {
      if (!mappedNodeIds.has(node.id)) {
        result.errors.push(`节点 ${node.name} (${node.id}) 未配置输出映射`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * 智能分发 - 自动匹配任务类型和智能体能力
   */
  private smartDispatch(context: DispatchContext): DispatchResult {
    const result: DispatchResult = {
      success: true,
      dispatches: [],
      errors: []
    };

    // 分析上游输出，推测任务类型
    const detectedTaskTypes = this.detectTaskTypes(context.upstreamOutput);

    for (const node of context.downstreamNodes) {
      const agent = node.agentId ? this.agents.get(node.agentId) : undefined;

      // 找到最佳匹配的任务类型
      let bestMatch: { taskType: TaskType; score: number } | null = null;

      for (const taskType of detectedTaskTypes) {
        const matchResult = this.checkCapabilityMatch(agent, taskType);
        if (matchResult.matched) {
          const score = this.calculateMatchScore(agent, taskType);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { taskType, score };
          }
        }
      }

      if (bestMatch) {
        result.dispatches.push({
          targetNodeId: node.id,
          targetAgentId: node.agentId,
          taskType: bestMatch.taskType,
          message: context.upstreamOutput,
          matched: true,
          matchReason: `智能匹配: ${bestMatch.taskType} (得分: ${bestMatch.score})`
        });
      } else {
        // 没有匹配的能力标签，使用通用类型
        result.dispatches.push({
          targetNodeId: node.id,
          targetAgentId: node.agentId,
          taskType: 'general',
          message: context.upstreamOutput,
          matched: true,
          matchReason: '未找到能力匹配，使用通用类型'
        });
      }
    }

    return result;
  }

  /**
   * 检查智能体能力是否匹配任务类型
   */
  private checkCapabilityMatch(
    agent: Agent | undefined, 
    taskType: TaskType
  ): { matched: boolean; reason: string } {
    if (!agent) {
      return { matched: false, reason: '节点未指定智能体' };
    }

    const requiredCapabilities = TASK_TYPE_TO_CAPABILITY[taskType];
    const agentCapabilities = agent.capability_tags || [];

    // 检查是否有交集
    const hasMatch = requiredCapabilities.some(cap => agentCapabilities.includes(cap));

    if (hasMatch) {
      return { 
        matched: true, 
        reason: `能力匹配: ${agent.name} 拥有 ${agentCapabilities.join(', ')} 能力` 
      };
    }

    return { 
      matched: false, 
      reason: `${agent.name} 缺少所需能力: ${requiredCapabilities.join(' 或 ')}` 
    };
  }

  /**
   * 计算匹配得分（用于优先级排序）
   */
  private calculateMatchScore(agent: Agent | undefined, taskType: TaskType): number {
    if (!agent) return 0;

    const requiredCapabilities = TASK_TYPE_TO_CAPABILITY[taskType];
    const agentCapabilities = agent.capability_tags || [];

    // 计算匹配的能力数量
    const matchCount = requiredCapabilities.filter(cap => agentCapabilities.includes(cap)).length;
    
    // 完全匹配得分最高
    if (matchCount === requiredCapabilities.length) {
      return 100;
    }

    // 部分匹配按比例给分
    return Math.floor((matchCount / requiredCapabilities.length) * 80);
  }

  /**
   * 根据输出内容推测任务类型
   */
  private detectTaskTypes(output: string): TaskType[] {
    const types: TaskType[] = [];
    const lowerOutput = output.toLowerCase();

    // 前端关键词
    if (/react|vue|前端|ui|css|html|javascript|typescript|组件|页面/.test(lowerOutput)) {
      types.push('frontend');
    }

    // 后端关键词
    if (/api|后端|server|database|sql|接口|服务/.test(lowerOutput)) {
      types.push('backend');
    }

    // 测试关键词
    if (/测试|test|bug|验证|检查/.test(lowerOutput)) {
      types.push('testing');
    }

    // 审核关键词
    if (/审核|review|代码质量|规范|优化/.test(lowerOutput)) {
      types.push('review');
    }

    // 架构关键词
    if (/架构|设计|方案|技术选型/.test(lowerOutput)) {
      types.push('architecture');
    }

    // 如果没有匹配到任何类型，使用通用类型
    if (types.length === 0) {
      types.push('general');
    }

    return types;
  }

  /**
   * 构建发送给下游的消息
   */
  private buildMessage(upstreamOutput: string, mapping: OutputMapping): string {
    if (mapping.template) {
      // 替换模板中的占位符
      return mapping.template.replace(/\{\{output\}\}/g, upstreamOutput);
    }

    // 默认消息格式
    const taskTypeLabel = {
      frontend: '前端开发',
      backend: '后端开发',
      testing: '测试',
      review: '代码审核',
      architecture: '架构设计',
      general: '通用'
    }[mapping.taskType];

    return `[${taskTypeLabel}任务]\n\n${upstreamOutput}`;
  }
}

/**
 * 创建任务分发引擎实例
 */
export function createTaskDispatchEngine(agents: Agent[]): TaskDispatchEngine {
  return new TaskDispatchEngine(agents);
}
