import { NextRequest, NextResponse } from 'next/server';
import {
  getTicket,
  updateTicket,
  deleteTicket
} from '@/lib/ticket-store';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { TicketStatus } from '@/types/agent';

// GET /api/tickets/[id] - 获取工单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = getTicket(id);
    
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error('获取工单详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工单详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/tickets/[id] - 更新工单（流转）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // 获取原工单信息
    const oldTicket = getTicket(id);
    
    const ticket = updateTicket(id, {
      title: body.title,
      description: body.description,
      priority: body.priority,
      assignee_id: body.assignee_id,
      assignee_name: body.assignee_name,
      status: body.status as TicketStatus,
      comment: body.comment
    });
    
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }
    
    // 如果分配了新的负责人，创建任务记录
    if (body.assignee_id && body.assignee_id !== oldTicket?.assignee_id) {
      try {
        const client = getSupabaseClient();
        
        // 先检查是否已存在相同任务
        const { data: existingTask } = await client
          .from('agent_tasks')
          .select('id')
          .eq('agent_id', body.assignee_id)
          .eq('reference_id', id)
          .eq('task_type', 'ticket')
          .eq('status', 'pending')
          .single();
        
        if (!existingTask) {
          // 创建新任务
          await client
            .from('agent_tasks')
            .insert({
              agent_id: body.assignee_id,
              task_type: 'ticket',
              reference_id: id,
              title: `工单: ${ticket.title || '未命名工单'}`,
              description: ticket.description,
              priority: ticket.priority || 'medium',
              status: 'pending',
              metadata: {
                ticket_status: body.status,
                old_assignee: oldTicket?.assignee_id
              },
              assigned_at: new Date().toISOString()
            });
          
          console.log(`[Ticket] 为智能体 ${body.assignee_id} 创建任务: ${ticket.title}`);
        }
      } catch (taskError) {
        // 任务创建失败不影响工单更新
        console.error('创建智能体任务失败:', taskError);
      }
    }
    
    // 如果工单完成，更新任务状态
    if (body.status === 'closed' || body.status === 'resolved') {
      try {
        const client = getSupabaseClient();
        await client
          .from('agent_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('reference_id', id)
          .eq('task_type', 'ticket')
          .in('status', ['pending', 'in_progress']);
      } catch (taskError) {
        console.error('更新智能体任务状态失败:', taskError);
      }
    }
    
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error('更新工单失败:', error);
    return NextResponse.json(
      { success: false, error: '更新工单失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[id] - 删除工单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!deleteTicket(id)) {
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除工单失败:', error);
    return NextResponse.json(
      { success: false, error: '删除工单失败' },
      { status: 500 }
    );
  }
}
