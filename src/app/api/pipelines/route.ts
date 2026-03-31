import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPipelines,
  createPipeline
} from '@/lib/pipeline-store';

// GET /api/pipelines - 获取流水线列表
export async function GET() {
  try {
    const pipelines = getAllPipelines();
    
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
    const { name, description, trigger_type, nodes } = body;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: '流水线名称不能为空' },
        { status: 400 }
      );
    }
    
    const pipeline = createPipeline({
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
