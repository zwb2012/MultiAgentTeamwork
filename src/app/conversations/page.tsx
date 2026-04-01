'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Circle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { Conversation, ConversationType } from '@/types/conversation';
import type { Agent } from '@/types/agent';
import type { Project } from '@/types/project';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationParticipants, setConversationParticipants] = useState<Record<string, Agent[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
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
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const result = await response.json();
      
      if (result.success) {
        setConversations(result.data);
        
        // 从 conversation_participants 提取参与者信息
        const participantsMap: Record<string, Agent[]> = {};
        for (const conv of result.data || []) {
          if (conv.conversation_participants && conv.conversation_participants.length > 0) {
            // conversation_participants 结构: [{ agent_id, agents: { id, name, ... } }]
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

  const fetchAgents = async () => {
    try {
      // 只获取非模板智能体（项目智能体）
      const response = await fetch('/api/agents?is_template=false');
      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  const handleCreateConversation = async () => {
    if (!createForm.title) {
      alert('请输入会话标题');
      return;
    }
    
    if (createForm.type !== 'lobby' && createForm.selectedAgents.length === 0) {
      alert('请选择至少一个参与者');
      return;
    }

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          type: createForm.type,
          project_id: createForm.project_id || null,
          agent_ids: createForm.selectedAgents
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        fetchConversations();
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
        fetchConversations();
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 过滤会话
  const filteredConversations = conversations.filter(conv => {
    // 类型过滤
    if (activeTab !== 'all' && conv.type !== activeTab) {
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

  // 获取在线状态颜色
  const getOnlineColor = (status?: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      unknown: 'bg-gray-400'
    };
    return colors[status || 'unknown'] || colors.unknown;
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

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">会话管理</h1>
          <p className="text-muted-foreground mt-1">
            管理多智能体对话会话，支持私聊、群组和流水线模式
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
                选择会话类型并配置参与者
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

              {/* 项目选择 */}
              <div className="space-y-2">
                <Label>关联项目（可选）</Label>
                <Select
                  value={createForm.project_id || 'none'}
                  onValueChange={(v) => setCreateForm(prev => ({ ...prev, project_id: v === 'none' ? null : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联项目</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 选择参与者 */}
              {createForm.type !== 'lobby' && (
                <div className="space-y-2">
                  <Label>{createForm.type === 'private' ? '选择对话智能体 *' : '选择参与者 *'}</Label>
                  <ScrollArea className="h-48 border rounded-lg p-2">
                    {agents.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                        暂无可用智能体
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {agents.map(agent => {
                          const isSelected = createForm.selectedAgents.includes(agent.id);
                          const isPrivate = createForm.type === 'private';
                          
                          return (
                            <div
                              key={agent.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                              }`}
                              onClick={() => {
                                if (isPrivate) {
                                  // 私聊模式：单选
                                  setCreateForm(prev => ({
                                    ...prev,
                                    selectedAgents: isSelected ? [] : [agent.id]
                                  }));
                                } else {
                                  // 群组模式：多选
                                  setCreateForm(prev => ({
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
                                  onCheckedChange={() => toggleAgentSelection(agent.id)}
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
                              <span className={`w-2 h-2 rounded-full ${getOnlineColor(agent.online_status)}`} />
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

      {/* 搜索栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline">{filteredConversations.length} 个会话</Badge>
      </div>

      {/* 类型标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="lobby">
            <Globe className="h-4 w-4 mr-1" />
            大厅
          </TabsTrigger>
          <TabsTrigger value="private">
            <User className="h-4 w-4 mr-1" />
            私聊
          </TabsTrigger>
          <TabsTrigger value="group">
            <Users className="h-4 w-4 mr-1" />
            群组
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <Bot className="h-4 w-4 mr-1" />
            流水线
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无会话</p>
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
                            {getTypeIcon(conv.type)}
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
                            {getTypeLabel(conv.type)}
                          </Badge>
                          {projectName && (
                            <Badge variant="secondary" className="text-xs">
                              {projectName}
                            </Badge>
                          )}
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${onlineCount > 0 ? 'text-green-600 border-green-300' : 'text-muted-foreground'}`}
                          >
                            {onlineCount}/{participants.length} 在线
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* 参与者头像和状态 */}
                        <div className="flex items-center gap-1 mb-3">
                          {participants.slice(0, 5).map((agent, idx) => {
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
                                ? '在线'
                                : agent.online_status === 'offline'
                                  ? '离线'
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
                                {/* 悬浮显示状态和模型 */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-max">
                                  <div className="font-medium">{agent.name}</div>
                                  <div className="text-muted-foreground">{statusText}</div>
                                  {agent.model && (
                                    <div className="text-muted-foreground text-[10px] mt-0.5">
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
                            const onlineCount = participants.filter(a => a.work_status !== 'working' && a.online_status === 'online').length;
                            
                            return (
                              <>
                                {workingCount > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                    {workingCount} 工作中
                                  </Badge>
                                )}
                                {onlineCount > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                    {onlineCount} 在线
                                  </Badge>
                                )}
                                {workingCount === 0 && onlineCount === 0 && participants.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {participants.length} 离线
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
                          <div className="text-sm text-muted-foreground">
                            暂无消息
                          </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
