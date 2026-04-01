import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/health-logs - 获取所有智能体的健康检查日志
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 获取日志列表，关联智能体信息
    const { data, error, count } = await supabase
      .from('agent_health_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`查询日志失败: ${error.message}`);
    }
    
    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0
    });
  } catch (error) {
    console.error('获取健康日志失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
