/**
 * 文件存储工具
 * 使用本地文件系统存储流水线和工单数据
 */

import * as fs from 'fs';
import * as path from 'path';

// 数据目录
const DATA_DIR = process.env.COZE_WORKSPACE_PATH 
  ? path.join(process.env.COZE_WORKSPACE_PATH, 'data')
  : path.join(process.cwd(), 'data');

// 流水线目录
const PIPELINES_DIR = path.join(DATA_DIR, 'pipelines');

// 工单目录
const TICKETS_DIR = path.join(DATA_DIR, 'tickets');

// 工单状态目录
const TICKET_STATUS_DIRS = ['open', 'in_progress', 'resolved', 'closed'];

/**
 * 确保目录存在
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 初始化数据目录
 */
export function initDataDirs(): void {
  ensureDir(DATA_DIR);
  ensureDir(PIPELINES_DIR);
  ensureDir(TICKETS_DIR);
  
  // 创建工单状态目录
  for (const status of TICKET_STATUS_DIRS) {
    ensureDir(path.join(TICKETS_DIR, status));
  }
}

/**
 * 读取文件内容
 */
export function readFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error);
    return null;
  }
}

/**
 * 写入文件内容
 */
export function writeFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`写入文件失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 删除文件
 */
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.error(`删除文件失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 移动文件
 */
export function moveFile(source: string, target: string): boolean {
  try {
    const targetDir = path.dirname(target);
    ensureDir(targetDir);
    
    if (fs.existsSync(source)) {
      fs.renameSync(source, target);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`移动文件失败: ${source} -> ${target}`, error);
    return false;
  }
}

/**
 * 列出目录下的所有文件
 */
export function listFiles(dir: string, extension?: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    const files = fs.readdirSync(dir);
    if (extension) {
      return files.filter(f => f.endsWith(extension));
    }
    return files;
  } catch (error) {
    console.error(`列出目录失败: ${dir}`, error);
    return [];
  }
}

/**
 * 列出目录下的所有子目录
 */
export function listDirs(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch (error) {
    console.error(`列出目录失败: ${dir}`, error);
    return [];
  }
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 获取文件状态信息
 */
export function getFileStats(filePath: string): {
  exists: boolean;
  created?: Date;
  modified?: Date;
  size?: number;
} {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        created: stats.birthtime,
        modified: stats.mtime,
        size: stats.size
      };
    }
    return { exists: false };
  } catch (error) {
    return { exists: false };
  }
}

// 导出路径常量
export { DATA_DIR, PIPELINES_DIR, TICKETS_DIR, TICKET_STATUS_DIRS };
