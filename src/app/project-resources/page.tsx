'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  CheckCircle2,
  AlertCircle,
  Activity,
  Users,
  User,
  UserPlus,
  Globe,
  Clock
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
  const [conversationParticipants, setConversationParticipants] = useState<Record<string, Agent[]>>({});
  const [loading, setLoading] = useState(true);
  
  // 弹窗状态
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateConversation, setShowCreateConversation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  
  // 健康检测状态
  const [batchChecking, setBatchChecking] = useState(false);
  const [batchCheckResult, setBatchCheckResult] = useState<{
    total: number;
    healthy: number;
    unhealthy: number;
  } | null>(null);
  const [checkingAgents, setCheckingAgents] = useState<Set<string>>(new Set());
  
  // 管理参与者状态
  const [showManageParticipants, setShowManageParticipants] = useState(false);
  const [managingConversation, setManagingConversation] = useState<any>(null);
  const [managingParticipants, setManagingParticipants] = useState<Agent[]>([]);
  const [selectedNewAgentIds, setSelectedNewAgentIds] = useState<string[]>([]);
  const [managingLoading, setManagingLoading] = useState(false);
  const [managingSubmitting, setManagingSubmitting] = useState(false);
  
  // 创建表单
  const [newAgent, setNewAgent] = useState({ name: '', role: 'developer', system_prompt: '' });
  const [newConversation, setNewConversation] = useState({ title: '', type: 'private', selectedAgents: [] as string[] });

  const [submitting, setSubmitting] = useState(false);
  const [newPipeline, setNewPipeline] = useState({ name: '', description: '' });
  const [newTicket, setNewTicket] = useState({ title: '', description: '', type: 'feature', priority: 'medium' });

  // 编辑工单状态
  const [showEditTicket, setShowEditTicket] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editTicket, setEditTicket] = useState({
    title: '',
    description: '',
    type: 'feature',
    priority: 'medium',
    status: 'open'
  });

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
        
        // 提取参与者信息
        const participantsMap: Record<string, Agent[]> = {};
        for (const conv of allConv || []) {
          if (conv.conversation_participants && conv.conversation_participants.length > 0) {
            participantsMap[conv.id] = conv.conversation_participants
              .filter((p: any) => p.agents)
              .map((p: any) => ({
                ...p.agents,
                id: p.agent_id || p.agents.id
              }));
          } else {
            participantsMap[conv.id] = [];
          }
        }
        setConversationParticipants(participantsMap);
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

  // 单个智能体健康检测
  const handleHealthCheck = async (agentId: string) => {
    setCheckingAgents(prev => new Set(prev).add(agentId));
    
    try {
      const response = await fetch(`/api/agents/${agentId}/health-check`, {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        // 更新智能体列表中的状态
        setAgents(prev => prev.map(a => 
          a.id === agentId 
            ? { ...a, online_status: result.data?.online ? 'online' : 'offline' }
            : a
        ));
      }
    } catch (error) {
      console.error('健康检测失败:', error);
    } finally {
      setCheckingAgents(prev => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  };

  // 一键健康检测
  const handleBatchHealthCheck = async () => {
    if (agents.length === 0) return;
    
    setBatchChecking(true);
    setBatchCheckResult(null);
    
    let healthy = 0;
    let unhealthy = 0;
    
    for (const agent of agents) {
      try {
        const response = await fetch(`/api/agents/${agent.id}/health-check`, {
          method: 'POST'
        });
        
        const result = await response.json();
        if (result.success && result.data?.online) {
          healthy++;
        } else {
          unhealthy++;
        }
      } catch {
        unhealthy++;
      }
    }
    
    setBatchCheckResult({ total: agents.length, healthy, unhealthy });
    setBatchChecking(false);
    
    // 刷新智能体列表
    fetchResources();
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
        // 跳转到项目流水线编辑页面
        router.push(`/projects/${selectedProjectId}/pipelines/editor/${result.data.id}`);
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

  // 打开编辑工单对话框
  const handleOpenEditTicket = (ticket: any) => {
    setEditingTicket(ticket);
    setEditTicket({
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      priority: ticket.priority,
      status: ticket.status
    });
    setShowEditTicket(true);
  };

  // 保存编辑工单
  const handleUpdateTicket = async () => {
    if (!editingTicket || !editTicket.title) {
      alert('请输入工单标题');
      return;
    }

    try {
      setEditing(true);
      const response = await fetch(`/api/tickets/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTicket)
      });

      const result = await response.json();
      if (result.success) {
        setShowEditTicket(false);
        setEditingTicket(null);
        fetchResources();
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('更新工单失败:', error);
      alert('保存失败');
    } finally {
      setEditing(false);
    }
  };

  // 创建会话
  const handleCreateConversation = async () => {
    if (!newConversation.title || !selectedProjectId || selectedProjectId === 'all') {
      alert('请填写标题并选择项目');
      return;
    }
    
    if (newConversation.selectedAgents.length === 0) {
      alert('请至少选择一个参与者');
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
          project_id: selectedProjectId,
          agent_ids: newConversation.selectedAgents
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreateConversation(false);
        setNewConversation({ title: '', type: 'private', selectedAgents: [] });
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

  // 打开管理参与者弹窗
  const handleOpenManageParticipants = async (conversation: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setManagingConversation(conversation);
    setManagingLoading(true);
    setShowManageParticipants(true);
    
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/participants`);
      const result = await response.json();
      
      if (result.success) {
        setManagingParticipants(result.data || []);
      }
    } catch (error) {
      console.error('获取参与者失败:', error);
    } finally {
      setManagingLoading(false);
    }
    
    setSelectedNewAgentIds([]);
  };

  // 添加参与者
  const handleAddParticipants = async () => {
    if (!managingConversation || selectedNewAgentIds.length === 0) return;
    
    setManagingSubmitting(true);
    try {
      const response = await fetch(`/api/conversations/${managingConversation.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ids: selectedNewAgentIds })
      });
      
      const result = await response.json();
      if (result.success) {
        const participantsRes = await fetch(`/api/conversations/${managingConversation.id}/participants`);
        const participantsResult = await participantsRes.json();
        if (participantsResult.success) {
          setManagingParticipants(participantsResult.data || []);
        }
        setSelectedNewAgentIds([]);
        fetchResources();
      } else {
        alert(result.error || '添加失败');
      }
    } catch (error) {
      console.error('添加参与者失败:', error);
      alert('添加失败');
    } finally {
      setManagingSubmitting(false);
    }
  };

  // 移除参与者
  const handleRemoveParticipant = async (agentId: string) => {
    if (!managingConversation) return;
    
    try {
      const response = await fetch(`/api/conversations/${managingConversation.id}/participants?agent_id=${agentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        setManagingParticipants(prev => prev.filter(p => p.id !== agentId));
        fetchResources();
      } else {
        alert(result.error || '移除失败');
      }
    } catch (error) {
      console.error('移除参与者失败:', error);
      alert('移除失败');
    }
  };

  // 获取健康状态徽章
  const getHealthBadge = (status: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',   // 健康
      offline: 'bg-red-500',    // 异常
      unknown: 'bg-gray-400'    // 未检测
    };
    const labels: Record<string, string> = {
      online: '健康',
      offline: '异常',
      unknown: '未检测'
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${colors[status] || colors.unknown}`}>
        {labels[status] || '未知'}
      </span>
    );
  };

  // 兼容旧调用
  const getOnlineBadge = getHealthBadge;

  // 获取角色标签
  const getRoleLabel = (role?: string) => {
    const roleMap: Record<string, string> = {
      developer: '开发工程师',
      frontend_dev: '前端工程师',
      backend_dev: '后端工程师',
      tester: '测试工程师',
      reviewer: '代码审核',
      architect: '架构师',
      pm: '产品经理',
      custom: '自定义'
    };
    return roleMap[role || 'developer'] || role || '开发工程师';
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
              {agents.filter(a => a.online_status === 'online').length} 健康
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
            <div className="flex items-center gap-3">
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
              
              {/* 一键健康检测结果统计 */}
              {batchCheckResult && (
                <div className="flex items-center gap-4 px-4 py-2 bg-muted rounded-lg text-sm">
                  <span className="text-muted-foreground">检测结果:</span>
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    健康 {batchCheckResult.healthy}
                  </span>
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    异常 {batchCheckResult.unhealthy}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleBatchHealthCheck}
                disabled={batchChecking || agents.length === 0}
              >
                {batchChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    检测中...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    一键检测
                  </>
                )}
              </Button>
              
              <Button onClick={() => setShowCreateAgent(true)} disabled={!canCreate}>
                <Plus className="h-4 w-4 mr-2" />
                创建智能体
              </Button>
            </div>
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
                          <DropdownMenuItem 
                            onClick={() => handleHealthCheck(agent.id)}
                            disabled={checkingAgents.has(agent.id)}
                          >
                            {checkingAgents.has(agent.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                检测中...
                              </>
                            ) : (
                              <>
                                <Activity className="h-4 w-4 mr-2" />
                                健康检测
                              </>
                            )}
                          </DropdownMenuItem>
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
                            <Link href={`/projects/${pipeline.project_id}/pipelines/editor/${pipeline.id}`}>
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
                <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg line-clamp-1">{ticket.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        {ticket.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/tickets/${ticket.id}`);
                            }}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            处理
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditTicket(ticket);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: 'ticket', id: ticket.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/tickets/${ticket.id}`);
                    }}
                  >
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
              {conversations.map((conv) => {
                const participants = conversationParticipants[conv.id] || [];
                const onlineCount = participants.filter((a: Agent) => a.online_status === 'online').length;
                
                return (
                  <Card 
                    key={conv.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/conversations/${conv.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {conv.type === 'lobby' ? (
                            <Globe className="h-4 w-4 text-primary" />
                          ) : conv.type === 'private' ? (
                            <User className="h-4 w-4 text-primary" />
                          ) : (
                            <Users className="h-4 w-4 text-primary" />
                          )}
                          <CardTitle className="text-lg hover:text-primary transition-colors">{conv.title}</CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
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
                            <DropdownMenuItem onClick={(e) => handleOpenManageParticipants(conv, e)}>
                              <UserPlus className="h-4 w-4 mr-2" />
                              管理参与者
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: 'conversation', id: conv.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <Badge variant="outline" className="text-xs">
                          {conv.type === 'lobby' ? '大厅' : conv.type === 'private' ? '私聊' : conv.type === 'group' ? '群组' : conv.type}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${onlineCount > 0 ? 'text-green-600 border-green-300' : 'text-muted-foreground'}`}
                        >
                          {onlineCount}/{participants.length} 健康
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* 参与者头像和状态 */}
                      <div className="flex items-center gap-1 mb-3">
                        {participants.slice(0, 5).map((agent: Agent, idx: number) => {
                          // 工作状态优先于在线状态显示
                          const statusColor = agent.work_status === 'working' 
                            ? 'bg-blue-500 animate-pulse' 
                            : agent.online_status === 'online' 
                              ? 'bg-green-500' 
                              : agent.online_status === 'offline' 
                                ? 'bg-red-500' 
                                : 'bg-gray-400';
                          const statusText = agent.work_status === 'working'
                            ? '工作中'
                            : agent.online_status === 'online'
                              ? '健康'
                              : agent.online_status === 'offline'
                                ? '异常'
                                : '未知';
                          
                          return (
                            <div key={agent.id} className="relative -ml-2 first:ml-0 group">
                              <Avatar className="h-7 w-7 border-2 border-background">
                                <AvatarFallback className="text-xs bg-primary/10">
                                  <Bot className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <span 
                                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background ${statusColor}`} 
                                title={statusText}
                              />
                              {/* 悬浮显示详细信息 */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-max border">
                                <div className="font-semibold text-sm mb-1">{agent.name}</div>
                                <div className="text-muted-foreground flex items-center gap-1">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                                    {getRoleLabel(agent.role)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                                  <span className="text-muted-foreground">{statusText}</span>
                                </div>
                                {agent.model && (
                                  <div className="text-muted-foreground text-[10px] mt-1 pt-1 border-t border-border">
                                    模型: {agent.model}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {participants.length > 5 && (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium -ml-2 border-2 border-background">
                            +{participants.length - 5}
                          </div>
                        )}
                        {participants.length === 0 && (
                          <span className="text-xs text-muted-foreground">暂无参与者</span>
                        )}
                      </div>
                      
                      {/* 健康/工作中统计 */}
                      <div className="flex items-center gap-2 mb-2">
                        {(() => {
                          const workingCount = participants.filter((a: Agent) => a.work_status === 'working').length;
                          const onlineCount = participants.filter((a: Agent) => a.work_status !== 'working' && a.online_status === 'online').length;
                          
                          return (
                            <>
                              {workingCount > 0 && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                  {workingCount} 工作中
                                </Badge>
                              )}
                              {onlineCount > 0 && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  {onlineCount} 健康
                                </Badge>
                              )}
                              {workingCount === 0 && onlineCount === 0 && participants.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {participants.length} 异常
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* 最后消息或时间 */}
                      {conv.last_message ? (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          <span className="font-medium">{conv.last_message.agent_name}:</span>{' '}
                          {conv.last_message.content}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">暂无消息</div>
                      )}
                      
                      {/* 时间 */}
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {conv.updated_at || conv.created_at ? new Date(conv.updated_at || conv.created_at).toLocaleString('zh-CN', { 
                          month: 'numeric', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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

      {/* 编辑工单弹窗 */}
      <Dialog open={showEditTicket} onOpenChange={setShowEditTicket}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑工单</DialogTitle>
            <DialogDescription>编辑工单信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                value={editTicket.title}
                onChange={(e) => setEditTicket({ ...editTicket, title: e.target.value })}
                placeholder="工单标题"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={editTicket.type} onValueChange={(v) => setEditTicket({ ...editTicket, type: v })}>
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
                <Select value={editTicket.priority} onValueChange={(v) => setEditTicket({ ...editTicket, priority: v })}>
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
              <Label>状态</Label>
              <Select value={editTicket.status} onValueChange={(v) => setEditTicket({ ...editTicket, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">待处理</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="resolved">已解决</SelectItem>
                  <SelectItem value="closed">已关闭</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={editTicket.description}
                onChange={(e) => setEditTicket({ ...editTicket, description: e.target.value })}
                placeholder="详细描述..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTicket(false)}>取消</Button>
            <Button onClick={handleUpdateTicket} disabled={editing}>
              {editing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建会话弹窗 */}
      <Dialog open={showCreateConversation} onOpenChange={setShowCreateConversation}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>创建会话</DialogTitle>
            <DialogDescription>为项目 {projects.find(p => p.id === selectedProjectId)?.name} 创建新会话</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input 
                value={newConversation.title}
                onChange={(e) => setNewConversation({ ...newConversation, title: e.target.value })}
                placeholder="会话标题"
              />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'private', label: '私聊', icon: User, desc: '1对1对话' },
                  { type: 'group', label: '群组', icon: Users, desc: '多智能体协作' }
                ].map(item => (
                  <Card
                    key={item.type}
                    className={`cursor-pointer transition-all ${
                      newConversation.type === item.type 
                        ? 'border-primary shadow-md' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setNewConversation(prev => ({ ...prev, type: item.type }))}
                  >
                    <CardContent className="p-3 text-center">
                      <item.icon className="h-5 w-5 mx-auto text-primary mb-1" />
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{newConversation.type === 'private' ? '选择对话智能体 *' : '选择参与者 *'}</Label>
              <ScrollArea className="h-48 border rounded-lg p-2">
                {agents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    暂无可用智能体
                  </div>
                ) : (
                  <div className="space-y-1">
                    {agents.map(agent => {
                      const isSelected = newConversation.selectedAgents.includes(agent.id);
                      const isPrivate = newConversation.type === 'private';
                      
                      return (
                        <div
                          key={agent.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                          }`}
                          onClick={() => {
                            if (isPrivate) {
                              // 私聊模式：单选
                              setNewConversation(prev => ({
                                ...prev,
                                selectedAgents: isSelected ? [] : [agent.id]
                              }));
                            } else {
                              // 群组模式：多选
                              setNewConversation(prev => ({
                                ...prev,
                                selectedAgents: isSelected
                                  ? prev.selectedAgents.filter(id => id !== agent.id)
                                  : [...prev.selectedAgents, agent.id]
                              }));
                            }
                          }}
                        >
                          {isPrivate ? (
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          ) : (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                setNewConversation(prev => ({
                                  ...prev,
                                  selectedAgents: isSelected
                                    ? prev.selectedAgents.filter(id => id !== agent.id)
                                    : [...prev.selectedAgents, agent.id]
                                }));
                              }}
                            />
                          )}
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              <Bot className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{agent.name}</div>
                          </div>
                          <span className={`w-2 h-2 rounded-full ${
                            agent.online_status === 'online' ? 'bg-green-500' : 
                            agent.online_status === 'offline' ? 'bg-red-500' : 'bg-gray-400'
                          }`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {newConversation.selectedAgents.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {newConversation.type === 'private' 
                    ? `已选择: ${agents.find(a => a.id === newConversation.selectedAgents[0])?.name}`
                    : `已选择 ${newConversation.selectedAgents.length} 个参与者`
                  }
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateConversation(false);
              setNewConversation({ title: '', type: 'private', selectedAgents: [] });
            }}>取消</Button>
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
      
      {/* 管理参与者弹窗 */}
      <Dialog open={showManageParticipants} onOpenChange={setShowManageParticipants}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>管理参与者 - {managingConversation?.title}</DialogTitle>
            <DialogDescription>
              添加或移除会话中的智能体
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {managingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* 当前参与者列表 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">当前参与者</Label>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {managingParticipants.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        暂无参与者
                      </div>
                    ) : (
                      managingParticipants.map(agent => (
                        <div key={agent.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10">
                                <Bot className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{agent.name}</div>
                              <div className="text-xs text-muted-foreground">{agent.role}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveParticipant(agent.id)}
                            disabled={managingParticipants.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                {/* 添加新参与者 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">添加参与者</Label>
                  <ScrollArea className="h-40 border rounded-lg p-2">
                    {agents.filter(a => !managingParticipants.some(p => p.id === a.id)).length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        暂无可添加的智能体
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {agents
                          .filter(a => !managingParticipants.some(p => p.id === a.id))
                          .map(agent => (
                            <div
                              key={agent.id}
                              className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setSelectedNewAgentIds(prev =>
                                  prev.includes(agent.id)
                                    ? prev.filter(id => id !== agent.id)
                                    : [...prev, agent.id]
                                );
                              }}
                            >
                              <Checkbox
                                checked={selectedNewAgentIds.includes(agent.id)}
                                onCheckedChange={() => {}}
                              />
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-primary/10">
                                  <Bot className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{agent.name}</div>
                              </div>
                              <Badge variant="outline" className="text-xs">{agent.role}</Badge>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowManageParticipants(false)}>
              关闭
            </Button>
            <Button 
              onClick={handleAddParticipants}
              disabled={managingSubmitting || selectedNewAgentIds.length === 0}
            >
              {managingSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  添加中...
                </>
              ) : (
                `添加选中 (${selectedNewAgentIds.length})`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
