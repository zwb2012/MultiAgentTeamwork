'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Plus, 
  Users, 
  User, 
  Bot, 
  Globe,
  Search,
  MoreVertical,
  Trash2,
  Clock,
  FolderOpen,
  LayoutGrid,
  FolderGit2,
  UserPlus,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationType } from '@/types/conversation';
import type { Agent } from '@/types/agent';
import type { Project } from '@/types/project';

// 视图模式
type ViewMode = 'all' | 'project';

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationParticipants, setConversationParticipants] = useState<Record<string, Agent[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // 管理参与者相关状态
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [managingConversation, setManagingConversation] = useState<Conversation | null>(null);
  const [managingParticipants, setManagingParticipants] = useState<Agent[]>([]);
  const [selectedNewAgentIds, setSelectedNewAgentIds] = useState<string[]>([]);
  const [managingLoading, setManagingLoading] = useState(false);
  const [managingSubmitting, setManagingSubmitting] = useState(false);
  
  // 创建表单
  const [createForm, setCreateForm] = useState({
    title: '',
    type: 'group' as ConversationType,
    project_id: '' as string | null,
    selectedAgents: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (viewMode === 'project' && selectedProjectId) {
      fetchConversations(selectedProjectId);
    } else if (viewMode === 'all') {
      fetchConversations();
    }
  }, [viewMode, selectedProjectId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchConversations(),
        fetchAgents(),
        fetchProjects()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      
      if (result.success) {
        setProjects(result.data || []);
        if (result.data?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(result.data[0].id);
        }
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const fetchConversations = async (projectId?: string) => {
    try {
      const url = projectId 
        ? `/api/conversations?project_id=${projectId}`
        : '/api/conversations';
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setConversations(result.data || []);
        
        // 从会话数据中提取参与者信息
        const participantsMap: Record<string, Agent[]> = {};
        for (const conv of result.data || []) {
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
      console.error('获取会话列表失败:', error);
    }
  };

  const fetchAgents = async (projectId?: string) => {
    try {
      const url = projectId 
        ? `/api/projects/${projectId}/agents`
        : '/api/agents?is_template=false';
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data || []);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  // 切换视图模式时更新智能体列表
  useEffect(() => {
    if (viewMode === 'project' && selectedProjectId) {
      fetchAgents(selectedProjectId);
    } else if (viewMode === 'all') {
      fetchAgents();
    }
  }, [viewMode, selectedProjectId]);

  const handleCreateConversation = async () => {
    if (!createForm.title) {
      alert('请输入会话标题');
      return;
    }

    if (createForm.type !== 'lobby' && createForm.selectedAgents.length === 0) {
      alert('请选择至少一个参与者');
      return;
    }

    // 如果是项目会话模式，自动关联当前项目；全局会话模式不关联项目
    const projectId = viewMode === 'project' ? selectedProjectId : null;

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          type: createForm.type,
          project_id: projectId,
          agent_ids: createForm.selectedAgents
        })
      });

      const result = await response.json();

      if (result.success) {
        setIsCreateDialogOpen(false);
        fetchConversations(viewMode === 'project' ? selectedProjectId : undefined);
        setCreateForm({
          title: '',
          type: 'group',
          project_id: null,
          selectedAgents: []
        });
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('确定要删除这个会话吗？')) return;
    
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchConversations(viewMode === 'project' ? selectedProjectId : undefined);
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 打开管理参与者弹窗
  const handleOpenManageDialog = async (conversation: Conversation) => {
    setManagingConversation(conversation);
    setManagingLoading(true);
    setIsManageDialogOpen(true);
    
    try {
      // 获取当前参与者
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
        // 刷新参与者列表
        const participantsRes = await fetch(`/api/conversations/${managingConversation.id}/participants`);
        const participantsResult = await participantsRes.json();
        if (participantsResult.success) {
          setManagingParticipants(participantsResult.data || []);
        }
        setSelectedNewAgentIds([]);
        // 刷新会话列表
        fetchConversations(viewMode === 'project' ? selectedProjectId : undefined);
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
        // 刷新会话列表
        fetchConversations(viewMode === 'project' ? selectedProjectId : undefined);
      } else {
        alert(result.error || '移除失败');
      }
    } catch (error) {
      console.error('移除参与者失败:', error);
      alert('移除失败');
    }
  };

  // 过滤会话
  const filteredConversations = conversations.filter(conv => {
    // 类型过滤
    if (activeType !== 'all' && conv.type !== activeType) {
      return false;
    }

    // 在全局会话模式下，过滤掉项目会话
    if (viewMode === 'all' && conv.project_id) {
      return false;
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        conv.title.toLowerCase().includes(query) ||
        conv.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // 获取会话类型图标
  const getTypeIcon = (type: ConversationType) => {
    switch (type) {
      case 'lobby':
        return <Globe className="h-4 w-4" />;
      case 'private':
        return <User className="h-4 w-4" />;
      case 'group':
        return <Users className="h-4 w-4" />;
      case 'pipeline':
        return <Bot className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // 获取会话类型标签
  const getTypeLabel = (type: ConversationType) => {
    switch (type) {
      case 'lobby':
        return '大厅';
      case 'private':
        return '私聊';
      case 'group':
        return '群组';
      case 'pipeline':
        return '流水线';
      default:
        return type;
    }
  };

  // 获取健康状态颜色
  const getHealthColor = (status?: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',   // 健康
      offline: 'bg-red-500',    // 异常
      unknown: 'bg-gray-400'    // 未检测
    };
    return colors[status || 'unknown'] || colors.unknown;
  };

  // 获取健康状态文字
  const getHealthLabel = (status?: string) => {
    const labels: Record<string, string> = {
      online: '健康',
      offline: '异常',
      unknown: '未检测'
    };
    return labels[status || 'unknown'] || '未检测';
  };

  // 兼容旧调用
  const getOnlineColor = getHealthColor;

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

  // 获取项目名称
  const getProjectName = (projectId: string | null | undefined) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
  };

  // 切换智能体选择
  const toggleAgentSelection = (agentId: string) => {
    setCreateForm(prev => ({
      ...prev,
      selectedAgents: prev.selectedAgents.includes(agentId)
        ? prev.selectedAgents.filter(id => id !== agentId)
        : [...prev.selectedAgents, agentId]
    }));
  };

  // 格式化时间
  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 会话类型选项
  const typeOptions = [
    { value: 'all', label: '全部', icon: LayoutGrid },
    { value: 'lobby', label: '大厅', icon: Globe },
    { value: 'private', label: '私聊', icon: User },
    { value: 'group', label: '群组', icon: Users },
    { value: 'pipeline', label: '流水线', icon: Bot },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">会话中心</h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === 'all'
              ? '全局会话：查看所有非项目关联的对话'
              : '项目会话：查看和管理特定项目的对话'}
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建会话
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>创建新会话</DialogTitle>
              <DialogDescription>
                {viewMode === 'project'
                  ? `为项目「${projects.find(p => p.id === selectedProjectId)?.name}」创建会话`
                  : '创建全局会话（不关联项目）'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* 会话类型选择 */}
              <div className="space-y-2">
                <Label>会话类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'lobby', label: '大厅', icon: Globe, desc: '所有人可见' },
                    { type: 'group', label: '群组', icon: Users, desc: '多智能体协作' },
                    { type: 'private', label: '私聊', icon: User, desc: '1对1对话' }
                  ].map(item => (
                    <Card
                      key={item.type}
                      className={`cursor-pointer transition-all ${
                        createForm.type === item.type 
                          ? 'border-primary shadow-md' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setCreateForm(prev => ({ ...prev, type: item.type as ConversationType }))}
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

              {/* 会话标题 */}
              <div className="space-y-2">
                <Label htmlFor="title">会话标题 *</Label>
                <Input
                  id="title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="输入会话标题"
                />
              </div>

              {/* 选择参与者 */}
              {createForm.type !== 'lobby' && (
                <div className="space-y-2">
                  <Label>{createForm.type === 'private' ? '选择对话智能体 *' : '选择参与者 *'}</Label>
                  <ScrollArea className="h-48 border rounded-lg p-2">
                    {agents.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                        {viewMode === 'project' ? '该项目暂无智能体' : '暂无可用智能体'}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {agents.map(agent => {
                          const isSelected = createForm.selectedAgents.includes(agent.id);
                          const isPrivate = createForm.type === 'private';
                          const statusColor = agent.work_status === 'working'
                            ? 'bg-blue-500 animate-pulse'
                            : agent.online_status === 'online'
                              ? 'bg-green-500'
                              : agent.online_status === 'offline'
                                ? 'bg-red-500'
                                : 'bg-gray-400';
                          
                          return (
                            <div
                              key={agent.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                                isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                              )}
                              onClick={() => {
                                if (isPrivate) {
                                  setCreateForm(prev => ({
                                    ...prev,
                                    selectedAgents: isSelected ? [] : [agent.id]
                                  }));
                                } else {
                                  toggleAgentSelection(agent.id);
                                }
                              }}
                            >
                              {isPrivate ? (
                                <div className={cn(
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                                )}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              ) : (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleAgentSelection(agent.id)}
                                />
                              )}
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  <Bot className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium truncate">{agent.name}</span>
                                  {agent.project_id ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      {projects.find(p => p.id === agent.project_id)?.name || '未知项目'}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      全局
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {getRoleLabel(agent.role)}
                                  </span>
                                </div>
                              </div>
                              <span className={cn("w-2 h-2 rounded-full", statusColor)} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                  {createForm.selectedAgents.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {createForm.type === 'private'
                        ? `已选择: ${agents.find(a => a.id === createForm.selectedAgents[0])?.name}`
                        : `已选择 ${createForm.selectedAgents.length} 个参与者`
                      }
                    </p>
                  )}
                </div>
              )}

              {/* 创建按钮 */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateConversation}>
                  创建
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 视图切换和项目选择 */}
      <div className="flex items-center gap-4">
        {/* 分段控制器 - 视图切换 */}
        <div className="inline-flex h-10 items-center rounded-lg bg-muted p-1">
          <button
            onClick={() => setViewMode('all')}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              viewMode === 'all'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            全局会话
          </button>
          <button
            onClick={() => setViewMode('project')}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              viewMode === 'project' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FolderGit2 className="h-4 w-4" />
            项目会话
          </button>
        </div>

        {/* 项目选择器 - 仅在项目会话模式下显示 */}
        {viewMode === 'project' && (
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 类型过滤 - 美观的按钮组 */}
      <div className="flex items-center gap-2 flex-wrap">
        {typeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => setActiveType(option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                activeType === option.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <Badge variant="outline">{filteredConversations.length} 个会话</Badge>
        </div>
      </div>

      {/* 会话列表 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      ) : viewMode === 'project' && !selectedProjectId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">请选择一个项目</p>
          </CardContent>
        </Card>
      ) : filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {viewMode === 'project' ? '该项目暂无会话' : '暂无会话'}
            </p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              创建第一个会话
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConversations.map(conv => {
            const participants = conversationParticipants[conv.id] || [];
            const onlineCount = participants.filter(a => a.online_status === 'online').length;
            const projectName = getProjectName(conv.project_id);
            
            return (
              <Card key={conv.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <Link href={`/conversations/${conv.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(conv.type as ConversationType)}
                        <CardTitle className="text-lg hover:text-primary transition-colors">{conv.title}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/conversations/${conv.id}`}>
                              进入会话
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              handleOpenManageDialog(conv);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            管理参与者
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteConversation(conv.id);
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
                        {getTypeLabel(conv.type as ConversationType)}
                      </Badge>
                      {projectName && (
                        <Badge variant="secondary" className="text-xs">
                          {projectName}
                        </Badge>
                      )}
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          onlineCount > 0 ? "text-green-600 border-green-300" : "text-muted-foreground"
                        )}
                      >
                        {onlineCount}/{participants.length} 健康
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* 参与者头像和状态 */}
                    <div className="flex items-center gap-1 mb-3">
                      {participants.slice(0, 5).map((agent) => {
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
                              className={cn("absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background", statusColor)} 
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
                                <span className={cn("w-1.5 h-1.5 rounded-full", statusColor)} />
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
                    
                    {/* 在线/工作中统计 */}
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const workingCount = participants.filter(a => a.work_status === 'working').length;
                        const onlineOnlyCount = participants.filter(a => a.work_status !== 'working' && a.online_status === 'online').length;
                        
                        return (
                          <>
                            {workingCount > 0 && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                {workingCount} 工作中
                              </Badge>
                            )}
                            {onlineOnlyCount > 0 && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                {onlineOnlyCount} 健康
                              </Badge>
                            )}
                            {workingCount === 0 && onlineOnlyCount === 0 && participants.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {participants.length} 异常
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    
                    {/* 最后消息 */}
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
                      {formatTime(conv.updated_at || conv.created_at)}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* 管理参与者弹窗 */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{agent.name}</span>
                                {agent.project_id ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {projects.find(p => p.id === agent.project_id)?.name || '未知项目'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                    全局
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{getRoleLabel(agent.role)}</div>
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm truncate">{agent.name}</span>
                                  {agent.project_id ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      {projects.find(p => p.id === agent.project_id)?.name || '未知项目'}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      全局
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {getRoleLabel(agent.role)}
                              </Badge>
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
            <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>
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
