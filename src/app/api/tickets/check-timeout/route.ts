import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/tickets/check-timeout - 检查并更新超时的工单
 */
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const now = new Date().toISOString();

    // 1. 查找所有处理中且已超时的工单
    const { data: timeoutTickets, error: fetchError } = await client
      .from('tickets')
      .select('*')
      .eq('status', 'in_progress')
      .lt('timeout_at', now);

    if (fetchError) {
      console.error('查找超时工单失败:', fetchError);
      return NextResponse.json(
        { success: false, error: '查找超时工单失败' },
        { status: 500 }
      );
    }

    if (!timeoutTickets || timeoutTickets.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有超时的工单',
        updated: 0
      });
    }

    console.log(`找到 ${timeoutTickets.length} 个超时的工单`);

    let updatedCount = 0;

    // 2. 检查每个超时工单的流水线运行状态
    for (const ticket of timeoutTickets) {
      if (!ticket.current_pipeline_run_id) {
        // 如果没有关联的流水线运行，标记为超时
        await updateTicketStatus(client, ticket.id, 'open', '流水线运行未找到，已重置为待处理');
        updatedCount++;
        continue;
      }

      // 查询流水线运行状态
      const { data: pipelineRun, error: runError } = await client
        .from('pipeline_runs')
        .select('status, completed_at, ended_at')
        .eq('id', ticket.current_pipeline_run_id)
        .single();

      if (runError || !pipelineRun) {
        console.error(`查询流水线运行失败:`, runError);
        // 标记为超时
        await updateTicketStatus(client, ticket.id, 'open', '流水线运行记录未找到，已重置为待处理');
        updatedCount++;
        continue;
      }

      // 根据流水线运行状态更新工单状态
      if (pipelineRun.status === 'success') {
        await updateTicketStatus(client, ticket.id, 'resolved', '流水线执行成功');
        updatedCount++;
      } else if (pipelineRun.status === 'failed') {
        await updateTicketStatus(client, ticket.id, 'open', '流水线执行失败，已重置为待处理');
        updatedCount++;
      } else if (pipelineRun.status === 'cancelled') {
        await updateTicketStatus(client, ticket.id, 'open', '流水线执行已取消，已重置为待处理');
        updatedCount++;
      } else if (pipelineRun.status === 'running') {
        // 流水线还在运行中，延长超时时间（延长24小时）
        const newTimeoutAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await client
          .from('tickets')
          .update({ timeout_at: newTimeoutAt })
          .eq('id', ticket.id);
        console.log(`工单 ${ticket.id} 的流水线还在运行中，已延长超时时间到 ${newTimeoutAt}`);
      } else {
        // 其他状态（pending），标记为超时
        await updateTicketStatus(client, ticket.id, 'open', '流水线执行超时，已重置为待处理');
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `已更新 ${updatedCount} 个超时的工单`,
      updated: updatedCount
    });
  } catch (error) {
    console.error('检查超时工单失败:', error);
    return NextResponse.json(
      { success: false, error: '检查超时工单失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新工单状态并添加历史记录
 */
async function updateTicketStatus(
  client: any,
  ticketId: string,
  newStatus: string,
  comment: string
) {
  const now = new Date().toISOString();

  // 更新工单状态
  const { error: updateError } = await client
    .from('tickets')
    .update({
      status: newStatus,
      current_pipeline_run_id: null, // 清除流水线运行ID
      updated_at: now,
      completed_at: newStatus === 'resolved' ? now : null
    })
    .eq('id', ticketId);

  if (updateError) {
    console.error(`更新工单 ${ticketId} 状态失败:`, updateError);
    return;
  }

  // 添加流转历史
  await client
    .from('ticket_history')
    .insert({
      ticket_id: ticketId,
      from_status: 'in_progress',
      to_status: newStatus,
      comment: comment,
      created_at: now
    });

  console.log(`工单 ${ticketId} 状态已更新为 ${newStatus}: ${comment}`);
}
