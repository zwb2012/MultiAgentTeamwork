'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Ticket as TicketIcon, 
  Bug,
  Lightbulb,
  Wrench,
  ClipboardList,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  GitBranch,
  User,
  Bot,
  History,
  ExternalLink,
  Zap,
  RefreshCw
} from 'lucide-react';
import type { Pipeline, TicketType, PipelineRunStatus } from '@/types/pipeline';
import type { TicketPriority } from '@/types/agent';
import type { Project } from '@/types/project';

// 工单类型配置
const TICKET_TYPE_CONFIG = {
  bug: { label: 'Bug 修复', icon: Bug, color: 'text-red-500' },
  feature: { label: '新需求', icon: Lightbulb, color: 'text-blue-500' },
  improvement: { label: '改进优化', icon: Wrench, color: 'text-green-500' },
  task: { label: '通用任务', icon: ClipboardList, color: 'text-gray-500' }
};

// 优先级配置
const PRIORITY_CONFIG = {
  low: { label: '低', color: 'bg-gray-100 text-gray-700' },
  medium: { label: '中', color: 'bg-blue-100 text-blue-700' },
  high: { label: '高', color: 'bg-orange-100 text-orange-700' },
  critical: { label: '紧急', color: 'bg-red-100 text-red-700' }
};

// 状态配置
const STATUS_CONFIG = {
  open: { label: '待处理', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: '处理中', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: '已解决', color: 'bg-green-100 text-green-700' },
  closed: { label: '已关闭', color: 'bg-gray-100 text-gray-500' }
};

// 运行状态配置
const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '等待执行', color: 'text-yellow-600', icon: Clock },
  running: { label: '执行中', color: 'text-blue-600', icon: Loader2 },
  success: { label: '执行成功', color: 'text-green-600', icon: CheckCircle },
  failed: { label: '执行失败', color: 'text-red-600', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-600', icon: XCircle }
};

interface TicketDetail {
  id: string;
  title: string;
  description?: string;
  type: TicketType;
  priority: TicketPriority;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  project_id?: string;
  assignee_id?: string;
  assignee?: { name: string };
  created_at: string;
  updated_at?: string;
  pipeline_run_id?: string;
  pipeline_run_status?: PipelineRunStatus;
  conversation_id?: string;
}

interface Agent {
  id: string;
  name: string;
  role?: string;
}

interface PipelineRunRecord {
  id: string;
  pipeline_id: string;
  pipeline_name?: string;
  status: string;
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  agent_tasks?: Array<{
    id: string;
    agent_id: string;
    title: string;
    status: string;
  }>;
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 流转对话框
  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [flowing, setFlowing] = useState(false);
  const [flowMode, setFlowMode] = useState<'status' | 'agent' | 'pipeline'>('status');
  const [flowData, setFlowData] = useState({
    status: '',
    assignee_id: '',
    pipeline_id: '',
    comment: ''
  });

  useEffect(() => {
    fetchData();
  }, [ticketId]);

  // 自动刷新（有运行中的流水线时）
  useEffect(() => {
    const hasRunning = pipelineRuns.some(r => r.status === 'running');
    if (hasRunning) {
      const interval = setInterval(() => {
        fetchPipelineRuns();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [pipelineRuns]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取工单详情
      const ticketRes = await fetch(`/api/tickets/${ticketId}`);
      const ticketData = await ticketRes.json();
      
      if (!ticketData.success) {
        alert('工单不存在');
        router.push('/tickets');
        return;
      }
      
      setTicket(ticketData.data);
      setFlowData({
        status: ticketData.data.status,
        assignee_id: ticketData.data.assignee_id || '',
        pipeline_id: '',
        comment: ''
      });
      
      // 并行获取相关数据
      const promises: Promise<any>[] = [
        fetch('/api/pipelines').then(r => r.json()),
        fetch('/api/agents?is_template=false').then(r => r.json()),
        fetch(`/api/tickets/${ticketId}/runs`).then(r => r.json())
      ];
      
      if (ticketData.data.project_id) {
        promises.push(
          fetch(`/api/projects/${ticketData.data.project_id}`).then(r => r.json())
        );
      }
      
      const [pipelinesRes, agentsRes, runsRes, projectRes] = await Promise.all(promises);
      
      if (pipelinesRes.success) {
        setPipelines(pipelinesRes.data.filter((p: Pipeline) => p.status === 'published'));
      }
      
      if (agentsRes.success) {
        setAgents(agentsRes.data);
      }
      
      if (runsRes.success) {
        setPipelineRuns(runsRes.data);
      }
      
      if (projectRes?.success) {
        setProject(projectRes.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineRuns = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/runs`);
      const result = await response.json();
      
      if (result.success) {
        setPipelineRuns(result.data);
      }
    } catch (error) {
      console.error('获取运行记录失败:', error);
    }
  };

  // 打开流转对话框
  const openFlowDialog = (mode: 'status' | 'agent' | 'pipeline') => {
    setFlowMode(mode);
    setFlowDialogOpen(true);
  };

  // 执行流转
  const handleFlow = async () => {
    if (!ticket) return;
    
    try {
      setFlowing(true);
      
      if (flowMode === 'pipeline' && flowData.pipeline_id) {
        // 驱动流水线执行
        const response = await fetch(`/api/pipelines/${flowData.pipeline_id}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket: {
              id: ticket.id,
              type: ticket.type,
              title: ticket.title,
              description: ticket.description || '',
              priority: ticket.priority
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          setFlowDialogOpen(false);
          fetchPipelineRuns();
          // 跳转到运行详情页
          if (result.data?.id) {
            router.push(`/pipelines/run/${result.data.id}`);
          } else {
            alert('流水线已开始执行');
          }
        } else {
          alert('执行失败: ' + result.error);
        }
      } else {
        // 普通流转
        const response = await fetch(`/api/tickets/${ticketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: flowData.status || ticket.status,
            assignee_id: flowData.assignee_id || undefined,
            assignee_name: agents.find(a => a.id === flowData.assignee_id)?.name,
            comment: flowData.comment
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          setFlowDialogOpen(false);
          fetchData();
          alert('流转成功');
        } else {
          alert('流转失败: ' + result.error);
        }
      }
    } catch (error) {
      console.error('流转失败:', error);
      alert('流转失败');
    } finally {
      setFlowing(false);
    }
  };

  // 获取类型图标
  const getTypeIcon = (type: TicketType) => {
    const config = TICKET_TYPE_CONFIG[type] || TICKET_TYPE_CONFIG.task;
    const Icon = config.icon;
    return <Icon className={`h-5 w-5 ${config.color}`} />;
  };

  // 格式化时间
  const formatTime = (time?: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
  };

  // 计算执行时长
  const getDuration = (run: PipelineRunRecord) => {
    if (!run.started_at) return '-';
    
    const start = new Date(run.started_at);
    const end = run.completed_at ? new Date(run.completed_at) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}小时${Math.floor((duration % 3600) / 60)}分`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>工单不存在</p>
        <Link href="/tickets">
          <Button className="mt-4">返回工单列表</Button>
        </Link>
      </div>
    );
  }

  const typeConfig = TICKET_TYPE_CONFIG[ticket.type] || TICKET_TYPE_CONFIG.task;
  const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={ticket.project_id ? `/projects/${ticket.project_id}/tickets` : '/tickets'}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              {getTypeIcon(ticket.type)}
              <div>
                <h1 className="text-xl font-bold">{ticket.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {ticket.project_id ? project?.name || '加载中...' : '未关联项目'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button variant="outline" onClick={() => openFlowDialog('status')}>
              更新状态
            </Button>
            <Button onClick={() => openFlowDialog('pipeline')}>
              <Play className="h-4 w-4 mr-2" />
              执行流水线
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 左侧：工单详情 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>工单详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">类型</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getTypeIcon(ticket.type)}
                      <span>{typeConfig.label}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">优先级</Label>
                    <div className="mt-1">
                      <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <div className="mt-1">
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">负责人</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{ticket.assignee?.name || '未分配'}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">创建时间</Label>
                    <p className="mt-1 text-sm">
                      {new Date(ticket.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {ticket.updated_at && (
                    <div>
                      <Label className="text-muted-foreground">更新时间</Label>
                      <p className="mt-1 text-sm">
                        {new Date(ticket.updated_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  )}
                </div>
                
                {ticket.description && (
                  <div className="pt-4 border-t">
                    <Label className="text-muted-foreground">描述</Label>
                    <div className="mt-2 p-4 bg-muted rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">{ticket.description}</pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 执行记录 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  执行记录
                </CardTitle>
                <CardDescription>
                  流水线执行历史和智能体工作状态
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pipelineRuns.length === 0 ? (
                  <div className="text-center py-8">
                    <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">暂无执行记录</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => openFlowDialog('pipeline')}
                      disabled={pipelines.length === 0}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      执行流水线
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pipelineRuns.map(run => {
                      const statusConfig = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.pending;
                      const StatusIcon = statusConfig.icon;
                      
                      return (
                        <Card key={run.id} className="overflow-hidden">
                          <div className="flex items-stretch">
                            <div className={`w-1 ${run.status === 'success' ? 'bg-green-500' : run.status === 'failed' ? 'bg-red-500' : run.status === 'running' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                            <CardContent className="flex-1 py-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className={`h-5 w-5 ${statusConfig.color} ${run.status === 'running' ? 'animate-spin' : ''}`} />
                                    <span className="font-medium">{run.pipeline_name || '流水线'}</span>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    <span>
                                      {run.completed_nodes}/{run.total_nodes} 节点
                                    </span>
                                    <span>耗时: {getDuration(run)}</span>
                                    <span>{formatTime(run.created_at)}</span>
                                  </div>
                                  
                                  {/* 智能体任务状态 */}
                                  {run.agent_tasks && run.agent_tasks.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {run.agent_tasks.map(task => (
                                        <Badge key={task.id} variant="outline" className="text-xs">
                                          <Bot className="h-3 w-3 mr-1" />
                                          {task.title}
                                          <span className="ml-1 text-muted-foreground">
                                            ({task.status})
                                          </span>
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                <Link href={`/pipelines/run/${run.id}`}>
                                  <Button variant="outline" size="sm">
                                    查看详情
                                    <ExternalLink className="h-4 w-4 ml-2" />
                                  </Button>
                                </Link>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：操作面板 */}
          <div className="space-y-6">
            {/* 快捷操作 */}
            <Card>
              <CardHeader>
                <CardTitle>快捷操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => openFlowDialog('status')}
                >
                  <History className="h-4 w-4 mr-2" />
                  更新状态
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => openFlowDialog('agent')}
                >
                  <User className="h-4 w-4 mr-2" />
                  分配负责人
                </Button>
                <Button 
                  className="w-full justify-start"
                  onClick={() => openFlowDialog('pipeline')}
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  执行流水线
                </Button>
                {pipelines.length > 0 && ticket.project_id && project?.default_pipelines?.[ticket.type] && (
                  <Button 
                    className="w-full justify-start"
                    variant="secondary"
                    onClick={() => {
                      setFlowData({
                        ...flowData,
                        pipeline_id: project.default_pipelines![ticket.type]!
                      });
                      setFlowMode('pipeline');
                      setFlowDialogOpen(true);
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    执行推荐流水线
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* 智能体列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  相关智能体
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂无可用智能体
                  </p>
                ) : (
                  <div className="space-y-2">
                    {agents.slice(0, 5).map(agent => (
                      <div 
                        key={agent.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setFlowData({ ...flowData, assignee_id: agent.id });
                          setFlowMode('agent');
                          setFlowDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{agent.name}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          分配
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 项目信息 */}
            {ticket.project_id && project && (
              <Card>
                <CardHeader>
                  <CardTitle>所属项目</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link 
                    href={`/projects/${ticket.project_id}`}
                    className="block p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-medium">{project.name}</p>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* 流转对话框 */}
      <Dialog open={flowDialogOpen} onOpenChange={setFlowDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {flowMode === 'status' ? '更新状态' : 
               flowMode === 'agent' ? '分配负责人' : 
               '执行流水线'}
            </DialogTitle>
            <DialogDescription>
              {flowMode === 'pipeline' 
                ? '选择流水线处理此工单' 
                : '更新工单信息'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {flowMode === 'status' && (
              <div className="space-y-2">
                <Label>新状态</Label>
                <Select 
                  value={flowData.status} 
                  onValueChange={(value) => setFlowData({ ...flowData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">待处理</SelectItem>
                    <SelectItem value="in_progress">处理中</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                    <SelectItem value="closed">已关闭</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {flowMode === 'agent' && (
              <div className="space-y-2">
                <Label>选择负责人</Label>
                <Select 
                  value={flowData.assignee_id} 
                  onValueChange={(value) => setFlowData({ ...flowData, assignee_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择智能体" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span>{agent.name}</span>
                          {agent.role && (
                            <span className="text-muted-foreground">({agent.role})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {flowMode === 'pipeline' && (
              <div className="space-y-2">
                <Label>选择流水线</Label>
                <Select 
                  value={flowData.pipeline_id} 
                  onValueChange={(value) => setFlowData({ ...flowData, pipeline_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择流水线" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(pipeline => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>{pipeline.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {flowData.pipeline_id && (
                  <p className="text-sm text-muted-foreground">
                    {pipelines.find(p => p.id === flowData.pipeline_id)?.description || '暂无描述'}
                  </p>
                )}
                {pipelines.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    暂无可用的流水线，请先创建并发布流水线
                  </p>
                )}
              </div>
            )}
            
            {flowMode !== 'pipeline' && (
              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  value={flowData.comment}
                  onChange={(e) => setFlowData({ ...flowData, comment: e.target.value })}
                  placeholder="流转说明..."
                  rows={3}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlowDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleFlow} disabled={flowing || (flowMode === 'pipeline' && !flowData.pipeline_id)}>
              {flowing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {flowMode === 'pipeline' ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      开始执行
                    </>
                  ) : (
                    '确认'
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
