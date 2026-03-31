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
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { Conversation, ConversationType } from '@/types/conversation';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // 创建表单
  const [createForm, setCreateForm] = useState({
    title: '',
    type: 'group' as ConversationType,
    selectedAgents: [] as string[]
  });

  useEffect(() => {
    fetchConversations();
    fetchAgents();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const result = await response.json();
      
      if (result.success) {
        setConversations(result.data);
      }
    } catch (error) {
      console.error('获取会话列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
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

  // 切换智能体选择
  const toggleAgentSelection = (agentId: string) => {
    setCreateForm(prev => ({
      ...prev,
      selectedAgents: prev.selectedAgents.includes(agentId)
        ? prev.selectedAgents.filter(id => id !== agentId)
        : [...prev.selectedAgents, agentId]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">会话中心</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">返回首页</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* 搜索和操作栏 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索会话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
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
                  <div className="grid grid-cols-2 gap-2">
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
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <item.icon className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-medium">{item.label}</div>
                              <div className="text-xs text-muted-foreground">{item.desc}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 会话标题 */}
                <div className="space-y-2">
                  <Label htmlFor="title">会话标题</Label>
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
                    <Label>选择参与者</Label>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                      {agents.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">
                          暂无可用智能体
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {agents.map(agent => (
                            <div
                              key={agent.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => toggleAgentSelection(agent.id)}
                            >
                              <Checkbox
                                checked={createForm.selectedAgents.includes(agent.id)}
                                onCheckedChange={() => toggleAgentSelection(agent.id)}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{agent.name}</div>
                                <div className="text-xs text-muted-foreground">{agent.role}</div>
                              </div>
                              <Badge variant="outline">
                                {agent.online_status || 'unknown'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

        {/* 类型标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
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

          <TabsContent value={activeTab}>
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
                {filteredConversations.map(conv => (
                  <Card key={conv.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(conv.type)}
                          <CardTitle className="text-lg">{conv.title}</CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/conversations/${conv.id}`}>
                                查看详情
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteConversation(conv.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(conv.type)}
                        </Badge>
                        {conv.participants && (
                          <Badge variant="secondary" className="text-xs">
                            {conv.participants.length} 人
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {conv.last_message ? (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{conv.last_message.agent_name}:</span>{' '}
                          {conv.last_message.content.length > 50 
                            ? conv.last_message.content.substring(0, 50) + '...' 
                            : conv.last_message.content}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          暂无消息
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Link href={`/conversations/${conv.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            进入会话
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
