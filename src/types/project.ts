/**
 * 项目管理相关类型定义
 */

// 同步状态
export type SyncStatus = 
  | 'pending'   // 待同步
  | 'syncing'   // 同步中
  | 'success'   // 同步成功
  | 'failed';   // 同步失败

// 同步类型
export type SyncType = 
  | 'auto'     // 自动同步
  | 'manual'   // 手动同步
  | 'webhook'; // Webhook触发

// 项目配置
export interface ProjectConfig {
  // 构建命令
  build_command?: string;
  
  // 测试命令
  test_command?: string;
  
  // 部署命令
  deploy_command?: string;
  
  // 其他配置
  [key: string]: any;
}

// 本地路径配置（支持多平台）
export interface LocalPathConfig {
  // Windows 路径
  windows?: string;  // 例如: D:\projects\my-project
  
  // Linux 路径
  linux?: string;    // 例如: /home/projects/my-project
  
  // macOS 路径
  macos?: string;    // 例如: /Users/dev/projects/my-project
  
  // 默认路径（当当前平台未配置时使用）
  default?: string;  // 例如: /tmp/projects/my-project
}

// 项目
export interface Project {
  id: string;
  
  // 基本信息
  name: string;
  description?: string;
  
  // Git 仓库配置
  git_url: string;
  git_branch: string;
  git_token?: string; // 前端显示时会被掩码
  
  // 同步配置
  sync_enabled: boolean;
  sync_interval: number; // 秒
  last_sync_at?: string;
  next_sync_at?: string;
  
  // 同步状态
  sync_status: SyncStatus;
  sync_error?: string;
  last_commit_sha?: string;
  
  // 本地存储路径配置（支持多平台）
  local_path_config?: LocalPathConfig;
  
  // 实际使用的本地路径（运行时确定）
  local_path?: string;
  
  // 项目配置
  config?: ProjectConfig;
  
  // 状态
  is_active: boolean;
  
  // 时间戳
  created_at: string;
  updated_at?: string;
}

// 同步历史记录
export interface ProjectSyncHistory {
  id: string;
  project_id: string;
  
  // 同步类型
  sync_type: SyncType;
  
  // 同步状态
  status: 'running' | 'success' | 'failed';
  
  // Git 信息
  before_commit_sha?: string;
  after_commit_sha?: string;
  commits_count: number;
  
  // 同步详情
  changes?: {
    added?: string[];
    modified?: string[];
    deleted?: string[];
  };
  error_message?: string;
  
  // 时间记录
  started_at: string;
  completed_at?: string;
}

// 创建项目请求
export interface CreateProjectRequest {
  name: string;
  description?: string;
  git_url: string;
  git_branch?: string;
  git_token?: string;
  sync_enabled?: boolean;
  sync_interval?: number;
  local_path_config?: LocalPathConfig;
  config?: ProjectConfig;
}

// 更新项目请求
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  git_url?: string;
  git_branch?: string;
  git_token?: string;
  sync_enabled?: boolean;
  sync_interval?: number;
  local_path_config?: LocalPathConfig;
  config?: ProjectConfig;
  is_active?: boolean;
}

// 同步间隔选项
export const SYNC_INTERVAL_OPTIONS = [
  { value: 60, label: '每1分钟' },
  { value: 300, label: '每5分钟' },
  { value: 600, label: '每10分钟' },
  { value: 1800, label: '每30分钟' },
  { value: 3600, label: '每1小时' },
  { value: 21600, label: '每6小时' },
  { value: 43200, label: '每12小时' },
  { value: 86400, label: '每24小时' },
];

// 同步状态显示配置
export const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待同步', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  syncing: { label: '同步中', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  success: { label: '同步成功', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: '同步失败', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// 平台类型
export type Platform = 'windows' | 'linux' | 'macos';

// 平台显示配置
export const PLATFORM_CONFIG: Record<Platform, { label: string; placeholder: string; example: string }> = {
  windows: { 
    label: 'Windows', 
    placeholder: 'D:\\projects\\my-project',
    example: '例如: D:\\projects\\my-project'
  },
  linux: { 
    label: 'Linux', 
    placeholder: '/home/projects/my-project',
    example: '例如: /home/projects/my-project'
  },
  macos: { 
    label: 'macOS', 
    placeholder: '/Users/dev/projects/my-project',
    example: '例如: /Users/dev/projects/my-project'
  }
};
