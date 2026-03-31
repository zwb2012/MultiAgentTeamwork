import { NextRequest, NextResponse } from 'next/server';
import {
  getPipeline,
  updatePipeline,
  deletePipeline
} from '@/lib/pipeline-store';

// GET /api/pipelines/[id] - 获取流水线详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pipeline = getPipeline(id);
    
    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: '流水线不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: pipeline });
  } catch (error) {
    console.error('获取流水线详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取流水线详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/pipelines/[id] - 更新流水线
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const pipeline = updatePipeline(id, {
      name: body.name,
      description: body.description,
      status: body.status,
      nodes: body.nodes
    });
    
    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: '流水线不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: pipeline });
  } catch (error) {
    console.error('更新流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '更新流水线失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/pipelines/[id] - 删除流水线
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!deletePipeline(id)) {
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '删除流水线失败' },
      { status: 500 }
    );
  }
}
