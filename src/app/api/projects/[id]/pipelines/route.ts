// 项目流水线 API
import { NextRequest, NextResponse } from 'next/server';
import { getPipelinesByProject, createPipeline } from '@/lib/pipeline-db-store';

// GET /api/projects/[id]/pipelines - 获取项目的流水线列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pipelines = await getPipelinesByProject(id);
    
    return NextResponse.json({ 
      success: true, 
      data: pipelines 
    });
  } catch (error) {
    console.error('获取项目流水线列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取流水线列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/pipelines - 创建项目流水线
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { name, description, trigger_type, nodes } = body;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: '流水线名称不能为空' },
        { status: 400 }
      );
    }
    
    const pipeline = await createPipeline({
      name,
      description,
      project_id: projectId,
      trigger_type,
      nodes
    });
    
    return NextResponse.json({ 
      success: true, 
      data: pipeline 
    });
  } catch (error) {
    console.error('创建流水线失败:', error);
    return NextResponse.json(
      { success: false, error: '创建流水线失败' },
      { status: 500 }
    );
  }
}
