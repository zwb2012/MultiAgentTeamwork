// 智能体类型
export type AgentType = 'llm' | 'process';

// 智能体角色类型
export type AgentRole = 
  | 'developer'      // 开发工程师
  | 'frontend_dev'   // 前端工程师
  | 'backend_dev'    // 后端工程师
  | 'tester'         // 测试工程师
  | 'reviewer'       // 代码审核员
  | 'architect'      // 架构师
  | 'pm'             // 产品经理
  | 'custom'         // 自定义

// 在线状态 - 表示智能体是否可用
export type OnlineStatus = 'online' | 'offline' | 'checking' | 'unknown';

// 工作状态 - 表示智能体当前在做什么
export type WorkStatus = 'idle' | 'working' | 'error';

// 智能体状态（兼容旧版本）
export type AgentStatus = WorkStatus | 'paused';

// 大模型配置
export interface ModelConfig {
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
  thinking?: 'enabled' | 'disabled';
  caching?: 'enabled' | 'disabled';
}

// 进程配置
export interface ProcessConfig {
  command: string;           // 启动命令
  args?: string[];           // 命令参数
  env?: Record<string, string>; // 环境变量
  cwd?: string;              // 工作目录
  platform?: 'linux' | 'windows' | 'macos' | 'auto'; // 平台
  auto_restart?: boolean;    // 自动重启
  restart_delay?: number;    // 重启延迟(毫秒)
}

// 智能体通用配置
export interface AgentConfig {
  description?: string;
  tags?: string[];
  max_concurrent_tasks?: number;
  timeout?: number;
}

// 能力标签类型 - 用于任务分发匹配
export type CapabilityTag = 'frontend' | 'backend' | 'testing' | 'review' | 'architecture' | 'general';

// 能力标签显示配置
export const CAPABILITY_TAG_CONFIG: Record<CapabilityTag, { label: string; color: string; description: string }> = {
  frontend: { 
    label: '前端开发', 
    color: 'bg-blue-500', 
    description: '擅长React、Vue、TypeScript等前端技术' 
  },
  backend: { 
    label: '后端开发', 
    color: 'bg-green-500', 
    description: '擅长Node.js、Python、数据库等后端技术' 
  },
  testing: { 
    label: '测试', 
    color: 'bg-yellow-500', 
    description: '擅长功能测试、自动化测试、性能测试' 
  },
  review: { 
    label: '代码审核', 
    color: 'bg-purple-500', 
    description: '擅长代码质量审核和最佳实践' 
  },
  architecture: { 
    label: '架构设计', 
    color: 'bg-indigo-500', 
    description: '擅长系统架构设计和技术选型' 
  },
  general: { 
    label: '通用', 
    color: 'bg-gray-500', 
    description: '可以处理各种通用任务' 
  }
};

// 健康检查结果
export interface HealthCheckResult {
  online: boolean;
  message?: string;
  latency?: number;  // 响应延迟(ms)
  checked_at?: string;
}

// 智能体
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  system_prompt: string;
  
  // 智能体类型
  agent_type: AgentType;
  
  // 项目关联
  project_id?: string;        // 绑定项目，为空表示全局模板
  is_template: boolean;       // 是否为模板
  template_id?: string;       // 从哪个模板创建的
  
  // 大模型配置
  model_config_id?: string;   // 关联大模型配置（新方式）
  model?: string;
  model_config?: ModelConfig;
  
  // 进程配置
  process_config?: ProcessConfig;
  process_pid?: number;
  
  // 状态（新）
  online_status: OnlineStatus;     // 在线状态
  work_status: WorkStatus;         // 工作状态
  
  // 状态（兼容旧版本）
  status: AgentStatus;
  is_active: boolean;
  
  // 健康检查信息
  last_health_check?: string;      // 上次检查时间
  health_check_result?: HealthCheckResult;
  
  // 其他配置
  config?: AgentConfig;
  
  // 能力标签 - 用于任务分发匹配
  capability_tags?: CapabilityTag[];
  
  created_at: string;
  updated_at?: string;
}

// 智能体模板（继承Agent，强调模板特性）
export type AgentTemplate = Omit<Agent, 'project_id' | 'is_template'> & {
  is_template: true;
  project_id?: null;
};

// 会话
export interface Conversation {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
  updated_at?: string;
}

// 会话参与者
export interface ConversationParticipant {
  id: number;
  conversation_id: string;
  agent_id: string;
  joined_at: string;
}

// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant'

// 消息
export interface Message {
  id: string;
  conversation_id: string;
  agent_id?: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

// 任务优先级
export type TaskPriority = 'low' | 'medium' | 'high'

// 任务
export interface Task {
  id: string;
  conversation_id?: string;
  agent_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  report?: string;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
}

// 工单类型
export type TicketType = 'bug' | 'feature' | 'improvement'

// 工单状态
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

// 工单优先级
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

// 工单
export interface Ticket {
  id: string;
  task_id?: string;
  type: TicketType;
  title: string;
  description?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id?: string;
  reporter_id?: string;
  project_id?: string;
  current_pipeline_run_id?: string; // 当前关联的流水线运行ID
  completed_at?: string; // 完成时间
  timeout_at?: string; // 超时时间
  created_at: string;
  updated_at?: string;
}

// 工单流转历史
export interface TicketHistory {
  id: string;
  ticket_id: string;
  from_status?: TicketStatus;
  to_status: TicketStatus;
  from_assignee_id?: string;
  to_assignee_id?: string;
  operator_id?: string;
  comment?: string;
  created_at: string;
}

// ==================== 流水线相关类型 ====================

// 流水线触发类型
export type PipelineTriggerType = 'manual' | 'scheduled' | 'webhook';

// 流水线状态
export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived';

// 节点类型
export type PipelineNodeType = 'agent' | 'task' | 'condition' | 'parallel' | 'delay';

// 执行模式
export type ExecutionMode = 'sequential' | 'parallel';

// 流水线运行状态
export type PipelineRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

// 节点运行状态
export type NodeRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

// 流水线触发配置
export interface PipelineTriggerConfig {
  schedule?: string; // cron表达式
  webhook_url?: string;
  webhook_secret?: string;
}

// 流水线配置
export interface PipelineConfig {
  timeout?: number; // 超时时间(秒)
  retry_policy?: {
    max_retries: number;
    retry_delay: number; // 重试延迟(毫秒)
  };
  notification?: {
    on_success?: boolean;
    on_failure?: boolean;
    channels?: string[]; // 通知渠道
  };
}

// 流水线
export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  trigger_type: PipelineTriggerType;
  trigger_config?: PipelineTriggerConfig;
  config?: PipelineConfig;
  status: PipelineStatus;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// 节点条件
export interface NodeCondition {
  type: 'expression' | 'output_match';
  expression?: string;
  expected_output?: string;
}

// 节点输入输出配置
export interface NodeIOConfig {
  mapping?: Record<string, string>; // 参数映射
  default?: Record<string, any>; // 默认值
}

// 流水线节点
export interface PipelineNode {
  id: string;
  pipeline_id: string;
  name: string;
  description?: string;
  node_type: PipelineNodeType;
  order_index: number;
  agent_id?: string;
  task_id?: string;
  execution_mode: ExecutionMode;
  parallel_group?: string;
  condition?: NodeCondition;
  retry_count: number;
  timeout_seconds?: number;
  input_config?: NodeIOConfig;
  output_config?: NodeIOConfig;
  created_at: string;
  updated_at?: string;
}

// 节点运行日志
export interface NodeRunLog {
  node_id: string;
  node_name: string;
  status: NodeRunStatus;
  start_time?: string;
  end_time?: string;
  output?: any;
  error?: string;
}

// 流水线运行
export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: PipelineRunStatus;
  current_node_id?: string;
  trigger_by: PipelineTriggerType;
  trigger_user?: string;
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: number;
  logs?: NodeRunLog[];
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// 流水线节点运行
export interface PipelineNodeRun {
  id: string;
  pipeline_run_id: string;
  node_id: string;
  status: NodeRunStatus;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// 创建流水线请求
export interface CreatePipelineRequest {
  name: string;
  description?: string;
  trigger_type?: PipelineTriggerType;
  trigger_config?: PipelineTriggerConfig;
  config?: PipelineConfig;
}

// 创建流水线节点请求
export interface CreatePipelineNodeRequest {
  name: string;
  description?: string;
  node_type: PipelineNodeType;
  order_index?: number;
  agent_id?: string;
  task_id?: string;
  execution_mode?: ExecutionMode;
  parallel_group?: string;
  condition?: NodeCondition;
  retry_count?: number;
  timeout_seconds?: number;
  input_config?: NodeIOConfig;
  output_config?: NodeIOConfig;
}

// 运行流水线请求
export interface RunPipelineRequest {
  input_data?: Record<string, any>;
}

// 预设角色模板
export interface AgentRoleTemplate {
  role: AgentRole;
  name: string;
  description: string;
  system_prompt: string;
  suggested_model: string;
  suggested_model_config: ModelConfig;
  agent_type: AgentType;
}

// 支持的大模型列表
export const SUPPORTED_MODELS = [
  { id: 'doubao-seed-1-8-251228', name: 'Doubao Seed 1.8 (推荐)', provider: 'doubao' },
  { id: 'doubao-seed-2-0-pro-260215', name: 'Doubao Seed 2.0 Pro', provider: 'doubao' },
  { id: 'doubao-seed-1-6-251015', name: 'Doubao Seed 1.6', provider: 'doubao' },
  { id: 'doubao-seed-1-6-vision-250815', name: 'Doubao Seed 1.6 Vision', provider: 'doubao' },
  { id: 'deepseek-v3-2-251201', name: 'DeepSeek V3.2', provider: 'deepseek' },
  { id: 'deepseek-r1-250528', name: 'DeepSeek R1', provider: 'deepseek' },
  { id: 'kimi-k2-5-260127', name: 'Kimi K2.5', provider: 'kimi' },
  { id: 'glm-4-7-251222', name: 'GLM-4-7', provider: 'zhipu' },
  { id: 'custom', name: '自定义模型', provider: 'custom' },
];

// 预设角色配置
export const AGENT_ROLE_TEMPLATES: AgentRoleTemplate[] = [
  {
    role: 'developer',
    name: '开发工程师',
    description: '负责功能开发和Bug修复',
    system_prompt: `你是一位资深的开发工程师，名字叫{name}。你具备以下能力：
1. 精通多种编程语言和框架
2. 能够快速理解需求并编写高质量代码
3. 注重代码质量、可维护性和性能优化
4. 善于解决复杂的技术问题
5. 会主动进行单元测试和代码自检

工作流程：
1. 接到开发任务后，先分析需求
2. 设计实现方案
3. 编写代码并自测
4. 提交代码审核
5. 根据审核意见修改
6. 通知测试进行验证

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

请始终保持专业、高效的工作态度。`,
    suggested_model: 'doubao-seed-1-8-251228',
    suggested_model_config: {
      temperature: 0.3,
      thinking: 'enabled',
      caching: 'enabled'
    },
    agent_type: 'llm'
  },
  {
    role: 'frontend_dev',
    name: '前端工程师',
    description: '专注于用户界面和交互开发',
    system_prompt: `你是一位专业的前端工程师，名字叫{name}。你擅长：
1. React、Vue、Next.js等现代前端框架
2. TypeScript类型系统
3. CSS/样式系统和UI组件库
4. 前端性能优化和用户体验
5. 响应式设计和跨浏览器兼容

开发规范：
1. 组件化开发，保持代码复用性
2. 遵循团队编码规范
3. 注重可访问性和用户体验
4. 进行浏览器兼容性测试
5. 与后端工程师紧密协作

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

完成开发后，主动通知后端工程师进行联调。`,
    suggested_model: 'doubao-seed-1-8-251228',
    suggested_model_config: {
      temperature: 0.3,
      caching: 'enabled'
    },
    agent_type: 'llm'
  },
  {
    role: 'backend_dev',
    name: '后端工程师',
    description: '负责服务端架构和API开发',
    system_prompt: `你是一位经验丰富的后端工程师，名字叫{name}。你精通：
1. Node.js、Python、Go等后端语言
2. 数据库设计与优化
3. API设计和RESTful规范
4. 微服务架构和分布式系统
5. 安全性、性能和可扩展性

开发流程：
1. 理解业务需求和技术架构
2. 设计API接口和数据模型
3. 实现业务逻辑
4. 编写单元测试和集成测试
5. 优化性能和安全性
6. 提供API文档给前端工程师

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

与前端工程师协作时，主动提供接口文档和测试数据。`,
    suggested_model: 'doubao-seed-1-8-251228',
    suggested_model_config: {
      temperature: 0.3,
      thinking: 'enabled'
    },
    agent_type: 'llm'
  },
  {
    role: 'tester',
    name: '测试工程师',
    description: '负责质量保障和测试',
    system_prompt: `你是一位严谨的测试工程师，名字叫{name}。你的职责包括：
1. 功能测试和回归测试
2. 编写测试用例和测试计划
3. Bug报告和缺陷跟踪
4. 自动化测试脚本开发
5. 性能测试和安全测试

测试流程：
1. 分析需求文档，设计测试用例
2. 执行测试并记录结果
3. 发现Bug时创建详细工单
4. 跟踪Bug修复进度
5. 回归验证修复效果
6. 输出测试报告

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

发现Bug时，请提供：
- 重现步骤
- 预期结果 vs 实际结果
- 优先级评估
- 截图或日志（如有）`,
    suggested_model: 'doubao-seed-1-6-251015',
    suggested_model_config: {
      temperature: 0.5,
      caching: 'enabled'
    },
    agent_type: 'llm'
  },
  {
    role: 'reviewer',
    name: '代码审核员',
    description: '负责代码质量审核',
    system_prompt: `你是一位资深的代码审核员，名字叫{name}。你的审核标准包括：
1. 代码规范和最佳实践
2. 潜在Bug和逻辑错误
3. 性能问题
4. 安全漏洞
5. 可维护性和可读性

审核流程：
1. 检查代码是否符合规范
2. 评估实现方案是否合理
3. 发现潜在问题并提出建议
4. 确认测试覆盖率
5. 给出审核结论：通过/需修改/拒绝

审核反馈格式：
- 问题级别：严重/一般/建议
- 具体位置：文件名、行号
- 问题描述：清晰说明问题
- 改进建议：如何修复

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

审核通过后，通知开发工程师合并代码，并通知测试工程师进行测试。`,
    suggested_model: 'doubao-seed-1-8-251228',
    suggested_model_config: {
      temperature: 0.3,
      thinking: 'enabled'
    },
    agent_type: 'llm'
  },
  {
    role: 'architect',
    name: '架构师',
    description: '负责系统架构设计',
    system_prompt: `你是一位经验丰富的系统架构师，名字叫{name}。你负责：
1. 系统架构设计和技术选型
2. 技术方案评审
3. 性能优化和扩展性规划
4. 技术债务管理
5. 最佳实践推广

架构原则：
1. 高可用性和容错性
2. 可扩展性和灵活性
3. 安全性和合规性
4. 可维护性和可观测性
5. 成本效益

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

输出架构设计文档时包含：
- 系统架构图
- 技术选型理由
- 数据流向
- 关键技术点
- 风险评估和应对方案`,
    suggested_model: 'doubao-seed-2-0-pro-260215',
    suggested_model_config: {
      temperature: 0.5,
      thinking: 'enabled'
    },
    agent_type: 'llm'
  },
  {
    role: 'pm',
    name: '产品经理',
    description: '负责产品规划和需求管理',
    system_prompt: `你是一位专业的产品经理，名字叫{name}。你的职责包括：
1. 产品规划和需求分析
2. 用户研究和市场调研
3. 需求文档编写
4. 项目管理和进度跟踪
5. 跨团队协调

工作流程：
1. 收集和分析需求
2. 编写产品需求文档(PRD)
3. 与开发团队沟通需求
4. 跟踪开发进度
5. 验收交付成果
6. 收集用户反馈

重要提示：
- 当有人在对话中提到你的名字"{name}"时，就是在和你说话，请积极响应
- 你要清楚地知道自己是{name}，当被问及身份时请正确回答
- 与其他智能体协作时，请称呼它们的名字进行交流

PRD文档包含：
- 功能描述
- 用户场景
- 验收标准
- 优先级和排期
- 风险评估`,
    suggested_model: 'doubao-seed-1-6-251015',
    suggested_model_config: {
      temperature: 0.6
    },
    agent_type: 'llm'
  }
];

// ==================== 智能体任务队列 ====================

// 智能体任务类型
export type AgentTaskType = 'ticket' | 'conversation' | 'pipeline' | 'mention';

// 智能体任务状态
export type AgentTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// 智能体任务
export interface AgentTask {
  id: string;
  agent_id: string;              // 分配给的智能体
  task_type: AgentTaskType;      // 任务类型
  reference_id: string;          // 关联ID（工单ID/会话ID等）
  title: string;                 // 任务标题
  description?: string;          // 任务描述
  priority?: TicketPriority;     // 优先级
  status: AgentTaskStatus;       // 任务状态
  metadata?: Record<string, any>;// 扩展信息
  assigned_at: string;           // 分配时间
  due_date?: string;             // 截止时间
  completed_at?: string;         // 完成时间
  created_at: string;
  updated_at?: string;
}

// 智能体任务摘要
export interface AgentTaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  by_priority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  by_type: {
    ticket: number;
    conversation: number;
    pipeline: number;
    mention: number;
  };
}

// 创建智能体任务请求
export interface CreateAgentTaskRequest {
  agent_id: string;
  task_type: AgentTaskType;
  reference_id: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  due_date?: string;
  metadata?: Record<string, any>;
}
