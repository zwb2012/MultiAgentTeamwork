import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/projects/[id]/agents - 获取项目的智能体列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agents')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_template', false)
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data || [] 
    });
  } catch (error) {
    console.error('获取项目智能体列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取智能体列表失败' },
      { status: 500 }
    );
  }
}
