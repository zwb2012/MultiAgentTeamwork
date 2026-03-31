import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent } from '@/types/agent';

// GET /api/projects/[id]/agents - 获取项目下的智能体
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
    console.error('获取项目智能体失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/agents - 为项目创建智能体（支持从模板复制）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { template_ids, agents: agentsData } = body;
    
    const client = getSupabaseClient();
    
    // 验证项目存在
    const { data: project, error: projectError } = await client
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: '项目不存在' },
        { status: 404 }
      );
    }
    
    const createdAgents: Agent[] = [];
    
    // 方式1: 从模板ID列表创建
    if (template_ids && Array.isArray(template_ids) && template_ids.length > 0) {
      // 获取模板
      const { data: templates, error: templatesError } = await client
        .from('agents')
        .select('*')
        .in('id', template_ids)
        .eq('is_template', true);
      
      if (templatesError) {
        throw new Error(`查询模板失败: ${templatesError.message}`);
      }
      
      // 为每个模板创建项目智能体
      for (const template of templates || []) {
        const agentName = `${template.name}`;
        const systemPrompt = template.system_prompt.replace(/{name}/g, agentName);
        
        const { data: newAgent, error: createError } = await client
          .from('agents')
          .insert({
            name: agentName,
            role: template.role,
            system_prompt: systemPrompt,
            agent_type: template.agent_type,
            project_id: projectId,
            is_template: false,
            template_id: template.id,
            model: template.model,
            model_config: template.model_config,
            process_config: template.process_config,
            config: template.config,
            capability_tags: template.capability_tags,
            online_status: 'unknown',
            work_status: 'idle',
            status: 'idle',
            is_active: true
          })
          .select()
          .single();
        
        if (createError) {
          console.error(`创建智能体 ${template.name} 失败:`, createError);
          continue;
        }
        
        if (newAgent) {
          createdAgents.push(newAgent as Agent);
        }
      }
    }
    
    // 方式2: 直接创建智能体
    if (agentsData && Array.isArray(agentsData)) {
      for (const agentData of agentsData) {
        const { name, role, system_prompt, agent_type, model, model_config, process_config, config, capability_tags } = agentData;
        
        if (!name || !role || !system_prompt || !agent_type) {
          continue;
        }
        
        const finalSystemPrompt = system_prompt.replace(/{name}/g, name);
        
        const insertData: Record<string, any> = {
          name,
          role,
          system_prompt: finalSystemPrompt,
          agent_type,
          project_id: projectId,
          is_template: false,
          online_status: 'unknown',
          work_status: 'idle',
          status: 'idle',
          is_active: true
        };
        
        if (agent_type === 'llm' && model) {
          insertData.model = model;
          insertData.model_config = model_config;
        }
        
        if (agent_type === 'process' && process_config) {
          insertData.process_config = process_config;
        }
        
        if (config) {
          insertData.config = config;
        }
        
        if (capability_tags) {
          insertData.capability_tags = capability_tags;
        }
        
        const { data: newAgent, error: createError } = await client
          .from('agents')
          .insert(insertData)
          .select()
          .single();
        
        if (createError) {
          console.error(`创建智能体 ${name} 失败:`, createError);
          continue;
        }
        
        if (newAgent) {
          createdAgents.push(newAgent as Agent);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: createdAgents,
      message: `成功创建 ${createdAgents.length} 个智能体`
    });
  } catch (error) {
    console.error('创建项目智能体失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
