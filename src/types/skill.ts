/**
 * 技能系统类型定义
 * 支持智能体技能插槽系统，类似扣子空间的技能机制
 */

/**
 * 技能类别
 */
export type SkillCategory = 'code' | 'text' | 'analysis' | 'design' | 'integration';

/**
 * 函数参数定义
 */
export interface FunctionParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: FunctionParameter;
  properties?: Record<string, FunctionParameter>;
  required?: string[];
  default?: any;
}

/**
 * 函数定义（用于 Function Calling）
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

/**
 * 技能执行结果
 */
export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time: number;
    tokens_used?: number;
    model_used?: string;
  };
}

/**
 * 技能执行器函数
 */
export type SkillExecutor = (params: any, context?: any) => Promise<SkillResult>;

/**
 * 技能配置
 */
export interface SkillConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeout?: number;
}

/**
 * 技能定义
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;

  // 能力定义
  capabilities: {
    // Function Calling 定义
    function_definition: FunctionDefinition;

    // 执行逻辑（本地实现）
    executor: SkillExecutor;

    // 是否需要LLM生成内容
    requires_llm: boolean;

    // 是否需要本地执行（文件操作等）
    requires_local_execution: boolean;
  };

  // 技能配置
  config?: SkillConfig;

  // 技能图标（用于UI展示）
  icon?: string;

  // 是否为组合技能
  is_composite?: boolean;

  // 子技能（用于组合技能）
  sub_skills?: string[];

  // 技能标签
  tags?: string[];
}

/**
 * 智能体技能配置
 */
export interface AgentSkillConfig {
  agent_id: string;
  enabled_skills: string[];      // 启用的技能ID列表
  skill_priorities?: Record<string, number>;  // 技能优先级
  skill_combinations?: {         // 技能组合规则
    trigger_conditions: string;
    skills_to_use: string[];
    execution_order: string[];
  }[];
  created_at?: string;
  updated_at?: string;
}

/**
 * 技能执行记录
 */
export interface SkillExecution {
  id: number;
  skill_id: string;
  agent_id: string;
  pipeline_run_id?: string;
  node_id?: string;
  params: any;
  result: SkillResult;
  execution_time: number;
  success: boolean;
  created_at: string;
}

/**
 * 技能路由结果
 */
export interface SkillRoutingResult {
  skills: Skill[];
  reasoning: string;
  estimated_complexity?: 'low' | 'medium' | 'high';
}

/**
 * 项目上下文
 */
export interface ProjectContext {
  project_id: string;
  project_name: string;
  local_path: string;
  git_url?: string;
  git_branch?: string;
  description?: string;
}
