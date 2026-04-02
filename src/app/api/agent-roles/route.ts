import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { DEFAULT_AGENT_ROLES, type AgentRoleConfig, type AgentRoleFormData } from '@/types/agent-role';

// 获取所有角色
export async function GET() {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_roles')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) {
      console.error('获取角色列表失败:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // 如果没有角色数据，初始化默认角色
    if (!data || data.length === 0) {
      const initialized = await initializeDefaultRoles();
      if (initialized) {
        // 重新获取
        const { data: newData } = await client
          .from('agent_roles')
          .select('*')
          .order('sort_order', { ascending: true });
        return NextResponse.json({ success: true, data: newData || [] });
      }
    }
    
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取角色列表失败' },
      { status: 500 }
    );
  }
}

// 创建新角色
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getSupabaseClient();
    
    const roleData: AgentRoleFormData = {
      role_key: body.role_key,
      name: body.name,
      description: body.description,
      system_prompt_template: body.system_prompt_template,
      suggested_agent_type: body.suggested_agent_type || 'llm',
      suggested_model: body.suggested_model,
      suggested_temperature: body.suggested_temperature,
      suggested_thinking: body.suggested_thinking,
      suggested_caching: body.suggested_caching,
      capability_tags: body.capability_tags || [],
      sort_order: body.sort_order || 0,
      is_active: body.is_active !== false
    };
    
    const { data, error } = await client
      .from('agent_roles')
      .insert(roleData)
      .select()
      .single();
    
    if (error) {
      console.error('创建角色失败:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建角色失败:', error);
    return NextResponse.json(
      { success: false, error: '创建角色失败' },
      { status: 500 }
    );
  }
}

// 初始化默认角色
async function initializeDefaultRoles(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    
    const rolesToInsert = DEFAULT_AGENT_ROLES.map(role => ({
      ...role,
      is_system: true, // 标记为系统预设
      is_active: true
    }));
    
    const { error } = await client
      .from('agent_roles')
      .insert(rolesToInsert);
    
    if (error) {
      console.error('初始化默认角色失败:', error);
      return false;
    }
    
    console.log('默认角色初始化成功');
    return true;
  } catch (error) {
    console.error('初始化默认角色失败:', error);
    return false;
  }
}

// 批量初始化默认角色（用于手动触发）
export async function PUT() {
  try {
    const initialized = await initializeDefaultRoles();
    if (initialized) {
      return NextResponse.json({ success: true, message: '默认角色初始化成功' });
    } else {
      return NextResponse.json({ success: false, error: '初始化失败' }, { status: 500 });
    }
  } catch (error) {
    console.error('初始化默认角色失败:', error);
    return NextResponse.json(
      { success: false, error: '初始化失败' },
      { status: 500 }
    );
  }
}
