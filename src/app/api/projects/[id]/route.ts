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

// DELETE /api/projects/[id] - 删除项目（级联删除关联资源）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const client = getSupabaseClient();
    
    // 1. 删除流水线相关的执行记录和节点
    // 获取项目关联的流水线
    const { data: projectPipelines } = await client
      .from('pipelines')
      .select('id')
      .eq('project_id', projectId);
    
    if (projectPipelines && projectPipelines.length > 0) {
      const pipelineIds = projectPipelines.map(p => p.id);
      
      // 删除流水线节点执行记录
      for (const pipelineId of pipelineIds) {
        // 获取流水线运行记录
        const { data: runs } = await client
          .from('pipeline_runs')
          .select('id')
          .eq('pipeline_id', pipelineId);
        
        if (runs && runs.length > 0) {
          const runIds = runs.map(r => r.id);
          
          // 删除节点执行记录
          await client
            .from('pipeline_node_runs')
            .delete()
            .in('pipeline_run_id', runIds);
        }
        
        // 删除流水线运行记录
        await client
          .from('pipeline_runs')
          .delete()
          .eq('pipeline_id', pipelineId);
        
        // 删除流水线节点
        await client
          .from('pipeline_nodes')
          .delete()
          .eq('pipeline_id', pipelineId);
      }
      
      // 删除流水线
      await client
        .from('pipelines')
        .delete()
        .eq('project_id', projectId);
    }
    
    // 2. 删除会话相关数据（消息和参与者会通过外键级联删除）
    // 获取项目关联的会话
    const { data: projectConversations } = await client
      .from('conversations')
      .select('id')
      .eq('project_id', projectId);
    
    if (projectConversations && projectConversations.length > 0) {
      const conversationIds = projectConversations.map(c => c.id);
      
      // 删除消息
      await client
        .from('messages')
        .delete()
        .in('conversation_id', conversationIds);
      
      // 删除参与者
      await client
        .from('conversation_participants')
        .delete()
        .in('conversation_id', conversationIds);
      
      // 删除会话
      await client
        .from('conversations')
        .delete()
        .eq('project_id', projectId);
    }
    
    // 3. 删除工单历史
    const { data: projectTickets } = await client
      .from('tickets')
      .select('id')
      .eq('project_id', projectId);
    
    if (projectTickets && projectTickets.length > 0) {
      const ticketIds = projectTickets.map(t => t.id);
      
      // 删除工单历史
      await client
        .from('ticket_history')
        .delete()
        .in('ticket_id', ticketIds);
      
      // 删除工单
      await client
        .from('tickets')
        .delete()
        .eq('project_id', projectId);
    }
    
    // 4. 删除任务
    await client
      .from('tasks')
      .delete()
      .eq('project_id', projectId);
    
    // 5. 删除智能体
    await client
      .from('agents')
      .delete()
      .eq('project_id', projectId);
    
    // 6. 删除项目同步历史
    await client
      .from('project_sync_history')
      .delete()
      .eq('project_id', projectId);
    
    // 7. 最后删除项目本身
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', projectId);
    
    if (error) {
      throw new Error(`删除项目失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '项目及其所有关联资源已删除' 
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
      // 拼接项目名称到平台路径
      const separator = platformPath.endsWith('/') || platformPath.endsWith('\\') ? '' : '/';
      const safeProjectName = projectName ? projectName.replace(/[^a-zA-Z0-9-_]/g, '_') : 'project';
      return `${platformPath}${separator}${safeProjectName}`;
    }

    if (pathConfig.default) {
      // 拼接项目名称到默认路径
      const separator = pathConfig.default.endsWith('/') || pathConfig.default.endsWith('\\') ? '' : '/';
      const safeProjectName = projectName ? projectName.replace(/[^a-zA-Z0-9-_]/g, '_') : 'project';
      return `${pathConfig.default}${separator}${safeProjectName}`;
    }
  }

  const baseDir = process.env.PROJECTS_DIR || '/tmp/projects';
  const projectDir = projectName ? `${baseDir}/${projectName.replace(/[^a-zA-Z0-9-_]/g, '_')}` : baseDir;

  return projectDir;
}
