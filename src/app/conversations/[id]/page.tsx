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
  AtSign,
  Square,
  ArrowDown
} from 'lucide-react';
import type { Conversation, Message } from '@/types/conversation';
import type { Agent } from '@/types/agent';
import { MessageContent } from '@/components/chat/MessageContent';

// 自定义样式
const messageStyles = `
  .agent-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .agent-name {
    font-size: 11px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .agent-meta {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .badge {
    font-size: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    font-weight: 500;
  }

  .timestamp {
    font-size: 9px;
    color: #999999;
    margin-left: auto;
  }

  .message-content-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    max-width: 70%;
  }

  .message-bubble {
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.6;
    position: relative;
    max-width: 100%;
  }

  .message-bubble.agent {
    background: #ffffff;
    border: 1px solid #e8e8e8;
    border-top-left-radius: 4px;
    color: #262626;
  }

  .message-bubble.user {
    background: #1890ff;
    color: #ffffff;
    border-top-right-radius: 4px;
  }
`;

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

  // 智能滚动控制（微信/企微标准实现）
  const isUserScrolledAway = useRef(false); // 用户是否滚离底部
  const lastAutoScrollTime = useRef(0); // 记录上次自动滚动的时间戳
  const isSmoothScrolling = useRef(false); // 是否正在进行平滑滚动

  // 监听滚动事件（当 loading 完成后绑定）
  useEffect(() => {
    if (isLoading) {
      console.log('⏳ 正在加载，等待加载完成...');
      return;
    }

    // 等待下一帧，确保 DOM 已经渲染
    const timer = setTimeout(() => {
      const scrollContainer = scrollRef.current;
      console.log('🔍 useEffect 执行（延迟），scrollContainer =', scrollContainer);

      if (!scrollContainer) {
        console.log('❌ scrollContainer 不存在，无法绑定 scroll 事件');
        return;
      }

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const threshold = 20; // 底部20px内算作底部
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const atBottom = distanceFromBottom <= threshold;

        console.log('📜 滚动事件:', {
          scrollTop,
          scrollHeight,
          clientHeight,
          distanceFromBottom,
          atBottom,
          isUserScrolledAway: isUserScrolledAway.current,
          timeSinceLastAutoScroll: Date.now() - lastAutoScrollTime.current
        });

        // 如果距离上次自动滚动不超过 500ms，认为是程序性滚动，忽略
        if (Date.now() - lastAutoScrollTime.current < 500) {
          console.log('⏭️ 跳过滚动事件（程序性滚动）');
          return;
        }

        // 微信/企微逻辑：不在底部就是 true，在底部就是 false
        isUserScrolledAway.current = !atBottom;
        console.log('✅ 用户手动滚动，设置 isUserScrolledAway =', isUserScrolledAway.current);
      };

      scrollContainer.addEventListener('scroll', handleScroll);
      console.log('🎧 已绑定 scroll 事件处理器');
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        console.log('🔌 已解绑 scroll 事件处理器');
      };
    }, 100); // 延迟 100ms 确保 DOM 已渲染

    return () => clearTimeout(timer);
  }, [isLoading]);

  // 智能自动滚动：只有当用户在底部时才自动滚动
  useEffect(() => {
    console.log('🔍 检查自动滚动:', {
      isUserScrolledAway: isUserScrolledAway.current,
      isSmoothScrolling: isSmoothScrolling.current,
      willScroll: !isUserScrolledAway.current && !isSmoothScrolling.current,
      messagesLength: messages.length,
      hasStreaming: !!streamingMessage
    });

    // 如果正在进行平滑滚动（用户点击"有新消息"），不执行自动滚动
    if (isSmoothScrolling.current) {
      console.log('⏸️ 正在平滑滚动中，跳过自动滚动');
      return;
    }

    // 只有当用户在底部时，才自动滚动
    if (!isUserScrolledAway.current) {
      console.log('⬇️ 执行自动滚动到底部');

      // 记录自动滚动时间戳
      lastAutoScrollTime.current = Date.now();

      // 使用 behavior: 'auto' 避免平滑滚动触发多次 scroll 事件
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      console.log('⏸️ 不执行自动滚动，用户已滚离底部');
    }
  }, [messages, streamingMessage]);
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
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  // 停止生成
  const handleStopGeneration = () => {
    // 取消请求（使用 try-catch 避免重复关闭错误）
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        // 忽略重复关闭的错误
        console.log('Controller already closed:', e);
      }
      abortControllerRef.current = null;
    }

    // 如果有流式输出的临时内容，保存到消息列表中
    if (streamingMessage) {
      if (currentStreamMessageId) {
        // 多智能体模式：内容已经在 messages 中了，只需要更新状态
        setStreamingMessage('');
      } else if (respondingAgent) {
        // 单智能体模式：创建消息对象保存内容
        const aiMsg: Message = {
          id: `ai-${Date.now()}-${Math.random()}`,
          conversation_id: conversationId,
          agent_id: respondingAgent.id,
          role: 'assistant',
          content: streamingMessage,
          created_at: new Date().toISOString(),
          message_type: 'text',
          metadata: {
            agent_name: respondingAgent.name,
            role: respondingAgent.role,
            project_id: respondingAgent.project_id
          }
        };
        setMessages(prev => [...prev, aiMsg]);
        setStreamingMessage('');
      }
    }

    // 清除状态，但保留已回复的消息
    setAiResponding(false);
    setCurrentStreamMessageId(null);
    setCurrentStreamMessageType(null);
    setRespondingAgent(null);
  };

  // 滚动到底部
  const scrollToBottom = () => {
    console.log('→ 用户点击"有新消息"，滚动到底部');

    // 设置锁定标志，禁用 useEffect 的自动滚动
    isSmoothScrolling.current = true;
    isUserScrolledAway.current = false; // 回到底部，恢复自动滚动

    // 执行平滑滚动
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // 在滚动动画完成后更新时间戳并解锁
    requestAnimationFrame(() => {
      // 再等待一帧，确保滚动动画已经开始
      setTimeout(() => {
        lastAutoScrollTime.current = Date.now();
        isSmoothScrolling.current = false; // 解锁，允许 useEffect 的自动滚动
        console.log('✅ 平滑滚动完成，更新 lastAutoScrollTime 并解锁');
      }, 300); // 平滑滚动通常需要 300-500ms，这里取 300ms
    });
  };

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
        // 从数据库加载的消息，提取 parallel_mode 到顶层
        const messagesWithParallelMode = (msgResult.data || []).map((msg: Message) => ({
          ...msg,
          parallel_mode: msg.metadata?.parallel_mode === true
        }));
        setMessages(messagesWithParallelMode);

        // 消息加载完成后，自动滚动到最下面
        setTimeout(() => {
          if (scrollRef.current) {
            console.log('✓ 消息加载完成，自动滚动到最下面');
            isUserScrolledAway.current = false; // 回到底部

            // 记录自动滚动时间戳
            lastAutoScrollTime.current = Date.now();
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }
        }, 100);
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

      // 创建 AbortController 用于中断请求
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_message: userMessage
        }),
        signal: abortControllerRef.current.signal
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
                  const isParallelMode = parsed.parallel_mode === true;
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
                      role: parsed.role,
                      parallel_mode: isParallelMode
                    },
                    streaming: true,
                    done: false,
                    // 直接在消息对象中记录并行模式，避免依赖 metadata 读取不稳定
                    parallel_mode: isParallelMode
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
                        const updatedMsg = {
                          ...msg,
                          streaming: false,
                          done: true
                        };
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

      // 如果是用户主动停止（AbortError），不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('用户停止了生成');
        // 不显示错误，保留已输出的内容
      } else {
        // 其他错误才显示提示
        alert(error instanceof Error ? error.message : '发送失败');
        // 移除失败的用户消息
        setMessages(prev => prev.filter(m => m.id !== `temp-${Date.now() - 1000}`));
      }
    } finally {
      setSending(false);
      setAiResponding(false);
      setStreamingMessage('');
      setCurrentStreamMessageId(null);
      setCurrentStreamMessageType(null);
      setRespondingAgent(null);
      abortControllerRef.current = null;
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
                      <Avatar className="h-10 w-10 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-blue-50">
                          <Bot className="h-5 w-5 text-blue-500" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`message-content-wrapper ${isUser ? 'items-end' : 'items-start'}`}>
                      {/* 智能体消息：信息行独立显示 */}
                      {!isUser && (
                        <div className="agent-header">
                          <span className="agent-name">{displayName}</span>
                          <div className="agent-meta">
                            {isCoordinator && (
                              <Badge variant="outline" className="badge">
                                协调者
                              </Badge>
                            )}
                            {!isCoordinator && agentInfo && (
                              <>
                                <Badge variant="outline" className="badge">
                                  {getRoleLabel(agentInfo.role)}
                                </Badge>
                                {agentInfo.project_id ? (
                                  <Badge variant="secondary" className="badge">
                                    {projects.find(p => p.id === agentInfo.project_id)?.name || '未知项目'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="badge">
                                    全局
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                          <span className="timestamp">
                            {msg.created_at && new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}

                      {/* 消息气泡：只包含对话内容 */}
                      <div className={`message-bubble ${isUser ? 'user' : 'agent'}`}>
                        <MessageContent
                          content={msg.content}
                          isStreaming={msg.streaming || false}
                          parallelMode={msg.parallel_mode === true}
                        />
                        {/* 流式状态指示器 */}
                        {msg.streaming && !isUser && (
                          <div className="flex items-center gap-2 text-xs mt-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            <span className="text-gray-500">正在思考...</span>
                          </div>
                        )}
                      </div>

                      {/* 用户消息：时间戳在左侧 */}
                      {isUser && (
                        <span className="timestamp">
                          {msg.created_at && new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {isUser && (
                      <Avatar className="h-10 w-10 mt-1 flex-shrink-0">
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}

              {/* 渲染流式输出的临时消息（单智能体模式） */}
              {streamingMessage && !currentStreamMessageId && respondingAgent && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-10 w-10 mt-1 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 max-w-[70%]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {respondingAgent.name}
                      </span>
                      {respondingAgent.role && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 rounded text-primary">
                          {getRoleLabel(respondingAgent.role)}
                        </span>
                      )}
                      {respondingAgent.project_id ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-secondary/60 rounded">
                          {projects.find(p => p.id === respondingAgent.project_id)?.name || '未知项目'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-secondary/60 rounded">
                          全局
                        </span>
                      )}
                    </div>
                    <div className="message-bubble agent">
                      <MessageContent
                        content={streamingMessage}
                        isStreaming={true}
                        parallelMode={false}
                      />
                      <div className="flex items-center gap-2 text-xs mt-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-gray-500">正在思考...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* 有新消息提示按钮 */}
          {isUserScrolledAway.current && aiResponding && (
            <Button
              onClick={scrollToBottom}
              className="fixed bottom-32 right-8 rounded-full shadow-lg"
              size="sm"
            >
              <ArrowDown className="h-4 w-4 mr-1" />
              有新消息
            </Button>
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
            {aiResponding ? (
              <Button onClick={handleStopGeneration} variant="destructive">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSendMessage} disabled={sending || aiResponding || !inputMessage.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
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

      {/* 自定义样式 */}
      <style jsx>{messageStyles}</style>
    </div>
  );
}
