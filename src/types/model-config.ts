// 大模型提供商类型
export type ModelProvider =
  | 'doubao'
  | 'deepseek'
  | 'kimi'
  | 'zhipu'
  | 'openai'
  | 'anthropic'
  | 'custom';

// 大模型配置状态
export type ModelConfigStatus = 'active' | 'inactive' | 'testing';

// 大模型配置
export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  
  // 连接配置
  api_key: string;
  base_url?: string;
  
  // 默认模型和参数
  default_model?: string;
  available_models?: string[];
  
  // 高级参数（默认值）
  temperature?: number;
  max_tokens?: number;
  thinking?: 'enabled' | 'disabled';
  caching?: 'enabled' | 'disabled';
  
  // 元数据
  status: ModelConfigStatus;
  last_tested_at?: string;
  test_result?: {
    success: boolean;
    message?: string;
    latency?: number;
    available_models?: string[];
  };
  
  created_at: string;
  updated_at?: string;
}

// 创建大模型配置请求
export interface CreateModelConfigRequest {
  name: string;
  provider: ModelProvider;
  api_key: string;
  base_url?: string;
  default_model?: string;
  temperature?: number;
  max_tokens?: number;
  thinking?: 'enabled' | 'disabled';
  caching?: 'enabled' | 'disabled';
}

// 更新大模型配置请求
export interface UpdateModelConfigRequest {
  name?: string;
  api_key?: string;
  base_url?: string;
  default_model?: string;
  temperature?: number;
  max_tokens?: number;
  thinking?: 'enabled' | 'disabled';
  caching?: 'enabled' | 'disabled';
  status?: ModelConfigStatus;
}

// 测试大模型配置请求
export interface TestModelConfigRequest {
  provider: ModelProvider;
  api_key: string;
  base_url?: string;
}

// 测试结果
export interface TestModelConfigResult {
  success: boolean;
  message?: string;
  latency?: number;
  available_models?: string[];
}

// 提供商配置（用于UI显示）
export const PROVIDER_CONFIG: Record<ModelProvider, { 
  label: string; 
  defaultBaseUrl: string;
  defaultModels: string[];
  color: string;
}> = {
  doubao: {
    label: '豆包 (Doubao)',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModels: ['doubao-seed-1-8-251228', 'doubao-seed-2-0-pro-260215', 'doubao-seed-1-6-251015'],
    color: 'bg-blue-500'
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    color: 'bg-purple-500'
  },
  kimi: {
    label: '月之暗面 (Kimi)',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    color: 'bg-red-500'
  },
  zhipu: {
    label: '智谱 (GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4', 'glm-4-plus', 'glm-4-flash'],
    color: 'bg-green-500'
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    color: 'bg-emerald-500'
  },
  anthropic: {
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
    color: 'bg-orange-500'
  },
  custom: {
    label: '自定义 (Custom)',
    defaultBaseUrl: '',
    defaultModels: [],
    color: 'bg-gray-500'
  }
};
