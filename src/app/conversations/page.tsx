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
import { 
  MessageSquare, 
  Plus, 
  Send,
  Bot,
  User,
  Loader2
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
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
      const response = await fetch('/api/agents?status=idle');
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

  const handleSendMessage = async (agentId: string) => {
    if (!inputMessage.trim() || !selectedConversation) return;

    setIsLoading(true);
    const userMessage = inputMessage;
    setInputMessage('');

    try {
      // 添加用户消息到界面
      const tempUserMsg: Message = {
        id: 'temp-user',
        conversation_id: selectedConversation.id,
        agent_id: agentId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMsg]);

      // 流式获取AI回复
      setStreamingAgentId(agentId);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          agent_id: agentId,
          user_message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiMessage = '';

      // 添加临时AI消息
      const tempAiMsg: Message = {
        id: 'temp-ai',
        conversation_id: selectedConversation.id,
        agent_id: agentId,
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
              // 完成,保存完整消息
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === 'temp-ai' 
                    ? { ...msg, content: aiMessage }
                    : msg
                )
              );
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                aiMessage += parsed.content;
                // 实时更新AI消息
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
      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('发送消息失败:', error);
      alert('发送消息失败');
    } finally {
      setIsLoading(false);
      setStreamingAgentId(null);
    }
  };

  const getAgentInfo = (agentId: string) => {
    if (!selectedConversation) return null;
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
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {agent.name} - <span className="text-muted-foreground">{agent.role}</span>
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
                  <div className="flex items-center gap-2 mt-2">
                    {selectedConversation.conversation_participants.map(p => (
                      <Badge key={p.agent_id} variant="secondary">
                        {p.agents.name} ({p.agents.role})
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-[calc(100vh-20rem)] p-4">
                    {messages.map((msg, index) => {
                      const agentInfo = msg.agent_id ? getAgentInfo(msg.agent_id) : null;
                      const isUser = msg.role === 'user';
                      const isStreaming = streamingAgentId === msg.agent_id && msg.id === 'temp-ai';
                      
                      return (
                        <div
                          key={index}
                          className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isUser && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4" />
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
                      placeholder="输入消息..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && selectedConversation.conversation_participants.length > 0) {
                          e.preventDefault();
                          handleSendMessage(selectedConversation.conversation_participants[0].agent_id);
                        }
                      }}
                      disabled={isLoading}
                    />
                    {selectedConversation.conversation_participants.map(p => (
                      <Button
                        key={p.agent_id}
                        size="icon"
                        onClick={() => handleSendMessage(p.agent_id)}
                        disabled={isLoading || !inputMessage.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    点击发送按钮选择对应的智能体进行对话
                  </p>
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
