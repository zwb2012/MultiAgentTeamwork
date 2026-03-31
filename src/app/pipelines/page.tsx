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
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Pipeline, PipelineStatus } from '@/types/pipeline';

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleRun = async (id: string) => {
    try {
      const response = await fetch(`/api/pipelines/${id}/run`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('流水线已开始执行');
        // 可以跳转到执行监控页面
      } else {
        alert('执行失败: ' + result.error);
      }
    } catch (error) {
      console.error('执行失败:', error);
    }
  };

  const getStatusBadge = (status: PipelineStatus) => {
    const styles: Record<PipelineStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      active: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-gray-100 text-gray-500'
    };
    
    const labels: Record<PipelineStatus, string> = {
      draft: '草稿',
      active: '活跃',
      paused: '暂停',
      archived: '归档'
    };
    
    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
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

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">加载中...</div>
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
                    <div>
                      <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                      {getStatusBadge(pipeline.status)}
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
                        <DropdownMenuItem onClick={() => handleRun(pipeline.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          运行
                        </DropdownMenuItem>
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
                      <Clock className="h-3 w-3" />
                      {new Date(pipeline.created_at).toLocaleDateString()}
                    </div>
                    {pipeline.nodes && (
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {pipeline.nodes.length} 个节点
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/pipelines/editor?id=${pipeline.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </Button>
                    </Link>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleRun(pipeline.id)}
                      disabled={pipeline.status !== 'active'}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      运行
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
