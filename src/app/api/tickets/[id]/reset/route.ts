import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tickets/[id]/reset - 强制重置工单状态
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();
    const { comment = '管理员强制重置' } = body;

    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();

    // 查询工单当前状态
    const { data: ticket, error: fetchError } = await client
      .from('tickets')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !ticket) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }

    // 更新工单状态
    const now = new Date().toISOString();
    const { error: updateError } = await client
      .from('tickets')
      .update({
        status: 'open',
        current_pipeline_run_id: null,
        timeout_at: null,
        updated_at: now
      })
      .eq('id', id);

    if (updateError) {
      console.error('重置工单状态失败:', updateError);
      return NextResponse.json(
        { success: false, error: '重置工单状态失败' },
        { status: 500 }
      );
    }

    // 添加流转历史
    await client
      .from('ticket_history')
      .insert({
        ticket_id: id,
        from_status: ticket.status,
        to_status: 'open',
        comment: comment,
        created_at: now
      });

    return NextResponse.json({
      success: true,
      message: '工单状态已重置为待处理'
    });
  } catch (error) {
    console.error('重置工单状态失败:', error);
    return NextResponse.json(
      { success: false, error: '重置工单状态失败' },
      { status: 500 }
    );
  }
}
