/**
 * 项目上下文注入工具
 * 用于在智能体对话时自动注入项目相关的上下文信息
 */

import type { Project } from '@/types/project';

// 项目上下文接口
export interface ProjectContext {
  project_id: string;
  project_name: string;
  local_path: string;
  git_url?: string;
  git_branch?: string;
  description?: string;
}

/**
 * 构建项目上下文系统提示词
 * 在智能体的system_prompt前添加项目信息
 */
export function buildProjectContextPrompt(context: ProjectContext): string {
  const parts: string[] = [
    `## 当前项目上下文`,
    ``,
    `你正在参与项目 **${context.project_name}** 的开发工作。`,
    ``,
    `### 项目信息`,
    `- **项目名称**: ${context.project_name}`,
  ];
  
  if (context.description) {
    parts.push(`- **项目描述**: ${context.description}`);
  }
  
  parts.push(`- **代码路径**: ${context.local_path}`);
  
  if (context.git_url) {
    parts.push(`- **Git仓库**: ${context.git_url}`);
  }
  
  if (context.git_branch) {
    parts.push(`- **当前分支**: ${context.git_branch}`);
  }
  
  parts.push(``);
  parts.push(`### 工作指南`);
  parts.push(`1. 你的工作范围限定在此项目内`);
  parts.push(`2. 读写文件时使用项目路径: ${context.local_path}`);
  parts.push(`3. 遵循项目已有的代码规范和目录结构`);
  parts.push(`4. 完成任务后，清晰地汇报你的工作成果`);
  parts.push(``);
  parts.push(`---`);
  parts.push(``);
  
  return parts.join('\n');
}

/**
 * 从项目数据构建项目上下文
 */
export function buildProjectContextFromProject(project: Project): ProjectContext {
  return {
    project_id: project.id,
    project_name: project.name,
    local_path: project.local_path || `/tmp/projects/${project.name}`,
    git_url: project.git_url,
    git_branch: project.git_branch,
    description: project.description
  };
}

/**
 * 注入项目上下文到系统提示词
 * 返回增强后的系统提示词
 */
export function injectProjectContext(
  systemPrompt: string,
  projectContext: ProjectContext | null
): string {
  if (!projectContext) {
    return systemPrompt;
  }
  
  const contextPrompt = buildProjectContextPrompt(projectContext);
  return contextPrompt + systemPrompt;
}
