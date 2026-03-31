# 多AI Agent协同工作平台

一个基于 Next.js 16 + shadcn/ui 的多AI智能体协同工作平台,支持智能体创建、多智能体交互、任务管理和工单流转。

## 功能特性

### 1. 智能体管理
- 创建和配置AI智能体
- 预设角色模板(开发工程师、测试工程师、代码审核员、架构师等)
- 自定义系统提示词和模型配置
- 智能体状态管理(空闲、工作中、已暂停)

### 2. 多智能体协作
- 创建会话,邀请多个智能体参与
- 实时流式对话交互
- 历史消息记录
- 多智能体并行工作

### 3. 任务报告
- 任务创建和分配
- 任务进度跟踪
- 任务报告生成和展示
- 任务状态管理

### 4. 工单流转
- Bug单和工单创建
- 工单状态流转(待处理→处理中→已解决→已关闭)
- 工单分配和负责人管理
- 流转历史记录

## 协作流程示例

```
开发工程师 → 编写代码 → 代码审核员 → 审核通过 → 测试工程师 → 功能测试
      ↑                                                              ↓
      ←←←←←←←←←←←← 发现Bug ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

1. **开发工程师**接收任务,编写代码并提交审核
2. **代码审核员**检查代码质量,通过后流转到测试
3. **测试工程师**进行功能测试,发现问题创建Bug单
4. **开发工程师**修复Bug,流转到审核和测试进行验证

## 快速开始

### 启动开发服务器

```bash
coze dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新，修改代码后页面会自动刷新。

### 构建生产版本

```bash
coze build
```

### 启动生产服务器

```bash
coze start
```

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── layout.tsx           # 根布局组件
│   ├── page.tsx             # 首页
│   ├── globals.css          # 全局样式（包含 shadcn 主题变量）
│   └── [route]/             # 其他路由页面
├── components/              # React 组件目录
│   └── ui/                  # shadcn/ui 基础组件（优先使用）
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── lib/                     # 工具函数库
│   └── utils.ts            # cn() 等工具函数
└── hooks/                   # 自定义 React Hooks（可选）

server/
├── index.ts                 # 自定义服务器入口
├── tsconfig.json           # Server TypeScript 配置
└── dist/                    # 编译输出目录（自动生成）
```

## 核心开发规范

### 1. 组件开发

**优先使用 shadcn/ui 基础组件**

本项目已预装完整的 shadcn/ui 组件库，位于 `src/components/ui/` 目录。开发时应优先使用这些组件作为基础：

```tsx
// ✅ 推荐：使用 shadcn 基础组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>标题</CardHeader>
      <CardContent>
        <Input placeholder="输入内容" />
        <Button>提交</Button>
      </CardContent>
    </Card>
  );
}
```

**可用的 shadcn 组件清单**

- 表单：`button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- 布局：`card`, `separator`, `tabs`, `accordion`, `collapsible`, `scroll-area`
- 反馈：`alert`, `alert-dialog`, `dialog`, `toast`, `sonner`, `progress`
- 导航：`dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`
- 数据展示：`table`, `avatar`, `badge`, `hover-card`, `tooltip`, `popover`
- 其他：`calendar`, `command`, `carousel`, `resizable`, `sidebar`

详见 `src/components/ui/` 目录下的具体组件实现。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4 进行样式开发，并已配置 shadcn 主题变量。

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">
    主要按钮
  </Button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form>
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **AI集成**: coze-coding-dev-sdk (支持流式输出)
- **数据库**: Supabase (PostgreSQL)
- **ORM**: Drizzle
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── agents/              # 智能体管理页面
│   ├── conversations/       # 多智能体协作页面
│   ├── tasks/               # 任务报告页面
│   ├── tickets/             # 工单流转页面
│   ├── api/                 # API 路由
│   │   ├── agents/         # 智能体API
│   │   ├── conversations/  # 会话API
│   │   ├── messages/       # 消息API
│   │   ├── chat/           # LLM对话API
│   │   ├── tasks/          # 任务API
│   │   └── tickets/        # 工单API
│   └── page.tsx             # 首页
├── components/              # React 组件目录
│   └── ui/                  # shadcn/ui 基础组件
├── types/                   # TypeScript类型定义
│   └── agent.ts            # 智能体相关类型
└── storage/                # 数据存储
    └── database/           # 数据库配置
        ├── shared/         # 共享模块
        │   └── schema.ts   # 数据库Schema
        └── supabase-client.ts # Supabase客户端
```

## 数据模型

### 核心表结构

1. **agents** - 智能体表
   - 存储智能体配置、角色、提示词
   - 状态管理(空闲/工作中/已暂停)

2. **conversations** - 会话表
   - 多智能体协作会话
   - 会话状态管理

3. **messages** - 消息表
   - 对话消息记录
   - 支持多角色消息

4. **tasks** - 任务表
   - 任务分配和进度跟踪
   - 任务报告存储

5. **tickets** - 工单表
   - Bug单和工单管理
   - 工单状态流转

6. **ticket_history** - 工单流转历史
   - 记录所有流转操作
   - 支持审计追溯

## 使用指南

### 1. 创建智能体

访问 `/agents` 页面:
- 选择预设角色模板或自定义角色
- 配置系统提示词和模型参数
- 设置温度(temperature)等参数

### 2. 启动协作会话

访问 `/conversations` 页面:
- 创建新会话
- 选择参与的智能体
- 开始多智能体对话

### 3. 查看任务报告

访问 `/tasks` 页面:
- 查看任务列表和进度
- 查看任务报告详情

### 4. 管理工单

访问 `/tickets` 页面:
- 创建Bug单或工单
- 流转工单状态
- 分配负责人

## API接口

### 智能体管理
- `GET /api/agents` - 获取智能体列表
- `POST /api/agents` - 创建智能体
- `PUT /api/agents/[id]` - 更新智能体
- `DELETE /api/agents/[id]` - 删除智能体

### 会话管理
- `GET /api/conversations` - 获取会话列表
- `POST /api/conversations` - 创建会话

### 消息管理
- `GET /api/messages` - 获取消息列表
- `POST /api/messages` - 发送消息

### LLM对话
- `POST /api/chat` - AI对话(流式输出)

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/[id]` - 更新任务

### 工单管理
- `GET /api/tickets` - 获取工单列表
- `POST /api/tickets` - 创建工单
- `PUT /api/tickets/[id]` - 流转工单

## 环境要求

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）
