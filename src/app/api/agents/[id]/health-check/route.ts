import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST /api/agents/[id]/health-check - 健康检查
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    
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
      // LLM 类型健康检查
      const checkResult = await checkLLMAgent(agent);
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
    const updateData: any = {
      online_status: result.online ? 'online' : 'offline',
      work_status: result.online ? 'idle' : 'error',
      last_health_check: result.checked_at,
      health_check_result: result
    };
    
    await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id);
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    return NextResponse.json(
      { success: false, error: '健康检查失败' },
      { status: 500 }
    );
  }
}

/**
 * 检查 LLM 智能体是否在线
 */
async function checkLLMAgent(agent: any): Promise<{
  online: boolean;
  message: string;
  latency?: number;
  checked_at?: string;
}> {
  try {
    const modelConfig = agent.model_config || {};
    const apiKey = modelConfig.api_key || process.env.COZE_API_KEY;
    const baseUrl = modelConfig.base_url || process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
    
    if (!apiKey) {
      return {
        online: false,
        message: '未配置 API Key'
      };
    }
    
    // 使用 fetch 发送简单的测试请求
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
    } else if (response.status === 401) {
      return {
        online: false,
        message: 'API Key 无效'
      };
    } else if (response.status === 404) {
      return {
        online: false,
        message: 'API 地址错误'
      };
    } else {
      return {
        online: false,
        message: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error: any) {
    console.error('LLM 健康检查失败:', error);
    
    // 解析错误信息
    let message = '连接失败';
    if (error.message) {
      if (error.message.includes('ENOTFOUND')) {
        message = '无法解析 API 地址';
      } else if (error.message.includes('timeout')) {
        message = '连接超时';
      } else {
        message = error.message.substring(0, 100);
      }
    }
    
    return {
      online: false,
      message
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
