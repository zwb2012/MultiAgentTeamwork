'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  GitBranch, 
  Plus, 
  Play, 
  Edit, 
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  Loader2,
  Archive,
  RotateCcw,
  Send,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { Pipeline, PipelineDefinitionStatus, PipelineRunStatus, TicketInput } from '@/types/pipeline';
import { PIPELINE_STATUS_CONFIG, PIPELINE_RUN_STATUS_CONFIG } from '@/types/pipeline';

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 执行对话框状态
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [ticketForm, setTicketForm] = useState<Partial<TicketInput>>({
    type: 'task',
    priority: 'medium'
  });
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines');
      const result = await response.json();
      
      if (result.success) {
        setPipelines(result.data);
      }
    } catch (error) {
      console.error('获取流水线列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个流水线吗？')) return;
    
    try {
      const response = await fetch(`/api/pipelines/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchPipelines();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleStatusChange = async (id: string, action: 'publish' | 'unpublish' | 'archive' | 'restore') => {
    try {
      const response = await fetch(`/api/pipelines/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchPipelines();
      } else {
        alert(result.error || '操作失败');
      }
    } catch (error) {
      console.error('状态变更失败:', error);
      alert('操作失败');
    }
  };

  const openExecuteDialog = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setTicketForm({
      type: 'task',
      priority: 'medium',
      title: '',
      description: ''
    });
    setExecuteDialogOpen(true);
  };

  const handleExecute = async () => {
    if (!selectedPipeline) return;
    
    if (!ticketForm.title) {
      alert('请输入工单标题');
      return;
    }
    
    try {
      setIsExecuting(true);
      
      const response = await fetch(`/api/pipelines/${selectedPipeline.id}/run`, {
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
        setExecuteDialogOpen(false);
        fetchPipelines();
        // 可以跳转到运行详情页
        alert('流水线已开始执行');
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

  const getStatusBadge = (status: PipelineDefinitionStatus) => {
    const config = PIPELINE_STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getRunStatusBadge = (runStatus: PipelineRunStatus) => {
    const config = PIPELINE_RUN_STATUS_CONFIG[runStatus];
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const canExecute = (pipeline: Pipeline) => {
    return pipeline.status === 'published' && pipeline.run_status !== 'running';
  };

  const canPublish = (pipeline: Pipeline) => {
    return pipeline.status === 'draft' || pipeline.status === 'archived';
  };

  const canUnpublish = (pipeline: Pipeline) => {
    return pipeline.status === 'published' && pipeline.run_status !== 'running';
  };

  const canArchive = (pipeline: Pipeline) => {
    return pipeline.run_status !== 'running';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">流水线管理</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">返回首页</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">流水线列表</h2>
            <p className="text-muted-foreground">管理和执行多智能体协作流水线</p>
          </div>
          
          <Link href="/pipelines/editor">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建流水线
            </Button>
          </Link>
        </div>

        {/* 状态说明 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-gray-100 text-gray-700">草稿</Badge>
                <span className="text-muted-foreground">编辑中，不可执行</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-700">已发布</Badge>
                <span className="text-muted-foreground">可以执行</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-700">运行中</Badge>
                <span className="text-muted-foreground">正在执行</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-gray-100 text-gray-500">已归档</Badge>
                <span className="text-muted-foreground">已停用</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : pipelines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无流水线</p>
              <Link href="/pipelines/editor">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建第一个流水线
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pipelines.map(pipeline => (
              <Card key={pipeline.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(pipeline.status)}
                        {pipeline.run_status !== 'idle' && getRunStatusBadge(pipeline.run_status)}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/pipelines/editor?id=${pipeline.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            编辑
                          </Link>
                        </DropdownMenuItem>
                        
                        {canExecute(pipeline) && (
                          <DropdownMenuItem onClick={() => openExecuteDialog(pipeline)}>
                            <Play className="h-4 w-4 mr-2" />
                            执行
                          </DropdownMenuItem>
                        )}
                        
                        {pipeline.run_status === 'running' && (
                          <DropdownMenuItem disabled>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            执行中...
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        {canPublish(pipeline) && pipeline.status !== 'published' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(pipeline.id, 'publish')}>
                            <Send className="h-4 w-4 mr-2" />
                            发布
                          </DropdownMenuItem>
                        )}
                        
                        {canUnpublish(pipeline) && (
                          <DropdownMenuItem onClick={() => handleStatusChange(pipeline.id, 'unpublish')}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            撤回编辑
                          </DropdownMenuItem>
                        )}
                        
                        {canArchive(pipeline) && pipeline.status !== 'archived' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(pipeline.id, 'archive')}>
                            <Archive className="h-4 w-4 mr-2" />
                            归档
                          </DropdownMenuItem>
                        )}
                        
                        {pipeline.status === 'archived' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(pipeline.id, 'restore')}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            恢复
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(pipeline.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {pipeline.description || '暂无描述'}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {pipeline.nodes?.length || 0} 个节点
                    </div>
                    {pipeline.last_run_at && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        最近运行: {new Date(pipeline.last_run_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  {/* 快速操作按钮 */}
                  <div className="flex gap-2">
                    {canExecute(pipeline) && (
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => openExecuteDialog(pipeline)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        执行
                      </Button>
                    )}
                    {pipeline.run_status === 'running' && (
                      <Button size="sm" variant="outline" className="flex-1" disabled>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        执行中
                      </Button>
                    )}
                    {pipeline.status === 'draft' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleStatusChange(pipeline.id, 'publish')}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        发布
                      </Button>
                    )}
                    <Link href={`/pipelines/editor?id=${pipeline.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 执行对话框 */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>执行流水线</DialogTitle>
            <DialogDescription>
              输入工单信息，流水线将按顺序执行
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
              <Label htmlFor="ticket-title">工单标题 *</Label>
              <Input
                id="ticket-title"
                value={ticketForm.title || ''}
                onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                placeholder="例如：修复登录页面样式问题"
              />
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
            
            <div className="space-y-2">
              <Label htmlFor="ticket-description">详细描述</Label>
              <Textarea
                id="ticket-description"
                value={ticketForm.description || ''}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                placeholder="描述具体需求或问题..."
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteDialogOpen(false)}>
              取消
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
