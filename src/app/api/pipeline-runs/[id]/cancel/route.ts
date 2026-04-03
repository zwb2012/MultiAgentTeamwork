import { NextRequest, NextResponse } from 'next/server';
import { cancelPipelineRun } from '@/lib/pipeline-db-store';

// POST /api/pipeline-runs/[id]/cancel - 取消流水线运行
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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
  } catch (error) {
    console.error('取消流水线运行失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '取消运行失败' },
      { status: 500 }
    );
  }
}
