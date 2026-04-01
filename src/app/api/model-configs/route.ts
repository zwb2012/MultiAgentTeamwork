import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { encrypt, decrypt } from '@/lib/encryption';
import type { 
  ModelConfig, 
  CreateModelConfigRequest, 
  UpdateModelConfigRequest,
  TestModelConfigRequest,
  TestModelConfigResult
} from '@/types/model-config';

// GET /api/model-configs - 获取所有模型配置
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('model_configs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`查询模型配置失败: ${error.message}`);
    }
    
    // 掩码 API Key
    const maskedData = (data || []).map(item => ({
      ...item,
      api_key: item.api_key ? '••••••••••••' : undefined
    }));
    
    return NextResponse.json({ success: true, data: maskedData });
  } catch (error) {
    console.error('获取模型配置失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/model-configs - 创建模型配置
export async function POST(request: NextRequest) {
  try {
    const body: CreateModelConfigRequest = await request.json();
    const { name, provider, api_key, base_url, default_model, ...otherParams } = body;
    
    if (!name || !provider || !api_key) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: name, provider, api_key' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('model_configs')
      .insert({
        name,
        provider,
        api_key: await encrypt(api_key),
        base_url,
        default_model,
        temperature: otherParams.temperature,
        max_tokens: otherParams.max_tokens,
        thinking: otherParams.thinking,
        caching: otherParams.caching,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建模型配置失败: ${error.message}`);
    }
    
    // 掩码 API Key
    const maskedData = {
      ...data,
      api_key: '••••••••••••'
    };
    
    return NextResponse.json({ success: true, data: maskedData });
  } catch (error) {
    console.error('创建模型配置失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
