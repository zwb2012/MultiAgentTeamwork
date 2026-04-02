import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { GitSyncService } from '@/lib/git-sync-service';

// POST /api/projects/[id]/sync - 手动同步项目
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const client = getSupabaseClient();
    
    // 获取项目信息
    const { data: project, error: projectError } = await client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: '项目不存在' },
        { status: 404 }
      );
    }
    
    // 检查是否正在同步
    if (project.sync_status === 'syncing') {
      return NextResponse.json(
        { success: false, error: '项目正在同步中，请稍后再试' },
        { status: 400 }
      );
    }
    
    // 创建同步历史记录
    const { data: syncHistory, error: historyError } = await client
      .from('project_sync_history')
      .insert({
        project_id: projectId,
        sync_type: 'manual',
        status: 'running',
        before_commit_sha: project.last_commit_sha
      })
      .select()
      .single();
    
    if (historyError) {
      throw new Error(`创建同步记录失败: ${historyError.message}`);
    }
    
    // 更新项目状态为同步中
    await client
      .from('projects')
      .update({ 
        sync_status: 'syncing',
        updated_at: new Date()
      })
      .eq('id', projectId);
    
    // 异步执行同步
    executeSync(projectId, project, syncHistory.id)
      .catch(console.error);
    
    return NextResponse.json({ 
      success: true, 
      message: '同步任务已启动',
      data: {
        sync_history_id: syncHistory.id
      }
    });
  } catch (error) {
    console.error('同步项目失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/sync - 获取同步状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const client = getSupabaseClient();
    
    // 获取项目同步状态
    const { data: project, error } = await client
      .from('projects')
      .select('sync_status, sync_error, last_sync_at, last_commit_sha')
      .eq('id', projectId)
      .single();
    
    if (error) {
      throw new Error(`查询同步状态失败: ${error.message}`);
    }
    
    // 获取最近的同步历史
    const { data: recentSyncs } = await client
      .from('project_sync_history')
      .select('*')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        status: project.sync_status,
        error: project.sync_error,
        last_sync_at: project.last_sync_at,
        last_commit_sha: project.last_commit_sha,
        recent_syncs: recentSyncs || []
      }
    });
  } catch (error) {
    console.error('获取同步状态失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 执行同步（异步）
async function executeSync(
  projectId: string,
  project: Record<string, unknown>,
  syncHistoryId: string
) {
  const client = getSupabaseClient();
  
  try {
    const syncService = new GitSyncService();
    
    // 执行同步
    const result = await syncService.syncProject({
      id: project.id as string,
      name: project.name as string,
      description: project.description as string | undefined,
      git_url: project.git_url as string,
      git_branch: project.git_branch as string,
      git_token: project.git_token as string | undefined,
      local_path: project.local_path as string | undefined,
      last_commit_sha: project.last_commit_sha as string | undefined
    });
    
    // 更新同步历史
    const updateData: Record<string, unknown> = {
      status: 'success',
      after_commit_sha: result.commitSha,
      commits_count: result.commitsCount,
      changes: result.changes,
      completed_at: new Date()
    };
    
    // 如果是新初始化的项目，记录到错误信息中作为提示
    if (result.isNewInit) {
      updateData.error_message = '[INFO] 项目已在本地创建并初始化';
    }
    
    await client
      .from('project_sync_history')
      .update(updateData)
      .eq('id', syncHistoryId);
    
    // 更新项目状态
    await client
      .from('projects')
      .update({
        sync_status: 'success',
        last_sync_at: new Date(),
        last_commit_sha: result.commitSha,
        next_sync_at: project.sync_enabled 
          ? new Date(Date.now() + (project.sync_interval as number) * 1000)
          : null,
        sync_error: null,
        updated_at: new Date()
      })
      .eq('id', projectId);
    
  } catch (error) {
    console.error('同步执行失败:', error);
    
    // 更新同步历史
    await client
      .from('project_sync_history')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : '未知错误',
        completed_at: new Date()
      })
      .eq('id', syncHistoryId);
    
    // 更新项目状态
    await client
      .from('projects')
      .update({
        sync_status: 'failed',
        sync_error: error instanceof Error ? error.message : '未知错误',
        next_sync_at: project.sync_enabled 
          ? new Date(Date.now() + (project.sync_interval as number) * 1000)
          : null,
        updated_at: new Date()
      })
      .eq('id', projectId);
  }
}
