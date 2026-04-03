'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  GitBranch, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock,
  ArrowRight,
  Play,
  RefreshCw,
  Square
} from 'lucide-react';
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
import type { PipelineRun } from '@/types/pipeline';

// 运行状态配置
const RUN_STATUS_CONFIG = {
  pending: { label: '等待执行', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  running: { label: '执行中', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  success: { label: '执行成功', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: '执行失败', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700', icon: XCircle }
};

export default function PipelineRunsPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns();
    
    // 如果有运行中的任务，自动刷新
    const interval = setInterval(() => {
      if (runs.some(r => r.status === 'running')) {
        fetchRuns();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [runs]);

  const fetchRuns = async () => {
    try {
      // 直接获取所有运行记录
      const response = await fetch('/api/pipelines?type=runs');
      const result = await response.json();
      
      if (result.success) {
        setRuns(result.data || []);
      }
    } catch (error) {
      console.error('获取运行记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = RUN_STATUS_CONFIG[status as keyof typeof RUN_STATUS_CONFIG] || RUN_STATUS_CONFIG.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${status === 'running' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  const formatTime = (time?: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
  };

  const getDuration = (run: PipelineRun) => {
    if (!run.started_at) return '-';
    
    const start = new Date(run.started_at);
    const end = run.completed_at ? new Date(run.completed_at) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}小时${Math.floor((duration % 3600) / 60)}分`;
  };

  const handleCancel = async (runId: string) => {
    if (!confirm('确定要取消这个流水线运行吗？')) return;
    
    try {
      setCancelling(runId);
      const response = await fetch(`/api/pipeline-runs/${runId}/cancel`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchRuns();
        alert('已取消');
      } else {
        alert('取消失败: ' + result.error);
      }
    } catch (error) {
      console.error('取消失败:', error);
      alert('取消失败');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Link href="/pipelines/manage" className="hover:text-foreground">
          编排
        </Link>
        <ArrowRight className="h-4 w-4" />
        <span className="text-foreground">监控</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">运行监控</h1>
          <p className="text-muted-foreground">
            查看所有项目的流水线执行情况
          </p>
        </div>
        <Button variant="outline" onClick={fetchRuns}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>运行记录</CardTitle>
          <CardDescription>
            最近执行的流水线记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无运行记录</p>
              <p className="text-sm text-muted-foreground">
                请从项目页面执行流水线
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>流水线名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>节点进度</TableHead>
                  <TableHead>执行时长</TableHead>
                  <TableHead>开始时间</TableHead>
                  <TableHead>结束时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="font-medium">{(run as any).pipeline_name || '未知流水线'}</div>
                      {run.ticket_id && (
                        <div className="text-xs text-muted-foreground">
                          工单: {run.ticket_type || 'task'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell>
                      <span className="text-green-600">{run.completed_nodes}</span>
                      {run.failed_nodes > 0 && (
                        <span className="text-red-600"> / {run.failed_nodes}失败</span>
                      )}
                      <span className="text-muted-foreground"> / {run.total_nodes}总计</span>
                    </TableCell>
                    <TableCell>{getDuration(run)}</TableCell>
                    <TableCell>{formatTime(run.started_at)}</TableCell>
                    <TableCell>{formatTime(run.completed_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {run.status === 'running' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(run.id)}
                            disabled={cancelling === run.id}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/pipelines/run/${run.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
