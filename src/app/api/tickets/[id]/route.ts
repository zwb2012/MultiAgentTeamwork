import { NextRequest, NextResponse } from 'next/server';
import {
  getTicket,
  updateTicket,
  deleteTicket,
  updateTicketStatus
} from '@/lib/ticket-db-store';

// GET /api/tickets/[id] - 获取工单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await getTicket(id);
    
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

// PUT /api/tickets/[id] - 更新工单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, type, priority, status, assignee_id } = body;
    
    const ticket = await updateTicket(id, {
      title,
      description,
      type,
      priority,
      status,
      assignee_id
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

// PATCH /api/tickets/[id] - 更新工单状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, comment, operator_id } = body;
    
    const ticket = await updateTicketStatus(id, status, comment, operator_id);
    
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error('更新工单状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新工单状态失败' },
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
    
    const deleted = await deleteTicket(id);
    
    if (!deleted) {
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
