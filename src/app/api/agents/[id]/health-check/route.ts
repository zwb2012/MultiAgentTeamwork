import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { decrypt } from '@/lib/encryption';

// POST /api/agents/[id]/health-check - 健康检查
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
    // 获取请求体，判断是手动还是自动检查
    let checkType = 'manual';
    try {
      const body = await request.json();
      checkType = body.check_type || 'manual';
    } catch {
      // 没有请求体，默认手动检查
    }
    
    // 获取智能体信息
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    // 更新状态为检测中
    await supabase
      .from('agents')
      .update({ 
        online_status: 'checking',
        work_status: 'idle'
      })
      .eq('id', id);
    
    let result: {
      online: boolean;
      message: string;
      details?: string;
      latency: number;
      checked_at: string;
    } = {
      online: false,
      message: '',
      latency: 0,
      checked_at: new Date().toISOString()
    };
    
    const startTime = Date.now();
    
    if (agent.agent_type === 'llm') {
      // 获取大模型配置
      let modelConfig: {
        api_key?: string;
        base_url?: string;
        provider?: string;
        default_model?: string;
      } = {};
      
      // 优先使用 model_config_id 关联的配置
      if (agent.model_config_id) {
        const { data: config, error: configError } = await supabase
          .from('model_configs')
          .select('*')
          .eq('id', agent.model_config_id)
          .single();
        
        if (!configError && config) {
          const decryptedKey = config.api_key ? await decrypt(config.api_key) : undefined;
          modelConfig = {
            api_key: decryptedKey,
            base_url: config.base_url || undefined,
            provider: config.provider,
            default_model: config.default_model || undefined
          };
        }
      }
      
      // 兼容旧的 model_config 字段
      if (!modelConfig.api_key && agent.model_config) {
        const oldConfig = agent.model_config as any;
        modelConfig = {
          api_key: oldConfig.api_key,
          base_url: oldConfig.base_url,
          provider: oldConfig.provider
        };
      }
      
      // LLM 类型健康检查
      const checkResult = await checkLLMAgent(modelConfig, agent.model);
      result = {
        ...checkResult,
        latency: checkResult.latency || 0,
        checked_at: checkResult.checked_at || new Date().toISOString()
      };
    } else if (agent.agent_type === 'process') {
      // 进程类型健康检查
      const checkResult = await checkProcessAgent(agent);
      result = {
        ...checkResult,
        latency: checkResult.latency || 0,
        checked_at: checkResult.checked_at || new Date().toISOString()
      };
    }
    
    result.latency = Date.now() - startTime;
    result.checked_at = new Date().toISOString();
    
    // 更新健康检查结果
    const onlineStatus = result.online ? 'online' : 'offline';
    const updateData: any = {
      online_status: onlineStatus,
      work_status: result.online ? 'idle' : 'error',
      last_health_check: result.checked_at,
      health_check_result: result
    };
    
    await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id);
    
    // 记录健康检查日志
    await supabase
      .from('agent_health_logs')
      .insert({
        agent_id: id,
        check_type: checkType,
        online_status: onlineStatus,
        check_result: {
          online: result.online,
          message: result.message,
          details: result.details,
          latency: result.latency
        },
        error_message: result.online ? null : (result.details || result.message)
      });
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    
    // 记录失败日志
    try {
      const { id } = await params;
      const supabase = getSupabaseClient();
      await supabase
        .from('agent_health_logs')
        .insert({
          agent_id: id,
          check_type: 'manual',
          online_status: 'offline',
          check_result: {
            online: false,
            message: '健康检查异常'
          },
          error_message: error instanceof Error ? error.message : '未知错误'
        });
    } catch (logError) {
      console.error('记录日志失败:', logError);
    }
    
    return NextResponse.json(
      { success: false, error: '健康检查失败' },
      { status: 500 }
    );
  }
}

/**
 * 检查 LLM 智能体是否在线
 */
async function checkLLMAgent(
  modelConfig: {
    api_key?: string;
    base_url?: string;
    provider?: string;
    default_model?: string;
  },
  model?: string
): Promise<{
  online: boolean;
  message: string;
  details?: string;
  latency?: number;
  checked_at?: string;
}> {
  try {
    const apiKey = modelConfig.api_key;
    let baseUrl = modelConfig.base_url;
    const provider = modelConfig.provider;
    
    // 根据 provider 设置默认 base_url
    if (!baseUrl) {
      switch (provider) {
        case 'doubao':
        case 'coze':
          baseUrl = 'https://api.coze.cn';
          break;
        case 'deepseek':
          baseUrl = 'https://api.deepseek.com';
          break;
        case 'kimi':
          baseUrl = 'https://api.moonshot.cn';
          break;
        case 'zhipu':
          baseUrl = 'https://open.bigmodel.cn';
          break;
        case 'openai':
          baseUrl = 'https://api.openai.com';
          break;
        default:
          baseUrl = 'https://api.coze.cn';
      }
    }
    
    if (!apiKey) {
      return {
        online: false,
        message: '未配置 API Key',
        details: '请在智能体配置中设置 API Key 或关联大模型配置'
      };
    }
    
    // 根据不同的 provider 进行测试
    if (provider === 'doubao' || provider === 'coze' || baseUrl.includes('coze')) {
      // Coze/Doubao API 测试
      const response = await fetch(`${baseUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_id: 'health-check',
          user_id: 'health-check',
          additional_messages: [
            { role: 'user', content: 'ping', content_type: 'text' }
          ]
        })
      });
      
      if (response.ok) {
        return {
          online: true,
          message: 'API 连接正常'
        };
      } else {
        const errorBody = await response.text();
        const details = errorBody.substring(0, 200);
        
        if (response.status === 401) {
          return {
            online: false,
            message: 'API Key 无效或已过期',
            details: '请检查 API Key 是否正确'
          };
        } else if (response.status === 404) {
          return {
            online: false,
            message: 'API 地址错误',
            details: `请检查 base_url: ${baseUrl}`
          };
        } else if (response.status === 429) {
          return {
            online: false,
            message: 'API 请求频率限制',
            details: '请稍后重试'
          };
        }
        
        return {
          online: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          details
        };
      }
    } else {
      // 通用 OpenAI 兼容 API 测试
      // 处理 base_url：如果已经包含 /v1，则不再添加
      let testUrl = baseUrl;
      if (baseUrl.endsWith('/v1') || baseUrl.endsWith('/v1/')) {
        testUrl = baseUrl.replace(/\/v1\/?$/, '');
      }
      
      const response = await fetch(`${testUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        return {
          online: true,
          message: 'API 连接正常'
        };
      } else {
        const errorBody = await response.text();
        const details = errorBody.substring(0, 200);
        
        if (response.status === 401) {
          return {
            online: false,
            message: 'API Key 无效或已过期',
            details: '请检查 API Key 是否正确'
          };
        } else if (response.status === 404) {
          return {
            online: false,
            message: 'API 地址错误',
            details: `请检查 base_url: ${baseUrl}`
          };
        }
        
        return {
          online: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          details
        };
      }
    }
  } catch (error: any) {
    console.error('LLM 健康检查失败:', error);
    
    // 解析错误信息
    let message = '连接失败';
    let details = '';
    
    if (error.message) {
      if (error.message.includes('ENOTFOUND')) {
        message = '无法解析 API 地址';
        details = '请检查网络连接和 API 地址是否正确';
      } else if (error.message.includes('timeout')) {
        message = '连接超时';
        details = 'API 服务响应时间过长，请检查网络或稍后重试';
      } else if (error.message.includes('ECONNREFUSED')) {
        message = '连接被拒绝';
        details = 'API 服务可能未启动或端口被阻止';
      } else if (error.message.includes('certificate')) {
        message = 'SSL 证书错误';
        details = '请检查 API 服务的 SSL 配置';
      } else {
        message = '连接失败';
        details = error.message.substring(0, 200);
      }
    }
    
    return {
      online: false,
      message,
      details
    };
  }
}

/**
 * 检查进程智能体是否在线
 */
async function checkProcessAgent(agent: any): Promise<{
  online: boolean;
  message: string;
  latency?: number;
  checked_at?: string;
}> {
  try {
    const processConfig = agent.process_config;
    
    if (!processConfig || !processConfig.command) {
      return {
        online: false,
        message: '未配置启动命令'
      };
    }
    
    // 检查进程是否存在
    if (agent.process_pid) {
      try {
        // 发送信号 0 检查进程是否存在
        process.kill(agent.process_pid, 0);
        return {
          online: true,
          message: '进程运行中'
        };
      } catch {
        // 进程不存在
        return {
          online: false,
          message: '进程已停止'
        };
      }
    }
    
    // 没有进程 PID，检查命令是否可执行
    const { execSync } = require('child_process');
    const command = processConfig.command;
    
    try {
      // 检查命令是否存在
      execSync(`which ${command}`, { stdio: 'ignore' });
      return {
        online: false,
        message: '命令可用，等待启动'
      };
    } catch {
      return {
        online: false,
        message: `命令不存在: ${command}`
      };
    }
  } catch (error: any) {
    return {
      online: false,
      message: error.message || '检查失败'
    };
  }
}

// GET /api/agents/[id]/health-check - 获取健康检查状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
    const { data: agent, error } = await supabase
      .from('agents')
      .select('online_status, work_status, last_health_check, health_check_result')
      .eq('id', id)
      .single();
    
    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        online_status: agent.online_status || 'unknown',
        work_status: agent.work_status || 'idle',
        last_health_check: agent.last_health_check,
        health_check_result: agent.health_check_result
      }
    });
  } catch (error) {
    console.error('获取健康状态失败:', error);
    return NextResponse.json(
      { success: false, error: '获取健康状态失败' },
      { status: 500 }
    );
  }
}
