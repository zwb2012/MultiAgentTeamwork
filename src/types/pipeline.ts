/**
 * 流水线相关类型定义
 */

import type { Agent } from './agent';

// ============================================
// 流水线状态机
// ============================================
// 
// 状态转换规则：
// draft → published (发布)
// published → draft (撤回编辑)
// published → running (执行)
// running → success / failed / cancelled (执行结束)
// success/failed/cancelled → published (重新执行)
// published → archived (归档)
// archived → draft (恢复编辑)
//
// ============================================

// 流水线定义状态（元数据状态）
export type PipelineDefinitionStatus = 'draft' | 'published' | 'archived';

// 流水线运行状态（实例状态）
export type PipelineRunStatus = 'idle' | 'running' | 'success' | 'failed' | 'cancelled';

// 兼容旧版本的流水线状态
export type PipelineStatus = PipelineDefinitionStatus;

// 流水线完整状态（组合定义状态和运行状态）
export interface PipelineFullStatus {
  definition_status: PipelineDefinitionStatus;
  run_status: PipelineRunStatus;
}

// 状态配置
export const PIPELINE_STATUS_CONFIG = {
  draft: {
    label: '草稿',
    description: '编辑中，不可执行',
    color: 'bg-gray-100 text-gray-700',
    borderColor: 'border-gray-300',
    icon: 'Edit'
  },
  published: {
    label: '已发布',
    description: '可以执行',
    color: 'bg-green-100 text-green-700',
    borderColor: 'border-green-400',
    icon: 'CheckCircle'
  },
  archived: {
    label: '已归档',
    description: '已停用',
    color: 'bg-gray-100 text-gray-500',
    borderColor: 'border-gray-300',
    icon: 'Archive'
  }
} as const;

// 运行状态配置
export const PIPELINE_RUN_STATUS_CONFIG = {
  idle: {
    label: '空闲',
    description: '未运行',
    color: 'bg-gray-50 text-gray-600',
    icon: 'Circle'
  },
  running: {
    label: '运行中',
    description: '正在执行',
    color: 'bg-blue-100 text-blue-700',
    icon: 'Loader2'
  },
  success: {
    label: '执行成功',
    description: '已完成',
    color: 'bg-green-100 text-green-700',
    icon: 'CheckCircle2'
  },
  failed: {
    label: '执行失败',
    description: '出现错误',
    color: 'bg-red-100 text-red-700',
    icon: 'XCircle'
  },
  cancelled: {
    label: '已取消',
    description: '手动取消',
    color: 'bg-yellow-100 text-yellow-700',
    icon: 'MinusCircle'
  }
} as const;

// 流水线触发类型
export type TriggerType = 'manual' | 'scheduled' | 'webhook';

// 节点类型
export type NodeType = 
  | 'agent'      // 智能体节点
  | 'task'       // 任务节点
  | 'gateway'    // 网关节点
  | 'parallel'   // 并行网关节点（简化版，替代gateway）
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

// 条件类型
export type ConditionType = 
  | 'expression'    // 表达式求值
  | 'output_match'  // 输出匹配
  | 'script';       // 自定义脚本

// 循环配置
export interface LoopConfig {
  // 是否为循环边
  isLoop: boolean;
  
  // 循环条件（表达式）
  loopCondition?: string; // 例如: "{{output.bugs.length}} > 0"
  
  // 最大循环次数
  maxIterations: number; // 默认: 10
  
  // 循环数据映射（每次循环携带的数据）
  carryOver?: string[]; // 例如: ["bugs", "testReport"]
  
  // 循环提示词（发送给循环目标节点的额外提示）
  loopPrompt?: string;
}

// 条件分支配置
export interface ConditionBranch {
  // 分支ID
  id: string;
  
  // 分支名称
  label: string;
  
  // 条件值（当表达式结果等于此值时走此分支）
  conditionValue: any;
  
  // 目标节点ID
  targetNodeId: string;
  
  // 是否为循环分支
  isLoop: boolean;
  
  // 循环配置（当 isLoop 为 true 时）
  loopConfig?: LoopConfig;
}

// 条件网关配置
export interface ConditionConfig {
  // 条件类型
  conditionType: ConditionType;
  
  // 条件表达式
  expression: string; // 例如: "{{output.status}} === 'passed'"
  
  // 分支配置列表
  branches: ConditionBranch[];
  
  // 默认分支ID（当所有条件都不满足时）
  defaultBranchId?: string;
}

// 执行模式
export type ExecutionMode = 'sequential' | 'parallel';

// 汇聚策略
export type MergeStrategy = 
  | 'all'     // 所有上游节点完成
  | 'any'     // 任一上游节点完成
  | 'custom'; // 自定义条件

// 任务类型（用于任务分发匹配）
export type TaskType = 
  | 'frontend'   // 前端任务
  | 'backend'    // 后端任务
  | 'testing'    // 测试任务
  | 'review'     // 代码审核
  | 'architecture' // 架构设计
  | 'general';   // 通用任务

// 任务类型标签
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  testing: '测试',
  review: '代码审核',
  architecture: '架构设计',
  general: '通用'
};

// 任务类型颜色
export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  frontend: 'bg-blue-500',
  backend: 'bg-green-500',
  testing: 'bg-yellow-500',
  review: 'bg-purple-500',
  architecture: 'bg-indigo-500',
  general: 'bg-gray-500'
};

// 节点输出映射（任务分发配置）
export interface OutputMapping {
  // 目标节点ID
  targetNodeId: string;
  
  // 任务类型标签
  taskType: TaskType;
  
  // 发送给下游的消息模板
  template?: string;
  
  // 输出数据提取字段
  extractFields?: string[];
  
  // 条件判断
  condition?: string;
}

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
  condition_config?: ConditionConfig;
  
  // 条件配置（旧版，保持兼容）
  condition?: {
    expression: string;
    true_node_id?: string;
    false_node_id?: string;
  };
  
  // 额外配置
  config?: {
    parallelType?: 'split' | 'join';
    
    // 任务分发配置
    outputMappings?: OutputMapping[];
    
    [key: string]: any;
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

// 工单类型
export type TicketType = 'bug' | 'feature' | 'improvement' | 'task';

// 工单信息（作为流水线输入）
export interface TicketInput {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  labels?: string[];
}

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
  
  // 工单信息
  ticket_id?: string;
  ticket_type?: TicketType;
  
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
  
  // 项目关联
  project_id?: string;
  
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
  
  // 定义状态：draft, published, archived
  status: PipelineDefinitionStatus;
  
  // 运行状态：idle, running, success, failed, cancelled
  run_status: PipelineRunStatus;
  
  // 当前运行ID
  current_run_id?: string;
  
  // 最后运行信息
  last_run_at?: string;
  last_run_status?: RunStatus;
  
  is_active: boolean;
  
  // 时间戳
  created_at: string;
  updated_at?: string;
  
  // 节点列表（关联查询）
  nodes?: PipelineNode[];
  
  // 边列表（可视化连接）
  edges?: Array<{
    id?: string;
    source: string;
    target: string;
    data?: {
      label?: string;
      condition?: string;
      isLoop?: boolean;
      loopConfig?: LoopConfig;
    };
  }>;
  
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
