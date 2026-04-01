'use client';

import { useState, useEffect } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Plus, 
  MoreHorizontal, 
  RefreshCw, 
  Trash2, 
  Edit,
  GitBranch,
  Clock,
  ExternalLink
} from 'lucide-react';
import type { Project, SyncStatus } from '@/types/project';
import { SYNC_STATUS_CONFIG, SYNC_INTERVAL_OPTIONS } from '@/types/project';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      const result = await response.json();
      
      if (result.success) {
        setProjects(result.data);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (projectId: string) => {
    try {
      setSyncingProjectId(projectId);
      
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新本地状态
        setProjects(prev => prev.map(p => 
          p.id === projectId 
            ? { ...p, sync_status: 'syncing' as SyncStatus }
            : p
        ));
        
        // 3秒后刷新列表
        setTimeout(fetchProjects, 3000);
      } else {
        alert('同步失败: ' + result.error);
      }
    } catch (error) {
      console.error('同步项目失败:', error);
      alert('同步失败');
    } finally {
      setSyncingProjectId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteProjectId) return;
    
    try {
      const response = await fetch(`/api/projects/${deleteProjectId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProjects(prev => prev.filter(p => p.id !== deleteProjectId));
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除项目失败:', error);
      alert('删除失败');
    } finally {
      setDeleteProjectId(null);
    }
  };

  const formatInterval = (seconds: number) => {
    const option = SYNC_INTERVAL_OPTIONS.find(o => o.value === seconds);
    return option?.label || `${seconds}秒`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getSyncStatusBadge = (status: SyncStatus) => {
    const config = SYNC_STATUS_CONFIG[status];
    return (
      <Badge className={`${config.bgColor} ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">项目管理</h1>
          <p className="text-muted-foreground mt-1">
            管理 Git 项目仓库，配置自动同步
          </p>
        </div>
        
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            添加项目
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
          <CardDescription>
            已配置 {projects.length} 个项目
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无项目</p>
              <Link href="/projects/new">
                <Button>添加第一个项目</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>Git 地址</TableHead>
                  <TableHead>分支</TableHead>
                  <TableHead>同步状态</TableHead>
                  <TableHead>同步间隔</TableHead>
                  <TableHead>最后同步</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.name}</div>
                        {project.description && (
                          <div className="text-sm text-muted-foreground">
                            {project.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a 
                        href={project.git_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {project.git_url.length > 30 
                          ? project.git_url.substring(0, 30) + '...'
                          : project.git_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {project.git_branch}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getSyncStatusBadge(project.sync_status)}
                      {project.sync_error && (
                        <div className="text-xs text-red-600 mt-1">
                          {project.sync_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {project.sync_enabled 
                          ? formatInterval(project.sync_interval)
                          : '已禁用'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(project.last_sync_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleSync(project.id)}
                            disabled={syncingProjectId === project.id || project.sync_status === 'syncing'}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${
                              syncingProjectId === project.id ? 'animate-spin' : ''
                            }`} />
                            {project.sync_status === 'syncing' ? '同步中...' : '立即同步'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteProjectId(project.id)}
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
      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个项目吗？此操作将同时删除项目下的所有智能体、流水线、会话、工单等关联资源，且不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
