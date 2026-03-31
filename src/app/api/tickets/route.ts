import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Ticket, TicketHistory } from '@/types/agent';

// GET /api/tickets - 获取工单列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const assigneeId = searchParams.get('assignee_id');
    
    let query = client
      .from('tickets')
      .select(`
        *,
        assignee:agents!tickets_assignee_id_fkey (
          id,
          name,
          role
        ),
        reporter:agents!tickets_reporter_id_fkey (
          id,
          name,
          role
        ),
        tasks (
          id,
          title
        )
      `)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    if (assigneeId) {
      query = query.eq('assignee_id', assigneeId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询工单失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Ticket[] 
    });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/tickets - 创建工单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, type, title, description, priority, assignee_id, reporter_id } = body;
    
    if (!type || !title || !priority) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: type, title, priority' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 创建工单
    const { data: ticket, error: ticketError } = await client
      .from('tickets')
      .insert({
        task_id,
        type,
        title,
        description,
        priority,
        assignee_id,
        reporter_id,
        status: 'open'
      })
      .select()
      .single();
    
    if (ticketError || !ticket) {
      throw new Error(`创建工单失败: ${ticketError?.message}`);
    }
    
    // 创建流转历史
    const { error: historyError } = await client
      .from('ticket_history')
      .insert({
        ticket_id: ticket.id,
        to_status: 'open',
        to_assignee_id: assignee_id,
        operator_id: reporter_id,
        comment: '创建工单'
      });
    
    if (historyError) {
      console.error('创建流转历史失败:', historyError);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: ticket as Ticket 
    });
  } catch (error) {
    console.error('创建工单失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
