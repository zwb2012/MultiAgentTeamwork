'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Bot,
  MessageSquare,
  FileText,
  User,
  Zap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

// 运行状态配置
const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: '等待执行', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  running: { label: '执行中', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Loader2 },
  success: { label: '执行成功', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  failed: { label: '执行失败', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircle }
};

// 节点状态配置
const NODE_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待执行', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  waiting: { label: '等待中', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  running: { label: '执行中', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  success: { label: '已完成', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: '失败', color: 'text-red-600', bgColor: 'bg-red-100' },
  skipped: { label: '已跳过', color: 'text-gray-600', bgColor: 'bg-gray-100' }
};

// 节点类型配置
const NODE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Bot }> = {
  start: { label: '开始', icon: Play },
  end: { label: '结束', icon: CheckCircle },
  agent: { label: '智能体', icon: Bot },
  task: { label: '任务', icon: FileText },
  gateway: { label: '网关', icon: GitBranch },
  condition: { label: '条件', icon: AlertCircle },
  delay: { label: '延迟', icon: Clock }
};

interface NodeRun {
  id: string;
  node_id: string;
  node_name: string;
  node_type: string;
  agent_id?: string;
  order_index: number;
  status: string;
  wait_status?: {
    required_nodes: string[];
    completed_nodes: string[];
    merge_strategy: string;
  };
  input_data?: any;
  output_data?: any;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

interface Agent {
  id: string;
  name: string;
  role?: string;
  online_status: string;
  work_status: string;
}

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  title: string;
  status: string;
  priority: string;
  assigned_at: string;
  completed_at?: string;
}

interface Message {
  id: string;
  content: string;
  role: string;
  message_type: string;
  created_at: string;
  agents?: {
    id: string;
    name: string;
    role?: string;
  };
}

interface RunData {
  run: {
    id: string;
    pipeline_id: string;
    pipeline_name: string;
    conversation_id?: string;
    status: string;
    trigger_by: string;
    total_nodes: number;
    completed_nodes: number;
    failed_nodes: number;
    input_data?: any;
    output_data?: any;
    started_at?: string;
    completed_at?: string;
    created_at: string;
  };
  node_runs: NodeRun[];
  agents: Agent[];
  agent_tasks: AgentTask[];
  messages: Message[];
  summary: {
    total_nodes: number;
    completed_nodes: number;
    failed_nodes: number;
    pending_nodes: number;
    running_nodes: number;
    waiting_nodes: number;
  };
}

export default function PipelineRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  
  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [runId]);

  // 自动刷新（运行中时）
  useEffect(() => {
    if (data?.run.status === 'running') {
      const interval = setInterval(() => {
        fetchData(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [data?.run.status]);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`/api/pipeline-runs/${runId}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        alert('运行记录不存在');
        router.push('/pipelines/run');
      }
    } catch (error) {
      console.error('获取运行详情失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 获取智能体信息
  const getAgent = (agentId?: string) => {
    if (!agentId) return null;
    return data?.agents.find(a => a.id === agentId);
  };

  // 获取智能体任务
  const getAgentTasks = (agentId: string) => {
    return data?.agent_tasks.filter(t => t.agent_id === agentId) || [];
  };

  // 格式化时间
  const formatTime = (time?: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
  };

  // 计算执行时长
  const getDuration = () => {
    if (!data?.run.started_at) return '-';
    
    const start = new Date(data.run.started_at);
    const end = data.run.completed_at ? new Date(data.run.completed_at) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}小时${Math.floor((duration % 3600) / 60)}分`;
  };

  // 计算进度
  const getProgress = () => {
    if (!data) return 0;
    const { total_nodes, completed_nodes, failed_nodes } = data.summary;
    if (total_nodes === 0) return 0;
    return Math.round(((completed_nodes + failed_nodes) / total_nodes) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>运行记录不存在</p>
        <Link href="/pipelines/run">
          <Button className="mt-4">返回运行记录</Button>
        </Link>
      </div>
    );
  }

  const statusConfig = RUN_STATUS_CONFIG[data.run.status] || RUN_STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* 面包屑导航 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-12 items-center px-4 gap-2 text-sm text-muted-foreground">
          <Link href="/pipelines/manage" className="hover:text-foreground">
            编排
          </Link>
          <ArrowRight className="h-3 w-3" />
          <Link href="/pipelines/run" className="hover:text-foreground">
            监控
          </Link>
          <ArrowRight className="h-3 w-3" />
          <span className="text-foreground">运行详情</span>
        </div>
      </div>

      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/pipelines/run">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <GitBranch className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">{data.run.pipeline_name}</h1>
                <p className="text-sm text-muted-foreground">
                  运行ID: {runId.substring(0, 8)}...
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              刷新
            </Button>
            {data.run.conversation_id && (
              <Link href={`/conversations/${data.run.conversation_id}`}>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  查看对话
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* 状态概览 */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">运行状态</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusIcon className={`h-5 w-5 ${statusConfig.color} ${data.run.status === 'running' ? 'animate-spin' : ''}`} />
                    <span className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">执行进度</p>
                <div className="mt-2">
                  <Progress value={getProgress()} className="h-2" />
                  <p className="text-sm mt-1">
                    {data.summary.completed_nodes + data.summary.failed_nodes} / {data.summary.total_nodes} 节点
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">执行时长</p>
                <p className="text-xl font-bold mt-1">{getDuration()}</p>
                {data.run.started_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    开始: {formatTime(data.run.started_at)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">触发方式</p>
                <p className="text-xl font-bold mt-1">
                  {data.run.trigger_by === 'manual' ? '手动触发' : 
                   data.run.trigger_by === 'scheduled' ? '定时触发' : 'Webhook触发'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 节点状态统计 */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Clock className="h-3 w-3 mr-1" />
            等待: {data.summary.waiting_nodes}
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Loader2 className="h-3 w-3 mr-1" />
            执行中: {data.summary.running_nodes}
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3 text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            成功: {data.summary.completed_nodes}
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3 text-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            失败: {data.summary.failed_nodes}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：节点执行列表 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                节点执行状态
              </CardTitle>
              <CardDescription>
                流水线各节点的执行状态和结果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {data.node_runs.map((nodeRun, index) => {
                    const nodeStatus = NODE_STATUS_CONFIG[nodeRun.status] || NODE_STATUS_CONFIG.pending;
                    const nodeType = NODE_TYPE_CONFIG[nodeRun.node_type] || NODE_TYPE_CONFIG.task;
                    const NodeTypeIcon = nodeType.icon;
                    const agent = getAgent(nodeRun.agent_id);
                    
                    return (
                      <Card key={nodeRun.id} className="overflow-hidden">
                        <div className="flex items-stretch">
                          {/* 状态条 */}
                          <div className={`w-1 ${nodeStatus.bgColor}`} />
                          
                          <CardContent className="flex-1 py-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${nodeStatus.bgColor}`}>
                                  <NodeTypeIcon className={`h-4 w-4 ${nodeStatus.color}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{nodeRun.node_name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {nodeType.label}
                                    </Badge>
                                  </div>
                                  
                                  {agent && (
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                      <Bot className="h-3 w-3" />
                                      <span>{agent.name}</span>
                                      {agent.work_status === 'working' && (
                                        <Badge variant="outline" className="text-xs text-blue-600">
                                          工作中
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* 等待状态详情 */}
                                  {nodeRun.status === 'waiting' && nodeRun.wait_status && (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      <p>等待 {nodeRun.wait_status.completed_nodes?.length || 0} / {nodeRun.wait_status.required_nodes?.length || 0} 个上游节点完成</p>
                                    </div>
                                  )}
                                  
                                  {/* 错误信息 */}
                                  {nodeRun.error_message && (
                                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-600">
                                      {nodeRun.error_message}
                                    </div>
                                  )}
                                  
                                  {/* 执行时间 */}
                                  {nodeRun.started_at && (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      <p>开始: {formatTime(nodeRun.started_at)}</p>
                                      {nodeRun.completed_at && (
                                        <p>完成: {formatTime(nodeRun.completed_at)}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <Badge className={nodeStatus.bgColor}>
                                {nodeStatus.label}
                              </Badge>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 右侧：详细信息 */}
          <div className="space-y-6">
            {/* 智能体状态 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  参与智能体
                </CardTitle>
                <CardDescription>
                  流水线中各智能体的工作状态和任务
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂无参与智能体
                  </p>
                ) : (
                  <div className="space-y-4">
                    {data.agents.map(agent => {
                      const tasks = getAgentTasks(agent.id);
                      
                      return (
                        <div key={agent.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bot className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium">{agent.name}</p>
                                {agent.role && (
                                  <p className="text-xs text-muted-foreground">{agent.role}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline" className={
                                agent.online_status === 'online' ? 'text-green-600' : 'text-gray-500'
                              }>
                                {agent.online_status === 'online' ? '在线' : '离线'}
                              </Badge>
                              {agent.work_status === 'working' && (
                                <Badge variant="outline" className="text-blue-600">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  工作中
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* 智能体任务 */}
                          {tasks.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground mb-2">任务状态</p>
                              <div className="space-y-2">
                                {tasks.map(task => (
                                  <div key={task.id} className="flex items-center justify-between text-sm">
                                    <span className="truncate">{task.title}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {task.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 会话消息 */}
            {data.run.conversation_id && data.messages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    执行对话
                  </CardTitle>
                  <CardDescription>
                    智能体协作过程中的对话记录
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {data.messages.map(message => (
                        <div key={message.id} className="flex gap-3">
                          <div className="flex-shrink-0">
                            {message.agents ? (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {message.agents?.name || '系统'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.created_at).toLocaleTimeString('zh-CN')}
                              </span>
                            </div>
                            <div className="mt-1 text-sm whitespace-pre-wrap">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="mt-4 pt-4 border-t">
                    <Link href={`/conversations/${data.run.conversation_id}`}>
                      <Button variant="outline" className="w-full">
                        查看完整对话
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 输入输出 */}
            {(data.run.input_data || data.run.output_data) && (
              <Card>
                <CardHeader>
                  <CardTitle>执行数据</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="input">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="input">输入数据</TabsTrigger>
                      <TabsTrigger value="output">输出结果</TabsTrigger>
                    </TabsList>
                    <TabsContent value="input" className="mt-4">
                      {data.run.input_data ? (
                        <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-[200px]">
                          {JSON.stringify(data.run.input_data, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">无输入数据</p>
                      )}
                    </TabsContent>
                    <TabsContent value="output" className="mt-4">
                      {data.run.output_data ? (
                        <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-[200px]">
                          {JSON.stringify(data.run.output_data, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">暂无输出结果</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
