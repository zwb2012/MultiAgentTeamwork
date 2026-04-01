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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot,
  GitBranch,
  Ticket,
  Plus,
  ArrowRight,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import type { Agent } from '@/types/agent';
import type { Project } from '@/types/project';

export default function ProjectResourcesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 弹窗状态
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateConversation, setShowCreateConversation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  
  // 创建表单
  const [newAgent, setNewAgent] = useState({ name: '', role: 'developer', system_prompt: '' });
  const [newPipeline, setNewPipeline] = useState({ name: '', description: '' });
  const [newTicket, setNewTicket] = useState({ title: '', description: '', type: 'feature', priority: 'medium' });
  const [newConversation, setNewConversation] = useState({ title: '', type: 'private' });
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (projects.length >= 0) {
      fetchResources();
    }
  }, [selectedProjectId, projects.length]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/agents?is_template=true');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('获取模板失败:', error);
    }
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      const [agentsRes, pipelinesRes, ticketsRes, convRes] = await Promise.all([
        fetch('/api/agents?is_template=false'),
        fetch('/api/pipelines'),
        fetch('/api/tickets'),
        fetch('/api/conversations')
      ]);

      const agentsResult = await agentsRes.json();
      const pipelinesResult = await pipelinesRes.json();
      const ticketsResult = await ticketsRes.json();
      const convResult = await convRes.json();

      if (agentsResult.success) {
        const allAgents = agentsResult.data || [];
        if (selectedProjectId !== 'all') {
          setAgents(allAgents.filter((a: Agent) => a.project_id === selectedProjectId));
        } else {
          setAgents(allAgents);
        }
      }

      if (pipelinesResult.success) {
        const allPipelines = pipelinesResult.data || [];
        if (selectedProjectId !== 'all') {
          setPipelines(allPipelines.filter((p: any) => p.project_id === selectedProjectId));
        } else {
          setPipelines(allPipelines);
        }
      }

      if (ticketsResult.success) {
        const allTickets = ticketsResult.data || [];
        if (selectedProjectId !== 'all') {
          setTickets(allTickets.filter((t: any) => t.project_id === selectedProjectId));
        } else {
          setTickets(allTickets);
        }
      }

      if (convResult.success) {
        const allConv = convResult.data || [];
        if (selectedProjectId !== 'all') {
          setConversations(allConv.filter((c: any) => c.project_id === selectedProjectId));
        } else {
          setConversations(allConv);
        }
      }
    } catch (error) {
      console.error('获取资源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 创建智能体
  const handleCreateAgent = async () => {
    if (!newAgent.name || !selectedProjectId || selectedProjectId === 'all') {
      alert('请先选择一个项目');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAgent,
          agent_type: 'llm',
          project_id: selectedProjectId,
          is_template: false
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreateAgent(false);
        setNewAgent({ name: '', role: 'developer', system_prompt: '' });
        fetchResources();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建智能体失败:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 从模板创建智能体
  const handleCreateFromTemplate = async (templateId: string) => {
    if (!selectedProjectId || selectedProjectId === 'all') {
      alert('请先选择一个项目');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_ids: [templateId] })
      });
      
      const result = await response.json();
      if (result.success) {
        fetchResources();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('从模板创建失败:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 创建流水线
  const handleCreatePipeline = async () => {
    if (!newPipeline.name || !selectedProjectId || selectedProjectId === 'all') {
      alert('请先选择一个项目');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPipeline,
          project_id: selectedProjectId,
          nodes: []
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreatePipeline(false);
        setNewPipeline({ name: '', description: '' });
        fetchResources();
        // 跳转到编辑页面
        router.push(`/pipelines/${result.data.id}`);
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建流水线失败:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 创建工单
  const handleCreateTicket = async () => {
    if (!newTicket.title || !selectedProjectId || selectedProjectId === 'all') {
      alert('请先选择一个项目');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTicket,
          project_id: selectedProjectId
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreateTicket(false);
        setNewTicket({ title: '', description: '', type: 'feature', priority: 'medium' });
        fetchResources();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建工单失败:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 创建会话
  const handleCreateConversation = async () => {
    if (!newConversation.title || !selectedProjectId || selectedProjectId === 'all') {
      alert('请先选择一个项目');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newConversation.title,
          type: newConversation.type,
          project_id: selectedProjectId
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreateConversation(false);
        setNewConversation({ title: '', type: 'private' });
        fetchResources();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除资源
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    const { type, id } = deleteTarget;
    const endpoints: Record<string, string> = {
      agent: `/api/agents/${id}`,
      pipeline: `/api/pipelines/${id}`,
      ticket: `/api/tickets/${id}`,
      conversation: `/api/conversations/${id}`
    };
    
    try {
      const response = await fetch(endpoints[type], { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        fetchResources();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    } finally {
      setDeleteTarget(null);
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

  const getProjectName = (projectId: string | null | undefined) => {
    if (!projectId) return '全局';
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
  };

  const canCreate = selectedProjectId !== 'all';

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">项目资源</h1>
          <p className="text-muted-foreground mt-1">
            管理项目的智能体、流水线、工单和会话
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
      <div className="grid gap-4 md:grid-cols-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">会话</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversations.length}</div>
            <p className="text-xs text-muted-foreground">
              {conversations.filter(c => c.status === 'active').length} 活跃
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
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            会话
          </TabsTrigger>
        </TabsList>

        {/* 智能体列表 */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {templates.length > 0 && canCreate && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">从模板添加:</span>
                  {templates.map(template => (
                    <Button
                      key={template.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateFromTemplate(template.id)}
                      disabled={submitting}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {template.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={() => setShowCreateAgent(true)} disabled={!canCreate}>
              <Plus className="h-4 w-4 mr-2" />
              创建智能体
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {!canCreate ? '请先选择一个项目' : '暂无智能体'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/agents/${agent.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteTarget({ type: 'agent', id: agent.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                      {getOnlineBadge(agent.online_status || 'unknown')}
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-2">
                      项目: {getProjectName(agent.project_id)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {agent.system_prompt || '暂无描述'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 流水线列表 */}
        <TabsContent value="pipelines" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreatePipeline(true)} disabled={!canCreate}>
              <Plus className="h-4 w-4 mr-2" />
              创建流水线
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pipelines.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {!canCreate ? '请先选择一个项目' : '暂无流水线'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pipelines.map((pipeline) => (
                <Card key={pipeline.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/pipelines/${pipeline.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteTarget({ type: 'pipeline', id: pipeline.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription>{pipeline.description || '暂无描述'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={pipeline.status === 'active' ? 'default' : 'secondary'}>
                      {pipeline.status === 'active' ? '活跃' : pipeline.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 工单列表 */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateTicket(true)} disabled={!canCreate}>
              <Plus className="h-4 w-4 mr-2" />
              创建工单
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {!canCreate ? '请先选择一个项目' : '暂无工单'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg line-clamp-1">{ticket.title}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/tickets/${ticket.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              查看
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteTarget({ type: 'ticket', id: ticket.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        ticket.status === 'open' ? 'destructive' :
                        ticket.status === 'in_progress' ? 'default' : 'secondary'
                      }>
                        {ticket.status === 'open' ? '待处理' : 
                         ticket.status === 'in_progress' ? '进行中' : 
                         ticket.status === 'resolved' ? '已解决' : '已关闭'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {ticket.type === 'bug' ? 'Bug' : ticket.type === 'feature' ? '功能' : '改进'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 会话列表 */}
        <TabsContent value="conversations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateConversation(true)} disabled={!canCreate}>
              <Plus className="h-4 w-4 mr-2" />
              创建会话
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {!canCreate ? '请先选择一个项目' : '暂无会话'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {conversations.map((conv) => (
                <Card key={conv.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg line-clamp-1">{conv.title}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/conversations/${conv.id}`}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              进入会话
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteTarget({ type: 'conversation', id: conv.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                        {conv.status === 'active' ? '活跃' : conv.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {conv.type === 'private' ? '私聊' : conv.type === 'group' ? '群组' : conv.type}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 创建智能体弹窗 */}
      <Dialog open={showCreateAgent} onOpenChange={setShowCreateAgent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建智能体</DialogTitle>
            <DialogDescription>为项目 {projects.find(p => p.id === selectedProjectId)?.name} 创建新智能体</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input 
                value={newAgent.name} 
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="智能体名称"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={newAgent.role} onValueChange={(v) => setNewAgent({ ...newAgent, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">开发者</SelectItem>
                  <SelectItem value="tester">测试者</SelectItem>
                  <SelectItem value="reviewer">审核者</SelectItem>
                  <SelectItem value="assistant">助手</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>系统提示词</Label>
              <Textarea 
                value={newAgent.system_prompt}
                onChange={(e) => setNewAgent({ ...newAgent, system_prompt: e.target.value })}
                placeholder="定义智能体的行为和能力..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAgent(false)}>取消</Button>
            <Button onClick={handleCreateAgent} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建流水线弹窗 */}
      <Dialog open={showCreatePipeline} onOpenChange={setShowCreatePipeline}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建流水线</DialogTitle>
            <DialogDescription>为项目 {projects.find(p => p.id === selectedProjectId)?.name} 创建新流水线</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input 
                value={newPipeline.name}
                onChange={(e) => setNewPipeline({ ...newPipeline, name: e.target.value })}
                placeholder="流水线名称"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea 
                value={newPipeline.description}
                onChange={(e) => setNewPipeline({ ...newPipeline, description: e.target.value })}
                placeholder="流水线描述..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePipeline(false)}>取消</Button>
            <Button onClick={handleCreatePipeline} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建并编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建工单弹窗 */}
      <Dialog open={showCreateTicket} onOpenChange={setShowCreateTicket}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建工单</DialogTitle>
            <DialogDescription>为项目 {projects.find(p => p.id === selectedProjectId)?.name} 创建新工单</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input 
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                placeholder="工单标题"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={newTicket.type} onValueChange={(v) => setNewTicket({ ...newTicket, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">功能</SelectItem>
                    <SelectItem value="improvement">改进</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>描述</Label>
              <Textarea 
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="详细描述..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTicket(false)}>取消</Button>
            <Button onClick={handleCreateTicket} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建会话弹窗 */}
      <Dialog open={showCreateConversation} onOpenChange={setShowCreateConversation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建会话</DialogTitle>
            <DialogDescription>为项目 {projects.find(p => p.id === selectedProjectId)?.name} 创建新会话</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input 
                value={newConversation.title}
                onChange={(e) => setNewConversation({ ...newConversation, title: e.target.value })}
                placeholder="会话标题"
              />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <Select value={newConversation.type} onValueChange={(v) => setNewConversation({ ...newConversation, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私聊</SelectItem>
                  <SelectItem value="group">群组</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateConversation(false)}>取消</Button>
            <Button onClick={handleCreateConversation} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除该{deleteTarget?.type === 'agent' ? '智能体' : 
                deleteTarget?.type === 'pipeline' ? '流水线' : 
                deleteTarget?.type === 'ticket' ? '工单' : '会话'}吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
