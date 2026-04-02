/**
 * 流水线文件存储
 * 使用MD文件管理流水线
 */

import * as path from 'path';
import {
  initDataDirs,
  readFile,
  writeFile,
  deleteFile,
  listDirs,
  fileExists,
  PIPELINES_DIR
} from './file-store';
import type { Pipeline, PipelineNode, PipelineRun, TicketInput, PipelineDefinitionStatus, PipelineRunStatus } from '@/types/pipeline';

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// 初始化
initDataDirs();

/**
 * 解析MD文件中的YAML frontmatter
 */
function parseFrontmatter(content: string): { data: Record<string, any>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { data: {}, body: content };
  }
  
  const frontmatter: Record<string, any> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let currentArray: any[] | null = null;
  let inMultiline = false;
  let multilineKey = '';
  let multilineValue = '';
  
  for (const line of lines) {
    // 处理多行值
    if (inMultiline) {
      if (line.startsWith('  ') || line.startsWith('\t')) {
        multilineValue += line.trim() + '\n';
        continue;
      } else {
        frontmatter[multilineKey] = multilineValue.trim();
        inMultiline = false;
        multilineKey = '';
        multilineValue = '';
      }
    }
    
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      // 数组类型
      if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
        frontmatter[key] = items;
      }
      // 多行文本
      else if (value === '|' || value === '>') {
        inMultiline = true;
        multilineKey = key;
        multilineValue = '';
      }
      // 布尔值
      else if (value === 'true') {
        frontmatter[key] = true;
      } else if (value === 'false') {
        frontmatter[key] = false;
      }
      // 数字
      else if (!isNaN(Number(value)) && value !== '') {
        frontmatter[key] = Number(value);
      }
      // JSON对象
      else if (value.startsWith('{')) {
        try {
          frontmatter[key] = JSON.parse(value);
        } catch {
          frontmatter[key] = value;
        }
      }
      // 字符串
      else {
        frontmatter[key] = value;
      }
      currentKey = key;
    }
  }
  
  // 处理最后一个多行值
  if (inMultiline && multilineKey) {
    frontmatter[multilineKey] = multilineValue.trim();
  }
  
  return { data: frontmatter, body: match[2] };
}

/**
 * 生成YAML frontmatter
 */
function generateFrontmatter(data: Record<string, any>): string {
  const lines: string[] = ['---'];
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      // 多行文本用 |
      if (String(value).includes('\n')) {
        lines.push(`${key}: |`);
        for (const line of String(value).split('\n')) {
          lines.push(`  ${line}`);
        }
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/**
 * 获取所有流水线
 */
export function getAllPipelines(): Pipeline[] {
  const dirs = listDirs(PIPELINES_DIR);
  const pipelines: Pipeline[] = [];
  
  for (const dir of dirs) {
    const configPath = path.join(PIPELINES_DIR, dir, 'config.md');
    const content = readFile(configPath);
    
    if (content) {
      const { data, body } = parseFrontmatter(content);
      const nodes = getPipelineNodes(dir);
      
      pipelines.push({
        id: dir,
        name: data.name || dir,
        description: body.trim(),
        trigger_type: data.trigger_type || 'manual',
        status: data.status || 'draft',
        run_status: data.run_status || 'idle',
        is_active: data.is_active !== false,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at,
        last_run_at: data.last_run_at,
        last_run_status: data.last_run_status,
        nodes: nodes
      });
    }
  }
  
  return pipelines.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * 获取流水线详情
 */
export function getPipeline(id: string): Pipeline | null {
  const configPath = path.join(PIPELINES_DIR, id, 'config.md');
  const content = readFile(configPath);
  
  if (!content) {
    return null;
  }
  
  const { data, body } = parseFrontmatter(content);
  const nodes = getPipelineNodes(id);
  
  return {
    id,
    name: data.name || id,
    description: body.trim(),
    trigger_type: data.trigger_type || 'manual',
    status: data.status || 'draft',
    run_status: data.run_status || 'idle',
    is_active: data.is_active !== false,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at,
    last_run_at: data.last_run_at,
    last_run_status: data.last_run_status,
    nodes: nodes
  };
}

/**
 * 获取流水线节点
 */
export function getPipelineNodes(pipelineId: string): any[] {
  const nodesPath = path.join(PIPELINES_DIR, pipelineId, 'nodes.md');
  const content = readFile(nodesPath);
  
  if (!content) {
    return [];
  }
  
  const { body } = parseFrontmatter(content);
  const nodes: any[] = [];
  
  // 解析节点列表
  // 格式: ## Node: 节点名
  // agent_id: xxx
  // execution_mode: sequential
  const sections = body.split(/^## /m).filter(Boolean);
  
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const titleLine = lines[0];
    const nameMatch = titleLine.match(/^Node:\s*(.+)$/);
    
    if (nameMatch) {
      const node: any = {
        id: generateId(),
        name: nameMatch[1].trim(),
        node_type: 'agent',
        execution_mode: 'sequential',
        order_index: nodes.length
      };
      
      // 解析节点属性
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1];
          let value: any = match[2].trim();
          
          if (key === 'order_index') {
            value = parseInt(value);
          }
          
          node[key] = value;
        }
      }
      
      nodes.push(node);
    }
  }
  
  return nodes.sort((a, b) => a.order_index - b.order_index);
}

/**
 * 创建流水线
 */
export function createPipeline(data: {
  name: string;
  description?: string;
  trigger_type?: string;
  nodes?: PipelineNode[];
}): Pipeline {
  const id = generateId().substring(0, 8);
  const now = new Date().toISOString();
  
  const frontmatter = generateFrontmatter({
    name: data.name,
    trigger_type: data.trigger_type || 'manual',
    status: 'draft',
    run_status: 'idle',
    is_active: true,
    created_at: now
  });
  
  const content = `${frontmatter}
${data.description || ''}
`;
  
  const configPath = path.join(PIPELINES_DIR, id, 'config.md');
  writeFile(configPath, content);
  
  // 写入节点
  if (data.nodes && data.nodes.length > 0) {
    savePipelineNodes(id, data.nodes);
  }
  
  return getPipeline(id)!;
}

/**
 * 保存流水线节点
 */
export function savePipelineNodes(pipelineId: string, nodes: any[]): void {
  const nodesContent = `# 流水线节点

${nodes.map((node, index) => `## Node: ${node.name}
id: ${node.id || generateId()}
agent_id: ${node.agent_id || ''}
node_type: ${node.node_type || 'agent'}
execution_mode: ${node.execution_mode || 'sequential'}
parallel_group: ${node.parallel_group || ''}
order_index: ${index}
`).join('\n')}
`;
  
  const nodesPath = path.join(PIPELINES_DIR, pipelineId, 'nodes.md');
  writeFile(nodesPath, nodesContent);
}

/**
 * 更新流水线
 */
export function updatePipeline(id: string, data: {
  name?: string;
  description?: string;
  status?: PipelineDefinitionStatus;
  run_status?: PipelineRunStatus;
  nodes?: PipelineNode[];
  last_run_at?: string;
  last_run_status?: string;
}): Pipeline | null {
  const existing = getPipeline(id);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  
  const frontmatter = generateFrontmatter({
    name: data.name || existing.name,
    trigger_type: existing.trigger_type,
    status: data.status || existing.status,
    run_status: data.run_status || existing.run_status,
    is_active: existing.is_active,
    created_at: existing.created_at,
    updated_at: now,
    last_run_at: data.last_run_at !== undefined ? data.last_run_at : existing.last_run_at,
    last_run_status: data.last_run_status !== undefined ? data.last_run_status : existing.last_run_status
  });
  
  const content = `${frontmatter}
${data.description || existing.description || ''}
`;
  
  const configPath = path.join(PIPELINES_DIR, id, 'config.md');
  writeFile(configPath, content);
  
  // 更新节点
  if (data.nodes !== undefined) {
    savePipelineNodes(id, data.nodes);
  }
  
  return getPipeline(id);
}

/**
 * 删除流水线
 */
export function deletePipeline(id: string): boolean {
  const pipelinePath = path.join(PIPELINES_DIR, id);
  
  try {
    const fs = require('fs');
    if (fs.existsSync(pipelinePath)) {
      fs.rmSync(pipelinePath, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error('删除流水线失败:', error);
    return false;
  }
}

/**
 * 发布流水线
 */
export function publishPipeline(id: string): Pipeline | null {
  const pipeline = getPipeline(id);
  if (!pipeline) return null;
  
  if (pipeline.status === 'archived') {
    throw new Error('已归档的流水线不能发布');
  }
  
  // 验证流水线是否有节点
  if (!pipeline.nodes || pipeline.nodes.length === 0) {
    throw new Error('流水线必须至少有一个节点才能发布');
  }
  
  // 验证是否有开始和结束节点
  const hasStart = pipeline.nodes.some(n => n.node_type === 'start');
  const hasEnd = pipeline.nodes.some(n => n.node_type === 'end');
  
  if (!hasStart) {
    throw new Error('流水线必须有开始节点');
  }
  
  return updatePipeline(id, { status: 'published' });
}

/**
 * 撤回流水线（从已发布变为草稿）
 */
export function unpublishPipeline(id: string): Pipeline | null {
  const pipeline = getPipeline(id);
  if (!pipeline) return null;
  
  if (pipeline.run_status === 'running') {
    throw new Error('运行中的流水线不能撤回');
  }
  
  return updatePipeline(id, { status: 'draft' });
}

/**
 * 归档流水线
 */
export function archivePipeline(id: string): Pipeline | null {
  const pipeline = getPipeline(id);
  if (!pipeline) return null;
  
  if (pipeline.run_status === 'running') {
    throw new Error('运行中的流水线不能归档');
  }
  
  return updatePipeline(id, { status: 'archived' });
}

/**
 * 恢复流水线（从归档变为草稿）
 */
export function restorePipeline(id: string): Pipeline | null {
  return updatePipeline(id, { status: 'draft' });
}

/**
 * 运行流水线（支持工单输入）
 */
export function runPipeline(id: string, ticket?: TicketInput): PipelineRun {
  const pipeline = getPipeline(id);
  if (!pipeline) {
    throw new Error('流水线不存在');
  }
  
  if (pipeline.status !== 'published') {
    throw new Error('只有已发布的流水线才能执行');
  }
  
  if (pipeline.run_status === 'running') {
    throw new Error('流水线正在运行中，请等待执行完成');
  }
  
  const runId = generateId().substring(0, 8);
  const now = new Date().toISOString();
  
  // 更新流水线运行状态
  updatePipeline(id, { run_status: 'running' });
  
  // 创建运行记录
  const runFrontmatter = generateFrontmatter({
    pipeline_id: id,
    status: 'running',
    trigger_by: 'manual',
    ticket_id: ticket?.id,
    ticket_type: ticket?.type,
    total_nodes: pipeline.nodes?.length || 0,
    started_at: now,
    input_data: ticket ? {
      ticket_id: ticket.id,
      ticket_type: ticket.type,
      ticket_title: ticket.title,
      ticket_description: ticket.description,
      ticket_priority: ticket.priority,
      ticket_labels: ticket.labels
    } : undefined
  });
  
  let runContent = `${runFrontmatter}

# 执行日志

`;
  
  if (ticket) {
    runContent += `## 工单信息

- **类型**: ${ticket.type === 'bug' ? 'Bug' : ticket.type === 'feature' ? '新需求' : ticket.type === 'improvement' ? '改进' : '任务'}
- **标题**: ${ticket.title}
- **优先级**: ${ticket.priority || 'medium'}
- **描述**: ${ticket.description}

---

`;
  }
  
  runContent += `流水线开始执行...`;
  
  const runsDir = path.join(PIPELINES_DIR, id, 'runs');
  const runPath = path.join(runsDir, `${runId}.md`);
  writeFile(runPath, runContent);
  
  // 异步执行（实际生产环境应该用消息队列）
  executePipelineAsync(id, runId, pipeline.nodes || [], ticket);
  
  return {
    id: runId,
    pipeline_id: id,
    status: 'running',
    trigger_by: 'manual',
    ticket_id: ticket?.id,
    ticket_type: ticket?.type,
    total_nodes: pipeline.nodes?.length || 0,
    completed_nodes: 0,
    failed_nodes: 0,
    started_at: now,
    created_at: now,
    input_data: ticket ? {
      ticket_id: ticket.id,
      ticket_type: ticket.type,
      ticket_title: ticket.title,
      ticket_description: ticket.description
    } : undefined
  };
}

/**
 * 异步执行流水线
 */
async function executePipelineAsync(
  pipelineId: string, 
  runId: string, 
  nodes: PipelineNode[],
  ticket?: TicketInput
): Promise<void> {
  const runPath = path.join(PIPELINES_DIR, pipelineId, 'runs', `${runId}.md`);
  
  try {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      
      // 更新运行记录
      const timestamp = new Date().toLocaleTimeString();
      let logEntry = `\n## [${timestamp}] 节点: ${node.name}\n\n`;
      logEntry += `- 类型: ${node.node_type}\n`;
      logEntry += `- 状态: 执行中...\n\n`;
      
      const currentContent = readFile(runPath) || '';
      writeFile(runPath, currentContent + logEntry);
      
      // 模拟执行（实际应该调用智能体）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 记录完成
      const completeEntry = `状态: ✅ 完成\n`;
      writeFile(runPath, (readFile(runPath) || '') + completeEntry);
    }
    
    // 标记完成
    const finalContent = readFile(runPath) || '';
    const endTimestamp = new Date().toLocaleTimeString();
    const endEntry = `\n---\n\n## [${endTimestamp}] 流水线执行完成 ✅\n`;
    
    writeFile(runPath, finalContent + endEntry);
    
    // 更新状态为success
    const { data } = parseFrontmatter(finalContent);
    const updatedFrontmatter = generateFrontmatter({
      ...data,
      status: 'success',
      completed_at: new Date().toISOString()
    });
    
    // 更新流水线状态
    updatePipeline(pipelineId, { 
      run_status: 'success',
      last_run_at: new Date().toISOString(),
      last_run_status: 'success'
    });
    
    writeFile(runPath, `${updatedFrontmatter}\n${finalContent.split('---\n').slice(2).join('---\n')}${endEntry}`);
    
  } catch (error) {
    // 记录失败
    const errorEntry = `\n## ❌ 执行失败\n\n错误: ${error instanceof Error ? error.message : '未知错误'}\n`;
    writeFile(runPath, (readFile(runPath) || '') + errorEntry);
    
    // 更新流水线状态
    updatePipeline(pipelineId, { 
      run_status: 'failed',
      last_run_at: new Date().toISOString(),
      last_run_status: 'failed'
    });
  }
}

/**
 * 获取流水线运行记录
 */
export function getPipelineRuns(pipelineId: string): PipelineRun[] {
  const runsDir = path.join(PIPELINES_DIR, pipelineId, 'runs');
  const runs: PipelineRun[] = [];
  
  try {
    const fs = require('fs');
    if (!fs.existsSync(runsDir)) return [];
    
    const files = fs.readdirSync(runsDir).filter((f: string) => f.endsWith('.md'));
    
    for (const file of files) {
      const runPath = path.join(runsDir, file);
      const content = readFile(runPath);
      
      if (content) {
        const { data } = parseFrontmatter(content);
        runs.push({
          id: file.replace('.md', ''),
          pipeline_id: pipelineId,
          status: data.status || 'running',
          trigger_by: data.trigger_by || 'manual',
          ticket_id: data.ticket_id,
          ticket_type: data.ticket_type,
          total_nodes: data.total_nodes || 0,
          completed_nodes: data.completed_nodes || 0,
          failed_nodes: data.failed_nodes || 0,
          started_at: data.started_at,
          completed_at: data.completed_at,
          created_at: data.started_at || new Date().toISOString(),
          input_data: data.input_data
        });
      }
    }
    
    return runs.sort((a, b) => 
      new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()
    );
  } catch (error) {
    console.error('获取运行记录失败:', error);
    return [];
  }
}
