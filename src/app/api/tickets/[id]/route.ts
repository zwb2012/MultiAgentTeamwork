import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { TicketStatus } from '@/types/agent';

// PUT /api/tickets/[id] - 更新工单状态(流转)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, assignee_id, comment, operator_id } = body;
    
    const client = getSupabaseClient();
    
    // 获取当前工单信息
    const { data: currentTicket, error: fetchError } = await client
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !currentTicket) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }
    
    // 更新工单
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    if (status !== undefined) {
      updateData.status = status as TicketStatus;
    }
    
    if (assignee_id !== undefined) {
      updateData.assignee_id = assignee_id;
    }
    
    const { data: updatedTicket, error: updateError } = await client
      .from('tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(`更新工单失败: ${updateError.message}`);
    }
    
    // 创建流转历史
    const { error: historyError } = await client
      .from('ticket_history')
      .insert({
        ticket_id: id,
        from_status: currentTicket.status,
        to_status: status || currentTicket.status,
        from_assignee_id: currentTicket.assignee_id,
        to_assignee_id: assignee_id || currentTicket.assignee_id,
        operator_id,
        comment
      });
    
    if (historyError) {
      console.error('创建流转历史失败:', historyError);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: updatedTicket 
    });
  } catch (error) {
    console.error('更新工单失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// GET /api/tickets/[id]/history - 获取工单流转历史
export async function GET_History(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('ticket_history')
      .select(`
        *,
        from_assignee:agents!ticket_history_from_assignee_id_fkey (
          id,
          name,
          role
        ),
        to_assignee:agents!ticket_history_to_assignee_id_fkey (
          id,
          name,
          role
        ),
        operator:agents!ticket_history_operator_id_fkey (
          id,
          name,
          role
        )
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`查询流转历史失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data 
    });
  } catch (error) {
    console.error('获取流转历史失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
