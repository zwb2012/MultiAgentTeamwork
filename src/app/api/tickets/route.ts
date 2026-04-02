import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTickets,
  createTicket,
  getTicketStats
} from '@/lib/ticket-store';
import type { TicketType, TicketPriority } from '@/types/agent';

// GET /api/tickets - 获取工单列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stats = searchParams.get('stats');
    const projectId = searchParams.get('project_id');
    
    if (stats === 'true') {
      const ticketStats = getTicketStats();
      return NextResponse.json({ success: true, data: ticketStats });
    }
    
    const tickets = getAllTickets(projectId || undefined);
    
    return NextResponse.json({ 
      success: true, 
      data: tickets 
    });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工单列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/tickets - 创建工单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type, 
      title, 
      description, 
      priority, 
      project_id,
      assignee_id,
      assignee_name 
    } = body;
    
    if (!title) {
      return NextResponse.json(
        { success: false, error: '工单标题不能为空' },
        { status: 400 }
      );
    }
    
    const ticket = createTicket({
      type: type as TicketType || 'bug',
      title,
      description: description || '',
      priority: priority as TicketPriority || 'medium',
      project_id,
      assignee_id,
      assignee_name
    });
    
    return NextResponse.json({ 
      success: true, 
      data: ticket 
    });
  } catch (error) {
    console.error('创建工单失败:', error);
    return NextResponse.json(
      { success: false, error: '创建工单失败' },
      { status: 500 }
    );
  }
}
