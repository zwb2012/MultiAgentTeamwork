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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Ticket as TicketIcon, 
  Plus,
  Bug,
  Lightbulb,
  Wrench,
  ClipboardList,
  MoreVertical,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  GitBranch,
  Settings,
  User,
  Bot,
  ExternalLink
} from 'lucide-react';
import type { Project, DefaultPipelines } from '@/types/project';
import type { Pipeline, TicketType, PipelineRunStatus } from '@/types/pipeline';
import type { TicketPriority } from '@/types/agent';

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
  idle: { label: '空闲', color: 'text-gray-500', icon: Clock },
  pending: { label: '等待执行', color: 'text-yellow-500', icon: Clock },
  running: { label: '执行中', color: 'text-blue-500', icon: Loader2 },
  success: { label: '执行成功', color: 'text-green-500', icon: CheckCircle },
  failed: { label: '执行失败', color: 'text-red-500', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-500', icon: XCircle }
};

interface Ticket {
  id: string;
  title: string;
  description?: string;
  type: TicketType;
  priority: TicketPriority;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  project_id?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_at: string;
  pipeline_run_id?: string;
  pipeline_run_status?: PipelineRunStatus;
}

interface Agent {
  id: string;
  name: string;
  role?: string;
}

export default function ProjectTicketsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 创建工单对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'bug' as TicketType,
    title: '',
    description: '',
    priority: 'medium' as TicketPriority
  });

  // 流转对话框
  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [flowMode, setFlowMode] = useState<'status' | 'agent' | 'pipeline'>('status');
  const [flowing, setFlowing] = useState(false);
  const [flowData, setFlowData] = useState({
    status: '',
    assignee_id: '',
    pipeline_id: '',
    comment: ''
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 并行获取项目、工单、流水线、智能体
      const [projectRes, ticketsRes, pipelinesRes, agentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/tickets?project_id=${projectId}`),
        fetch(`/api/projects/${projectId}/pipelines`),
        fetch(`/api/projects/${projectId}/agents`)
      ]);
      
      const projectData = await projectRes.json();
      const ticketsData = await ticketsRes.json();
      const pipelinesData = await pipelinesRes.json();
      const agentsData = await agentsRes.json();
      
      if (projectData.success) {
        setProject(projectData.data);
      } else {
        alert('项目不存在');
        router.push('/projects');
        return;
      }
      
      if (ticketsData.success) {
        setTickets(ticketsData.data);
      }
      
      if (pipelinesData.success) {
        // 只显示已发布的流水线
        setPipelines(pipelinesData.data.filter((p: Pipeline) => p.status === 'published'));
      }

      if (agentsData.success) {
        setAgents(agentsData.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 创建工单
  const handleCreateTicket = async () => {
    if (!createForm.title) {
      alert('请输入工单标题');
      return;
    }
    
    try {
      setCreating(true);
      
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          project_id: projectId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCreateDialogOpen(false);
        setCreateForm({
          type: 'bug',
          title: '',
          description: '',
          priority: 'medium'
        });
        fetchData();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建工单失败:', error);
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 打开执行对话框
  const openExecuteDialog = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    // 自动选择推荐的流水线
    const recommendedPipelineId = getRecommendedPipelineId(ticket.type);
    setSelectedPipelineId(recommendedPipelineId || '');
    setExecuteDialogOpen(true);
  };

  // 打开流转对话框
  const openFlowDialog = (ticket: Ticket, mode: 'status' | 'agent' | 'pipeline') => {
    setSelectedTicket(ticket);
    setFlowMode(mode);
    setFlowData({
      status: ticket.status,
      assignee_id: ticket.assignee_id || '',
      pipeline_id: getRecommendedPipelineId(ticket.type) || '',
      comment: ''
    });
    setFlowDialogOpen(true);
  };

  // 获取推荐的流水线ID
  const getRecommendedPipelineId = (ticketType: TicketType): string | null => {
    if (!project?.default_pipelines) return null;

    const defaultPipelines = project.default_pipelines as DefaultPipelines;
    return defaultPipelines[ticketType] || null;
  };

  // 执行流转
  const handleFlow = async () => {
    if (!selectedTicket) return;
    
    try {
      setFlowing(true);
      
      if (flowMode === 'pipeline' && flowData.pipeline_id) {
        // 驱动流水线执行
        const response = await fetch(`/api/pipelines/${flowData.pipeline_id}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket: {
              id: selectedTicket.id,
              type: selectedTicket.type,
              title: selectedTicket.title,
              description: selectedTicket.description || '',
              priority: selectedTicket.priority
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          setFlowDialogOpen(false);
          fetchData();
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
        const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: flowData.status || selectedTicket.status,
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

  // 获取流水线名称
  const getPipelineName = (id: string) => {
    return pipelines.find(p => p.id === id)?.name || '未知流水线';
  };

  // 过滤工单
  const filterTickets = (status?: string) => {
    if (!status) return tickets;
    return tickets.filter(t => t.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{project?.name} - 工单管理</h1>
              <p className="text-sm text-muted-foreground">创建和管理项目工单</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                项目设置
              </Button>
            </Link>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建工单
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待处理</p>
                  <p className="text-2xl font-bold">{filterTickets('open').length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">处理中</p>
                  <p className="text-2xl font-bold">{filterTickets('in_progress').length}</p>
                </div>
                <Loader2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已解决</p>
                  <p className="text-2xl font-bold">{filterTickets('resolved').length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已关闭</p>
                  <p className="text-2xl font-bold">{filterTickets('closed').length}</p>
                </div>
                <XCircle className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 工单列表 */}
        <Tabs defaultValue="open" className="space-y-4">
          <TabsList>
            <TabsTrigger value="open">待处理 ({filterTickets('open').length})</TabsTrigger>
            <TabsTrigger value="in_progress">处理中 ({filterTickets('in_progress').length})</TabsTrigger>
            <TabsTrigger value="resolved">已解决 ({filterTickets('resolved').length})</TabsTrigger>
            <TabsTrigger value="closed">已关闭 ({filterTickets('closed').length})</TabsTrigger>
          </TabsList>
          
          {['open', 'in_progress', 'resolved', 'closed'].map(status => (
            <TabsContent key={status} value={status}>
              {filterTickets(status).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <TicketIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">暂无工单</p>
                    {status === 'open' && (
                      <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        新建工单
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filterTickets(status).map(ticket => {
                    const typeConfig = TICKET_TYPE_CONFIG[ticket.type] || TICKET_TYPE_CONFIG.task;
                    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
                    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                    const TypeIcon = typeConfig.icon;
                    
                    return (
                      <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div 
                              className="flex items-start gap-4 flex-1 cursor-pointer"
                              onClick={() => router.push(`/tickets/${ticket.id}`)}
                            >
                              <TypeIcon className={`h-5 w-5 mt-1 ${typeConfig.color}`} />
                              <div className="flex-1">
                                <h3 className="font-medium">{ticket.title}</h3>
                                {ticket.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {ticket.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className={priorityConfig.color}>
                                    {priorityConfig.label}
                                  </Badge>
                                  <Badge variant="outline" className={statusConfig.color}>
                                    {statusConfig.label}
                                  </Badge>
                                  {ticket.assignee_name && (
                                    <Badge variant="outline" className="text-xs">
                                      <User className="h-3 w-3 mr-1" />
                                      {ticket.assignee_name}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(ticket.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                
                                {/* 执行状态 */}
                                {ticket.pipeline_run_id && ticket.pipeline_run_status && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      流水线: {ticket.pipeline_run_id.substring(0, 8)}...
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        ticket.pipeline_run_status === 'success' ? 'text-green-600' :
                                        ticket.pipeline_run_status === 'failed' ? 'text-red-600' :
                                        ticket.pipeline_run_status === 'running' ? 'text-blue-600' : ''
                                      }`}
                                    >
                                      {RUN_STATUS_CONFIG[ticket.pipeline_run_status]?.label || ticket.pipeline_run_status}
                                    </Badge>
                                    <Link 
                                      href={`/pipelines/run/${ticket.pipeline_run_id}`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button variant="ghost" size="sm" className="h-6 px-2">
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* 调试：始终显示按钮 */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('点击了处理按钮，工单ID:', ticket.id);
                                  router.push(`/tickets/${ticket.id}`);
                                }}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                处理
                              </Button>

                              {/* 更新状态按钮 - 处理中状态显示 */}
                              {ticket.status === 'in_progress' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openFlowDialog(ticket, 'status');
                                  }}
                                >
                                  更新状态
                                </Button>
                              )}
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                    查看详情
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openFlowDialog(ticket, 'status')}>
                                    更新状态
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openFlowDialog(ticket, 'agent')}>
                                    分配负责人
                                  </DropdownMenuItem>
                                  {pipelines.length > 0 && (
                                    <DropdownMenuItem onClick={() => openFlowDialog(ticket, 'pipeline')}>
                                      执行流水线
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* 创建工单对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>新建工单</DialogTitle>
            <DialogDescription>
              创建项目工单，可选择流水线自动执行
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>工单类型</Label>
                <Select 
                  value={createForm.type} 
                  onValueChange={(value) => setCreateForm({ ...createForm, type: value as TicketType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug 修复</SelectItem>
                    <SelectItem value="feature">新需求</SelectItem>
                    <SelectItem value="improvement">改进优化</SelectItem>
                    <SelectItem value="task">通用任务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select 
                  value={createForm.priority} 
                  onValueChange={(value) => setCreateForm({ ...createForm, priority: value as TicketPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="critical">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>工单标题 *</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="例如：修复登录页面样式问题"
              />
            </div>
            
            <div className="space-y-2">
              <Label>详细描述</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="描述具体需求或问题..."
                rows={4}
              />
            </div>
            
            {/* 推荐流水线提示 */}
            {project?.default_pipelines && createForm.type && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span>推荐流水线: {getPipelineName(getRecommendedPipelineId(createForm.type) || '')}</span>
                </div>
                <Link href={`/projects/${projectId}`} className="text-primary text-xs hover:underline">
                  修改默认流水线配置
                </Link>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateTicket} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建工单'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {selectedTicket?.title}
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
                {agents.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无可用智能体</p>
                )}
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
            <Button 
              onClick={handleFlow} 
              disabled={flowing || (flowMode === 'pipeline' && !flowData.pipeline_id)}
            >
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
