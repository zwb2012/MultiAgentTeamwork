import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { AgentTask } from '@/types/agent';

/**
 * 获取智能体的待办任务
 */
export async function getAgentTasks(agentId: string): Promise<AgentTask[]> {
  try {
    const client = getSupabaseClient();
    
    const { data: tasks, error } = await client
      .from('agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: false })
      .order('assigned_at', { ascending: true })
      .limit(10);
    
    if (error) {
      console.error('获取智能体任务失败:', error);
      return [];
    }
    
    return tasks || [];
  } catch (error) {
    console.error('获取智能体任务失败:', error);
    return [];
  }
}

/**
 * 格式化任务列表为文本
 */
export function formatTasksForPrompt(tasks: AgentTask[]): string {
  if (!tasks || tasks.length === 0) {
    return '暂无待处理任务。';
  }
  
  const lines: string[] = [];
  
  // 按类型分组
  const tickets = tasks.filter(t => t.task_type === 'ticket');
  const conversations = tasks.filter(t => t.task_type === 'conversation' || t.task_type === 'mention');
  const pipelines = tasks.filter(t => t.task_type === 'pipeline');
  
  if (tickets.length > 0) {
    lines.push(`\n📋 工单任务 (${tickets.length}个):`);
    tickets.forEach((t, i) => {
      const priority = t.priority === 'critical' ? '🔴' : 
                       t.priority === 'high' ? '🟠' : 
                       t.priority === 'medium' ? '🟡' : '🟢';
      const status = t.status === 'in_progress' ? '[进行中]' : '[待处理]';
      lines.push(`  ${i + 1}. ${priority} ${status} ${t.title}`);
    });
  }
  
  if (conversations.length > 0) {
    lines.push(`\n💬 会话邀请 (${conversations.length}个):`);
    conversations.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.title}`);
    });
  }
  
  if (pipelines.length > 0) {
    lines.push(`\n🔄 流水线任务 (${pipelines.length}个):`);
    pipelines.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.title}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * 注入任务上下文到系统提示词
 */
export function injectTaskContext(
  systemPrompt: string,
  tasks: AgentTask[]
): string {
  if (!tasks || tasks.length === 0) {
    return systemPrompt;
  }
  
  const taskContext = formatTasksForPrompt(tasks);
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  
  const taskPrompt = `

## 📌 当前任务状态
你当前有 ${pendingCount} 个待处理任务，${inProgressCount} 个进行中的任务。
${taskContext}

### 任务处理提示
- 当用户询问你的工作或任务时，请告知当前的待办事项
- 如果有高优先级任务，请主动提醒用户
- 完成任务后，请告知用户可以更新任务状态
`;

  // 在原有提示词后追加任务上下文
  return systemPrompt + taskPrompt;
}

/**
 * 为智能体创建任务
 */
export async function createAgentTask(params: {
  agentId: string;
  taskType: 'ticket' | 'conversation' | 'pipeline' | 'mention';
  referenceId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}): Promise<AgentTask | null> {
  try {
    const client = getSupabaseClient();
    
    const { data: task, error } = await client
      .from('agent_tasks')
      .insert({
        agent_id: params.agentId,
        task_type: params.taskType,
        reference_id: params.referenceId,
        title: params.title,
        description: params.description,
        priority: params.priority || 'medium',
        status: 'pending',
        metadata: params.metadata,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('创建智能体任务失败:', error);
      return null;
    }
    
    return task;
  } catch (error) {
    console.error('创建智能体任务失败:', error);
    return null;
  }
}

/**
 * 更新任务状态
 */
export async function updateAgentTaskStatus(
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { error } = await client
      .from('agent_tasks')
      .update(updateData)
      .eq('id', taskId);
    
    return !error;
  } catch (error) {
    console.error('更新任务状态失败:', error);
    return false;
  }
}
