import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Agent, ProcessConfig } from '@/types/agent';

// 存储活跃的进程
const activeProcesses = new Map<string, ChildProcess>();

// POST /api/agents/[id]/process - 启动进程
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    // 获取智能体信息
    const { data: agent, error: agentError } = await client
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: '智能体不存在' },
        { status: 404 }
      );
    }
    
    if (agent.agent_type !== 'process') {
      return NextResponse.json(
        { success: false, error: '该智能体不是进程类型' },
        { status: 400 }
      );
    }
    
    const processConfig = agent.process_config as ProcessConfig;
    if (!processConfig?.command) {
      return NextResponse.json(
        { success: false, error: '未配置启动命令' },
        { status: 400 }
      );
    }
    
    // 检查是否已有进程在运行
    if (activeProcesses.has(id)) {
      return NextResponse.json(
        { success: false, error: '进程已在运行中' },
        { status: 400 }
      );
    }
    
    // 解析命令和参数
    const command = processConfig.command;
    const args = processConfig.args || [];
    const env = {
      ...process.env,
      ...processConfig.env
    };
    
    // 启动进程
    const childProcess = spawn(command, args, {
      env,
      cwd: processConfig.cwd || process.cwd(),
      shell: true,
      detached: false
    });
    
    // 存储进程引用
    activeProcesses.set(id, childProcess);
    
    // 监听进程事件
    childProcess.on('error', async (error) => {
      console.error(`进程 ${id} 错误:`, error);
      activeProcesses.delete(id);
      
      await client
        .from('agents')
        .update({ 
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    });
    
    childProcess.on('exit', async (code, signal) => {
      console.log(`进程 ${id} 退出: code=${code}, signal=${signal}`);
      activeProcesses.delete(id);
      
      // 如果是异常退出且配置了自动重启
      if (code !== 0 && processConfig.auto_restart) {
        console.log(`进程 ${id} 将在 ${processConfig.restart_delay || 5000}ms 后自动重启`);
        setTimeout(() => {
          // 重新触发启动
          fetch(`${process.env.DEPLOY_RUN_PORT ? `http://localhost:${process.env.DEPLOY_RUN_PORT}` : 'http://localhost:5000'}/api/agents/${id}/process`, {
            method: 'POST'
          });
        }, processConfig.restart_delay || 5000);
      } else {
        await client
          .from('agents')
          .update({ 
            status: 'idle',
            process_pid: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
    });
    
    // 捕获输出
    childProcess.stdout?.on('data', (data) => {
      console.log(`[Agent ${id} stdout]:`, data.toString());
    });
    
    childProcess.stderr?.on('data', (data) => {
      console.error(`[Agent ${id} stderr]:`, data.toString());
    });
    
    // 更新智能体状态
    await client
      .from('agents')
      .update({ 
        status: 'working',
        process_pid: childProcess.pid,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        pid: childProcess.pid,
        command: command,
        args: args
      }
    });
  } catch (error) {
    console.error('启动进程失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/process - 停止进程
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const childProcess = activeProcesses.get(id);
    
    if (!childProcess) {
      return NextResponse.json(
        { success: false, error: '没有找到运行中的进程' },
        { status: 404 }
      );
    }
    
    // 发送终止信号
    childProcess.kill('SIGTERM');
    
    // 等待进程退出
    setTimeout(() => {
      if (activeProcesses.has(id)) {
        const proc = activeProcesses.get(id);
        proc?.kill('SIGKILL');
        activeProcesses.delete(id);
      }
    }, 5000);
    
    activeProcesses.delete(id);
    
    // 更新智能体状态
    const client = getSupabaseClient();
    await client
      .from('agents')
      .update({ 
        status: 'idle',
        process_pid: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    return NextResponse.json({ 
      success: true, 
      message: '进程已停止' 
    });
  } catch (error) {
    console.error('停止进程失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// GET /api/agents/[id]/process - 获取进程状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const childProcess = activeProcesses.get(id);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        running: !!childProcess,
        pid: childProcess?.pid || null
      }
    });
  } catch (error) {
    console.error('获取进程状态失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
