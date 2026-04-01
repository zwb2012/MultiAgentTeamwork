'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Plus,
  Loader2,
  MoreHorizontal,
  Trash2,
  FolderOpen,
  Users,
  User,
  Globe,
  Bot,
  Clock
} from 'lucide-react';
import type { Project } from '@/types/project';
import type { Agent } from '@/types/agent';

export default function ProjectConversationsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationParticipants, setConversationParticipants] = useState<Record<string, Agent[]>>({});
  const [loading, setLoading] = useState(true);
  
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newConversation, setNewConversation] = useState({ title: '', type: 'private', agent_ids: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchConversations();
      fetchAgents();
    }
  }, [selectedProjectId]);

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

  const fetchConversations = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/conversations?project_id=${selectedProjectId}`);
      const result = await response.json();
      if (result.success) {
        setConversations(result.data || []);
        
        // 从会话数据中提取参与者信息
        const participantsMap: Record<string, Agent[]> = {};
        if (result.data && result.data.length > 0) {
          result.data.forEach((conv: any) => {
            if (conv.conversation_participants) {
              participantsMap[conv.id] = conv.conversation_participants
                .filter((p: any) => p.agents)
                .map((p: any) => ({
                  id: p.agents.id,
                  name: p.agents.name,
                  role: p.agents.role,
                  agent_type: p.agents.agent_type,
                  model: p.agents.model,
                  online_status: p.agents.online_status,
                  work_status: p.agents.work_status
                }));
            }
          });
        }
        setConversationParticipants(participantsMap);
      }
    } catch (error) {
      console.error('获取会话失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    if (!selectedProjectId) return;
    
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/agents`);
      const result = await response.json();
      if (result.success) {
        setAgents(result.data || []);
      }
    } catch (error) {
      console.error('获取智能体失败:', error);
    }
  };

  const handleCreate = async () => {
    if (!newConversation.title || !selectedProjectId) {
      alert('请填写会话标题');
      return;
    }
    
    if (newConversation.type !== 'lobby' && newConversation.agent_ids.length === 0) {
      alert('请选择至少一个参与者');
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
          agent_ids: newConversation.agent_ids
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreate(false);
        setNewConversation({ title: '', type: 'private', agent_ids: [] });
        fetchConversations();
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

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      const response = await fetch(`/api/conversations/${deleteId}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        fetchConversations();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    } finally {
      setDeleteId(null);
    }
  };

  // 切换智能体选择
  const toggleAgentSelection = (agentId: string) => {
    const isPrivate = newConversation.type === 'private';
    
    setNewConversation(prev => ({
      ...prev,
      agent_ids: isPrivate
        ? (prev.agent_ids.includes(agentId) ? [] : [agentId])
        : (prev.agent_ids.includes(agentId)
          ? prev.agent_ids.filter(id => id !== agentId)
          : [...prev.agent_ids, agentId])
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

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">项目会话</h1>
          <p className="text-muted-foreground mt-1">
            管理项目内的智能体会话
          </p>
        </div>
        
        <div className="flex items-center gap-4">
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
          
          <Button onClick={() => setShowCreate(true)} disabled={!selectedProjectId}>
            <Plus className="h-4 w-4 mr-2" />
            创建会话
          </Button>
        </div>
      </div>

      {/* 会话列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedProjectId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">请先选择一个项目</p>
          </CardContent>
        </Card>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">该项目暂无会话</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个会话
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {conversations.map((conv) => {
            const participants = conversationParticipants[conv.id] || [];
            const onlineCount = participants.filter(a => a.online_status === 'online').length;
            
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
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(conv.id);
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
                      const workingCount = participants.filter(a => a.work_status === 'working').length;
                      const onlineCount = participants.filter(a => a.work_status !== 'working' && a.online_status === 'online').length;
                      
                      return (
                        <>
                          {workingCount > 0 && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              {workingCount} 工中
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
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建会话弹窗 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建会话</DialogTitle>
            <DialogDescription>为项目 {selectedProject?.name} 创建新会话</DialogDescription>
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
              <Select value={newConversation.type} onValueChange={(v) => setNewConversation({ ...newConversation, type: v, agent_ids: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私聊</SelectItem>
                  <SelectItem value="group">群组</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {newConversation.type !== 'lobby' && (
              <div className="space-y-2">
                <Label>{newConversation.type === 'private' ? '选择对话智能体' : '选择参与者'}</Label>
                <ScrollArea className="h-48 border rounded-lg p-2">
                  {agents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      该项目暂无智能体，请先创建智能体
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {agents.map(agent => {
                        const isSelected = newConversation.agent_ids.includes(agent.id);
                        const isPrivate = newConversation.type === 'private';
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
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                            }`}
                            onClick={() => toggleAgentSelection(agent.id)}
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
                            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                {newConversation.agent_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {newConversation.type === 'private'
                      ? `已选择: ${agents.find(a => a.id === newConversation.agent_ids[0])?.name}`
                      : `已选择 ${newConversation.agent_ids.length} 个参与者`
                    }
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={submitting || (newConversation.type !== 'lobby' && newConversation.agent_ids.length === 0)}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，确定要删除该会话吗？
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
