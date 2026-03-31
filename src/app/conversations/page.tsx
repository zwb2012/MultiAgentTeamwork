'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Plus, 
  Send,
  Bot,
  User,
  Loader2,
  Terminal,
  Play,
  Square,
  Info
} from 'lucide-react';
import type { Agent, Message } from '@/types/agent';

interface ConversationWithAgents {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  conversation_participants: Array<{
    agent_id: string;
    agents: Agent;
  }>;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationWithAgents[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithAgents | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [newConversationDesc, setNewConversationDesc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null);
  const [streamingAgentName, setStreamingAgentName] = useState<string>('');
  const [processStatus, setProcessStatus] = useState<Record<string, { running: boolean; pid: number | null }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      // 检查进程状态
      checkProcessStatus();
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const result = await response.json();
      
      if (result.success) {
        setConversations(result.data);
      }
    } catch (error) {
      console.error('获取会话列表失败:', error);
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

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`);
      const result = await response.json();
      
      if (result.success) {
        setMessages(result.data);
      }
    } catch (error) {
      console.error('获取消息列表失败:', error);
    }
  };

  const checkProcessStatus = async () => {
    if (!selectedConversation) return;
    
    for (const p of selectedConversation.conversation_participants) {
      if (p.agents.agent_type === 'process') {
        try {
          const response = await fetch(`/api/agents/${p.agent_id}/process`);
          const result = await response.json();
          if (result.success) {
            setProcessStatus(prev => ({
              ...prev,
              [p.agent_id]: result.data
            }));
          }
        } catch (error) {
          console.error('检查进程状态失败:', error);
        }
      }
    }
  };

  const handleCreateConversation = async () => {
    if (!newConversationTitle || selectedAgents.length === 0) {
      alert('请填写会话标题并选择至少一个智能体');
      return;
    }

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newConversationTitle,
          description: newConversationDesc,
          agent_ids: selectedAgents
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        setNewConversationTitle('');
        setNewConversationDesc('');
        setSelectedAgents([]);
        fetchConversations();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      alert('创建失败');
    }
  };

  // 发送消息（自动识别智能体）
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversation) return;

    setIsLoading(true);
    const userMessage = inputMessage;
    setInputMessage('');

    try {
      // 添加用户消息到界面
      const tempUserMsg: Message = {
        id: 'temp-user',
        conversation_id: selectedConversation.id,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMsg]);

      // 流式获取AI回复（自动识别智能体）
      setStreamingAgentId('auto');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          user_message: userMessage,
          auto_detect: true
        })
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiMessage = '';
      let detectedAgentId = '';
      let detectedAgentName = '';

      // 添加临时AI消息
      const tempAiMsg: Message = {
        id: 'temp-ai',
        conversation_id: selectedConversation.id,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempAiMsg]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === 'temp-ai' 
                    ? { ...msg, content: aiMessage, agent_id: detectedAgentId }
                    : msg
                )
              );
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                aiMessage += parsed.content;
                if (parsed.agent_id && !detectedAgentId) {
                  detectedAgentId = parsed.agent_id;
                  detectedAgentName = parsed.agent_name || '';
                  setStreamingAgentName(detectedAgentName);
                }
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === 'temp-ai' 
                      ? { ...msg, content: aiMessage }
                      : msg
                  )
                );
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      setStreamingAgentId(null);
      setStreamingAgentName('');
      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('发送消息失败:', error);
      alert('发送消息失败');
    } finally {
      setIsLoading(false);
      setStreamingAgentId(null);
      setStreamingAgentName('');
    }
  };

  // 启动进程
  const handleStartProcess = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/process`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProcessStatus(prev => ({
          ...prev,
          [agentId]: { running: true, pid: result.data.pid }
        }));
      } else {
        alert('启动失败: ' + result.error);
      }
    } catch (error) {
      console.error('启动进程失败:', error);
      alert('启动失败');
    }
  };

  // 停止进程
  const handleStopProcess = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/process`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProcessStatus(prev => ({
          ...prev,
          [agentId]: { running: false, pid: null }
        }));
      }
    } catch (error) {
      console.error('停止进程失败:', error);
    }
  };

  const getAgentInfo = (agentId: string | undefined) => {
    if (!selectedConversation || !agentId) return null;
    const participant = selectedConversation.conversation_participants.find(
      p => p.agent_id === agentId
    );
    return participant?.agents;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            <h1 className="text-xl font-bold">多智能体协作</h1>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建会话
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>创建新会话</DialogTitle>
                <DialogDescription>
                  选择参与协作的智能体
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>会话标题 *</Label>
                  <Input
                    value={newConversationTitle}
                    onChange={(e) => setNewConversationTitle(e.target.value)}
                    placeholder="输入会话标题"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Textarea
                    value={newConversationDesc}
                    onChange={(e) => setNewConversationDesc(e.target.value)}
                    placeholder="描述协作目标"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>选择智能体 * (至少选择1个)</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {agents.map(agent => (
                      <div key={agent.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={agent.id}
                          checked={selectedAgents.includes(agent.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAgents([...selectedAgents, agent.id]);
                            } else {
                              setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={agent.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                        >
                          {agent.name}
                          {agent.agent_type === 'process' ? (
                            <Badge variant="outline" className="text-xs"><Terminal className="h-3 w-3 mr-1" />进程</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs"><Bot className="h-3 w-3 mr-1" />LLM</Badge>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateConversation}>
                  创建
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container px-4 py-8">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
          {/* 会话列表 */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm">会话列表</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`p-4 border-b cursor-pointer hover:bg-muted transition-colors ${
                        selectedConversation?.id === conv.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <h3 className="font-medium text-sm">{conv.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {conv.description}
                      </p>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {conv.conversation_participants.map(p => (
                          <Badge key={p.agent_id} variant="outline" className="text-xs">
                            {p.agents.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {conversations.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无会话</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* 聊天区域 */}
          <div className="col-span-9">
            {selectedConversation ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b">
                  <CardTitle>{selectedConversation.title}</CardTitle>
                  <CardDescription>
                    {selectedConversation.description}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selectedConversation.conversation_participants.map(p => (
                      <div key={p.agent_id} className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {p.agents.name} ({p.agents.role})
                        </Badge>
                        {p.agents.agent_type === 'process' && (
                          processStatus[p.agent_id]?.running ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleStopProcess(p.agent_id)}
                            >
                              <Square className="h-3 w-3 mr-1" />
                              停止
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleStartProcess(p.agent_id)}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              启动
                            </Button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* 提示信息 */}
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      提示：在消息中提到智能体的名字即可唤起它。例如："张三，请帮我看看这个bug"
                    </AlertDescription>
                  </Alert>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] p-4">
                    {messages.map((msg, index) => {
                      const agentInfo = msg.agent_id ? getAgentInfo(msg.agent_id) : null;
                      const isUser = msg.role === 'user';
                      const isStreaming = streamingAgentId === 'auto' && msg.id === 'temp-ai';
                      
                      return (
                        <div
                          key={index}
                          className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isUser && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              {agentInfo?.agent_type === 'process' ? (
                                <Terminal className="h-4 w-4" />
                              ) : (
                                <Bot className="h-4 w-4" />
                              )}
                            </div>
                          )}
                          
                          <div className={`max-w-[70%] ${isUser ? 'order-first' : ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {!isUser && agentInfo && (
                                <span className="text-xs font-medium">{agentInfo.name}</span>
                              )}
                              {isStreaming && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                            </div>
                            <div className={`rounded-lg p-3 ${
                              isUser 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          
                          {isUser && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </ScrollArea>
                </CardContent>
                
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="输入消息，提到智能体名字可唤起它..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isLoading || !inputMessage.trim()}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {streamingAgentName && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {streamingAgentName} 正在回复...
                    </p>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>选择一个会话开始协作</p>
                  <p className="text-sm mt-2">或创建新会话</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
