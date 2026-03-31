'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Bot, 
  MessageSquare, 
  Ticket, 
  GitBranch,
  Activity,
  Users,
  FolderGit2,
  Wifi,
  WifiOff,
  HelpCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  Play,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  agents: {
    total: number;
    online: number;
    offline: number;
    unknown: number;
    idle: number;
    working: number;
    error: number;
  };
  projects: {
    total: number;
  };
  conversations: {
    total: number;
  };
  tickets: {
    total: number;
    open: number;
    inProgress: number;
  };
  pipelines: {
    total: number;
  };
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // 每30秒刷新一次
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOnlineRate = () => {
    if (!stats || stats.agents.total === 0) return 0;
    return Math.round((stats.agents.online / stats.agents.total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">监控面板</h1>
          <p className="text-muted-foreground mt-1">
            实时监控智能体状态和系统运行情况
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>最后更新: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* 智能体状态概览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle>智能体状态</CardTitle>
            </div>
            <Badge variant="outline">
              共 {stats?.agents.total || 0} 个智能体
            </Badge>
          </div>
          <CardDescription>
            仅统计项目智能体和通用智能体，不包括模板
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            {/* 在线状态 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wifi className="h-4 w-4 text-green-500" />
                在线
              </div>
              <div className="text-3xl font-bold text-green-500">
                {stats?.agents.online || 0}
              </div>
              <Progress 
                value={getOnlineRate()} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground">
                在线率 {getOnlineRate()}%
              </div>
            </div>

            {/* 离线状态 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <WifiOff className="h-4 w-4 text-red-500" />
                离线
              </div>
              <div className="text-3xl font-bold text-red-500">
                {stats?.agents.offline || 0}
              </div>
            </div>

            {/* 未知状态 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HelpCircle className="h-4 w-4 text-gray-500" />
                未检测
              </div>
              <div className="text-3xl font-bold text-gray-500">
                {stats?.agents.unknown || 0}
              </div>
            </div>

            {/* 工作中 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Play className="h-4 w-4 text-blue-500" />
                工作中
              </div>
              <div className="text-3xl font-bold text-blue-500">
                {stats?.agents.working || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快速统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* 项目 */}
        <Link href="/projects">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">项目</CardTitle>
              <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.projects.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                活跃项目
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 会话 */}
        <Link href="/conversations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">会话</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.conversations.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                活跃会话
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 工单 */}
        <Link href="/tickets">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">工单</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.tickets.total || 0}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {stats?.tickets.open || 0} 待处理
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 流水线 */}
        <Link href="/pipelines">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">流水线</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pipelines.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                已创建流水线
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 智能体详细状态 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>工作状态分布</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.agents.idle || 0}</div>
                <div className="text-sm text-muted-foreground">空闲</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Play className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.agents.working || 0}</div>
                <div className="text-sm text-muted-foreground">工作中</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.agents.error || 0}</div>
                <div className="text-sm text-muted-foreground">异常</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快捷操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/agent-templates">
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 py-1.5 px-3">
                创建智能体模板
              </Badge>
            </Link>
            <Link href="/project-agents">
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 py-1.5 px-3">
                查看项目智能体
              </Badge>
            </Link>
            <Link href="/projects/new">
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 py-1.5 px-3">
                新建项目
              </Badge>
            </Link>
            <Link href="/conversations">
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 py-1.5 px-3">
                发起会话
              </Badge>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
