/**
 * 任务分发与节点输出映射设计
 * 
 * 核心问题：智能体A完成后，如何把正确的任务分发给正确的下游智能体？
 * 
 * 方案：节点输出映射 + 智能体角色匹配
 */

// ============================================
// 1. 智能体能力声明
// ============================================

export interface AgentAbility {
  // 能力标签
  tags: string[]; // ['frontend', 'react', 'vue'] 或 ['backend', 'nodejs', 'api']
  
  // 角色类型
  role: AgentRole;
  
  // 擅长领域描述（用于LLM理解）
  expertise: string; // "擅长前端开发，熟悉React、Vue框架"
  
  // 接受的任务类型
  acceptedTaskTypes: string[]; // ['frontend', 'ui', 'component']
}

// 智能体角色扩展
export type AgentRole = 
  | 'developer'      // 通用开发
  | 'frontend'       // 前端开发
  | 'backend'        // 后端开发
  | 'fullstack'      // 全栈开发
  | 'tester'         // 测试
  | 'reviewer'       // 代码审核
  | 'architect'      // 架构师
  | 'pm'             // 项目经理
  | 'custom';        // 自定义

// ============================================
// 2. 节点输出映射配置
// ============================================

export interface OutputMapping {
  // 目标节点ID
  targetNodeId: string;
  
  // 目标智能体ID（可选，如果不填则根据taskType自动匹配）
  targetAgentId?: string;
  
  // 任务类型标签
  taskType: string; // 'frontend' | 'backend' | 'test' | 'review'
  
  // 输出数据提取规则
  dataExtraction: {
    // 从上游输出中提取哪些字段
    fields?: string[]; // ['frontend_requirements', 'ui_design']
    
    // 或者使用JSONPath提取
    jsonPath?: string; // '$.tasks[?(@.type=="frontend")]'
  };
  
  // 发送给下游的消息模板
  messageTemplate: string;
  // 示例: "需求分析完成，前端部分：{frontend_requirements}，请开始开发"
  
  // 条件判断（可选）
  condition?: string; // "$output.hasFrontendTask == true"
}

// ============================================
// 3. 示例配置
// ============================================

/*
流水线示例：需求分析 → 前端开发 + 后端开发 → 集成测试

节点配置：

1. 智能体A（需求分析）:
   - agent_id: 'analyst-001'
   - output_config: {
       output_schema: {
         frontend_requirements: 'string',
         backend_requirements: 'string',
         timeline: 'object'
       }
     }
   - output_mappings: [
       {
         targetNodeId: 'node-frontend',
         taskType: 'frontend',
         dataExtraction: {
           fields: ['frontend_requirements', 'timeline']
         },
         messageTemplate: '需求分析完成，前端需求：{frontend_requirements}，请在{timeline.frontend_deadline}前完成'
       },
       {
         targetNodeId: 'node-backend',
         taskType: 'backend',
         dataExtraction: {
           fields: ['backend_requirements', 'timeline']
         },
         messageTemplate: '需求分析完成，后端需求：{backend_requirements}，请在{timeline.backend_deadline}前完成'
       }
     ]

2. 智能体B（前端开发）:
   - agent_id: 'frontend-dev-001'
   - abilities: {
       tags: ['frontend', 'react', 'typescript'],
       role: 'frontend',
       expertise: '擅长前端开发，熟悉React、Vue、TypeScript',
       acceptedTaskTypes: ['frontend', 'ui', 'component']
     }

3. 智能体C（后端开发）:
   - agent_id: 'backend-dev-001'
   - abilities: {
       tags: ['backend', 'nodejs', 'api'],
       role: 'backend',
       expertise: '擅长后端开发，熟悉Node.js、数据库设计',
       acceptedTaskTypes: ['backend', 'api', 'database']
     }
*/

// ============================================
// 4. 执行流程
// ============================================

/*
执行流程：

1. 智能体A完成需求分析，输出：
   {
     frontend_requirements: '实现用户登录页面...',
     backend_requirements: '实现登录API...',
     timeline: {
       frontend_deadline: '2024-01-15',
       backend_deadline: '2024-01-16'
     }
   }

2. 系统根据 output_mappings 处理：

   a. 对于 targetNodeId: 'node-frontend':
      - 提取数据: { frontend_requirements, timeline }
      - 渲染消息: "需求分析完成，前端需求：实现用户登录页面...，请在2024-01-15前完成"
      - 发送给智能体B

   b. 对于 targetNodeId: 'node-backend':
      - 提取数据: { backend_requirements, timeline }
      - 渲染消息: "需求分析完成，后端需求：实现登录API...，请在2024-01-16前完成"
      - 发送给智能体C

3. 智能体B收到消息，识别到任务类型是'frontend'（匹配自己的能力），开始工作

4. 智能体C收到消息，识别到任务类型是'backend'（匹配自己的能力），开始工作
*/

// ============================================
// 5. 简化方案（无代码配置）
// ============================================

/*
对于非技术用户，可以在UI上配置：

┌─────────────────────────────────────────┐
│ 节点输出配置                              │
├─────────────────────────────────────────┤
│                                         │
│ 输出分支1:                               │
│ ├── 目标节点: [前端开发 ▼]               │
│ ├── 任务类型: [前端 ▼]                   │
│ ├── 发送内容:                            │
│ │   ┌─────────────────────────────┐     │
│ │   │ 前端需求已完成，请开始开发：   │     │
│ │   │ {前端需求内容}                │     │
│ │   └─────────────────────────────┘     │
│ └── 条件: ☑ 只有包含前端任务时才发送      │
│                                         │
│ 输出分支2:                               │
│ ├── 目标节点: [后端开发 ▼]               │
│ ├── 任务类型: [后端 ▼]                   │
│ ├── 发送内容:                            │
│ │   ┌─────────────────────────────┐     │
│ │   │ 后端需求已完成，请开始开发：   │     │
│ │   │ {后端需求内容}                │     │
│ │   └─────────────────────────────┘     │
│ └── 条件: ☑ 只有包含后端任务时才发送      │
│                                         │
│ [+ 添加输出分支]                         │
└─────────────────────────────────────────┘
*/

// ============================================
// 6. 自动匹配模式（备选）
// ============================================

/*
如果用户不想手动配置输出映射，可以使用自动匹配：

1. 智能体A输出包含任务标签：
   {
     tasks: [
       { type: 'frontend', content: '实现登录页面...', assignee: 'frontend' },
       { type: 'backend', content: '实现登录API...', assignee: 'backend' }
     ]
   }

2. 系统自动根据下游智能体的 abilities.tags 匹配：
   - 智能体B tags: ['frontend'] → 接收到 frontend 任务
   - 智能体C tags: ['backend'] → 接收到 backend 任务

3. 或者使用LLM智能匹配：
   - 将任务描述和下游智能体的 expertise 发给LLM
   - LLM决定哪个智能体适合哪个任务
*/

export interface AutoMatchConfig {
  // 是否启用自动匹配
  enabled: boolean;
  
  // 匹配方式
  matchBy: 'tag' | 'role' | 'llm';
  
  // 任务标签字段路径
  taskTypeField: string; // '$.type' 或 '$.task_type'
  
  // 任务内容字段路径
  taskContentField: string; // '$.content'
}
