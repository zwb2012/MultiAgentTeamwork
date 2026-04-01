'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

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
    if (!inputMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: inputMessage
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessages(prev => [...prev, result.data]);
        setInputMessage('');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
    } finally {
      setSending(false);
    }
  };

  const getOnlineStatus = (status?: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      unknown: 'bg-gray-400'
    };
    return colors[status || 'unknown'] || colors.unknown;
  };

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
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
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
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧 - 消息区域 */}
      <div className="flex-1 flex flex-col">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
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
            </div>
          )}
        </ScrollArea>

        {/* 输入区域 */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="输入消息..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={sending || !inputMessage.trim()}>
              {sending ? (
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
