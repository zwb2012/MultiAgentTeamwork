'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GitBranch,
  Play,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Pipeline, PipelineRun, TicketInput } from '@/types/pipeline';

export default function PipelineRunPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pipelineId = searchParams.get('id');
  
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentRun, setCurrentRun] = useState<PipelineRun | null>(null);
  
  const [ticketForm, setTicketForm] = useState<Partial<TicketInput>>({
    type: 'task',
    priority: 'medium',
    title: '',
    description: ''
  });

  useEffect(() => {
    if (pipelineId) {
      fetchPipeline();
    } else {
      router.push('/pipelines');
    }
  }, [pipelineId]);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pipelines/${pipelineId}`);
      const result = await response.json();
      
      if (result.success) {
        setPipeline(result.data);
        
        // 如果正在运行，获取运行状态
        if (result.data.run_status === 'running') {
          fetchCurrentRun();
        }
      } else {
        alert('流水线不存在');
        router.push('/pipelines');
      }
    } catch (error) {
      console.error('获取流水线失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentRun = async () => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/run`);
      const result = await response.json();
      
      if (result.success && result.data?.length > 0) {
        setCurrentRun(result.data[0]);
      }
    } catch (error) {
      console.error('获取运行状态失败:', error);
    }
  };

  const handleExecute = async () => {
    if (!pipeline) return;
    
    if (!ticketForm.title) {
      alert('请输入工单标题');
      return;
    }
    
    try {
      setIsExecuting(true);
      
      const response = await fetch(`/api/pipelines/${pipeline.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: {
            id: `ticket-${Date.now()}`,
            type: ticketForm.type || 'task',
            title: ticketForm.title,
            description: ticketForm.description || '',
            priority: ticketForm.priority || 'medium',
            labels: []
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCurrentRun(result.data);
        // 刷新流水线状态
        fetchPipeline();
      } else {
        alert(result.error || '执行失败');
      }
    } catch (error) {
      console.error('执行失败:', error);
      alert('执行失败');
    } finally {
      setIsExecuting(false);
    }
  };

  const getTicketTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bug: 'Bug 修复',
      feature: '新需求',
      improvement: '改进优化',
      task: '通用任务'
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return colors[priority] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>流水线不存在</span>
        </div>
      </div>
    );
  }

  const isRunning = pipeline.run_status === 'running';
  const canExecute = pipeline.status === 'published' && !isRunning;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/pipelines">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{pipeline.name}</h1>
              <p className="text-sm text-muted-foreground">执行流水线</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={pipeline.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
              {pipeline.status === 'published' ? '已发布' : '草稿'}
            </Badge>
            {isRunning && (
              <Badge variant="outline" className="bg-blue-100 text-blue-700">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                运行中
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-4xl">
        {/* 流水线信息 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">流水线信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">节点数量:</span>
                <span className="ml-2 font-medium">{pipeline.nodes?.length || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">触发类型:</span>
                <span className="ml-2 font-medium">
                  {pipeline.trigger_type === 'manual' ? '手动触发' : pipeline.trigger_type}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">最后运行:</span>
                <span className="ml-2 font-medium">
                  {pipeline.last_run_at 
                    ? new Date(pipeline.last_run_at).toLocaleString()
                    : '从未运行'}
                </span>
              </div>
            </div>
            {pipeline.description && (
              <p className="mt-4 text-sm text-muted-foreground">
                {pipeline.description}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 当前运行状态 */}
        {isRunning && currentRun && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <CardTitle className="text-lg text-blue-700">正在执行</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-600">运行ID: {currentRun.id}</span>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700">
                    {currentRun.completed_nodes}/{currentRun.total_nodes} 节点
                  </Badge>
                </div>
                
                {currentRun.input_data?.ticket_title && (
                  <div className="p-3 bg-white rounded-lg border border-blue-100">
                    <div className="text-sm font-medium mb-1">工单信息</div>
                    <div className="text-sm text-muted-foreground">
                      {currentRun.input_data.ticket_title}
                    </div>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={fetchCurrentRun}
                  className="w-full"
                >
                  刷新状态
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 工单输入表单 */}
        {canExecute && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">创建执行任务</CardTitle>
              <CardDescription>
                输入工单信息，流水线将按顺序执行各个节点
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket-type">工单类型</Label>
                  <Select 
                    value={ticketForm.type} 
                    onValueChange={(value) => setTicketForm({ ...ticketForm, type: value as TicketInput['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug 修复</SelectItem>
                      <SelectItem value="feature">新需求</SelectItem>
                      <SelectItem value="improvement">改进优化</SelectItem>
                      <SelectItem value="task">通用任务</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ticket-priority">优先级</Label>
                  <Select 
                    value={ticketForm.priority} 
                    onValueChange={(value) => setTicketForm({ ...ticketForm, priority: value as TicketInput['priority'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择优先级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="critical">紧急</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ticket-title">工单标题 *</Label>
                <Input
                  id="ticket-title"
                  value={ticketForm.title || ''}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  placeholder="例如：修复登录页面样式问题"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ticket-description">详细描述</Label>
                <Textarea
                  id="ticket-description"
                  value={ticketForm.description || ''}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder="描述具体需求或问题..."
                  rows={5}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" asChild>
                  <Link href="/pipelines">取消</Link>
                </Button>
                <Button onClick={handleExecute} disabled={isExecuting}>
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      执行中...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      开始执行
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 不可执行提示 */}
        {!canExecute && !isRunning && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="py-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-700">
                    此流水线尚未发布
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">
                    请先在编辑器中保存并发布流水线，然后才能执行
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-3"
                    asChild
                  >
                    <Link href={`/pipelines/editor?id=${pipelineId}`}>
                      前往编辑
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 执行历史 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">执行历史</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              执行历史记录将在此显示
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
