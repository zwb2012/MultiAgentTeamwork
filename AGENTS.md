# 项目上下文

## 项目概述

多AI Agent协同工作平台，支持：
- 智能体创建、配置和管理
- 多智能体协作（私聊、群组、大厅模式）
- 流水线可视化编辑与执行
- 任务管理和工单流转

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Flow Diagram**: React Flow (流水线可视化)
- **Database**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM
- **LLM SDK**: coze-coding-dev-sdk

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── agents/         # 智能体管理页面
│   │   ├── conversations/  # 会话管理页面
│   │   ├── pipelines/      # 流水线管理页面
│   │   │   └── editor/     # 流水线可视化编辑器
│   │   ├── tasks/          # 任务管理页面
│   │   ├── tickets/        # 工单管理页面
│   │   ├── skills/         # 技能管理页面
│   │   ├── settings/       # 全局设置页面
│   │   └── api/            # API路由
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   ├── utils.ts        # 通用工具函数 (cn)
│   │   ├── pipeline-engine.ts  # 流水线执行引擎
│   │   ├── pipeline-db-store.ts   # 流水线数据库存储
│   │   ├── ticket-db-store.ts     # 工单数据库存储
│   │   ├── global-config.ts    # 全局配置管理
│   │   ├── file-store.ts       # 文件存储工具
│   │   └── skills/             # 技能系统
│   │       ├── types.ts         # 技能类型定义
│   │       ├── registry.ts      # 技能注册表
│   │       ├── executor.ts      # 技能执行引擎
│   │       └── enhanced-chat.ts # 技能增强聊天
│   ├── types/              # TypeScript 类型定义
│   │   ├── agent.ts        # 智能体相关类型
│   │   ├── conversation.ts # 会话相关类型
│   │   ├── pipeline.ts     # 流水线相关类型
│   │   └── skill.ts        # 技能相关类型
│   └── storage/            # 数据存储
│       └── database/       # 数据库相关
│           └── shared/
│               └── schema.ts   # 数据库表定义
├── docs/                   # 文档目录
│   ├── database-migration-v2.md  # 数据库迁移指南
│   ├── database-migration-skills.md  # 技能系统数据库迁移
│   └── parallel-merge-design.md  # 并行节点汇聚方案设计
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下`package.json`文件理解项目类型，如果没有或无法理解退化成阅读其他文件。
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。


## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 核心功能模块

### 1. 智能体管理 (`/agents`)
- 支持两种类型：LLM智能体、本地进程智能体
- 状态分离：在线状态 + 工作状态
- 支持全局API配置继承或自定义配置
- 健康检查功能

### 2. 会话管理 (`/conversations`)
- 三种会话模式：
  - 大厅(lobby): 所有智能体参与
  - 私聊(private): 1对1对话
  - 群组(group): 多智能体协作
  - 流水线(pipeline): 流水线执行时的协作会话
- 消息类型：文本、系统消息、任务通知、节点流转

### 3. 流水线管理
- **流水线绑定项目**：流水线创建时必须绑定到特定项目
- **项目流水线路由**：`/projects/[id]/pipelines` - 项目流水线管理
- **流水线编辑器**：`/projects/[id]/pipelines/editor/[pipelineId]` - 项目流水线编辑
- **智能体选择**：只能选择当前项目的智能体
- **全局运行记录**：`/pipelines/run` - 查看所有项目的流水线运行记录
- 可视化编辑器（React Flow）
- 节点类型：开始、结束、智能体、网关、条件、延迟
- 并行汇聚策略：所有完成(all)、任一完成(any)、自定义条件
- 流水线执行引擎自动处理节点流转和汇聚

### 4. 全局设置 (`/settings`)
- API Key配置
- Base URL配置
- 默认模型选择

### 5. 技能插槽系统 (`/skills`)
- **技能注册表**：预定义8个核心技能
  - 代码生成、文件创建、目录创建、文件读取
  - 命令执行、文案编写、PRD设计、需求分析
- **技能分类**：代码开发、文本处理、分析能力、设计规划、集成能力
- **智能体技能配置**：为每个LLM智能体单独配置启用哪些技能
- **技能执行**：通过Function Calling机制让LLM主动调用技能
- **执行日志**：记录所有技能执行情况，支持统计和追溯

## 数据库迁移

### 主迁移脚本
数据库迁移SQL脚本位于 `docs/database-migration-v2.md`，包含：
- 会话类型扩展
- 消息类型扩展
- 流水线节点汇聚配置
- 智能体状态字段

### 技能系统迁移
技能系统数据库迁移SQL脚本位于 `docs/database-migration-skills.md`，包含：
- `agent_skills` 表：存储智能体技能配置
- `skill_executions` 表：存储技能执行日志

在Supabase控制台的SQL Editor中执行迁移脚本。

## 关键决策

### 统一使用数据库存储
- **问题**：存储方式不一致，流水线和工单使用文件存储，其他模块使用数据库
- **解决方案**：统一使用数据库存储
  - 创建 `pipeline-db-store.ts` 替代 `pipeline-store.ts`
  - 创建 `ticket-db-store.ts` 替代 `ticket-store.ts`
  - 删除文件存储相关代码和数据目录
  - 所有 API 路由统一使用数据库存储层

### 流水线绑定项目
- **问题**：流水线不区分项目，可以选择任意项目的智能体，执行时缺少项目上下文
- **解决方案**：流水线创建时必须绑定到特定项目
  - 流水线数据结构增加 `project_id` 字段
  - 流水线管理页面移到项目下 (`/projects/[id]/pipelines`)
  - 流水线编辑器只能选择当前项目的智能体
  - 工单执行流水线时只显示同项目的流水线
  - 全局流水线页面改为运行记录列表页 (`/pipelines/run`)

### 技能插槽系统
- **设计目标**：为LLM智能体配备各种专业能力，实现类似扣子空间的技能系统
- **实现方式**：
  - 预定义技能：在 `src/lib/skills/registry.ts` 中注册核心技能
  - 技能执行引擎：`src/lib/skills/executor.ts` 负责技能路由和执行
  - 智能体配置：通过 `agent_skills` 表为每个智能体配置启用哪些技能
  - 技能增强聊天：`src/lib/skills/enhanced-chat.ts` 提供集成技能的对话能力
  - 技能调用解析：`src/lib/skills/parser.ts` 提供优化的技能调用识别
- **技能类别**：
  - 代码开发：代码生成、文件操作、命令执行
  - 文本处理：文案编写、文本生成
  - 分析能力：需求分析、数据分析
  - 设计规划：PRD设计、架构设计
  - 集成能力：API调用、第三方集成
- **注意事项**：
  - 技能执行器在服务端运行，避免客户端导入node模块
  - 技能调用通过LLM JSON输出识别，精确度高
  - 所有技能执行记录到 `skill_executions` 表，便于统计和调试
- **前端页面**：
  - `/skills` - 技能管理页面：查看所有技能和分类
  - `/skills/stats` - 技能统计页面：查看使用统计和执行日志
  - `/agents/[id]/skills` - 智能体技能配置：为智能体配置技能


