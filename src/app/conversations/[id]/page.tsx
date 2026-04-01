'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Send,
  Users,
  Bot,
  MessageSquare,
  Loader2,
  Circle
} from 'lucide-react';
import type { Conversation, Message } from '@/types/conversation';
import type { Agent } from '@/types/agent';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [respondingAgent, setRespondingAgent] = useState<Agent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const fetchConversation = async () => {
    try {
      setIsLoading(true);
      
      // 获取会话详情
      const convRes = await fetch(`/api/conversations/${conversationId}`);
      const convResult = await convRes.json();
      
      if (!convResult.success) {
        alert('会话不存在');
        router.push('/conversations');
        return;
      }
      
      setConversation(convResult.data);
      
      // 从 conversation_participants 提取参与者信息
      if (convResult.data.conversation_participants?.length > 0) {
        const participantsData = convResult.data.conversation_participants
          .filter((p: any) => p.agents)
          .map((p: any) => ({
            ...p.agents,
            id: p.agent_id || p.agents.id
          }));
        setParticipants(participantsData);
      }
      
      // 获取消息列表
      const msgRes = await fetch(`/api/conversations/${conversationId}/messages`);
      const msgResult = await msgRes.json();
      if (msgResult.success) {
        setMessages(msgResult.data || []);
      }
    } catch (error) {
      console.error('获取会话详情失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending || aiResponding) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    
    try {
      // 先添加用户消息到界面
      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString(),
        message_type: 'text'
      };
      setMessages(prev => [...prev, userMsg]);
      
      // 调用 chat API 获取 AI 回复（流式输出）
      setAiResponding(true);
      setStreamingMessage('');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_message: userMessage
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '请求失败');
      }
      
      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                // 流结束
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingMessage(fullContent);
                  
                  // 设置响应的智能体
                  if (parsed.agent_id && !respondingAgent) {
                    const agent = participants.find(a => a.id === parsed.agent_id);
                    if (agent) setRespondingAgent(agent);
                  }
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
      
      // 添加 AI 回复到消息列表
      if (fullContent) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          conversation_id: conversationId,
          agent_id: respondingAgent?.id,
          role: 'assistant',
          content: fullContent,
          created_at: new Date().toISOString(),
          message_type: 'text'
        };
        setMessages(prev => [...prev, aiMsg]);
      }
      
    } catch (error) {
      console.error('发送消息失败:', error);
      alert(error instanceof Error ? error.message : '发送失败');
      // 移除失败的用户消息
      setMessages(prev => prev.filter(m => m.id !== `temp-${Date.now() - 1000}`));
    } finally {
      setSending(false);
      setAiResponding(false);
      setStreamingMessage('');
      setRespondingAgent(null);
    }
  };

  // 获取健康状态颜色
  const getHealthStatus = (status?: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',   // 健康
      offline: 'bg-red-500',    // 异常
      unknown: 'bg-gray-400'    // 未检测
    };
    return colors[status || 'unknown'] || colors.unknown;
  };

  // 兼容旧调用
  const getOnlineStatus = getHealthStatus;

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      lobby: '大厅',
      private: '私聊',
      group: '群组',
      pipeline: '流水线'
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* 左侧边栏 - 参与者列表 */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/conversations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
          </Link>
        </div>
        
        <div className="p-4 border-b">
          <h2 className="font-semibold truncate">{conversation?.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{getTypeLabel(conversation?.type || 'private')}</Badge>
            <Badge variant="secondary">{participants.length} 人</Badge>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            参与者
          </h3>
          <div className="space-y-2">
            {participants.map(agent => (
              <div 
                key={agent.id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer ${
                  respondingAgent?.id === agent.id ? 'bg-primary/10' : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getOnlineStatus(agent.online_status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">{agent.role}</div>
                </div>
                {respondingAgent?.id === agent.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧 - 消息区域 */}
      <div className="flex-1 flex flex-col">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 && !streamingMessage ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p>暂无消息</p>
              <p className="text-sm mt-1">发送一条消息开始对话</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => {
                const agent = participants.find(a => a.id === msg.agent_id);
                const isUser = msg.role === 'user';
                
                return (
                  <div 
                    key={msg.id || index}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[70%] ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg p-3`}>
                      {!isUser && agent && (
                        <div className="text-xs font-medium mb-1 text-muted-foreground">
                          {agent.name}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className={`text-xs mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {msg.created_at && new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {isUser && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
              
              {/* 流式输出中的消息 */}
              {streamingMessage && respondingAgent && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[70%] bg-muted rounded-lg p-3">
                    <div className="text-xs font-medium mb-1 text-muted-foreground">
                      {respondingAgent.name}
                      <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* 输入区域 */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={aiResponding ? "AI 正在回复..." : "输入消息..."}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
              disabled={aiResponding}
            />
            <Button onClick={handleSendMessage} disabled={sending || aiResponding || !inputMessage.trim()}>
              {sending || aiResponding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
