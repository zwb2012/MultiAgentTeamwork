'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  MessageSquare,
  Plus,
  Loader2,
  MoreHorizontal,
  Trash2,
  FolderOpen
} from 'lucide-react';
import type { Project } from '@/types/project';

export default function ProjectConversationsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newConversation, setNewConversation] = useState({ title: '', type: 'private', agent_ids: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);

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
                        onClick={() => setDeleteId(conv.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                      {conv.status === 'active' ? '活跃' : conv.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {conv.type === 'private' ? '私聊' : 
                       conv.type === 'group' ? '群组' : 
                       conv.type === 'lobby' ? '大厅' : conv.type}
                    </span>
                  </div>
                  
                  {conv.last_message && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {conv.last_message.content}
                    </p>
                  )}
                  
                  {conv.conversation_participants && (
                    <div className="flex flex-wrap gap-1">
                      {conv.conversation_participants.slice(0, 3).map((p: any) => (
                        <Badge key={p.agent_id} variant="outline" className="text-xs">
                          {p.agents?.name || '未知'}
                        </Badge>
                      ))}
                      {conv.conversation_participants.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{conv.conversation_participants.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
            
            {newConversation.type !== 'lobby' && agents.length > 0 && (
              <div className="space-y-2">
                <Label>参与者</Label>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <Badge
                      key={agent.id}
                      variant={newConversation.agent_ids.includes(agent.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setNewConversation(prev => ({
                          ...prev,
                          agent_ids: prev.agent_ids.includes(agent.id)
                            ? prev.agent_ids.filter(id => id !== agent.id)
                            : [...prev.agent_ids, agent.id]
                        }));
                      }}
                    >
                      {agent.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">点击选择参与者</p>
              </div>
            )}
            
            {agents.length === 0 && (
              <div className="text-sm text-muted-foreground">
                该项目暂无智能体，请先创建智能体
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
