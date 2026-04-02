/**
 * 工单数据库存储层
 * 使用 Supabase + Drizzle ORM
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { TicketStatus, TicketType, TicketPriority } from '@/types/agent';

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 工单类型定义
 */
export interface Ticket {
  id: string;
  project_id?: string;
  task_id?: string;
  type: TicketType;
  title: string;
  description?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id?: string;
  assignee?: { id: string; name: string } | null;
  reporter_id?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

/**
 * 获取所有工单
 */
export async function getAllTickets(projectId?: string): Promise<Ticket[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('获取工单列表失败:', error);
    return [];
  }
  
  return (data || []).map(t => ({
    id: t.id,
    project_id: t.project_id,
    task_id: t.task_id,
    type: t.type,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    assignee_id: t.assignee_id,
    assignee: null,
    reporter_id: t.reporter_id,
    created_at: t.created_at,
    updated_at: t.updated_at,
    completed_at: t.completed_at
  }));
}

/**
 * 获取工单详情
 */
export async function getTicket(id: string): Promise<Ticket | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    id: data.id,
    project_id: data.project_id,
    task_id: data.task_id,
    type: data.type,
    title: data.title,
    description: data.description,
    priority: data.priority,
    status: data.status,
    assignee_id: data.assignee_id,
    assignee: null,
    reporter_id: data.reporter_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    completed_at: data.completed_at
  };
}

/**
 * 创建工单
 */
export async function createTicket(input: {
  type: TicketType;
  title: string;
  description?: string;
  priority: TicketPriority;
  project_id?: string;
  assignee_id?: string;
  assignee_name?: string;
}): Promise<Ticket> {
  const client = getSupabaseClient();
  const id = generateId().substring(0, 8);
  const now = new Date().toISOString();
  
  const { data, error } = await client
    .from('tickets')
    .insert({
      id,
      project_id: input.project_id,
      type: input.type,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: 'open',
      assignee_id: input.assignee_id,
      created_at: now
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`创建工单失败: ${error?.message}`);
  }
  
  return getTicket(id) as Promise<Ticket>;
}

/**
 * 更新工单
 */
export async function updateTicket(id: string, input: {
  title?: string;
  description?: string;
  type?: TicketType;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignee_id?: string;
}): Promise<Ticket | null> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();
  
  const updateData: Record<string, any> = {
    updated_at: now
  };
  
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.assignee_id !== undefined) updateData.assignee_id = input.assignee_id;
  
  // 如果状态变为 resolved 或 closed，设置完成时间
  if (input.status === 'resolved' || input.status === 'closed') {
    updateData.completed_at = now;
  }
  
  const { error } = await client
    .from('tickets')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('更新工单失败:', error);
    return null;
  }
  
  return getTicket(id);
}

/**
 * 更新工单状态（流转）
 */
export async function updateTicketStatus(
  id: string, 
  newStatus: TicketStatus,
  comment?: string,
  operatorId?: string
): Promise<Ticket | null> {
  const client = getSupabaseClient();
  
  // 获取当前工单信息
  const ticket = await getTicket(id);
  if (!ticket) return null;
  
  const now = new Date().toISOString();
  
  // 更新工单状态
  const updateData: Record<string, any> = {
    status: newStatus,
    updated_at: now
  };
  
  if (newStatus === 'resolved' || newStatus === 'closed') {
    updateData.completed_at = now;
  }
  
  const { error } = await client
    .from('tickets')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('更新工单状态失败:', error);
    return null;
  }
  
  // 记录流转历史
  await client
    .from('ticket_history')
    .insert({
      id: generateId(),
      ticket_id: id,
      from_status: ticket.status,
      to_status: newStatus,
      from_assignee_id: ticket.assignee_id,
      to_assignee_id: ticket.assignee_id,
      operator_id: operatorId,
      comment: comment,
      created_at: now
    });
  
  return getTicket(id);
}

/**
 * 删除工单
 */
export async function deleteTicket(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('tickets')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('删除工单失败:', error);
    return false;
  }
  
  return true;
}

/**
 * 获取工单流转历史
 */
export async function getTicketHistory(ticketId: string): Promise<any[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('ticket_history')
    .select(`
      *,
      operators:ticket_history_operator_id_fkey (id, name),
      from_assignee:ticket_history_from_assignee_id_fkey (id, name),
      to_assignee:ticket_history_to_assignee_id_fkey (id, name)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取工单历史失败:', error);
    return [];
  }
  
  return data || [];
}
