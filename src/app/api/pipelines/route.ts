import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPipelines,
  getPipelineRuns,
  createPipeline
} from '@/lib/pipeline-db-store';

// GET /api/pipelines - 获取流水线运行记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const type = searchParams.get('type'); // 'runs' or 'pipelines'
    
    // 默认返回运行记录列表
    if (type === 'runs' || !type) {
      const runs = await getPipelineRuns(
        projectId || undefined, 
        projectId ? 'project' : 'pipeline'
      );
      return NextResponse.json({ 
        success: true, 
        data: runs 
      });
    }
    
    // 返回流水线列表
    const pipelines = await getAllPipelines(projectId || undefined);
    return NextResponse.json({ 
      success: true, 
      data: pipelines 
    });
  } catch (error) {
    console.error('获取流水线列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取流水线列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/pipelines - 创建流水线
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, name, description, trigger_type, nodes } = body;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: '流水线名称不能为空' },
        { status: 400 }
      );
    }
    
    if (!project_id) {
      return NextResponse.json(
        { success: false, error: '项目ID不能为空' },
        { status: 400 }
      );
    }
    
    const pipeline = await createPipeline({
      project_id,
      name,
      description,
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
