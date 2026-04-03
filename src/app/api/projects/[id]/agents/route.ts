import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent } from '@/types/agent';

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
      .eq('is_template', false)  // 只返回项目智能体，不返回模板
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`查询项目智能体失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data as Agent[]
    });
  } catch (error) {
    console.error('获取项目智能体列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
