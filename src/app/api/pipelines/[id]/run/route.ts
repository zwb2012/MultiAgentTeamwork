import { NextRequest, NextResponse } from 'next/server';
import {
  getPipeline,
  runPipeline,
  getPipelineRuns,
  publishPipeline,
  unpublishPipeline,
  archivePipeline,
  restorePipeline
} from '@/lib/pipeline-store';
import type { TicketInput } from '@/types/pipeline';

// POST /api/pipelines/[id]/run - 运行流水线
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    // 提取工单信息
    const ticket: TicketInput | undefined = body.ticket ? {
      id: body.ticket.id || `ticket-${Date.now()}`,
      type: body.ticket.type || 'task',
      title: body.ticket.title || '',
      description: body.ticket.description || '',
      priority: body.ticket.priority,
      labels: body.ticket.labels
    } : undefined;
    
    const run = runPipeline(id, ticket);
    
    return NextResponse.json({ 
      success: true, 
      data: run,
      message: '流水线已开始执行' 
    });
  } catch (error) {
    console.error('运行流水线失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '运行流水线失败' },
      { status: 500 }
    );
  }
}

// GET /api/pipelines/[id]/run - 获取运行记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const runs = getPipelineRuns(id);
    
    return NextResponse.json({ 
      success: true, 
      data: runs 
    });
  } catch (error) {
    console.error('获取运行记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取运行记录失败' },
      { status: 500 }
    );
  }
}
