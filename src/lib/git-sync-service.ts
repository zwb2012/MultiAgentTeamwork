/**
 * Git 同步服务
 * 负责克隆、拉取和同步 Git 仓库
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { decrypt } from './encryption';

const execAsync = promisify(exec);

// 同步结果
export interface SyncResult {
  commitSha: string;
  commitsCount: number;
  changes: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
}

export class GitSyncService {
  private baseDir: string;

  constructor() {
    // 项目克隆的基础目录
    this.baseDir = process.env.PROJECTS_DIR || '/tmp/projects';
  }

  /**
   * 同步项目
   */
  async syncProject(project: {
    id: string;
    git_url: string;
    git_branch: string;
    git_token?: string;
    local_path?: string;
    last_commit_sha?: string;
  }): Promise<SyncResult> {
    const projectDir = project.local_path || path.join(this.baseDir, project.id);
    
    // 确保目录存在
    await fs.mkdir(this.baseDir, { recursive: true });
    
    // 检查项目是否已克隆
    const isCloned = await this.isProjectCloned(projectDir);
    
    if (isCloned) {
      // 拉取最新代码
      return await this.pullProject(project, projectDir);
    } else {
      // 克隆项目
      return await this.cloneProject(project, projectDir);
    }
  }

  /**
   * 检查项目是否已克隆
   */
  private async isProjectCloned(projectDir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(projectDir, '.git'));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 克隆项目
   */
  private async cloneProject(
    project: {
      git_url: string;
      git_branch: string;
      git_token?: string;
    },
    projectDir: string
  ): Promise<SyncResult> {
    // 构建带认证的 Git URL
    const authenticatedUrl = await this.buildAuthenticatedUrl(
      project.git_url,
      project.git_token
    );
    
    // 克隆命令
    const cloneCommand = `git clone --branch ${project.git_branch} --single-branch ${authenticatedUrl} ${projectDir}`;
    
    console.log(`克隆项目: ${project.git_url} -> ${projectDir}`);
    
    try {
      await execAsync(cloneCommand, {
        timeout: 300000, // 5分钟超时
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      });
      
      // 获取最新 commit
      const { stdout: commitSha } = await execAsync(
        'git rev-parse HEAD',
        { cwd: projectDir }
      );
      
      // 获取所有文件列表
      const { stdout: files } = await execAsync(
        'git ls-tree --name-only -r HEAD',
        { cwd: projectDir }
      );
      
      const allFiles = files.trim().split('\n').filter(Boolean);
      
      return {
        commitSha: commitSha.trim(),
        commitsCount: 1, // 首次克隆算1个提交
        changes: {
          added: allFiles,
          modified: [],
          deleted: []
        }
      };
    } catch (error) {
      // 清理失败的克隆目录
      try {
        await fs.rm(projectDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('清理失败:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 拉取项目更新
   */
  private async pullProject(
    project: {
      git_url: string;
      git_branch: string;
      git_token?: string;
      last_commit_sha?: string;
    },
    projectDir: string
  ): Promise<SyncResult> {
    // 获取当前 commit
    const { stdout: beforeCommit } = await execAsync(
      'git rev-parse HEAD',
      { cwd: projectDir }
    );
    
    // 更新远程 URL（token 可能已更新）
    const authenticatedUrl = await this.buildAuthenticatedUrl(
      project.git_url,
      project.git_token
    );
    
    await execAsync(
      `git remote set-url origin ${authenticatedUrl}`,
      { cwd: projectDir }
    );
    
    // 拉取最新代码
    console.log(`拉取更新: ${project.git_url}`);
    
    await execAsync(
      `git fetch origin ${project.git_branch}`,
      { cwd: projectDir }
    );
    
    // 检查是否有更新
    const { stdout: localCommit } = await execAsync(
      'git rev-parse HEAD',
      { cwd: projectDir }
    );
    
    const { stdout: remoteCommit } = await execAsync(
      `git rev-parse origin/${project.git_branch}`,
      { cwd: projectDir }
    );
    
    if (localCommit.trim() === remoteCommit.trim()) {
      // 没有更新
      return {
        commitSha: localCommit.trim(),
        commitsCount: 0,
        changes: {
          added: [],
          modified: [],
          deleted: []
        }
      };
    }
    
    // 获取变更统计
    const { stdout: diffStat } = await execAsync(
      `git diff --name-status HEAD origin/${project.git_branch}`,
      { cwd: projectDir }
    );
    
    // 拉取更新
    await execAsync(
      `git pull origin ${project.git_branch}`,
      { cwd: projectDir }
    );
    
    // 解析变更
    const changes = this.parseDiffOutput(diffStat);
    
    // 获取新的 commit 数量
    const { stdout: commitCount } = await execAsync(
      `git rev-list ${beforeCommit.trim()}..HEAD --count`,
      { cwd: projectDir }
    );
    
    const { stdout: newCommitSha } = await execAsync(
      'git rev-parse HEAD',
      { cwd: projectDir }
    );
    
    return {
      commitSha: newCommitSha.trim(),
      commitsCount: parseInt(commitCount.trim()) || 1,
      changes
    };
  }

  /**
   * 构建带认证的 Git URL
   */
  private async buildAuthenticatedUrl(
    gitUrl: string,
    encryptedToken?: string
  ): Promise<string> {
    if (!encryptedToken) {
      return gitUrl;
    }
    
    try {
      const token = await decrypt(encryptedToken);
      
      // HTTPS URL 格式: https://token@github.com/user/repo.git
      if (gitUrl.startsWith('https://')) {
        return gitUrl.replace('https://', `https://${token}@`);
      }
      
      // SSH URL 暂不支持 token 认证
      return gitUrl;
    } catch (error) {
      console.error('解密 token 失败:', error);
      return gitUrl;
    }
  }

  /**
   * 解析 git diff 输出
   */
  private parseDiffOutput(diffOutput: string): {
    added: string[];
    modified: string[];
    deleted: string[];
  } {
    const changes = {
      added: [] as string[],
      modified: [] as string[],
      deleted: [] as string[]
    };
    
    if (!diffOutput.trim()) {
      return changes;
    }
    
    const lines = diffOutput.trim().split('\n');
    
    for (const line of lines) {
      const [status, file] = line.split('\t');
      
      switch (status) {
        case 'A': // 新增
          changes.added.push(file);
          break;
        case 'M': // 修改
          changes.modified.push(file);
          break;
        case 'D': // 删除
          changes.deleted.push(file);
          break;
        case 'R': // 重命名
          const [oldFile, newFile] = file.split('\t');
          changes.deleted.push(oldFile);
          changes.added.push(newFile);
          break;
        default:
          // 其他类型（如 C 复制）视为修改
          changes.modified.push(file);
      }
    }
    
    return changes;
  }

  /**
   * 获取项目文件列表
   */
  async listFiles(projectId: string, localPath?: string): Promise<string[]> {
    const projectDir = localPath || path.join(this.baseDir, projectId);
    
    if (!(await this.isProjectCloned(projectDir))) {
      return [];
    }
    
    const { stdout } = await execAsync(
      'git ls-tree --name-only -r HEAD',
      { cwd: projectDir }
    );
    
    return stdout.trim().split('\n').filter(Boolean);
  }

  /**
   * 读取项目文件内容
   */
  async readFile(
    projectId: string,
    filePath: string,
    localPath?: string
  ): Promise<string> {
    const projectDir = localPath || path.join(this.baseDir, projectId);
    const fullPath = path.join(projectDir, filePath);
    
    return await fs.readFile(fullPath, 'utf8');
  }
}

// 导出单例实例
export const gitSyncService = new GitSyncService();
