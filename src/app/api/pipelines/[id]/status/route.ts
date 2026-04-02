import { NextRequest, NextResponse } from 'next/server';
import {
  getPipeline,
  publishPipeline,
  unpublishPipeline,
  archivePipeline,
  restorePipeline
} from '@/lib/pipeline-db-store';

// POST /api/pipelines/[id]/status - 更改流水线状态
// Body: { action: 'publish' | 'unpublish' | 'archive' | 'restore' }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;
    
    if (!action) {
      return NextResponse.json(
        { success: false, error: '缺少 action 参数' },
        { status: 400 }
      );
    }
    
    let pipeline;
    
    switch (action) {
      case 'publish':
        pipeline = await publishPipeline(id);
        break;
      case 'unpublish':
        pipeline = await unpublishPipeline(id);
        break;
      case 'archive':
        pipeline = await archivePipeline(id);
        break;
      case 'restore':
        pipeline = await restorePipeline(id);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `未知操作: ${action}` },
          { status: 400 }
        );
    }
    
    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: '流水线不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: pipeline,
      message: `流水线已${getActionLabel(action)}`
    });
  } catch (error) {
    console.error('状态变更失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '状态变更失败' },
      { status: 500 }
    );
  }
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    publish: '发布',
    unpublish: '撤回',
    archive: '归档',
    restore: '恢复'
  };
  return labels[action] || action;
}
