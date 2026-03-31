import { NextRequest, NextResponse } from 'next/server';
import {
  getTicket,
  updateTicket,
  deleteTicket
} from '@/lib/ticket-store';
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
