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
│   │   ├── settings/       # 全局设置页面
│   │   └── api/            # API路由
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   ├── utils.ts        # 通用工具函数 (cn)
│   │   ├── pipeline-engine.ts  # 流水线执行引擎
│   │   ├── pipeline-store.ts   # 流水线文件存储
│   │   ├── global-config.ts    # 全局配置管理
│   │   └── file-store.ts       # 文件存储工具
│   ├── types/              # TypeScript 类型定义
│   │   ├── agent.ts        # 智能体相关类型
│   │   ├── conversation.ts # 会话相关类型
│   │   └── pipeline.ts     # 流水线相关类型
│   └── storage/            # 数据存储
│       └── database/       # 数据库相关
│           └── shared/
│               └── schema.ts   # 数据库表定义
├── docs/                   # 文档目录
│   ├── database-migration-v2.md  # 数据库迁移指南
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

## 数据库迁移

数据库迁移SQL脚本位于 `docs/database-migration-v2.md`，包含：
- 会话类型扩展
- 消息类型扩展
- 流水线节点汇聚配置
- 智能体状态字段

在Supabase控制台的SQL Editor中执行迁移脚本。

## 关键决策

### 流水线绑定项目
- **问题**：流水线不区分项目，可以选择任意项目的智能体，执行时缺少项目上下文
- **解决方案**：流水线创建时必须绑定到特定项目
  - 流水线数据结构增加 `project_id` 字段
  - 流水线管理页面移到项目下 (`/projects/[id]/pipelines`)
  - 流水线编辑器只能选择当前项目的智能体
  - 工单执行流水线时只显示同项目的流水线
  - 全局流水线页面改为运行记录列表页 (`/pipelines/run`)


