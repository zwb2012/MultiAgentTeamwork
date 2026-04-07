'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Send,
  Users,
  Bot,
  MessageSquare,
  Loader2,
  Circle,
  UserPlus,
  MoreHorizontal,
  Trash2,
  AtSign
} from 'lucide-react';
import type { Conversation, Message } from '@/types/conversation';
import type { Agent } from '@/types/agent';
import { MessageContent } from '@/components/chat/MessageContent';

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
  // 多智能体流式输出跟踪
  const [currentStreamMessageId, setCurrentStreamMessageId] = useState<string | null>(null);
  const [currentStreamMessageType, setCurrentStreamMessageType] = useState<'coordinator' | 'agent' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 管理参与者相关状态
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [managingParticipants, setManagingParticipants] = useState(false);
  
  // @智能体唤起相关状态
  const [showAgentMention, setShowAgentMention] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
      
      // 获取项目列表（用于显示参与者所属项目）
      const projectsRes = await fetch('/api/projects');
      const projectsResult = await projectsRes.json();
      if (projectsResult.success) {
        setProjects(projectsResult.data || []);
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
        id: `temp-${Date.now()}-${Math.random()}`, // 添加随机数避免并发冲突
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
      // 兼容旧的单智能体模式
      let fullContent = '';
      let sseMetadata: Record<string, any> = {};

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

                // 处理新的并行流式消息类型（优先处理）
                if (parsed.type === 'agent_start') {
                  // 创建新的消息卡片
                  const newMsg: Message = {
                    id: parsed.msg_id,
                    conversation_id: conversationId,
                    agent_id: parsed.agent_id,
                    role: 'assistant',
                    content: '',
                    created_at: new Date().toISOString(),
                    message_type: 'text',
                    metadata: {
                      agent_name: parsed.agent_name,
                      project_id: parsed.project_id,
                      role: parsed.role
                    },
                    streaming: true,
                    done: false
                  };
                  setMessages(prev => [...prev, newMsg]);
                } else if (parsed.type === 'agent_chunk') {
                  // 更新对应消息的流式内容
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === parsed.msg_id
                        ? { ...msg, content: msg.content + parsed.content }
                        : msg
                    )
                  );
                } else if (parsed.type === 'agent_done') {
                  // 标记消息完成，并用数据库生成的真实ID替换临时ID
                  setMessages(prev =>
                    prev.map(msg => {
                      if (msg.id === parsed.msg_id) {
                        const updatedMsg = { ...msg, streaming: false, done: true };
                        // 如果后端返回了数据库生成的真实ID，则替换临时ID
                        if (parsed.db_msg_id) {
                          updatedMsg.id = parsed.db_msg_id;
                        }
                        return updatedMsg;
                      }
                      return msg;
                    })
                  );
                }

                // 处理旧的单智能体和串行模式（兼容性保留）
                if (parsed.content && !parsed.type?.startsWith('agent_')) {
                  // 检查是否是新消息类型（多智能体协调模式）
                  const messageType = parsed.type; // 'coordinator' | 'agent'

                  if (messageType && messageType !== currentStreamMessageType) {
                    // 新的消息类型，创建新的消息对象
                    const timestamp = Date.now();
                    const randomId = Math.random().toString(36).substr(2, 9);
                    const newMsgId = `ai-${messageType}-${timestamp}-${randomId}`;
                    setCurrentStreamMessageId(newMsgId);
                    setCurrentStreamMessageType(messageType);

                    const newMsg: Message = {
                      id: newMsgId,
                      conversation_id: conversationId,
                      agent_id: parsed.agent_id,
                      role: 'assistant',
                      content: parsed.content,
                      created_at: new Date().toISOString(),
                      message_type: 'text',
                      metadata: {
                        coordinator_mode: parsed.coordinator_mode,
                        agent_name: parsed.agent_name,
                        project_id: parsed.project_id,
                        role: parsed.role
                      }
                    };

                    // 如果是agent类型，设置respondingAgent
                    if (messageType === 'agent' && parsed.agent_id) {
                      const agent = participants.find(a => a.id === parsed.agent_id);
                      if (agent) {
                        setRespondingAgent(agent);
                        // 确保agent对象包含项目信息
                        newMsg.metadata!.project_id = agent.project_id;
                        newMsg.metadata!.role = agent.role;
                      }
                    }

                    setMessages(prev => [...prev, newMsg]);
                    setStreamingMessage(parsed.content);
                  } else if (currentStreamMessageId) {
                    // 相同的消息类型，追加到现有消息
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === currentStreamMessageId
                          ? { ...msg, content: msg.content + parsed.content }
                          : msg
                      )
                    );
                    setStreamingMessage(prev => prev + parsed.content);
                  } else {
                    // 兼容旧的单智能体模式（没有type字段）
                    fullContent += parsed.content;
                    setStreamingMessage(fullContent);

                    // 保存SSE元数据
                    if (parsed.coordinator_mode) {
                      sseMetadata.coordinator_mode = true;
                    }
                    if (parsed.agent_name) {
                      sseMetadata.agent_name = parsed.agent_name;
                    }

                    // 设置响应的智能体
                    if (parsed.agent_id && !respondingAgent) {
                      const agent = participants.find(a => a.id === parsed.agent_id);
                      if (agent) setRespondingAgent(agent);
                    }
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

      // 兼容旧的单智能体模式（没有使用多智能体协调）
      if (fullContent && !currentStreamMessageId) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}-${Math.random()}`, // 添加随机数避免并发冲突
          conversation_id: conversationId,
          agent_id: respondingAgent?.id,
          role: 'assistant',
          content: fullContent,
          created_at: new Date().toISOString(),
          message_type: 'text',
          metadata: Object.keys(sseMetadata).length > 0 ? sseMetadata : undefined
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
      setCurrentStreamMessageId(null);
      setCurrentStreamMessageType(null);
    }
  };

  // 获取所有可用的智能体
  const fetchAllAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await fetch('/api/agents?is_template=false');
      const result = await response.json();
      if (result.success) {
        setAllAgents(result.data || []);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  // 打开管理参与者弹窗
  const handleOpenManageDialog = () => {
    setShowManageDialog(true);
    fetchAllAgents();
    setSelectedAgentIds(participants.map(p => p.id));
  };

  // 添加参与者
  const handleAddParticipants = async () => {
    const currentParticipantIds = participants.map(p => p.id);
    const newAgentIds = selectedAgentIds.filter(id => !currentParticipantIds.includes(id));
    
    if (newAgentIds.length === 0) {
      setShowManageDialog(false);
      return;
    }
    
    setManagingParticipants(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ids: newAgentIds })
      });
      
      const result = await response.json();
      if (result.success) {
        // 刷新参与者列表
        const participantsRes = await fetch(`/api/conversations/${conversationId}/participants`);
        const participantsResult = await participantsRes.json();
        if (participantsResult.success) {
          setParticipants(participantsResult.data || []);
        }
        setShowManageDialog(false);
      } else {
        alert(result.error || '添加失败');
      }
    } catch (error) {
      console.error('添加参与者失败:', error);
      alert('添加失败');
    } finally {
      setManagingParticipants(false);
    }
  };

  // 移除参与者
  const handleRemoveParticipant = async (agentId: string) => {
    if (!confirm('确定要移除该智能体吗？')) return;
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}/participants?agent_id=${agentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        setParticipants(prev => prev.filter(p => p.id !== agentId));
      } else {
        alert(result.error || '移除失败');
      }
    } catch (error) {
      console.error('移除参与者失败:', error);
      alert('移除失败');
    }
  };

  // 处理输入变化，检测@符号
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setInputMessage(value);
    setCursorPosition(cursorPos);
    
    // 检测@符号
    const lastAtIndex = value.lastIndexOf('@', cursorPos - 1);
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1, cursorPos);
      // 确保@后面没有空格（表示正在输入智能体名称）
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setShowAgentMention(true);
      } else {
        setShowAgentMention(false);
      }
    } else {
      setShowAgentMention(false);
    }
  };

  // 选择智能体进行@唤起
  const handleSelectAgentMention = (agent: Agent) => {
    const lastAtIndex = inputMessage.lastIndexOf('@', cursorPosition - 1);
    if (lastAtIndex !== -1) {
      const beforeAt = inputMessage.slice(0, lastAtIndex);
      const afterCursor = inputMessage.slice(cursorPosition);
      const newMessage = `${beforeAt}@${agent.name} ${afterCursor}`;
      setInputMessage(newMessage);
      setShowAgentMention(false);
      
      // 聚焦输入框并设置光标位置
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = beforeAt.length + agent.name.length + 2;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // 过滤可显示的智能体（用于@唤起）
  const filteredAgentsForMention = useMemo(() => {
    if (!mentionSearch) return participants;
    return participants.filter(a => 
      a.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [participants, mentionSearch]);

  // 过滤可添加的智能体（不在当前会话中的）
  const availableAgentsToAdd = useMemo(() => {
    const currentIds = participants.map(p => p.id);
    return allAgents.filter(a => !currentIds.includes(a.id));
  }, [allAgents, participants]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 左侧边栏 - 参与者列表（固定，不滚动） */}
      <div className="w-64 border-r bg-muted/30 flex flex-col flex-shrink-0">
        <div className="p-4 border-b flex-shrink-0">
          <Link href="/conversations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
          </Link>
        </div>
        
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="font-semibold truncate">{conversation?.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{getTypeLabel(conversation?.type || 'private')}</Badge>
            <Badge variant="secondary">{participants.length} 人</Badge>
          </div>
        </div>
        
        {/* 参与者列表区域 - 内部可滚动 */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            参与者
          </h3>
          <div className="space-y-2">
            {participants.map(agent => (
              <div 
                key={agent.id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted group ${
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
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{getRoleLabel(agent.role)}</div>
                </div>
                {respondingAgent?.id === agent.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {/* 移除参与者按钮 */}
                {participants.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => handleRemoveParticipant(agent.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          {/* 添加参与者按钮 */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={handleOpenManageDialog}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            添加参与者
          </Button>
        </div>
      </div>

      {/* 右侧 - 消息区域（可滚动） */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0" ref={scrollRef}>
          {messages.length === 0 && !streamingMessage ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p>暂无消息</p>
              <p className="text-sm mt-1">发送一条消息开始对话</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => {
                // 从metadata中获取智能体信息（多智能体协调模式）
                const isCoordinator = msg.metadata?.coordinator_mode;
                const coordinatorName = msg.metadata?.agent_name || '协调者';

                // 构建智能体信息对象（优先从metadata读取，兼容旧逻辑）
                let agentInfo: Agent | null = null;
                if (isCoordinator) {
                  // 协调者模式：只显示名称，不显示项目/角色
                  agentInfo = null;
                } else if (msg.metadata?.agent_name) {
                  // 多智能体协调模式：从metadata读取信息
                  agentInfo = {
                    id: msg.agent_id || '',
                    name: msg.metadata.agent_name,
                    project_id: msg.metadata.project_id,
                    role: msg.metadata.role,
                    online_status: 'online' as const
                  } as Agent;
                } else {
                  // 传统模式：从participants查找
                  agentInfo = participants.find(a => a.id === msg.agent_id) || null;
                }

                const displayName = isCoordinator
                  ? coordinatorName
                  : (agentInfo?.name || '未知智能体');

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
                    <div className={`max-w-[70%] ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg p-3 relative group`}>
                      {!isUser && (
                        <div className="text-xs font-medium mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">{displayName}</span>
                            {isCoordinator && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                协调者
                              </Badge>
                            )}
                            {!isCoordinator && agentInfo && (
                              <>
                                {agentInfo.project_id ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {projects.find(p => p.id === agentInfo.project_id)?.name || '未知项目'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                    全局
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {getRoleLabel(agentInfo.role)}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      <MessageContent content={msg.content} isStreaming={msg.streaming || false} />
                      {/* 流式状态指示器 */}
                      {msg.streaming && (
                        <div className="flex items-center gap-2 text-xs mt-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className={isUser ? 'text-primary-foreground/70' : 'text-gray-500'}>正在思考...</span>
                        </div>
                      )}
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

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="border-t p-4">
          <div className="flex gap-2 relative">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={handleInputChange}
                placeholder={aiResponding ? "AI 正在回复..." : "输入消息... (@智能体名称 可唤起指定智能体)"}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1"
                disabled={aiResponding}
              />
              
              {/* @智能体唤起下拉列表 */}
              {showAgentMention && filteredAgentsForMention.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-full max-w-xs bg-popover border rounded-lg shadow-lg z-10">
                  <div className="p-2 text-xs text-muted-foreground flex items-center gap-1">
                    <AtSign className="h-3 w-3" />
                    选择要唤起的智能体
                  </div>
                  <ScrollArea className="max-h-40">
                    {filteredAgentsForMention.map(agent => (
                      <div
                        key={agent.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
                        onClick={() => handleSelectAgentMention(agent)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{agent.name}</div>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${getHealthStatus(agent.online_status)}`} />
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
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
      
      {/* 管理参与者弹窗 */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加参与者</DialogTitle>
            <DialogDescription>
              选择要添加到会话的智能体
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {loadingAgents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableAgentsToAdd.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-8 w-8 mx-auto mb-2" />
                <p>暂无可添加的智能体</p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {availableAgentsToAdd.map(agent => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => {
                        setSelectedAgentIds(prev => 
                          prev.includes(agent.id)
                            ? prev.filter(id => id !== agent.id)
                            : [...prev, agent.id]
                        );
                      }}
                    >
                      <Checkbox
                        checked={selectedAgentIds.includes(agent.id)}
                        onChange={() => {}}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.role}</div>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${getHealthStatus(agent.online_status)}`} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowManageDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={handleAddParticipants}
              disabled={managingParticipants || selectedAgentIds.filter(id => !participants.map(p => p.id).includes(id)).length === 0}
            >
              {managingParticipants ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  添加中...
                </>
              ) : (
                '添加'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
