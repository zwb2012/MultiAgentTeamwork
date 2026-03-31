/**
 * 流水线相关类型定义
 */

import type { Agent } from './agent';

// 流水线状态
export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived';

// 流水线触发类型
export type TriggerType = 'manual' | 'scheduled' | 'webhook';

// 节点类型
export type NodeType = 
  | 'agent'      // 智能体节点
  | 'task'       // 任务节点
  | 'gateway'    // 网关节点
  | 'condition'  // 条件节点
  | 'delay'      // 延迟节点
  | 'start'      // 开始节点
  | 'end';       // 结束节点

// 网关类型
export type GatewayType = 
  | 'parallel_split'  // 并行分叉
  | 'parallel_join'   // 并行汇聚
  | 'exclusive'       // 排他网关（条件分支）
  | 'inclusive';      // 包容网关

// 执行模式
export type ExecutionMode = 'sequential' | 'parallel';

// 汇聚策略
export type MergeStrategy = 
  | 'all'     // 所有上游节点完成
  | 'any'     // 任一上游节点完成
  | 'custom'; // 自定义条件

// 节点位置（可视化用）
export interface NodePosition {
  x: number;
  y: number;
}

// 流水线节点
export interface PipelineNode {
  id: string;
  pipeline_id: string;
  
  // 基本信息
  name: string;
  description?: string;
  node_type: NodeType;
  
  // 执行顺序
  order_index: number;
  
  // 智能体配置
  agent_id?: string;
  agent?: Agent;
  task_id?: string;
  
  // 执行模式
  execution_mode: ExecutionMode;
  parallel_group?: string; // 并行组标识
  
  // 网关配置（当 node_type === 'gateway' 时）
  gateway_type?: GatewayType;
  
  // 汇聚配置（当 gateway_type === 'parallel_join' 时）
  merge_strategy?: MergeStrategy;
  upstream_nodes?: string[]; // 上游节点ID列表
  downstream_nodes?: string[]; // 下游节点ID列表
  custom_condition?: string; // 自定义条件表达式
  
  // 条件配置（当 node_type === 'condition' 时）
  condition?: {
    expression: string;
    true_node_id?: string;
    false_node_id?: string;
  };
  
  // 重试和超时
  retry_count: number;
  timeout_seconds?: number;
  
  // 输入输出配置
  input_config?: Record<string, any>;
  output_config?: Record<string, any>;
  
  // 可视化位置
  position?: NodePosition;
  
  // 时间戳
  created_at: string;
  updated_at?: string;
}

// 流水线运行状态
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

// 节点运行状态
export type NodeRunStatus = 'pending' | 'waiting' | 'running' | 'success' | 'failed' | 'skipped';

// 流水线运行记录
export interface PipelineRun {
  id: string;
  pipeline_id: string;
  
  // 运行状态
  status: RunStatus;
  current_node_id?: string;
  
  // 运行配置
  trigger_by: TriggerType | 'manual';
  trigger_user?: string;
  
  // 执行结果
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: number;
  
  // 关联会话
  conversation_id?: string;
  
  // 运行日志
  logs?: RunLogEntry[];
  
  // 输入输出
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  
  // 时间记录
  started_at?: string;
  completed_at?: string;
  created_at: string;
  
  // 关联数据
  pipeline?: Pipeline;
  node_runs?: PipelineNodeRun[];
}

// 运行日志条目
export interface RunLogEntry {
  timestamp: string;
  node_id: string;
  node_name: string;
  status: NodeRunStatus;
  message?: string;
  error?: string;
}

// 节点运行记录
export interface PipelineNodeRun {
  id: string;
  pipeline_run_id: string;
  node_id: string;
  
  // 执行状态
  status: NodeRunStatus;
  
  // 等待状态详情
  wait_status?: {
    required_nodes: string[];
    completed_nodes: string[];
    merge_strategy: MergeStrategy;
  };
  
  // 执行结果
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  
  // 重试信息
  retry_count: number;
  
  // 时间记录
  started_at?: string;
  completed_at?: string;
  created_at: string;
  
  // 关联数据
  node?: PipelineNode;
}

// 流水线
export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  
  // 触发配置
  trigger_type: TriggerType;
  trigger_config?: Record<string, any>;
  
  // 全局配置
  config?: {
    timeout?: number;
    retry_policy?: {
      max_retries: number;
      retry_delay: number;
    };
    notification?: {
      on_start: boolean;
      on_complete: boolean;
      on_error: boolean;
    };
  };
  
  // 状态
  status: PipelineStatus;
  is_active: boolean;
  
  // 时间戳
  created_at: string;
  updated_at?: string;
  
  // 节点列表（关联查询）
  nodes?: PipelineNode[];
  
  // 最后运行信息
  last_run?: PipelineRun;
}

// 流水线创建/更新请求
export interface PipelineInput {
  name: string;
  description?: string;
  trigger_type?: TriggerType;
  trigger_config?: Record<string, any>;
  config?: Pipeline['config'];
  nodes?: Partial<PipelineNode>[];
}

// 节点模板
export interface NodeTemplate {
  type: NodeType;
  name: string;
  icon: string;
  description: string;
  default_config: Partial<PipelineNode>;
}

// 预定义节点模板
export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: 'start',
    name: '开始',
    icon: 'Play',
    description: '流水线开始节点',
    default_config: {
      node_type: 'start',
      execution_mode: 'sequential',
      order_index: 0
    }
  },
  {
    type: 'end',
    name: '结束',
    icon: 'Flag',
    description: '流水线结束节点',
    default_config: {
      node_type: 'end',
      execution_mode: 'sequential'
    }
  },
  {
    type: 'agent',
    name: '智能体',
    icon: 'Bot',
    description: '执行智能体任务',
    default_config: {
      node_type: 'agent',
      execution_mode: 'sequential',
      retry_count: 0
    }
  },
  {
    type: 'gateway',
    name: '并行分叉',
    icon: 'GitBranch',
    description: '将流程分为多个并行分支',
    default_config: {
      node_type: 'gateway',
      gateway_type: 'parallel_split',
      execution_mode: 'parallel'
    }
  },
  {
    type: 'gateway',
    name: '并行汇聚',
    icon: 'GitMerge',
    description: '等待多个并行分支完成',
    default_config: {
      node_type: 'gateway',
      gateway_type: 'parallel_join',
      execution_mode: 'sequential',
      merge_strategy: 'all',
      upstream_nodes: []
    }
  },
  {
    type: 'condition',
    name: '条件分支',
    icon: 'GitFork',
    description: '根据条件选择执行路径',
    default_config: {
      node_type: 'condition',
      execution_mode: 'sequential',
      condition: {
        expression: ''
      }
    }
  },
  {
    type: 'delay',
    name: '延迟',
    icon: 'Clock',
    description: '等待指定时间后继续',
    default_config: {
      node_type: 'delay',
      execution_mode: 'sequential',
      timeout_seconds: 60
    }
  }
];
