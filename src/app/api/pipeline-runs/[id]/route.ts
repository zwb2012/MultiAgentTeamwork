import { NextRequest, NextResponse } from 'next/server';
import { getPipelineRun, getPipeline, cancelPipelineRun } from '@/lib/pipeline-db-store';

// GET /api/pipeline-runs/[id] - 获取流水线运行详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. 获取运行记录
    const run = await getPipelineRun(id);
    
    if (!run) {
      return NextResponse.json(
        { success: false, error: '运行记录不存在' },
        { status: 404 }
      );
    }
    
    // 2. 获取流水线信息
    const pipeline = await getPipeline(run.pipeline_id);
    
    // 3. 构建返回数据
    const result = {
      run: {
        ...run,
        pipeline_name: pipeline?.name || '未知流水线',
        pipeline_status: pipeline?.status
      },
      node_runs: [], // TODO: 从数据库获取节点运行详情
      agents: [],
      agent_tasks: [],
      messages: [],
      summary: {
        total_nodes: run.total_nodes || 0,
        completed_nodes: run.completed_nodes || 0,
        failed_nodes: run.failed_nodes || 0,
        pending_nodes: run.status === 'running' ? run.total_nodes - run.completed_nodes - run.failed_nodes : 0,
        running_nodes: run.status === 'running' ? 1 : 0,
        waiting_nodes: 0
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('获取流水线运行详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取运行详情失败' },
      { status: 500 }
    );
  }
}

// POST /api/pipeline-runs/[id]/cancel - 取消流水线运行
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查是否是取消操作
    const url = new URL(request.url);
    if (url.pathname.endsWith('/cancel')) {
      const run = await cancelPipelineRun(id);
      
      if (!run) {
        return NextResponse.json(
          { success: false, error: '运行记录不存在' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        data: run,
        message: '流水线运行已取消' 
      });
    }
    
    return NextResponse.json(
      { success: false, error: '未知操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('取消流水线运行失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '取消运行失败' },
      { status: 500 }
    );
  }
}
