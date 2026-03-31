import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Project, UpdateProjectRequest, LocalPathConfig } from '@/types/project';
import { encrypt, decrypt } from '@/lib/encryption';
import os from 'os';

// GET /api/projects/[id] - 获取单个项目
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (error) {
      throw new Error(`查询项目失败: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '项目不存在' },
        { status: 404 }
      );
    }
    
    // 掩码 git_token
    const maskedData = {
      ...data,
      git_token: data.git_token ? '••••••••••••' : undefined
    } as Project;
    
    return NextResponse.json({ 
      success: true, 
      data: maskedData 
    });
  } catch (error) {
    console.error('获取项目失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body: UpdateProjectRequest = await request.json();
    const { 
      name, 
      description, 
      git_url, 
      git_branch,
      git_token,
      sync_enabled,
      sync_interval,
      local_path_config,
      config,
      is_active 
    } = body;
    
    const client = getSupabaseClient();
    
    const updateData: Record<string, any> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (git_url !== undefined) {
      // 验证 Git URL 格式
      if (!isValidGitUrl(git_url)) {
        return NextResponse.json(
          { success: false, error: '无效的 Git URL 格式' },
          { status: 400 }
        );
      }
      updateData.git_url = git_url;
    }
    if (git_branch !== undefined) updateData.git_branch = git_branch;
    if (git_token !== undefined) {
      // 只有当 token 不是掩码时才更新
      if (git_token && !git_token.includes('•')) {
        updateData.git_token = await encrypt(git_token);
      }
    }
    if (sync_enabled !== undefined) {
      updateData.sync_enabled = sync_enabled;
      // 更新下次同步时间
      if (sync_enabled) {
        const project = await client
          .from('projects')
          .select('sync_interval')
          .eq('id', projectId)
          .single();
        
        const interval = project.data?.sync_interval || 300;
        updateData.next_sync_at = new Date(Date.now() + interval * 1000);
      } else {
        updateData.next_sync_at = null;
      }
    }
    if (sync_interval !== undefined) {
      updateData.sync_interval = sync_interval;
      // 更新下次同步时间
      if (sync_interval > 0) {
        updateData.next_sync_at = new Date(Date.now() + sync_interval * 1000);
      }
    }
    if (config !== undefined) updateData.config = config;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    // 处理本地路径配置
    if (local_path_config !== undefined) {
      updateData.local_path_config = local_path_config;
      // 重新解析本地路径
      const { data: currentProject } = await client
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();
      
      const actualPath = resolveLocalPath(local_path_config, currentProject?.name);
      updateData.local_path = actualPath;
    }
    
    updateData.updated_at = new Date();
    
    const { data, error } = await client
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`更新项目失败: ${error.message}`);
    }
    
    // 返回时掩码 token
    const maskedData = {
      ...data,
      git_token: data.git_token ? '••••••••••••' : undefined
    } as Project;
    
    return NextResponse.json({ 
      success: true, 
      data: maskedData 
    });
  } catch (error) {
    console.error('更新项目失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - 删除项目（软删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const client = getSupabaseClient();
    
    // 软删除
    const { error } = await client
      .from('projects')
      .update({ 
        is_active: false,
        updated_at: new Date()
      })
      .eq('id', projectId);
    
    if (error) {
      throw new Error(`删除项目失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '项目已删除' 
    });
  } catch (error) {
    console.error('删除项目失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 验证 Git URL 格式
function isValidGitUrl(url: string): boolean {
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(\.git)?$/;
  const sshPattern = /^git@[\w.-]+:[\w.-]+\/[\w.-]+(\.git)?$/;
  
  return httpsPattern.test(url) || sshPattern.test(url);
}

// 根据当前平台解析本地路径
function resolveLocalPath(pathConfig?: LocalPathConfig, projectName?: string): string {
  const platform = os.platform();
  let platformKey: 'windows' | 'linux' | 'macos' | 'default';
  
  if (platform === 'win32') {
    platformKey = 'windows';
  } else if (platform === 'darwin') {
    platformKey = 'macos';
  } else {
    platformKey = 'linux';
  }
  
  if (pathConfig) {
    const platformPath = pathConfig[platformKey];
    if (platformPath) {
      return platformPath;
    }
    
    if (pathConfig.default) {
      return pathConfig.default;
    }
  }
  
  const baseDir = process.env.PROJECTS_DIR || '/tmp/projects';
  const projectDir = projectName ? `${baseDir}/${projectName.replace(/[^a-zA-Z0-9-_]/g, '_')}` : baseDir;
  
  return projectDir;
}
