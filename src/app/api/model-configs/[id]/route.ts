import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { encrypt, decrypt } from '@/lib/encryption';
import type { UpdateModelConfigRequest } from '@/types/model-config';

// GET /api/model-configs/[id] - 获取单个模型配置
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('model_configs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`查询模型配置失败: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '模型配置不存在' },
        { status: 404 }
      );
    }
    
    // 掩码 API Key
    const maskedData = {
      ...data,
      api_key: '••••••••••••'
    };
    
    return NextResponse.json({ success: true, data: maskedData });
  } catch (error) {
    console.error('获取模型配置失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// PUT /api/model-configs/[id] - 更新模型配置
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateModelConfigRequest = await request.json();
    const client = getSupabaseClient();
    
    const updateData: Record<string, any> = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.api_key !== undefined) {
      // 只有不是掩码时才更新
      if (body.api_key && !body.api_key.includes('•')) {
        updateData.api_key = await encrypt(body.api_key);
      }
    }
    if (body.base_url !== undefined) updateData.base_url = body.base_url;
    if (body.default_model !== undefined) updateData.default_model = body.default_model;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.max_tokens !== undefined) updateData.max_tokens = body.max_tokens;
    if (body.thinking !== undefined) updateData.thinking = body.thinking;
    if (body.caching !== undefined) updateData.caching = body.caching;
    if (body.status !== undefined) updateData.status = body.status;
    
    updateData.updated_at = new Date();
    
    const { data, error } = await client
      .from('model_configs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`更新模型配置失败: ${error.message}`);
    }
    
    // 掩码 API Key
    const maskedData = {
      ...data,
      api_key: '••••••••••••'
    };
    
    return NextResponse.json({ success: true, data: maskedData });
  } catch (error) {
    console.error('更新模型配置失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// DELETE /api/model-configs/[id] - 删除模型配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 检查是否有智能体正在使用此配置
    const { data: usingAgents } = await client
      .from('agents')
      .select('id, name')
      .eq('model_config_id', id);
    
    if (usingAgents && usingAgents.length > 0) {
      const agentNames = usingAgents.map(a => a.name).join(', ');
      return NextResponse.json(
        { success: false, error: `该配置正在被以下智能体使用: ${agentNames}` },
        { status: 400 }
      );
    }
    
    const { error } = await client
      .from('model_configs')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`删除模型配置失败: ${error.message}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除模型配置失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
