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
import type { Pipeline, PipelineNode, PipelineRun } from '@/types/agent';

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
export function getAllPipelines(): any[] {
  const dirs = listDirs(PIPELINES_DIR);
  const pipelines: any[] = [];
  
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
        is_active: data.is_active !== false,
        created_at: data.created_at || new Date().toISOString(),
        nodes: nodes,
        ...data
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
export function getPipeline(id: string): any | null {
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
    is_active: data.is_active !== false,
    created_at: data.created_at || new Date().toISOString(),
    nodes: nodes,
    ...data
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
  nodes?: any[];
}): any {
  const id = generateId().substring(0, 8);
  const now = new Date().toISOString();
  
  const frontmatter = generateFrontmatter({
    name: data.name,
    trigger_type: data.trigger_type || 'manual',
    status: 'draft',
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
  
  return getPipeline(id);
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
  status?: string;
  nodes?: any[];
}): any | null {
  const existing = getPipeline(id);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  
  const frontmatter = generateFrontmatter({
    name: data.name || existing.name,
    trigger_type: existing.trigger_type,
    status: data.status || existing.status,
    is_active: existing.is_active,
    created_at: existing.created_at,
    updated_at: now
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
 * 运行流水线（模拟）
 */
export function runPipeline(id: string): any {
  const pipeline = getPipeline(id);
  if (!pipeline) {
    throw new Error('流水线不存在');
  }
  
  const runId = generateId().substring(0, 8);
  const now = new Date().toISOString();
  
  // 创建运行记录
  const runFrontmatter = generateFrontmatter({
    pipeline_id: id,
    status: 'running',
    trigger_by: 'manual',
    total_nodes: pipeline.nodes?.length || 0,
    started_at: now
  });
  
  const runContent = `${runFrontmatter}

# 执行日志

流水线开始执行...
`;
  
  const runsDir = path.join(PIPELINES_DIR, id, 'runs');
  const runPath = path.join(runsDir, `${runId}.md`);
  writeFile(runPath, runContent);
  
  // 异步执行（实际生产环境应该用消息队列）
  executePipelineAsync(id, runId, pipeline.nodes || []);
  
  return {
    id: runId,
    pipeline_id: id,
    status: 'running',
    started_at: now
  };
}

/**
 * 异步执行流水线
 */
async function executePipelineAsync(pipelineId: string, runId: string, nodes: any[]): Promise<void> {
  const runPath = path.join(PIPELINES_DIR, pipelineId, 'runs', `${runId}.md`);
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    // 更新运行记录
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `\n## [${timestamp}] 节点: ${node.name}\n\n状态: 执行中...\n`;
    
    const currentContent = readFile(runPath) || '';
    writeFile(runPath, currentContent + logEntry);
    
    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 记录完成
    const completeEntry = `状态: ✅ 完成\n`;
    writeFile(runPath, readFile(runPath) + completeEntry);
  }
  
  // 标记完成
  const finalContent = readFile(runPath) || '';
  const endTimestamp = new Date().toLocaleTimeString();
  const endEntry = `\n---\n\n## [${endTimestamp}] 流水线执行完成 ✅\n`;
  
  writeFile(runPath, finalContent + endEntry);
  
  // 更新状态为success
  const { data, body } = parseFrontmatter(finalContent);
  const updatedFrontmatter = generateFrontmatter({
    ...data,
    status: 'success',
    completed_at: new Date().toISOString()
  });
  
  writeFile(runPath, `${updatedFrontmatter}\n${body}`);
}
