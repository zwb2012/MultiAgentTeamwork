'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Ticket as TicketIcon, 
  Plus,
  Bug,
  Lightbulb,
  Wrench,
  ClipboardList,
  Folder,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Search,
  Trash2,
  Edit,
  MoreVertical
} from 'lucide-react';
import type { Ticket, TicketType, TicketPriority } from '@/types/agent';
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

export default function TicketsPage() {
  const router = useRouter();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);  // 所有工单，用于统计
  const [tickets, setTickets] = useState<any[]>([]);  // 当前筛选的工单，用于显示
  const [loading, setLoading] = useState(true);
  
  // 选中的项目
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 创建工单对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'bug' as TicketType,
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    project_id: ''
  });

  // 删除工单对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑工单对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    type: 'bug' as TicketType,
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    status: 'open' as 'open' | 'in_progress' | 'resolved' | 'closed'
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProjectId !== null) {
      fetchTickets(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [projectsRes, ticketsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/tickets')
      ]);
      
      const projectsData = await projectsRes.json();
      const ticketsData = await ticketsRes.json();
      
      if (projectsData.success) {
        setProjects(projectsData.data);
        // 默认选择第一个项目
        if (projectsData.data.length > 0 && !selectedProjectId) {
          setSelectedProjectId('all');
        }
      }
      
      if (ticketsData.success) {
        setAllTickets(ticketsData.data);  // 保存所有工单
        setTickets(ticketsData.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async (projectId: string | null) => {
    try {
      const url = projectId && projectId !== 'all' 
        ? `/api/tickets?project_id=${projectId}`
        : '/api/tickets';
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setTickets(result.data);
      }
    } catch (error) {
      console.error('获取工单失败:', error);
    }
  };

  // 选择项目
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    fetchTickets(projectId);
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
          project_id: createForm.project_id || (selectedProjectId !== 'all' ? selectedProjectId : undefined)
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCreateDialogOpen(false);
        setCreateForm({
          type: 'bug',
          title: '',
          description: '',
          priority: 'medium',
          project_id: ''
        });
        // 刷新所有工单列表
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

  // 删除工单
  const handleDeleteTicket = async () => {
    if (!deletingTicketId) return;

    try {
      setDeleting(true);

      const response = await fetch(`/api/tickets/${deletingTicketId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setDeleteDialogOpen(false);
        setDeletingTicketId(null);
        // 刷新所有工单列表
        fetchData();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除工单失败:', error);
      alert('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 打开编辑对话框
  const handleOpenEditDialog = (ticket: any) => {
    setEditingTicketId(ticket.id);
    setEditForm({
      type: ticket.type,
      title: ticket.title,
      description: ticket.description || '',
      priority: ticket.priority,
      status: ticket.status
    });
    setEditDialogOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingTicketId || !editForm.title) {
      alert('请输入工单标题');
      return;
    }

    try {
      setEditing(true);

      const response = await fetch(`/api/tickets/${editingTicketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const result = await response.json();

      if (result.success) {
        setEditDialogOpen(false);
        setEditingTicketId(null);
        // 刷新所有工单列表
        fetchData();
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存工单失败:', error);
      alert('保存失败');
    } finally {
      setEditing(false);
    }
  };

  // 获取项目名称
  const getProjectName = (projectId?: string) => {
    if (!projectId) return '未关联项目';
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
  };

  // 过滤工单
  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery) return true;
    return ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (ticket.description && ticket.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // 按状态分组
  const groupedTickets = {
    open: filteredTickets.filter(t => t.status === 'open'),
    in_progress: filteredTickets.filter(t => t.status === 'in_progress'),
    resolved: filteredTickets.filter(t => t.status === 'resolved'),
    closed: filteredTickets.filter(t => t.status === 'closed')
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">工单管理</h1>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建工单
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* 左侧：项目列表 */}
        <aside className="w-64 border-r bg-background min-h-[calc(100vh-64px)]">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm text-muted-foreground">项目列表</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-128px)]">
            <div className="p-2">
              {/* 全部项目 */}
              <button
                onClick={() => handleSelectProject('all')}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                  selectedProjectId === 'all' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TicketIcon className="h-4 w-4" />
                  <span className="font-medium">全部工单</span>
                </div>
                <p className="text-xs mt-1 opacity-70">{allTickets.length} 个工单</p>
              </button>
              
              {projects.map(project => {
                const projectTickets = allTickets.filter(t => t.project_id === project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                      selectedProjectId === project.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      <span className="font-medium truncate">{project.name}</span>
                    </div>
                    <p className="text-xs mt-1 opacity-70">{projectTickets.length} 个工单</p>
                  </button>
                );
              })}
              
              {projects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">暂无项目</p>
                  <Link href="/projects" className="text-primary text-xs hover:underline mt-1 inline-block">
                    创建项目
                  </Link>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* 右侧：工单列表 */}
        <main className="flex-1 p-6">
          {/* 搜索栏 */}
          <div className="mb-6 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索工单..."
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              共 {filteredTickets.length} 个工单
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {/* 滚动到待处理 */}}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">待处理</p>
                    <p className="text-2xl font-bold">{groupedTickets.open.length}</p>
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
                    <p className="text-2xl font-bold">{groupedTickets.in_progress.length}</p>
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
                    <p className="text-2xl font-bold">{groupedTickets.resolved.length}</p>
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
                    <p className="text-2xl font-bold">{groupedTickets.closed.length}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 工单列表 */}
          <Tabs defaultValue="open" className="space-y-4">
            <TabsList>
              <TabsTrigger value="open">待处理 ({groupedTickets.open.length})</TabsTrigger>
              <TabsTrigger value="in_progress">处理中 ({groupedTickets.in_progress.length})</TabsTrigger>
              <TabsTrigger value="resolved">已解决 ({groupedTickets.resolved.length})</TabsTrigger>
              <TabsTrigger value="closed">已关闭 ({groupedTickets.closed.length})</TabsTrigger>
            </TabsList>
            
            {['open', 'in_progress', 'resolved', 'closed'].map(status => (
              <TabsContent key={status} value={status}>
                {groupedTickets[status as keyof typeof groupedTickets].length === 0 ? (
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
                  <div className="space-y-3">
                    {groupedTickets[status as keyof typeof groupedTickets].map(ticket => {
                      const typeConfig = TICKET_TYPE_CONFIG[ticket.type as keyof typeof TICKET_TYPE_CONFIG] || TICKET_TYPE_CONFIG.task;
                      const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                      const statusConfig = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
                      const TypeIcon = typeConfig.icon;
                      
                      return (
                        <Card 
                          key={ticket.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => router.push(`/tickets/${ticket.id}`)}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                <TypeIcon className={`h-5 w-5 mt-1 ${typeConfig.color}`} />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium truncate">{ticket.title}</h3>
                                  {ticket.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                      {ticket.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge variant="outline" className={priorityConfig.color}>
                                      {priorityConfig.label}
                                    </Badge>
                                    {selectedProjectId === 'all' && ticket.project_id && (
                                      <Badge variant="outline" className="text-xs">
                                        {getProjectName(ticket.project_id)}
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(ticket.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
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
                                    <Play className="h-4 w-4 mr-1" />
                                    处理
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenEditDialog(ticket)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      编辑
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        e.stopPropagation();
                                        setDeletingTicketId(ticket.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      删除
                                    </DropdownMenuItem>
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
      </div>

      {/* 创建工单对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>新建工单</DialogTitle>
            <DialogDescription>
              创建新的工单
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
                    <SelectItem value="bug">
                      <div className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-red-500" />
                        Bug 修复
                      </div>
                    </SelectItem>
                    <SelectItem value="feature">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-500" />
                        新需求
                      </div>
                    </SelectItem>
                    <SelectItem value="improvement">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-green-500" />
                        改进优化
                      </div>
                    </SelectItem>
                    <SelectItem value="task">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-gray-500" />
                        通用任务
                      </div>
                    </SelectItem>
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
              <Label>所属项目</Label>
              <Select 
                value={createForm.project_id || (selectedProjectId !== 'all' ? selectedProjectId || '' : '')}
                onValueChange={(value) => setCreateForm({ ...createForm, project_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        <span>{project.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* 编辑工单对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑工单</DialogTitle>
            <DialogDescription>
              修改工单信息
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>工单类型</Label>
              <Select
                value={editForm.type}
                onValueChange={(value) => setEditForm({ ...editForm, type: value as TicketType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-red-500" />
                      Bug 修复
                    </div>
                  </SelectItem>
                  <SelectItem value="feature">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-500" />
                      新需求
                    </div>
                  </SelectItem>
                  <SelectItem value="improvement">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-green-500" />
                      改进优化
                    </div>
                  </SelectItem>
                  <SelectItem value="task">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-gray-500" />
                      通用任务
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>标题 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="输入工单标题"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                placeholder="输入工单描述"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(value) => setEditForm({ ...editForm, priority: value as TicketPriority })}
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

              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value as any })}
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={editing}>
              {editing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，确定要删除这个工单吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteTicket} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
