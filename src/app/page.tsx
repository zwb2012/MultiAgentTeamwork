'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  MessageSquare, 
  ListTodo, 
  Ticket, 
  Settings,
  Activity,
  Users,
  GitBranch,
  FolderGit2
} from 'lucide-react';

interface AgentStats {
  total: number;
  idle: number;
  working: number;
  paused: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<AgentStats>({
    total: 0,
    idle: 0,
    working: 0,
    paused: 0
  });

  useEffect(() => {
    fetchAgentStats();
  }, []);

  const fetchAgentStats = async () => {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();
      
      if (result.success && result.data) {
        const agents = result.data;
        setStats({
          total: agents.length,
          idle: agents.filter((a: any) => a.status === 'idle').length,
          working: agents.filter((a: any) => a.status === 'working').length,
          paused: agents.filter((a: any) => a.status === 'paused').length
        });
      }
    } catch (error) {
      console.error('获取智能体统计失败:', error);
    }
  };

  const features = [
    {
      title: '智能体管理',
      description: '创建、配置和管理AI智能体',
      icon: Bot,
      href: '/agents',
      color: 'text-blue-500',
      badge: `${stats.total} 个智能体`
    },
    {
      title: '多智能体协作',
      description: '启动会话，让多个智能体协同工作',
      icon: MessageSquare,
      href: '/conversations',
      color: 'text-green-500',
      badge: `${stats.working} 个工作中`
    },
    {
      title: '任务报告',
      description: '查看任务执行报告和进度',
      icon: ListTodo,
      href: '/tasks',
      color: 'text-purple-500',
      badge: null
    },
    {
      title: '工单流转',
      description: 'Bug单和工单的状态流转管理',
      icon: Ticket,
      href: '/tickets',
      color: 'text-orange-500',
      badge: null
    },
    {
      title: '流水线管理',
      description: '自定义流水线，配置串行/并行执行',
      icon: GitBranch,
      href: '/pipelines',
      color: 'text-cyan-500',
      badge: null
    },
    {
      title: '项目管理',
      description: '管理Git项目仓库，配置自动同步',
      icon: FolderGit2,
      href: '/projects',
      color: 'text-indigo-500',
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">多AI Agent协同工作平台</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                全局设置
              </Button>
            </Link>
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3 w-3" />
              {stats.working} 个智能体工作中
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8">
        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总智能体数</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">空闲</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.idle}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">工作中</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.working}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已暂停</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.paused}</div>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Icon className={`h-8 w-8 ${feature.color}`} />
                      {feature.badge && (
                        <Badge variant="secondary">{feature.badge}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Workflow Description */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>协同工作流程示例</CardTitle>
            <CardDescription>
              多个智能体可以协同完成复杂任务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge>开发</Badge>
              <div className="flex-1 border-l-2 border-primary pl-4">
                开发工程师接收任务，编写代码并提交审核
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="secondary">审核</Badge>
              <div className="flex-1 border-l-2 border-primary pl-4">
                代码审核员检查代码质量，通过后流转到测试
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">测试</Badge>
              <div className="flex-1 border-l-2 border-primary pl-4">
                测试工程师进行功能测试和回归测试，发现问题创建Bug单
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="destructive">修复</Badge>
              <div className="flex-1 border-l-2 border-primary pl-4">
                开发工程师修复Bug，流转到审核和测试进行验证
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
