import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Project, CreateProjectRequest } from '@/types/project';
import { encrypt, decrypt } from '@/lib/encryption';

// GET /api/projects - 获取所有项目
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const syncStatus = searchParams.get('sync_status');
    
    let query = client
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (syncStatus) {
      query = query.eq('sync_status', syncStatus);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询项目失败: ${error.message}`);
    }
    
    // 掩码 git_token
    const maskedData = (data as Project[]).map(project => ({
      ...project,
      git_token: project.git_token ? '••••••••••••' : undefined
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: maskedData 
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/projects - 创建项目
export async function POST(request: NextRequest) {
  try {
    const body: CreateProjectRequest = await request.json();
    const { 
      name, 
      description, 
      git_url, 
      git_branch,
      git_token,
      sync_enabled,
      sync_interval,
      config 
    } = body;
    
    // 参数校验
    if (!name || !git_url) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: name, git_url' },
        { status: 400 }
      );
    }
    
    // 验证 Git URL 格式
    if (!isValidGitUrl(git_url)) {
      return NextResponse.json(
        { success: false, error: '无效的 Git URL 格式' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 加密 git_token
    const encryptedToken = git_token ? await encrypt(git_token) : null;
    
    // 计算下次同步时间
    const now = new Date();
    const interval = sync_interval || 300;
    const nextSyncAt = sync_enabled !== false 
      ? new Date(now.getTime() + interval * 1000)
      : null;
    
    const insertData: Record<string, any> = {
      name,
      description,
      git_url,
      git_branch: git_branch || 'main',
      git_token: encryptedToken,
      sync_enabled: sync_enabled !== false,
      sync_interval: interval,
      next_sync_at: nextSyncAt,
      sync_status: 'pending',
      is_active: true
    };
    
    if (config) {
      insertData.config = config;
    }
    
    const { data, error } = await client
      .from('projects')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建项目失败: ${error.message}`);
    }
    
    // 返回时掩码 token
    const maskedData = {
      ...data,
      git_token: encryptedToken ? '••••••••••••' : undefined
    } as Project;
    
    return NextResponse.json({ 
      success: true, 
      data: maskedData 
    });
  } catch (error) {
    console.error('创建项目失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 验证 Git URL 格式
function isValidGitUrl(url: string): boolean {
  // 支持 HTTPS 和 SSH 两种格式
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(\.git)?$/;
  const sshPattern = /^git@[\w.-]+:[\w.-]+\/[\w.-]+(\.git)?$/;
  
  return httpsPattern.test(url) || sshPattern.test(url);
}
