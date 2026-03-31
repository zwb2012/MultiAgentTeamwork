'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  GitBranch, 
  Plus, 
  Play, 
  Settings, 
  Trash2,
  Users,
  ArrowRight,
  Layers,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import type { Pipeline, PipelineNode, Agent } from '@/types/agent';

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null);
  
  // 创建/编辑表单
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'manual' as 'manual' | 'scheduled' | 'webhook',
    nodes: [] as any[]
  });
  
  // 节点编辑
  const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    description: '',
    node_type: 'agent' as 'agent' | 'task',
    agent_id: '',
    execution_mode: 'sequential' as 'sequential' | 'parallel',
    parallel_group: ''
  });

  useEffect(() => {
    fetchPipelines();
    fetchAgents();
  }, []);

  const fetchPipelines = async () => {
    setIsLoading(true);
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

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  // 创建流水线
  const handleCreate = async () => {
    if (!formData.name) {
      alert('请输入流水线名称');
      return;
    }

    try {
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        resetForm();
        fetchPipelines();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建流水线失败:', error);
      alert('创建失败');
    }
  };

  // 更新流水线
  const handleUpdate = async () => {
    if (!selectedPipeline) return;
    
    try {
      const response = await fetch(`/api/pipelines/${selectedPipeline.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          nodes: formData.nodes
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsEditDialogOpen(false);
        resetForm();
        fetchPipelines();
      } else {
        alert('更新失败: ' + result.error);
      }
    } catch (error) {
      console.error('更新流水线失败:', error);
      alert('更新失败');
    }
  };

  // 删除流水线
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此流水线吗？')) return;
    
    try {
      const response = await fetch(`/api/pipelines/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchPipelines();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除流水线失败:', error);
      alert('删除失败');
    }
  };

  // 运行流水线
  const handleRun = async (id: string) => {
    try {
      const response = await fetch(`/api/pipelines/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('流水线已开始执行');
        fetchPipelines();
      } else {
        alert('运行失败: ' + result.error);
      }
    } catch (error) {
      console.error('运行流水线失败:', error);
      alert('运行失败');
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_type: 'manual',
      nodes: []
    });
    setEditingNodeIndex(null);
    setNodeForm({
      name: '',
      description: '',
      node_type: 'agent',
      agent_id: '',
      execution_mode: 'sequential',
      parallel_group: ''
    });
  };

  // 添加节点
  const handleAddNode = () => {
    if (!nodeForm.name || !nodeForm.agent_id) {
      alert('请填写节点名称和选择智能体');
      return;
    }
    
    const newNode = {
      ...nodeForm,
      order_index: formData.nodes.length
    };
    
    setFormData({
      ...formData,
      nodes: [...formData.nodes, newNode]
    });
    
    // 重置节点表单
    setNodeForm({
      name: '',
      description: '',
      node_type: 'agent',
      agent_id: '',
      execution_mode: 'sequential',
      parallel_group: ''
    });
    setEditingNodeIndex(null);
  };

  // 删除节点
  const handleRemoveNode = (index: number) => {
    const newNodes = formData.nodes.filter((_, i) => i !== index);
    // 重新排序
    newNodes.forEach((node, i) => {
      node.order_index = i;
    });
    setFormData({ ...formData, nodes: newNodes });
  };

  // 获取状态Badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      draft: { label: '草稿', variant: 'secondary' },
      active: { label: '已激活', variant: 'default' },
      paused: { label: '已暂停', variant: 'outline' },
      archived: { label: '已归档', variant: 'outline' }
    };
    const config = statusMap[status] || statusMap.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // 打开编辑对话框
  const openEditDialog = (pipeline: any) => {
    setSelectedPipeline(pipeline);
    setFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      trigger_type: pipeline.trigger_type || 'manual',
      nodes: pipeline.nodes || []
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            <h1 className="text-xl font-bold">流水线管理</h1>
          </div>
          <Button onClick={() => {
            resetForm();
            setIsCreateDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            创建流水线
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pipelines.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无流水线</p>
              <Button onClick={() => {
                resetForm();
                setIsCreateDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个流水线
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pipelines.map((pipeline: any) => (
              <Card key={pipeline.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {pipeline.description || '暂无描述'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(pipeline.status)}
                      <Badge variant="outline">
                        {pipeline.nodes?.length || 0} 个节点
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 节点预览 */}
                    {pipeline.nodes && pipeline.nodes.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {pipeline.nodes.map((node: any, index: number) => (
                          <div key={node.id} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                              <Users className="h-3 w-3" />
                              <span>{node.name}</span>
                              {node.execution_mode === 'parallel' && (
                                <Badge variant="outline" className="text-xs ml-1">并行</Badge>
                              )}
                            </div>
                            {index < pipeline.nodes.length - 1 && (
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 操作按钮 */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        创建于: {new Date(pipeline.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(pipeline)}>
                          <Settings className="h-3 w-3 mr-1" />
                          编辑
                        </Button>
                        <Button size="sm" onClick={() => handleRun(pipeline.id)}>
                          <Play className="h-3 w-3 mr-1" />
                          运行
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(pipeline.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 创建/编辑流水线对话框 */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? '编辑流水线' : '创建流水线'}
            </DialogTitle>
            <DialogDescription>
              配置流水线基本信息和执行节点
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>流水线名称 *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="输入流水线名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>触发方式</Label>
                  <Select 
                    value={formData.trigger_type} 
                    onValueChange={(value: any) => setFormData({ ...formData, trigger_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">手动触发</SelectItem>
                      <SelectItem value="scheduled">定时触发</SelectItem>
                      <SelectItem value="webhook">Webhook触发</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="描述此流水线的用途"
                  rows={2}
                />
              </div>
            </div>
            
            <Separator />
            
            {/* 节点配置 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">执行节点</h3>
              <p className="text-sm text-muted-foreground">
                添加流水线节点，设置串行或并行执行。同一并行组的节点会同时执行。
              </p>
              
              {/* 已添加的节点列表 */}
              {formData.nodes.length > 0 && (
                <div className="space-y-2">
                  {formData.nodes.map((node, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{index + 1}. {node.name}</span>
                          {node.execution_mode === 'parallel' && (
                            <Badge variant="outline" className="text-xs">并行: {node.parallel_group}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          智能体: {agents.find(a => a.id === node.agent_id)?.name || '未选择'}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveNode(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 添加新节点 */}
              <div className="p-4 border rounded-lg space-y-4">
                <h4 className="text-sm font-medium">添加节点</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>节点名称 *</Label>
                    <Input
                      value={nodeForm.name}
                      onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                      placeholder="如：代码审核"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>选择智能体 *</Label>
                    <Select 
                      value={nodeForm.agent_id} 
                      onValueChange={(value) => setNodeForm({ ...nodeForm, agent_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择智能体" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name} ({agent.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>执行模式</Label>
                    <Select 
                      value={nodeForm.execution_mode} 
                      onValueChange={(value: any) => setNodeForm({ ...nodeForm, execution_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sequential">串行执行</SelectItem>
                        <SelectItem value="parallel">并行执行</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {nodeForm.execution_mode === 'parallel' && (
                    <div className="space-y-2">
                      <Label>并行组名称</Label>
                      <Input
                        value={nodeForm.parallel_group}
                        onChange={(e) => setNodeForm({ ...nodeForm, parallel_group: e.target.value })}
                        placeholder="如：group1"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>节点描述</Label>
                  <Input
                    value={nodeForm.description}
                    onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
                    placeholder="描述此节点的任务"
                  />
                </div>
                
                <Button onClick={handleAddNode} type="button">
                  <Plus className="h-4 w-4 mr-2" />
                  添加节点
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setIsEditDialogOpen(false);
              resetForm();
            }}>
              取消
            </Button>
            <Button onClick={isEditDialogOpen ? handleUpdate : handleCreate}>
              {isEditDialogOpen ? '保存' : '创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
