import { NextRequest, NextResponse } from 'next/server';
import {
  getPipeline,
  updatePipeline,
  deletePipeline,
  publishPipeline,
  unpublishPipeline,
  archivePipeline,
  restorePipeline
} from '@/lib/pipeline-db-store';

// GET /api/pipelines/[id] - 获取流水线详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pipeline = await getPipeline(id);
    
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
    const { action, ...updateData } = body;
    
    let pipeline;
    
    // 支持不同的操作
    if (action === 'publish') {
      pipeline = await publishPipeline(id);
    } else if (action === 'unpublish') {
      pipeline = await unpublishPipeline(id);
    } else if (action === 'archive') {
      pipeline = await archivePipeline(id);
    } else if (action === 'restore') {
      pipeline = await restorePipeline(id);
    } else {
      pipeline = await updatePipeline(id, {
        name: updateData.name,
        description: updateData.description,
        trigger_type: updateData.trigger_type,
        nodes: updateData.nodes
      });
    }
    
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
    
    if (!await deletePipeline(id)) {
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
