/**
 * 会话相关类型定义
 */

// 会话类型
export type ConversationType = 
  | 'lobby'    // 大厅模式：所有人可见，所有智能体参与
  | 'private'  // 私聊模式：1对1对话
  | 'group'    // 群组模式：多智能体协作
  | 'pipeline'; // 流水线专属：流水线执行时的协作会话

// 会话状态
export type ConversationStatus = 'active' | 'archived' | 'completed';

// 会话配置
export interface ConversationConfig {
  // 大厅模式配置
  is_public?: boolean;
  
  // 群组模式配置
  allow_invite?: boolean;
  
  // 流水线专属配置
  pipeline_run_id?: string;
  auto_notify?: boolean; // 节点完成时自动通知
}

// 会话参与者
export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  agent_id: string;
  agent_name?: string;
  role: 'owner' | 'member' | 'observer';
  joined_at: string;
}

// 会话
export interface Conversation {
  id: string;
  title: string;
  description?: string;
  type: ConversationType;
  status: ConversationStatus;
  
  // 配置
  config?: ConversationConfig;
  
  // 元数据
  created_at: string;
  updated_at?: string;
  
  // 参与者（关联查询）
  participants?: ConversationParticipant[];
  
  // 最后消息预览
  last_message?: {
    content: string;
    agent_name: string;
    created_at: string;
  };
  
  // 未读消息数
  unread_count?: number;
}

// 消息类型
export type MessageType = 
  | 'text'           // 普通文本
  | 'system'         // 系统消息
  | 'task_start'     // 任务开始
  | 'task_complete'  // 任务完成
  | 'task_failed'    // 任务失败
  | 'notification'   // 通知
  | 'node_transfer'; // 节点流转通知

// 消息
export interface Message {
  id: string;
  conversation_id: string;
  agent_id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  message_type: MessageType;
  
  // 元数据
  metadata?: {
    task_id?: string;
    node_id?: string;
    pipeline_run_id?: string;
    transfer_from?: string; // 流转来源节点
    transfer_to?: string;   // 流转目标节点
    [key: string]: any;
  };
  
  created_at: string;
}
