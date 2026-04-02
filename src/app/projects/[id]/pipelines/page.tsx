'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft,
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit,
  Play,
  MoreVertical,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Archive,
  RotateCcw,
  Loader2
} from 'lucide-react';
import type { Pipeline, PipelineDefinitionStatus } from '@/types/pipeline';
import { PIPELINE_STATUS_CONFIG, PIPELINE_RUN_STATUS_CONFIG } from '@/types/pipeline';

export default function ProjectPipelinesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [project, setProject] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletePipelineId, setDeletePipelineId] = useState<string | null>(null);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取项目信息
      const projectRes = await fetch(`/api/projects/${projectId}`);
      const projectResult = await projectRes.json();
      if (projectResult.success) {
        setProject(projectResult.data);
      }
      
      // 获取项目流水线
      const pipelinesRes = await fetch(`/api/projects/${projectId}/pipelines`);
      const pipelinesResult = await pipelinesRes.json();
      if (pipelinesResult.success) {
        setPipelines(pipelinesResult.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePipelineId) return;
    
    try {
      const response = await fetch(`/api/pipelines/${deletePipelineId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPipelines(prev => prev.filter(p => p.id !== deletePipelineId));
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除流水线失败:', error);
      alert('删除失败');
    } finally {
      setDeletePipelineId(null);
    }
  };

  const handlePublish = async (pipelineId: string) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/publish`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchData();
      } else {
        alert('发布失败: ' + result.error);
      }
    } catch (error) {
      console.error('发布流水线失败:', error);
      alert('发布失败');
    }
  };

  const handleUnpublish = async (pipelineId: string) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/unpublish`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchData();
      } else {
        alert('撤回失败: ' + result.error);
      }
    } catch (error) {
      console.error('撤回流水线失败:', error);
      alert('撤回失败');
    }
  };

  const handleArchive = async (pipelineId: string) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/archive`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchData();
      } else {
        alert('归档失败: ' + result.error);
      }
    } catch (error) {
      console.error('归档流水线失败:', error);
      alert('归档失败');
    }
  };

  const handleRestore = async (pipelineId: string) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/restore`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchData();
      } else {
        alert('恢复失败: ' + result.error);
      }
    } catch (error) {
      console.error('恢复流水线失败:', error);
      alert('恢复失败');
    }
  };

  const handleExecute = async () => {
    if (!selectedPipeline) return;
    
    try {
      const response = await fetch(`/api/pipelines/${selectedPipeline.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      if (result.success) {
        setExecuteDialogOpen(false);
        // 跳转到执行详情页
        if (result.data?.id) {
          router.push(`/pipelines/run/${result.data.id}`);
        }
      } else {
        alert('执行失败: ' + result.error);
      }
    } catch (error) {
      console.error('执行流水线失败:', error);
      alert('执行失败');
    }
  };

  const openExecuteDialog = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setExecuteDialogOpen(true);
  };

  const getStatusBadge = (status: PipelineDefinitionStatus) => {
    const config = PIPELINE_STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getRunStatusBadge = (runStatus: string) => {
    const config = PIPELINE_RUN_STATUS_CONFIG[runStatus as keyof typeof PIPELINE_RUN_STATUS_CONFIG];
    if (!config) return null;
    
    // 映射图标名称到组件
    const iconMap: Record<string, React.ReactNode> = {
      'Circle': <Clock className="h-3 w-3 mr-1" />,
      'Loader2': <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      'CheckCircle2': <CheckCircle className="h-3 w-3 mr-1" />,
      'XCircle': <XCircle className="h-3 w-3 mr-1" />,
      'MinusCircle': <XCircle className="h-3 w-3 mr-1" />
    };
    
    return (
      <Badge variant="outline" className={config.color}>
        {iconMap[config.icon] || null}
        {config.label}
      </Badge>
    );
  };

  const canExecute = (pipeline: Pipeline) => {
    return pipeline.status === 'published' && pipeline.run_status !== 'running';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">流水线管理</h1>
            <p className="text-muted-foreground">
              {project?.name || '项目'} 的流水线
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/projects/${projectId}/pipelines/editor/new`}>
            <Plus className="h-4 w-4 mr-2" />
            创建流水线
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>流水线列表</CardTitle>
          <CardDescription>
            管理项目的自动化工作流程
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pipelines.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无流水线</p>
              <Button asChild>
                <Link href={`/projects/${projectId}/pipelines/editor/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建第一个流水线
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>运行状态</TableHead>
                  <TableHead>节点数</TableHead>
                  <TableHead>最后运行</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelines.map(pipeline => (
                  <TableRow key={pipeline.id}>
                    <TableCell>
                      <div className="font-medium">{pipeline.name}</div>
                      {pipeline.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {pipeline.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(pipeline.status)}</TableCell>
                    <TableCell>{getRunStatusBadge(pipeline.run_status)}</TableCell>
                    <TableCell>{pipeline.nodes?.length || 0}</TableCell>
                    <TableCell>
                      {pipeline.last_run_at 
                        ? new Date(pipeline.last_run_at).toLocaleString('zh-CN')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(pipeline.created_at).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${projectId}/pipelines/editor/${pipeline.id}`}>
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
                          
                          {pipeline.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handlePublish(pipeline.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              发布
                            </DropdownMenuItem>
                          )}
                          
                          {pipeline.status === 'published' && (
                            <DropdownMenuItem onClick={() => handleUnpublish(pipeline.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              撤回编辑
                            </DropdownMenuItem>
                          )}
                          
                          {pipeline.status === 'published' && (
                            <DropdownMenuItem onClick={() => handleArchive(pipeline.id)}>
                              <Archive className="h-4 w-4 mr-2" />
                              归档
                            </DropdownMenuItem>
                          )}
                          
                          {pipeline.status === 'archived' && (
                            <DropdownMenuItem onClick={() => handleRestore(pipeline.id)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              恢复
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => setDeletePipelineId(pipeline.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deletePipelineId} onOpenChange={() => setDeletePipelineId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条流水线吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 执行确认对话框 */}
      <AlertDialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>执行流水线</AlertDialogTitle>
            <AlertDialogDescription>
              确定要执行流水线 "{selectedPipeline?.name}" 吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecute}>
              <Play className="h-4 w-4 mr-2" />
              开始执行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
