'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  GitBranch,
  Ticket,
  FolderOpen,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play
} from 'lucide-react';
import type { Agent } from '@/types/agent';
import type { Project } from '@/types/project';

export default function ProjectResourcesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchResources();
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      
      if (result.success) {
        setProjects(result.data || []);
        if (result.data?.length > 0 && selectedProjectId === 'all') {
          // 默认不选择任何项目，显示全部
        }
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      // 获取智能体
      const agentsUrl = selectedProjectId === 'all' 
        ? '/api/agents?is_template=false'
        : `/api/projects/${selectedProjectId}/agents`;
      
      const [agentsRes, pipelinesRes, ticketsRes] = await Promise.all([
        fetch(agentsUrl),
        fetch('/api/pipelines'),
        fetch('/api/tickets')
      ]);

      const agentsResult = await agentsRes.json();
      const pipelinesResult = await pipelinesRes.json();
      const ticketsResult = await ticketsRes.json();

      if (agentsResult.success) {
        // 如果选择了特定项目，过滤智能体
        if (selectedProjectId !== 'all') {
          setAgents(agentsResult.data?.filter((a: Agent) => a.project_id === selectedProjectId) || []);
        } else {
          // 显示所有非模板智能体
          setAgents(agentsResult.data || []);
        }
      }

      if (pipelinesResult.success) {
        // TODO: 流水线暂无项目关联，显示全部
        setPipelines(pipelinesResult.data || []);
      }

      if (ticketsResult.success) {
        // TODO: 工单暂无项目关联，显示全部
        setTickets(ticketsResult.data || []);
      }
    } catch (error) {
      console.error('获取资源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOnlineBadge = (status: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      unknown: 'bg-gray-400'
    };
    const labels: Record<string, string> = {
      online: '在线',
      offline: '离线',
      unknown: '未检测'
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${colors[status] || colors.unknown}`}>
        {labels[status] || '未知'}
      </span>
    );
  };

  const getWorkStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      idle: { label: '空闲', className: 'bg-gray-100 text-gray-700' },
      working: { label: '工作中', className: 'bg-blue-100 text-blue-700' },
      error: { label: '异常', className: 'bg-red-100 text-red-700' }
    };
    const config = configs[status] || configs.idle;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return '全局';
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">项目资源</h1>
          <p className="text-muted-foreground mt-1">
            查看和管理项目的智能体、流水线和工单
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 资源统计 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">智能体</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">
              {agents.filter(a => a.online_status === 'online').length} 在线
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">流水线</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelines.length}</div>
            <p className="text-xs text-muted-foreground">
              {pipelines.filter(p => p.status === 'active').length} 活跃
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">工单</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
            <p className="text-xs text-muted-foreground">
              {tickets.filter(t => t.status === 'open').length} 待处理
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tab 切换 */}
      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="h-4 w-4" />
            智能体
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="gap-2">
            <GitBranch className="h-4 w-4" />
            流水线
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <Ticket className="h-4 w-4" />
            工单
          </TabsTrigger>
        </TabsList>

        {/* 智能体列表 */}
        <TabsContent value="agents">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {selectedProjectId === 'all' ? '暂无智能体' : '该项目暂无智能体'}
                </p>
                <Link href="/project-agents">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    创建智能体
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getOnlineBadge(agent.online_status || 'unknown')}
                          {agent.work_status && getWorkStatusBadge(agent.work_status)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>所属项目:</span>
                        <span className="font-medium text-foreground">{getProjectName(agent.project_id ?? null)}</span>
                      </div>
                      {agent.agent_type === 'llm' && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>模型:</span>
                          <span className="font-medium text-foreground">{agent.model || '-'}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-4">
                      {agent.system_prompt || '暂无描述'}
                    </p>
                    
                    <div className="flex gap-2 mt-4">
                      <Link href={`/project-agents/${agent.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          查看详情
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 流水线列表 */}
        <TabsContent value="pipelines">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pipelines.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">暂无流水线</p>
                <Link href="/pipelines">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    创建流水线
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pipelines.map((pipeline) => (
                <Card key={pipeline.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                      <Badge variant={pipeline.status === 'active' ? 'default' : 'secondary'}>
                        {pipeline.status === 'active' ? '活跃' : pipeline.status}
                      </Badge>
                    </div>
                    <CardDescription>{pipeline.description || '暂无描述'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/pipelines/${pipeline.id}`} className="block">
                      <Button variant="outline" size="sm" className="w-full">
                        查看详情
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 工单列表 */}
        <TabsContent value="tickets">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">暂无工单</p>
                <Link href="/tickets">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    创建工单
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg line-clamp-1">{ticket.title}</CardTitle>
                      <Badge variant={
                        ticket.status === 'open' ? 'destructive' :
                        ticket.status === 'in_progress' ? 'default' : 'secondary'
                      }>
                        {ticket.status === 'open' ? '待处理' : 
                         ticket.status === 'in_progress' ? '进行中' : 
                         ticket.status === 'resolved' ? '已解决' : '已关闭'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>{ticket.type === 'bug' ? 'Bug' : ticket.type === 'feature' ? '功能' : '改进'}</span>
                      <span>{ticket.priority === 'high' ? '高优先级' : ticket.priority === 'critical' ? '紧急' : '普通'}</span>
                    </div>
                    <Link href={`/tickets/${ticket.id}`} className="block">
                      <Button variant="outline" size="sm" className="w-full">
                        查看详情
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
