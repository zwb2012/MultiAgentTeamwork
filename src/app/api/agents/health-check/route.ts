import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { decrypt } from '@/lib/encryption';

// POST /api/agents/health-check - 批量健康检查（用于定时任务）
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // 获取请求体中的配置
    let checkType = 'scheduled';
    try {
      const body = await request.json();
      checkType = body.check_type || 'scheduled';
    } catch {
      // 使用默认值
    }
    
    // 获取所有活跃的智能体（非模板）
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .eq('is_template', false);
    
    if (error) {
      console.error('获取智能体列表失败:', error);
      return NextResponse.json(
        { success: false, error: '获取智能体列表失败: ' + error.message },
        { status: 500 }
      );
    }
    
    if (!agents || agents.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: { checked: 0, results: [] }
      });
    }
    
    const results: Array<{
      agent_id: string;
      agent_name: string;
      online: boolean;
      message: string;
    }> = [];
    
    // 逐个检查智能体
    for (const agent of agents) {
      try {
        // 更新状态为检测中
        await supabase
          .from('agents')
          .update({ 
            online_status: 'checking',
            work_status: 'idle'
          })
          .eq('id', agent.id);
        
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
          
          if (agent.model_config_id) {
            const { data: config } = await supabase
              .from('model_configs')
              .select('*')
              .eq('id', agent.model_config_id)
              .single();
            
            if (config) {
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
          
          const checkResult = await checkLLMAgent(modelConfig, agent.model);
          result = {
            ...checkResult,
            latency: checkResult.latency || 0,
            checked_at: checkResult.checked_at || new Date().toISOString()
          };
        } else if (agent.agent_type === 'process') {
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
        await supabase
          .from('agents')
          .update({
            online_status: onlineStatus,
            work_status: result.online ? 'idle' : 'error',
            last_health_check: result.checked_at,
            health_check_result: result
          })
          .eq('id', agent.id);
        
        // 记录健康检查日志
        await supabase
          .from('agent_health_logs')
          .insert({
            agent_id: agent.id,
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
        
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          online: result.online,
          message: result.message
        });
        
      } catch (error) {
        console.error(`智能体 ${agent.name} 健康检查失败:`, error);
        
        // 记录失败
        await supabase
          .from('agents')
          .update({
            online_status: 'offline',
            work_status: 'error'
          })
          .eq('id', agent.id);
        
        await supabase
          .from('agent_health_logs')
          .insert({
            agent_id: agent.id,
            check_type: checkType,
            online_status: 'offline',
            check_result: {
              online: false,
              message: '健康检查异常'
            },
            error_message: error instanceof Error ? error.message : '未知错误'
          });
        
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          online: false,
          message: '检查异常'
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        checked: agents.length,
        online: results.filter(r => r.online).length,
        offline: results.filter(r => !r.online).length,
        results 
      }
    });
  } catch (error) {
    console.error('批量健康检查失败:', error);
    return NextResponse.json(
      { success: false, error: '批量健康检查失败' },
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
        return { online: true, message: 'API 连接正常' };
      } else {
        if (response.status === 401) {
          return { online: false, message: 'API Key 无效或已过期' };
        }
        return { online: false, message: `HTTP ${response.status}` };
      }
    } else {
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
        return { online: true, message: 'API 连接正常' };
      } else {
        if (response.status === 401) {
          return { online: false, message: 'API Key 无效或已过期' };
        }
        return { online: false, message: `HTTP ${response.status}` };
      }
    }
  } catch (error: any) {
    let message = '连接失败';
    if (error.message?.includes('ENOTFOUND')) {
      message = '无法解析 API 地址';
    } else if (error.message?.includes('timeout')) {
      message = '连接超时';
    }
    return { online: false, message, details: error.message };
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
  // 进程类型智能体暂时返回在线状态
  return {
    online: true,
    message: '进程智能体',
    checked_at: new Date().toISOString()
  };
}
