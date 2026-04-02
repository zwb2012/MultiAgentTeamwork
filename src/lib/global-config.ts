/**
 * 全局配置存储
 * 使用JSON文件存储全局配置（如API Key）
 */

import * as path from 'path';
import * as fs from 'fs';
import { initDataDirs, DATA_DIR } from './file-store';

// 全局配置文件路径
const GLOBAL_CONFIG_FILE = path.join(DATA_DIR, 'global-config.json');

// 全局配置类型
export interface GlobalConfig {
  // LLM默认配置
  llm: {
    default_api_key: string;
    default_base_url: string;
    default_model: string;
  };
  
  // Git 配置
  git: {
    user_name: string;        // Git 用户名
    user_email: string;       // Git 邮箱
    default_branch: string;   // 默认分支
    token?: string;           // 全局 Git Token（加密存储）
  };
  
  // 其他配置
  settings: {
    auto_health_check: boolean;  // 创建智能体后自动检测
    health_check_interval: number; // 自动检测间隔（分钟）
  };
  
  // 更新时间
  updated_at?: string;
}

// 默认配置
const DEFAULT_CONFIG: GlobalConfig = {
  llm: {
    default_api_key: '',
    default_base_url: 'https://api.coze.cn',
    default_model: 'doubao-seed-1-8-251228'
  },
  git: {
    user_name: 'AI Agent',
    user_email: 'agent@ai.local',
    default_branch: 'main',
    token: undefined
  },
  settings: {
    auto_health_check: true,
    health_check_interval: 30
  }
};

/**
 * 初始化配置
 */
initDataDirs();

/**
 * 读取全局配置
 */
export function getGlobalConfig(): GlobalConfig {
  try {
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const content = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.error('读取全局配置失败:', error);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存全局配置
 */
export function saveGlobalConfig(config: Partial<GlobalConfig>): GlobalConfig {
  const currentConfig = getGlobalConfig();
  const newConfig: GlobalConfig = {
    ...currentConfig,
    ...config,
    updated_at: new Date().toISOString()
  };
  
  // 保存LLM配置
  if (config.llm) {
    newConfig.llm = { ...currentConfig.llm, ...config.llm };
  }
  
  // 保存 Git 配置
  if (config.git) {
    newConfig.git = { ...currentConfig.git, ...config.git };
  }
  
  // 保存设置
  if (config.settings) {
    newConfig.settings = { ...currentConfig.settings, ...config.settings };
  }
  
  try {
    fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    return newConfig;
  } catch (error) {
    console.error('保存全局配置失败:', error);
    throw error;
  }
}

/**
 * 获取有效的API配置
 * 优先使用智能体自己的配置，否则使用全局配置
 */
export function getEffectiveAPIConfig(agentConfig?: {
  api_key?: string;
  base_url?: string;
}): {
  api_key: string;
  base_url: string;
} {
  const globalConfig = getGlobalConfig();
  
  return {
    api_key: agentConfig?.api_key || globalConfig.llm.default_api_key,
    base_url: agentConfig?.base_url || globalConfig.llm.default_base_url
  };
}

/**
 * 检查是否配置了全局API Key
 */
export function hasGlobalAPIKey(): boolean {
  const config = getGlobalConfig();
  return !!config.llm.default_api_key;
}

/**
 * 获取有效的 Git Token
 * 优先使用项目自己的配置，否则使用全局配置
 */
export function getEffectiveGitToken(projectToken?: string): string | undefined {
  if (projectToken) {
    return projectToken;
  }
  const globalConfig = getGlobalConfig();
  return globalConfig.git.token;
}

/**
 * 获取 Git 用户配置
 */
export function getGitUserConfig(): {
  user_name: string;
  user_email: string;
  default_branch: string;
} {
  const globalConfig = getGlobalConfig();
  return {
    user_name: globalConfig.git.user_name,
    user_email: globalConfig.git.user_email,
    default_branch: globalConfig.git.default_branch
  };
}
