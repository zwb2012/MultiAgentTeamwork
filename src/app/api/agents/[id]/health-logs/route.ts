import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/agents/[id]/health-logs - 获取健康检查日志
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 获取日志列表
    const { data, error, count } = await supabase
      .from('agent_health_logs')
      .select('*', { count: 'exact' })
      .eq('agent_id', id)
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

// DELETE /api/agents/[id]/health-logs - 清理健康检查日志
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    
    // 删除指定天数之前的日志
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const { error } = await supabase
      .from('agent_health_logs')
      .delete()
      .eq('agent_id', id)
      .lt('created_at', cutoffDate.toISOString());
    
    if (error) {
      throw new Error(`清理日志失败: ${error.message}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `已清理 ${days} 天前的日志`
    });
  } catch (error) {
    console.error('清理健康日志失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
