import { NextRequest, NextResponse } from 'next/server';
import type { TestModelConfigRequest, TestModelConfigResult } from '@/types/model-config';

// POST /api/model-configs/test - 测试模型配置
export async function POST(request: NextRequest) {
  try {
    const body: TestModelConfigRequest = await request.json();
    const { provider, api_key, base_url } = body;
    
    if (!provider || !api_key) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: provider, api_key' },
        { status: 400 }
      );
    }
    
    const startTime = Date.now();
    let result: TestModelConfigResult;
    
    try {
      result = await testProvider(provider, api_key, base_url);
      const latency = Date.now() - startTime;
      
      return NextResponse.json({ 
        success: true, 
        data: {
          ...result,
          latency
        } 
      });
    } catch (testError) {
      const latency = Date.now() - startTime;
      
      return NextResponse.json({ 
        success: true, 
        data: {
          success: false,
          message: testError instanceof Error ? testError.message : '测试失败',
          latency
        } 
      });
    }
  } catch (error) {
    console.error('测试模型配置失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

async function testProvider(
  provider: string, 
  api_key: string, 
  base_url?: string
): Promise<TestModelConfigResult> {
  // 根据提供商选择合适的测试方式
  const testUrl = getTestUrl(provider, base_url);
  
  // 1. 首先尝试获取模型列表
  try {
    const models = await fetchModels(testUrl, api_key, provider);
    return {
      success: true,
      message: '连接成功',
      available_models: models
    };
  } catch (modelError) {
    // 如果获取模型列表失败，尝试发送测试消息
    try {
      await sendTestMessage(testUrl, api_key, provider);
      return {
        success: true,
        message: '连接成功（模型列表获取失败，但消息发送成功）'
      };
    } catch (messageError) {
      throw new Error('连接失败');
    }
  }
}

function getTestUrl(provider: string, base_url?: string): string {
  const defaultUrls: Record<string, string> = {
    doubao: 'https://ark.cn-beijing.volces.com/api/v3',
    deepseek: 'https://api.deepseek.com/v1',
    kimi: 'https://api.moonshot.cn/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    custom: base_url || ''
  };
  
  return base_url || defaultUrls[provider] || defaultUrls.openai;
}

async function fetchModels(baseUrl: string, apiKey: string, provider: string): Promise<string[]> {
  let url = `${baseUrl}/models`;
  
  // 智谱的模型列表API特殊处理
  if (provider === 'zhipu') {
    url = `${baseUrl}/models`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`获取模型列表失败: ${response.status}`);
  }
  
  const data = await response.json();
  
  // 解析不同提供商的响应格式
  if (data.data && Array.isArray(data.data)) {
    // OpenAI 格式
    return data.data.map((m: any) => m.id);
  } else if (Array.isArray(data)) {
    // 直接数组格式
    return data.map((m: any) => m.id || m.model);
  }
  
  return [];
}

async function sendTestMessage(baseUrl: string, apiKey: string, provider: string): Promise<void> {
  const url = `${baseUrl}/chat/completions`;
  
  const body: any = {
    model: getTestModel(provider),
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 10
  };
  
  // Anthropic 特殊处理
  if (provider === 'anthropic') {
    const anthropicUrl = baseUrl.replace('/v1', '');
    const response = await fetch(`${anthropicUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      })
    });
    
    if (!response.ok) {
      throw new Error(`测试消息发送失败: ${response.status}`);
    }
    return;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`测试消息发送失败: ${response.status}`);
  }
}

function getTestModel(provider: string): string {
  const testModels: Record<string, string> = {
    doubao: 'doubao-seed-1-8-251228',
    deepseek: 'deepseek-chat',
    kimi: 'moonshot-v1-8k',
    zhipu: 'glm-4-flash',
    openai: 'gpt-3.5-turbo',
    anthropic: 'claude-3-haiku-20240307',
    custom: 'gpt-3.5-turbo'
  };
  
  return testModels[provider] || testModels.openai;
}
