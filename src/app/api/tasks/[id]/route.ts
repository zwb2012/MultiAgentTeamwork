import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Task } from '@/types/agent';

// PUT /api/tasks/[id] - 更新任务
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, report } = body;
    
    const client = getSupabaseClient();
    
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }
    
    if (report !== undefined) {
      updateData.report = report;
    }
    
    const { data, error } = await client
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`更新任务失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Task 
    });
  } catch (error) {
    console.error('更新任务失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
