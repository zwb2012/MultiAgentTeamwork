import { NextRequest, NextResponse } from 'next/server';
import {
  getPipeline,
  runPipeline
} from '@/lib/pipeline-store';

// POST /api/pipelines/[id]/run - 运行流水线
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const run = runPipeline(id);
    
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
