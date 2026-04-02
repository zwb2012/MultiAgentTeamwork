'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  GitBranch, 
  Plus, 
  Play, 
  Edit, 
  Trash2,
  MoreVertical,
  CheckCircle,
  Loader2,
  Archive,
  RotateCcw,
  Send,
  Folder,
  ChevronRight
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Pipeline, PipelineDefinitionStatus, PipelineRunStatus } from '@/types/pipeline';
import { PIPELINE_STATUS_CONFIG, PIPELINE_RUN_STATUS_CONFIG } from '@/types/pipeline';

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface PipelineWithProject extends Pipeline {
  project?: Project;
}

export default function PipelineManagePage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
    fetchPipelines();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const fetchPipelines = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/pipelines?type=pipelines');
      const result = await response.json();
      
      if (result.success) {
        // 按项目分组流水线
        setPipelines(result.data || []);
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

  const canPublish = (pipeline: Pipeline) => {
    return pipeline.status === 'draft' || pipeline.status === 'archived';
  };

  const canUnpublish = (pipeline: Pipeline) => {
    return pipeline.status === 'published' && pipeline.run_status !== 'running';
  };

  const canArchive = (pipeline: Pipeline) => {
    return pipeline.run_status !== 'running';
  };

  // 按项目筛选流水线
  const filteredPipelines = selectedProject === 'all' 
    ? pipelines 
    : pipelines.filter(p => p.project_id === selectedProject);

  // 按项目分组
  const groupedPipelines = projects.reduce((acc, project) => {
    const projectPipelines = filteredPipelines.filter(p => p.project_id === project.id);
    if (projectPipelines.length > 0) {
      acc[project.id] = {
        project,
        pipelines: projectPipelines
      };
    }
    return acc;
  }, {} as Record<string, { project: Project; pipelines: PipelineWithProject[] }>);

  // 未分配项目的流水线
  const unassignedPipelines = filteredPipelines.filter(p => !p.project_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">流水线编排</h1>
          <p className="text-muted-foreground">设计和编排多智能体协作流水线</p>
        </div>
      </div>

      {/* 筛选和操作栏 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">项目筛选：</span>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部项目</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4" />
                共 {filteredPipelines.length} 个流水线
              </div>
            </div>
            
            {selectedProject !== 'all' && (
              <Link href={`/projects/${selectedProject}/pipelines/editor/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  创建流水线
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 状态说明 */}
      <Card>
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
      ) : filteredPipelines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {selectedProject === 'all' ? '暂无流水线' : '该项目暂无流水线'}
            </p>
            {selectedProject !== 'all' ? (
              <Link href={`/projects/${selectedProject}/pipelines/editor/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建第一个流水线
                </Button>
              </Link>
            ) : projects.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                请选择一个项目来创建流水线
              </p>
            ) : (
              <Link href="/projects">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  先创建项目
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 按项目分组展示 */}
          {Object.values(groupedPipelines).map(({ project, pipelines: projectPipelines }) => (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {projectPipelines.length} 个流水线
                    </Badge>
                  </div>
                  <Link 
                    href={`/projects/${project.id}/pipelines`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    项目流水线
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projectPipelines.map(pipeline => (
                    <Card key={pipeline.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="space-y-1">
                            <h3 className="font-medium">{pipeline.name}</h3>
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
                                <Link href={`/projects/${project.id}/pipelines/editor/${pipeline.id}`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  编辑
                                </Link>
                              </DropdownMenuItem>
                              
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
                        
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {pipeline.description || '暂无描述'}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {pipeline.nodes?.length || 0} 个节点
                          </div>
                          {pipeline.last_run_at && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {new Date(pipeline.last_run_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 mt-3">
                          <Link href={`/projects/${project.id}/pipelines/editor/${pipeline.id}`} className="flex-1">
                            <Button size="sm" variant="outline" className="w-full">
                              <Edit className="h-4 w-4 mr-1" />
                              编辑
                            </Button>
                          </Link>
                          {pipeline.status === 'draft' && (
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleStatusChange(pipeline.id, 'publish')}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              发布
                            </Button>
                          )}
                          {pipeline.status === 'published' && pipeline.run_status !== 'running' && (
                            <Link href={`/projects/${project.id}/tickets`} className="flex-1">
                              <Button size="sm" className="w-full">
                                <Play className="h-4 w-4 mr-1" />
                                执行
                              </Button>
                            </Link>
                          )}
                          {pipeline.run_status === 'running' && (
                            <Button size="sm" variant="outline" className="flex-1" disabled>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              执行中
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* 未分配项目的流水线 */}
          {unassignedPipelines.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">未分配项目</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {unassignedPipelines.length} 个流水线
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {unassignedPipelines.map(pipeline => (
                    <Card key={pipeline.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="space-y-1">
                            <h3 className="font-medium">{pipeline.name}</h3>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(pipeline.status)}
                              {pipeline.run_status !== 'idle' && getRunStatusBadge(pipeline.run_status)}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {pipeline.description || '暂无描述'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
