import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, AgentRole, AgentStatus, AgentType, ModelConfig, ProcessConfig, CapabilityTag } from '@/types/agent';

// GET /api/agents - 获取智能体列表
// 查询参数:
// - status: 按状态过滤
// - role: 按角色过滤
// - agent_type: 按类型过滤
// - project_id: 按项目过滤
// - is_template: 是否只查询模板
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const agentType = searchParams.get('agent_type');
    const projectId = searchParams.get('project_id');
    const isTemplate = searchParams.get('is_template');
    
    let query = client
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (role) {
      query = query.eq('role', role);
    }
    
    if (agentType) {
      query = query.eq('agent_type', agentType);
    }
    
    // 项目过滤
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    // 模板过滤
    if (isTemplate === 'true') {
      query = query.eq('is_template', true);
    } else if (isTemplate === 'false') {
      query = query.eq('is_template', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`查询智能体失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Agent[] 
    });
  } catch (error) {
    console.error('获取智能体列表失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/agents - 创建智能体
// 请求体:
// - name: 智能体名称
// - role: 角色
// - system_prompt: 系统提示词
// - agent_type: 类型 (llm/process)
// - project_id: 项目ID (可选，为空则创建为全局模板)
// - is_template: 是否为模板
// - template_id: 从模板创建时的模板ID
// - model_config_id: 大模型配置ID (新方式)
// - model, model_config, process_config, config, capability_tags
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      role, 
      system_prompt, 
      agent_type,
      project_id,
      is_template,
      template_id,
      model_config_id,
      model, 
      model_config,
      process_config,
      config,
      capability_tags 
    } = body;
    
    // 参数校验
    if (!name || !role || !system_prompt || !agent_type) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: name, role, system_prompt, agent_type' },
        { status: 400 }
      );
    }
    
    // 根据类型校验
    if (agent_type === 'llm') {
      // 需要model_config_id或model
      if (!model_config_id && !model) {
        return NextResponse.json(
          { success: false, error: 'LLM类型智能体必须指定大模型配置或模型' },
          { status: 400 }
        );
      }
    }
    
    if (agent_type === 'process' && !process_config?.command) {
      return NextResponse.json(
        { success: false, error: '进程类型智能体必须指定启动命令' },
        { status: 400 }
      );
    }
    
    // 如果指定了template_id，从模板复制配置
    let finalModelConfigId = model_config_id;
    let finalModel = model;
    let finalModelConfig = model_config;
    let finalProcessConfig = process_config;
    let finalSystemPrompt = system_prompt;
    
    if (template_id) {
      const client = getSupabaseClient();
      const { data: template, error: templateError } = await client
        .from('agents')
        .select('*')
        .eq('id', template_id)
        .eq('is_template', true)
        .single();
      
      if (templateError || !template) {
        return NextResponse.json(
          { success: false, error: '模板不存在' },
          { status: 400 }
        );
      }
      
      // 继承模板配置（如果未指定则使用模板的）
      finalModelConfigId = model_config_id || template.model_config_id;
      finalModel = model || template.model;
      finalModelConfig = model_config || template.model_config;
      finalProcessConfig = process_config || template.process_config;
      finalSystemPrompt = system_prompt || template.system_prompt;
    }
    
    // 替换系统提示词中的{name}占位符
    finalSystemPrompt = finalSystemPrompt.replace(/{name}/g, name);
    
    const client = getSupabaseClient();
    
    const insertData: Record<string, unknown> = {
      name,
      role: role as AgentRole,
      system_prompt: finalSystemPrompt,
      agent_type: agent_type as AgentType,
      // 项目关联
      project_id: project_id || null,
      is_template: is_template ?? false,
      template_id: template_id || null,
      // 新状态系统
      online_status: 'unknown',
      work_status: 'idle',
      // 兼容旧版本
      status: 'idle' as AgentStatus,
      is_active: true
    };
    
    // LLM类型配置
    if (agent_type === 'llm') {
      insertData.model = finalModel;
      if (finalModelConfigId) {
        insertData.model_config_id = finalModelConfigId;
      }
      if (finalModelConfig) {
        insertData.model_config = finalModelConfig as ModelConfig;
      }
    }
    
    // 进程类型配置
    if (agent_type === 'process' && finalProcessConfig) {
      insertData.process_config = finalProcessConfig as ProcessConfig;
    }
    
    // 其他配置
    if (config) {
      insertData.config = config;
    }
    
    // 能力标签
    if (capability_tags && Array.isArray(capability_tags)) {
      insertData.capability_tags = capability_tags as CapabilityTag[];
    }
    
    const { data, error } = await client
      .from('agents')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建智能体失败: ${error.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data as Agent 
    });
  } catch (error) {
    console.error('创建智能体失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
