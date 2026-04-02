import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个角色
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_roles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('获取角色失败:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('获取角色失败:', error);
    return NextResponse.json(
      { success: false, error: '获取角色失败' },
      { status: 500 }
    );
  }
}

// 更新角色
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const client = getSupabaseClient();
    
    // 检查是否为系统角色
    const { data: existingRole } = await client
      .from('agent_roles')
      .select('is_system, role_key')
      .eq('id', id)
      .single();
    
    if (existingRole?.is_system && body.role_key && body.role_key !== existingRole.role_key) {
      return NextResponse.json(
        { success: false, error: '系统预设角色的标识不能修改' },
        { status: 400 }
      );
    }
    
    const updateData = {
      ...body,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await client
      .from('agent_roles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('更新角色失败:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('更新角色失败:', error);
    return NextResponse.json(
      { success: false, error: '更新角色失败' },
      { status: 500 }
    );
  }
}

// 删除角色
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 检查是否为系统角色
    const { data: existingRole } = await client
      .from('agent_roles')
      .select('is_system, name')
      .eq('id', id)
      .single();
    
    if (existingRole?.is_system) {
      return NextResponse.json(
        { success: false, error: '系统预设角色不能删除' },
        { status: 400 }
      );
    }
    
    // 检查是否有智能体在使用此角色
    const { data: agentsUsingRole } = await client
      .from('agents')
      .select('id, name')
      .eq('role', existingRole?.name || '')
      .limit(5);
    
    if (agentsUsingRole && agentsUsingRole.length > 0) {
      const agentNames = agentsUsingRole.map(a => a.name).join(', ');
      return NextResponse.json(
        { success: false, error: `该角色正在被以下智能体使用: ${agentNames}` },
        { status: 400 }
      );
    }
    
    const { error } = await client
      .from('agent_roles')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('删除角色失败:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除角色失败:', error);
    return NextResponse.json(
      { success: false, error: '删除角色失败' },
      { status: 500 }
    );
  }
}
