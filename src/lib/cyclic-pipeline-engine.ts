/**
 * 循环流水线执行引擎
 * 
 * 支持自循环流水线的执行，包括：
 * - 循环检测
 * - 条件评估
 * - 循环控制（最大次数限制）
 * - 循环数据传递
 */

import type { 
  Pipeline, 
  PipelineNode, 
  ConditionConfig, 
  ConditionBranch,
  LoopConfig 
} from '@/types/pipeline';

// 循环信息
export interface LoopInfo {
  // 循环边的源节点和目标节点
  sourceNodeId: string;
  targetNodeId: string;
  
  // 循环配置
  config: LoopConfig;
  
  // 当前循环次数
  currentIteration: number;
  
  // 循环历史
  history: Array<{
    iteration: number;
    timestamp: string;
    input: any;
    output: any;
  }>;
}

// 执行上下文
export interface ExecutionContext {
  pipelineId: string;
  runId: string;
  
  // 当前执行位置
  currentNodeId: string;
  
  // 已完成的节点输出
  nodeOutputs: Map<string, any>;
  
  // 循环状态
  loops: Map<string, LoopInfo>;
  
  // 执行路径
  executionPath: string[];
  
  // 循环计数器
  iterationCounters: Map<string, number>;
}

// 节点执行结果
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  output: any;
  error?: string;
  
  // 是否触发了循环
  triggeredLoop?: {
    targetNodeId: string;
    iteration: number;
  };
}

/**
 * 循环流水线引擎
 */
export class CyclicPipelineEngine {
  private pipeline: Pipeline;
  private nodes: Map<string, PipelineNode>;
  private adjacencyList: Map<string, string[]>;
  private reverseAdjacencyList: Map<string, string[]>;
  private loopEdges: Map<string, LoopConfig>;

  constructor(pipeline: Pipeline) {
    this.pipeline = pipeline;
    this.nodes = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.loopEdges = new Map();
    
    this.initialize();
  }

  /**
   * 初始化引擎
   */
  private initialize() {
    // 构建节点映射
    for (const node of this.pipeline.nodes || []) {
      this.nodes.set(node.id, node);
      
      // 初始化邻接表
      if (!this.adjacencyList.has(node.id)) {
        this.adjacencyList.set(node.id, []);
      }
      if (!this.reverseAdjacencyList.has(node.id)) {
        this.reverseAdjacencyList.set(node.id, []);
      }
    }

    // 构建邻接表（从边信息）
    for (const edge of this.pipeline.edges || []) {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target;
      
      this.adjacencyList.get(sourceId)?.push(targetId);
      this.reverseAdjacencyList.get(targetId)?.push(sourceId);
      
      // 检测循环边
      if (edge.data?.isLoop) {
        this.loopEdges.set(`${sourceId}->${targetId}`, edge.data.loopConfig || {
          isLoop: true,
          maxIterations: 10
        });
      }
    }

    // 检测隐式循环（从条件网关的循环分支）
    for (const node of this.pipeline.nodes || []) {
      if (node.node_type === 'condition' && node.condition_config) {
        for (const branch of node.condition_config.branches) {
          if (branch.isLoop && branch.loopConfig) {
            this.loopEdges.set(`${node.id}->${branch.targetNodeId}`, branch.loopConfig);
          }
        }
      }
    }
  }

  /**
   * 检测图中的所有环
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // 找到环
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * 检查是否存在循环
   */
  hasLoops(): boolean {
    return this.loopEdges.size > 0;
  }

  /**
   * 获取所有循环边
   */
  getLoopEdges(): Array<{ source: string; target: string; config: LoopConfig }> {
    const result: Array<{ source: string; target: string; config: LoopConfig }> = [];
    
    for (const [key, config] of this.loopEdges) {
      const [source, target] = key.split('->');
      result.push({ source, target, config });
    }
    
    return result;
  }

  /**
   * 评估条件表达式
   */
  evaluateCondition(expression: string, context: any): boolean {
    try {
      // 替换模板变量
      let evalExpression = expression;
      
      // 支持 {{output.xxx}} 格式
      evalExpression = evalExpression.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
        const value = this.getNestedValue(context, path.trim());
        return JSON.stringify(value);
      });

      // 安全执行表达式
      // 注意：实际生产环境应使用更安全的表达式引擎
      const func = new Function('context', `
        with(context) {
          return ${evalExpression};
        }
      `);
      
      return func(context);
    } catch (error) {
      console.error('条件评估失败:', error);
      return false;
    }
  }

  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 获取条件网关的下一个节点
   */
  getNextNodeFromCondition(
    node: PipelineNode,
    context: ExecutionContext
  ): { nodeId: string; isLoop: boolean; loopConfig?: LoopConfig } | null {
    if (!node.condition_config) return null;

    const config = node.condition_config;
    const lastOutput = context.nodeOutputs.get(node.id);
    
    // 评估条件
    const conditionResult = this.evaluateCondition(config.expression, {
      output: lastOutput,
      context: context
    });

    // 查找匹配的分支
    for (const branch of config.branches) {
      // 检查条件值是否匹配
      if (branch.conditionValue === conditionResult) {
        // 检查是否为循环分支
        if (branch.isLoop && branch.loopConfig) {
          const loopKey = `${node.id}->${branch.targetNodeId}`;
          const currentIteration = context.iterationCounters.get(loopKey) || 0;
          
          // 检查是否达到最大循环次数
          if (currentIteration >= branch.loopConfig.maxIterations) {
            console.log(`循环已达到最大次数: ${branch.loopConfig.maxIterations}`);
            // 走默认分支或第一个非循环分支
            const defaultBranch = config.branches.find(b => !b.isLoop);
            if (defaultBranch) {
              return { nodeId: defaultBranch.targetNodeId, isLoop: false };
            }
            return null;
          }
        }
        
        return {
          nodeId: branch.targetNodeId,
          isLoop: branch.isLoop,
          loopConfig: branch.loopConfig
        };
      }
    }

    // 使用默认分支
    if (config.defaultBranchId) {
      const defaultBranch = config.branches.find(b => b.id === config.defaultBranchId);
      if (defaultBranch) {
        return {
          nodeId: defaultBranch.targetNodeId,
          isLoop: defaultBranch.isLoop,
          loopConfig: defaultBranch.loopConfig
        };
      }
    }

    return null;
  }

  /**
   * 准备循环数据
   */
  prepareLoopData(
    context: ExecutionContext,
    loopConfig: LoopConfig,
    output: any
  ): any {
    if (!loopConfig.carryOver || loopConfig.carryOver.length === 0) {
      return output;
    }

    const loopData: any = { ...output };
    
    // 提取需要携带的数据
    for (const field of loopConfig.carryOver) {
      const value = this.getNestedValue(output, field);
      if (value !== undefined) {
        loopData[field] = value;
      }
    }

    // 添加循环上下文
    loopData._loopContext = {
      iteration: (context.iterationCounters.get('current') || 0) + 1,
      maxIterations: loopConfig.maxIterations,
      history: output._loopContext?.history || []
    };

    return loopData;
  }

  /**
   * 获取下一个要执行的节点
   */
  getNextNode(
    currentNodeId: string,
    context: ExecutionContext
  ): { nodeId: string; isLoop: boolean; loopConfig?: LoopConfig } | null {
    const node = this.nodes.get(currentNodeId);
    if (!node) return null;

    // 如果是条件网关，评估条件
    if (node.node_type === 'condition') {
      return this.getNextNodeFromCondition(node, context);
    }

    // 普通节点，获取下一个节点
    const neighbors = this.adjacencyList.get(currentNodeId) || [];
    if (neighbors.length === 0) return null;

    // 检查是否有循环边
    for (const neighborId of neighbors) {
      const loopKey = `${currentNodeId}->${neighborId}`;
      const loopConfig = this.loopEdges.get(loopKey);
      
      if (loopConfig) {
        // 评估循环条件
        const lastOutput = context.nodeOutputs.get(currentNodeId);
        const shouldLoop = loopConfig.loopCondition 
          ? this.evaluateCondition(loopConfig.loopCondition, { output: lastOutput })
          : true; // 没有条件默认执行循环

        if (shouldLoop) {
          const currentIteration = context.iterationCounters.get(loopKey) || 0;
          
          if (currentIteration < loopConfig.maxIterations) {
            return { nodeId: neighborId, isLoop: true, loopConfig };
          }
        }
      }
    }

    // 没有循环，返回第一个邻居
    return { nodeId: neighbors[0], isLoop: false };
  }

  /**
   * 验证流水线的循环安全性
   */
  validateLoops(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查所有循环边
    for (const [key, config] of this.loopEdges) {
      if (!config.maxIterations || config.maxIterations <= 0) {
        errors.push(`循环边 ${key} 缺少有效的最大循环次数配置`);
      }
      
      if (config.maxIterations && config.maxIterations > 100) {
        warnings.push(`循环边 ${key} 的最大循环次数 (${config.maxIterations}) 过大，建议不超过100`);
      }
    }

    // 检查条件网关的循环分支
    for (const node of this.pipeline.nodes || []) {
      if (node.node_type === 'condition' && node.condition_config) {
        const config = node.condition_config;
        
        // 检查是否有循环分支
        const loopBranches = config.branches.filter(b => b.isLoop);
        for (const branch of loopBranches) {
          if (!branch.loopConfig?.maxIterations) {
            errors.push(`条件网关 ${node.name} 的循环分支缺少最大循环次数配置`);
          }
        }
        
        // 检查是否有退出分支
        const exitBranches = config.branches.filter(b => !b.isLoop);
        if (exitBranches.length === 0) {
          warnings.push(`条件网关 ${node.name} 没有非循环退出分支，可能导致无法退出循环`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * 创建循环流水线引擎实例
 */
export function createCyclicPipelineEngine(pipeline: Pipeline): CyclicPipelineEngine {
  return new CyclicPipelineEngine(pipeline);
}
