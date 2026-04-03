/**
 * 技能注册表和预定义技能
 * 类似扣子空间的技能插槽系统
 */

import type { Skill, SkillResult, ProjectContext } from '@/types/skill';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 技能注册表
 */
export const skillRegistry: Record<string, Skill> = {};

/**
 * 注册技能
 */
export function registerSkill(skill: Skill): void {
  skillRegistry[skill.id] = skill;
}

/**
 * 获取技能
 */
export function getSkill(skillId: string): Skill | undefined {
  return skillRegistry[skillId];
}

/**
 * 获取所有技能
 */
export function getAllSkills(): Skill[] {
  return Object.values(skillRegistry);
}

/**
 * 按类别获取技能
 */
export function getSkillsByCategory(category: string): Skill[] {
  return Object.values(skillRegistry).filter(s => s.category === category);
}

// ==================== 代码生成技能 ====================

const generateCodeExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { language, requirements, filename, framework } = params;

  // 导入LLM
  const { LLMClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const llmClient = new LLMClient(config);

  const systemPrompt = `你是一位专业的${language}开发工程师，擅长编写高质量的代码。
请根据需求生成完整、可运行的代码。

要求：
1. 代码符合最佳实践和规范
2. 包含必要的注释
3. 考虑边界情况和错误处理
4. 代码结构清晰，易于维护

${framework ? `请使用 ${framework} 框架。` : ''}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `需求描述：${requirements}\n\n请生成${filename}的完整代码。`
    }
  ];

  const codeResult = await llmClient.stream(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.7,
    thinking: 'disabled' as const,
    caching: 'disabled' as const
  });

  let code = '';
  for await (const chunk of codeResult) {
    if (chunk.content) {
      code += chunk.content.toString();
    }
  }

  // 提取代码块（如果LLM返回的代码在markdown代码块中）
  const codeMatch = code.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
  const extractedCode = codeMatch ? codeMatch[1] : code;

  return {
    success: true,
    data: {
      code: extractedCode,
      language,
      filename,
      suggestions: [
        `将代码保存到 ${filename}`,
        `检查语法错误`,
        `运行单元测试`,
        `检查代码覆盖率`
      ]
    },
    metadata: {
      execution_time: 2000,
      model_used: 'doubao-seed-1-8-251228'
    }
  };
};

registerSkill({
  id: 'code-generation',
  name: '代码生成',
  description: '根据需求描述生成高质量的代码',
  category: 'code',
  capabilities: {
    function_definition: {
      name: 'generate_code',
      description: '根据需求描述生成代码',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            description: '编程语言',
            enum: ['python', 'java', 'javascript', 'typescript', 'go', 'rust', 'cpp', 'c']
          },
          requirements: {
            type: 'string',
            description: '代码需求描述'
          },
          filename: {
            type: 'string',
            description: '文件名'
          },
          framework: {
            type: 'string',
            description: '框架（可选）'
          }
        },
        required: ['language', 'requirements', 'filename']
      }
    },
    executor: generateCodeExecutor,
    requires_llm: true,
    requires_local_execution: false
  },
  icon: '💻',
  tags: ['开发', '编程', '代码']
});

// ==================== 文件创建技能 ====================

const createFileExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { file_path, content, overwrite } = params;

  try {
    // 确保目录存在
    const dir = path.dirname(file_path);
    await fs.mkdir(dir, { recursive: true });

    // 检查文件是否存在
    try {
      await fs.access(file_path);
      if (!overwrite) {
        return {
          success: false,
          error: `文件已存在：${file_path}。如需覆盖，请设置 overwrite=true`
        };
      }
    } catch {
      // 文件不存在，可以创建
    }

    // 写入文件
    await fs.writeFile(file_path, content, 'utf-8');

    return {
      success: true,
      data: {
        file_path,
        bytes_written: content.length,
        created_at: new Date().toISOString()
      },
      metadata: {
        execution_time: 100
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '文件创建失败',
      metadata: {
        execution_time: 100
      }
    };
  }
};

registerSkill({
  id: 'file-creation',
  name: '文件创建',
  description: '在指定路径创建文件并写入内容',
  category: 'code',
  capabilities: {
    function_definition: {
      name: 'create_file',
      description: '创建文件并写入内容',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: '文件完整路径'
          },
          content: {
            type: 'string',
            description: '文件内容'
          },
          overwrite: {
            type: 'boolean',
            description: '是否覆盖已存在的文件',
            default: false
          }
        },
        required: ['file_path', 'content']
      }
    },
    executor: createFileExecutor,
    requires_llm: false,
    requires_local_execution: true
  },
  icon: '📄',
  tags: ['开发', '文件系统', 'IO']
});

// ==================== 文案编写技能 ====================

const copywritingExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { type, topic, tone, length, target_audience } = params;

  const { LLMClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const llmClient = new LLMClient(config);

  const systemPrompt = `你是一位专业的文案策划师，擅长撰写各种类型的文案。
请根据要求生成高质量的文案内容。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `文案类型：${type}
主题：${topic}
语气风格：${tone || '专业'}
长度：${length || '中等'}
目标受众：${target_audience || '一般用户'}

请生成文案。`
    }
  ];

  const copyResult = await llmClient.stream(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.8,
    thinking: 'disabled' as const,
    caching: 'disabled' as const
  });

  let copy = '';
  for await (const chunk of copyResult) {
    if (chunk.content) {
      copy += chunk.content.toString();
    }
  }

  return {
    success: true,
    data: {
      content: copy,
      type,
      tone: tone || '专业',
      word_count: copy.split(/\s+/).length
    },
    metadata: {
      execution_time: 1500,
      model_used: 'doubao-seed-1-8-251228'
    }
  };
};

registerSkill({
  id: 'copywriting',
  name: '文案编写',
  description: '生成各种类型的专业文案',
  category: 'text',
  capabilities: {
    function_definition: {
      name: 'generate_copy',
      description: '生成文案内容',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '文案类型',
            enum: ['product_description', 'marketing', 'social_media', 'email', 'announcement']
          },
          topic: {
            type: 'string',
            description: '文案主题'
          },
          tone: {
            type: 'string',
            description: '语气风格',
            enum: ['professional', 'casual', 'enthusiastic', 'formal', 'friendly']
          },
          length: {
            type: 'string',
            description: '长度',
            enum: ['short', 'medium', 'long']
          },
          target_audience: {
            type: 'string',
            description: '目标受众'
          }
        },
        required: ['type', 'topic']
      }
    },
    executor: copywritingExecutor,
    requires_llm: true,
    requires_local_execution: false
  },
  icon: '✍️',
  tags: ['写作', '内容', '营销']
});

// ==================== PRD设计技能 ====================

const prdDesignExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { product_name, product_type, target_users, core_features, business_goals } = params;

  const { LLMClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const llmClient = new LLMClient(config);

  const systemPrompt = `你是一位资深产品经理，擅长撰写详细的产品需求文档（PRD）。
请根据提供的信息，生成一份结构清晰、内容完整的PRD文档。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `产品名称：${product_name}
产品类型：${product_type}
目标用户：${target_users?.join(', ') || '未指定'}
核心功能：${core_features?.join(', ') || '未指定'}
业务目标：${business_goals?.join(', ') || '未指定'}

请生成完整的产品需求文档。`
    }
  ];

  const prdResult = await llmClient.stream(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.6,
    thinking: 'disabled' as const,
    caching: 'disabled' as const
  });

  let prd = '';
  for await (const chunk of prdResult) {
    if (chunk.content) {
      prd += chunk.content.toString();
    }
  }

  return {
    success: true,
    data: {
      prd,
      sections: [
        '产品概述',
        '目标用户',
        '核心功能',
        '用户故事',
        '非功能需求',
        '技术方案',
        '项目规划',
        '成功指标'
      ]
    },
    metadata: {
      execution_time: 3000,
      model_used: 'doubao-seed-1-8-251228'
    }
  };
};

registerSkill({
  id: 'prd-design',
  name: 'PRD设计',
  description: '生成完整的产品需求文档',
  category: 'design',
  capabilities: {
    function_definition: {
      name: 'design_prd',
      description: '设计产品需求文档',
      parameters: {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            description: '产品名称'
          },
          product_type: {
            type: 'string',
            description: '产品类型',
            enum: ['web_app', 'mobile_app', 'desktop_app', 'api_service', 'platform', 'system']
          },
          target_users: {
            type: 'array',
            description: '目标用户群体',
            items: { type: 'string' }
          },
          core_features: {
            type: 'array',
            description: '核心功能列表',
            items: { type: 'string' }
          },
          business_goals: {
            type: 'array',
            description: '业务目标',
            items: { type: 'string' }
          }
        },
        required: ['product_name', 'product_type', 'core_features']
      }
    },
    executor: prdDesignExecutor,
    requires_llm: true,
    requires_local_execution: false
  },
  icon: '📋',
  tags: ['产品', '设计', '规划']
});

// ==================== 需求分析技能 ====================

const requirementAnalysisExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { requirement_description, context: taskContext, constraints } = params;

  const { LLMClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const llmClient = new LLMClient(config);

  const systemPrompt = `你是一位专业的需求分析师，擅长拆解和分析复杂的需求。
请详细分析需求，识别用户故事、验收标准和技术要求。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `需求描述：${requirement_description}
${taskContext ? `上下文信息：${taskContext}` : ''}
${constraints ? `约束条件：${constraints.join(', ')}` : ''}

请分析需求并提供：
1. 用户故事
2. 验收标准
3. 功能需求
4. 非功能需求
5. 技术建议
6. 实现复杂度评估`
    }
  ];

  const analysisResult = await llmClient.stream(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.5,
    thinking: 'disabled' as const,
    caching: 'disabled' as const
  });

  let analysis = '';
  for await (const chunk of analysisResult) {
    if (chunk.content) {
      analysis += chunk.content.toString();
    }
  }

  return {
    success: true,
    data: {
      analysis,
      user_stories: [], // 可以通过解析analysis内容提取
      acceptance_criteria: [],
      estimated_complexity: 'medium'
    },
    metadata: {
      execution_time: 2500,
      model_used: 'doubao-seed-1-8-251228'
    }
  };
};

registerSkill({
  id: 'requirement-analysis',
  name: '需求分析',
  description: '分析和拆解用户需求',
  category: 'design',
  capabilities: {
    function_definition: {
      name: 'analyze_requirements',
      description: '分析用户需求',
      parameters: {
        type: 'object',
        properties: {
          requirement_description: {
            type: 'string',
            description: '需求描述'
          },
          context: {
            type: 'string',
            description: '上下文信息（可选）'
          },
          constraints: {
            type: 'array',
            description: '约束条件',
            items: { type: 'string' }
          }
        },
        required: ['requirement_description']
      }
    },
    executor: requirementAnalysisExecutor,
    requires_llm: true,
    requires_local_execution: false
  },
  icon: '🔍',
  tags: ['分析', '需求', '规划']
});

// ==================== 目录创建技能 ====================

const createDirectoryExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { directory_path, recursive } = params;

  try {
    await fs.mkdir(directory_path, { recursive: recursive !== false });

    return {
      success: true,
      data: {
        directory_path,
        created: true
      },
      metadata: {
        execution_time: 50
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '目录创建失败',
      metadata: {
        execution_time: 50
      }
    };
  }
};

registerSkill({
  id: 'directory-creation',
  name: '目录创建',
  description: '创建目录结构',
  category: 'code',
  capabilities: {
    function_definition: {
      name: 'create_directory',
      description: '创建目录',
      parameters: {
        type: 'object',
        properties: {
          directory_path: {
            type: 'string',
            description: '目录完整路径'
          },
          recursive: {
            type: 'boolean',
            description: '是否递归创建父目录',
            default: true
          }
        },
        required: ['directory_path']
      }
    },
    executor: createDirectoryExecutor,
    requires_llm: false,
    requires_local_execution: true
  },
  icon: '📁',
  tags: ['开发', '文件系统', 'IO']
});

// ==================== 文件读取技能 ====================

const readFileExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { file_path } = params;

  try {
    const content = await fs.readFile(file_path, 'utf-8');
    const stats = await fs.stat(file_path);

    return {
      success: true,
      data: {
        file_path,
        content,
        size: stats.size,
        modified_at: stats.mtime.toISOString()
      },
      metadata: {
        execution_time: 50
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '文件读取失败',
      metadata: {
        execution_time: 50
      }
    };
  }
};

registerSkill({
  id: 'file-read',
  name: '文件读取',
  description: '读取文件内容',
  category: 'code',
  capabilities: {
    function_definition: {
      name: 'read_file',
      description: '读取文件内容',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: '文件完整路径'
          }
        },
        required: ['file_path']
      }
    },
    executor: readFileExecutor,
    requires_llm: false,
    requires_local_execution: true
  },
  icon: '📖',
  tags: ['开发', '文件系统', 'IO']
});

// ==================== 命令执行技能 ====================

const executeCommandExecutor: Skill['capabilities']['executor'] = async (params, context) => {
  const { command, working_directory } = params;

  try {
    // 动态导入以避免客户端构建错误
    const { exec } = await import('child_process/promises');

    const options: any = {
      timeout: 60000 // 60秒超时
    };

    if (working_directory) {
      options.cwd = working_directory;
    }

    const { stdout, stderr } = await exec(command, options);

    return {
      success: true,
      data: {
        command,
        stdout,
        stderr,
        exit_code: 0
      },
      metadata: {
        execution_time: 1000
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      data: {
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exit_code: error.code || 1
      },
      metadata: {
        execution_time: 1000
      }
    };
  }
};

registerSkill({
  id: 'command-execution',
  name: '命令执行',
  description: '执行Shell命令',
  category: 'code',
  capabilities: {
    function_definition: {
      name: 'execute_command',
      description: '执行shell命令',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令'
          },
          working_directory: {
            type: 'string',
            description: '工作目录（可选）'
          }
        },
        required: ['command']
      }
    },
    executor: executeCommandExecutor,
    requires_llm: false,
    requires_local_execution: true
  },
  icon: '⚡',
  tags: ['开发', '命令', '执行']
});

console.log(`✅ 技能系统初始化完成，共加载 ${Object.keys(skillRegistry).length} 个技能`);
