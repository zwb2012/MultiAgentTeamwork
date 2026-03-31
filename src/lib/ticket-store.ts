/**
 * 工单文件存储
 * 使用状态目录和MD文件管理工单流转
 */

import * as path from 'path';
import {
  initDataDirs,
  readFile,
  writeFile,
  moveFile,
  listFiles,
  fileExists,
  TICKETS_DIR,
  TICKET_STATUS_DIRS
} from './file-store';
import type { Ticket, TicketStatus, TicketType, TicketPriority } from '@/types/agent';

// 初始化
initDataDirs();

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

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
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      if (value === 'true') {
        frontmatter[key] = true;
      } else if (value === 'false') {
        frontmatter[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        frontmatter[key] = Number(value);
      } else if (value.startsWith('[')) {
        try {
          frontmatter[key] = JSON.parse(value);
        } catch {
          frontmatter[key] = value;
        }
      } else {
        frontmatter[key] = value;
      }
    }
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
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (String(value).includes('\n')) {
      lines.push(`${key}: |`);
      for (const line of String(value).split('\n')) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/**
 * 获取状态目录
 */
function getStatusDir(status: TicketStatus): string {
  const statusMap: Record<string, string> = {
    open: 'open',
    in_progress: 'in_progress',
    resolved: 'resolved',
    closed: 'closed'
  };
  return statusMap[status] || 'open';
}

/**
 * 查找工单文件路径
 */
function findTicketPath(id: string): { path: string; status: TicketStatus } | null {
  for (const status of TICKET_STATUS_DIRS) {
    const filePath = path.join(TICKETS_DIR, status, `${id}.md`);
    if (fileExists(filePath)) {
      return { path: filePath, status: status as TicketStatus };
    }
  }
  return null;
}

/**
 * 获取所有工单
 */
export function getAllTickets(): any[] {
  const tickets: any[] = [];
  
  for (const status of TICKET_STATUS_DIRS) {
    const statusDir = path.join(TICKETS_DIR, status);
    const files = listFiles(statusDir, '.md');
    
    for (const file of files) {
      const filePath = path.join(statusDir, file);
      const content = readFile(filePath);
      
      if (content) {
        const { data, body } = parseFrontmatter(content);
        tickets.push({
          id: file.replace('.md', ''),
          title: data.title || '未命名工单',
          description: body.trim(),
          type: data.type || 'bug',
          priority: data.priority || 'medium',
          status,
          assignee_id: data.assignee_id,
          assignee: data.assignee_name ? { name: data.assignee_name } : null,
          created_at: data.created_at || new Date().toISOString(),
          ...data
        });
      }
    }
  }
  
  return tickets.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * 获取工单详情
 */
export function getTicket(id: string): any | null {
  const found = findTicketPath(id);
  if (!found) return null;
  
  const content = readFile(found.path);
  if (!content) return null;
  
  const { data, body } = parseFrontmatter(content);
  
  return {
    id,
    title: data.title || '未命名工单',
    description: body.trim(),
    type: data.type || 'bug',
    priority: data.priority || 'medium',
    status: found.status,
    assignee_id: data.assignee_id,
    assignee: data.assignee_name ? { name: data.assignee_name } : null,
    created_at: data.created_at || new Date().toISOString(),
    ...data
  };
}

/**
 * 创建工单
 */
export function createTicket(data: {
  type: TicketType;
  title: string;
  description?: string;
  priority: TicketPriority;
  assignee_id?: string;
  assignee_name?: string;
}): any {
  const id = generateId().substring(0, 8);
  const now = new Date().toISOString();
  
  const frontmatter = generateFrontmatter({
    title: data.title,
    type: data.type,
    priority: data.priority,
    assignee_id: data.assignee_id || '',
    assignee_name: data.assignee_name || '',
    reporter_id: '',
    created_at: now
  });
  
  const content = `${frontmatter}
${data.description || ''}
`;
  
  const filePath = path.join(TICKETS_DIR, 'open', `${id}.md`);
  writeFile(filePath, content);
  
  return getTicket(id);
}

/**
 * 更新工单状态（流转）
 */
export function updateTicketStatus(
  id: string, 
  newStatus: TicketStatus,
  comment?: string
): any | null {
  const found = findTicketPath(id);
  if (!found) return null;
  
  const content = readFile(found.path);
  if (!content) return null;
  
  const { data, body } = parseFrontmatter(content);
  
  // 更新时间
  data.updated_at = new Date().toISOString();
  data.status = newStatus;
  
  // 添加流转记录
  const historyEntry = `\n---\n\n## 流转记录 [${new Date().toLocaleString()}]\n\n- 从 "${found.status}" 流转到 "${newStatus}"\n${comment ? `- 备注: ${comment}` : ''}\n`;
  
  const newContent = `${generateFrontmatter(data)}
${body}${historyEntry}
`;
  
  // 移动到新状态目录
  const newStatusDir = getStatusDir(newStatus);
  const newPath = path.join(TICKETS_DIR, newStatusDir, `${id}.md`);
  
  writeFile(newPath, newContent);
  
  // 删除旧文件
  if (found.path !== newPath) {
    const fs = require('fs');
    fs.unlinkSync(found.path);
  }
  
  return getTicket(id);
}

/**
 * 更新工单
 */
export function updateTicket(
  id: string, 
  data: {
    title?: string;
    description?: string;
    priority?: TicketPriority;
    assignee_id?: string;
    assignee_name?: string;
    status?: TicketStatus;
    comment?: string;
  }
): any | null {
  const found = findTicketPath(id);
  if (!found) return null;
  
  const content = readFile(found.path);
  if (!content) return null;
  
  const { data: existingData, body } = parseFrontmatter(content);
  
  // 合并更新
  const updatedData = {
    ...existingData,
    title: data.title || existingData.title,
    priority: data.priority || existingData.priority,
    assignee_id: data.assignee_id ?? existingData.assignee_id,
    assignee_name: data.assignee_name ?? existingData.assignee_name,
    updated_at: new Date().toISOString()
  };
  
  // 添加流转记录
  let newBody = body;
  if (data.status && data.status !== found.status) {
    newBody += `\n---\n\n## 流转记录 [${new Date().toLocaleString()}]\n\n- 从 "${found.status}" 流转到 "${data.status}"\n${data.comment ? `- 备注: ${data.comment}` : ''}\n`;
  }
  
  const newContent = `${generateFrontmatter(updatedData)}
${newBody}
`;
  
  // 如果状态变化，移动文件
  if (data.status && data.status !== found.status) {
    const newStatusDir = getStatusDir(data.status);
    const newPath = path.join(TICKETS_DIR, newStatusDir, `${id}.md`);
    
    writeFile(newPath, newContent);
    
    // 删除旧文件
    if (found.path !== newPath) {
      const fs = require('fs');
      fs.unlinkSync(found.path);
    }
  } else {
    writeFile(found.path, newContent);
  }
  
  return getTicket(id);
}

/**
 * 删除工单
 */
export function deleteTicket(id: string): boolean {
  const found = findTicketPath(id);
  if (!found) return false;
  
  const fs = require('fs');
  fs.unlinkSync(found.path);
  return true;
}

/**
 * 获取工单统计
 */
export function getTicketStats(): Record<string, number> {
  const stats: Record<string, number> = {
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0
  };
  
  for (const status of TICKET_STATUS_DIRS) {
    const statusDir = path.join(TICKETS_DIR, status);
    const files = listFiles(statusDir, '.md');
    stats[status] = files.length;
    stats.total += files.length;
  }
  
  return stats;
}
