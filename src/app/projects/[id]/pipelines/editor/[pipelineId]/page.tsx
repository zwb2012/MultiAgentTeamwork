'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, 
  Save, 
  ArrowLeft,
  ArrowRight,
  Bot,
  GitBranch,
  Clock,
  Flag,
  PlayCircle,
  X,
  Trash2,
  Send,
  CheckCircle,
  Loader2
} from 'lucide-react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import type { 
  Pipeline, 
  PipelineNode, 
  NodeType,
  MergeStrategy
} from '@/types/pipeline';

// 自定义节点组件
const CustomNode = ({ data, id, selected }: { data: any; id: string; selected?: boolean }) => {
  const getNodeIcon = () => {
    switch (data.nodeType) {
      case 'start':
        return <PlayCircle className="h-5 w-5 text-green-500" />;
      case 'end':
        return <Flag className="h-5 w-5 text-red-500" />;
      case 'agent':
        return <Bot className="h-5 w-5 text-blue-500" />;
      case 'parallel':
        return <GitBranch className="h-5 w-5 text-purple-500" />;
      case 'condition':
        return <ArrowRight className="h-5 w-5 text-orange-500" />;
      case 'delay':
        return <Clock className="h-5 w-5 text-gray-500" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getNodeColor = () => {
    switch (data.nodeType) {
      case 'start':
        return 'border-green-400 bg-green-50';
      case 'end':
        return 'border-red-400 bg-red-50';
      case 'agent':
        return 'border-blue-400 bg-blue-50';
      case 'parallel':
        return 'border-purple-400 bg-purple-50';
      case 'condition':
        return 'border-orange-400 bg-orange-50';
      case 'delay':
        return 'border-gray-400 bg-gray-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px] ${getNodeColor()} 
        ${selected ? 'ring-2 ring-primary ring-offset-2' : ''} 
        cursor-pointer hover:shadow-md transition-all`}
    >
      {data.nodeType !== 'start' && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}
      
      <div className="flex items-center gap-2">
        {getNodeIcon()}
        <div>
          <div className="font-medium text-sm">{data.label}</div>
          {data.agentName && (
            <div className="text-xs text-muted-foreground">{data.agentName}</div>
          )}
          {data.nodeType === 'parallel' && (
            <div className="text-xs text-purple-600">
              {data.parallelType === 'split' ? '分叉点' : '汇聚点'}
            </div>
          )}
        </div>
      </div>
      
      {data.nodeType !== 'end' && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const NODE_TEMPLATES = [
  {
    type: 'start' as NodeType,
    name: '开始',
    icon: PlayCircle,
    description: '流水线起点',
    color: 'text-green-500'
  },
  {
    type: 'agent' as NodeType,
    name: '智能体',
    icon: Bot,
    description: '执行任务的智能体',
    color: 'text-blue-500'
  },
  {
    type: 'parallel' as NodeType,
    name: '汇聚网关',
    icon: GitBranch,
    description: '等待多个分支完成',
    color: 'text-purple-500'
  },
  {
    type: 'delay' as NodeType,
    name: '延迟',
    icon: Clock,
    description: '等待一段时间',
    color: 'text-gray-500'
  },
  {
    type: 'end' as NodeType,
    name: '结束',
    icon: Flag,
    description: '流水线终点',
    color: 'text-red-500'
  }
];

function PipelineEditorContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const pipelineId = params.pipelineId as string;
  const isNew = pipelineId === 'new';
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [pipeline, setPipeline] = useState<Partial<Pipeline>>({
    name: '新流水线',
    description: '',
    status: 'draft',
    run_status: 'idle',
    nodes: []
  });
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isNodeSheetOpen, setIsNodeSheetOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  
  const [nodeForm, setNodeForm] = useState({
    name: '',
    description: '',
    node_type: 'agent' as NodeType,
    agent_id: '',
    parallelType: 'split' as 'split' | 'join',
    merge_strategy: 'all' as MergeStrategy,
    timeout_seconds: 60
  });

  useEffect(() => {
    fetchAgents();
    
    if (!isNew) {
      fetchPipeline(pipelineId);
    }
  }, [projectId, pipelineId, isNew]);

  const fetchAgents = async () => {
    try {
      // 只获取当前项目的智能体
      const response = await fetch(`/api/projects/${projectId}/agents`);
      const result = await response.json();
      if (result.success) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  const fetchPipeline = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pipelines/${id}`);
      const result = await response.json();
      if (result.success) {
        setPipeline(result.data);
        if (result.data.nodes && result.data.nodes.length > 0) {
          convertNodesToFlow(result.data.nodes);
        }
      } else {
        alert('流水线不存在');
        router.push(`/projects/${projectId}/pipelines`);
      }
    } catch (error) {
      console.error('获取流水线失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertNodesToFlow = (pipelineNodes: PipelineNode[]) => {
    const flowNodes: Node[] = pipelineNodes.map(node => ({
      id: node.id,
      type: 'custom',
      position: (node.position as any) || { x: 0, y: 0 },
      data: {
        label: node.name,
        nodeType: node.node_type,
        agentName: agents.find(a => a.id === node.agent_id)?.name,
        parallelType: (node.config as any)?.parallelType || 'split',
        merge_strategy: node.merge_strategy || 'all'
      }
    }));
    
    setNodes(flowNodes);
    
    // 生成默认边
    const flowEdges: Edge[] = [];
    for (let i = 0; i < pipelineNodes.length - 1; i++) {
      flowEdges.push({
        id: `e-${pipelineNodes[i].id}-${pipelineNodes[i + 1].id}`,
        source: pipelineNodes[i].id,
        target: pipelineNodes[i + 1].id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed }
      });
    }
    setEdges(flowEdges);
  };

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed }
    }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    const nodeData = node.data;
    setNodeForm({
      name: nodeData.label,
      description: nodeData.description || '',
      node_type: nodeData.nodeType,
      agent_id: nodeData.agentId || '',
      parallelType: nodeData.parallelType || 'split',
      merge_strategy: nodeData.merge_strategy || 'all',
      timeout_seconds: nodeData.timeout_seconds || 60
    });
    setIsNodeSheetOpen(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow') as NodeType;
    
    if (!type) return;

    const position = {
      x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left || 0) - 80,
      y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top || 0) - 20
    };

    const template = NODE_TEMPLATES.find(t => t.type === type);
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'custom',
      position,
      data: {
        label: template?.name || type,
        nodeType: type,
        parallelType: 'split',
        merge_strategy: 'all'
      }
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleSave = async () => {
    if (!pipeline.name) {
      alert('请输入流水线名称');
      return;
    }

    try {
      setIsSaving(true);
      
      const pipelineNodes = nodes.map((node, index) => ({
        id: node.id,
        name: node.data.label,
        node_type: node.data.nodeType,
        agent_id: node.data.agentId || undefined,
        execution_mode: 'sequential' as const,
        order_index: index,
        position: node.position,
        config: {
          parallelType: node.data.parallelType
        },
        merge_strategy: node.data.merge_strategy,
        retry_count: 0
      }));

      const url = isNew 
        ? `/api/projects/${projectId}/pipelines`
        : `/api/pipelines/${pipelineId}`;
      
      const method = isNew ? 'POST' : 'PUT';
      
      const body: any = {
        name: pipeline.name,
        description: pipeline.description,
        trigger_type: pipeline.trigger_type || 'manual',
        nodes: pipelineNodes
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.success) {
        if (isNew) {
          // 跳转到编辑模式
          router.push(`/projects/${projectId}/pipelines/editor/${result.data.id}`);
        } else {
          alert('保存成功');
        }
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!pipelineId || isNew) {
      alert('请先保存流水线');
      return;
    }

    // 检查是否有节点
    if (nodes.length === 0) {
      alert('请先添加至少一个节点（开始、智能体等）才能发布流水线');
      return;
    }

    // 检查是否有开始节点
    const hasStartNode = nodes.some(node => node.data.nodeType === 'start');
    if (!hasStartNode) {
      alert('流水线必须有开始节点才能发布');
      return;
    }

    try {
      setIsPublishing(true);
      
      const response = await fetch(`/api/pipelines/${pipelineId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' })
      });

      const result = await response.json();

      if (result.success) {
        setPipeline(prev => ({ ...prev, status: 'published' }));
        alert('发布成功');
      } else {
        alert('发布失败: ' + result.error);
      }
    } catch (error) {
      console.error('发布失败:', error);
      alert('发布失败，请检查网络连接或稍后重试');
    } finally {
      setIsPublishing(false);
    }
  };

  const updateSelectedNode = () => {
    if (!selectedNodeId) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: nodeForm.name,
              nodeType: nodeForm.node_type,
              agentId: nodeForm.agent_id,
              agentName: agents.find(a => a.id === nodeForm.agent_id)?.name,
              parallelType: nodeForm.parallelType,
              merge_strategy: nodeForm.merge_strategy
            }
          };
        }
        return node;
      })
    );

    setIsNodeSheetOpen(false);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setIsNodeSheetOpen(false);
    setSelectedNodeId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部工具栏 */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/pipelines`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            value={pipeline.name}
            onChange={(e) => setPipeline(prev => ({ ...prev, name: e.target.value }))}
            className="w-64"
            placeholder="流水线名称"
          />
          <Badge variant={pipeline.status === 'published' ? 'default' : 'secondary'}>
            {pipeline.status === 'published' ? '已发布' : pipeline.status === 'draft' ? '草稿' : '已归档'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
          {pipeline.status === 'draft' && !isNew && (
            <Button onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              发布
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* 左侧节点面板 */}
        <div className="w-64 border-r bg-gray-50 p-4">
          <h3 className="font-semibold mb-4">节点类型</h3>
          <div className="space-y-2">
            {NODE_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <div
                  key={`${template.type}-${template.name}`}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', template.type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <Icon className={`h-5 w-5 ${template.color}`} />
                  <div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 中间画布 */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>

      {/* 右侧节点编辑面板 */}
      <Sheet open={isNodeSheetOpen} onOpenChange={setIsNodeSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>编辑节点</SheetTitle>
            <SheetDescription>
              配置节点的属性
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 mt-6">
            <div>
              <Label>节点名称</Label>
              <Input
                value={nodeForm.name}
                onChange={(e) => setNodeForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>节点类型</Label>
              <Select
                value={nodeForm.node_type}
                onValueChange={(value: NodeType) => setNodeForm(prev => ({ ...prev, node_type: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">开始</SelectItem>
                  <SelectItem value="agent">智能体</SelectItem>
                  <SelectItem value="parallel">汇聚网关</SelectItem>
                  <SelectItem value="delay">延迟</SelectItem>
                  <SelectItem value="end">结束</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 智能体节点配置 */}
            {nodeForm.node_type === 'agent' && (
              <div>
                <Label>选择智能体</Label>
                <Select
                  value={nodeForm.agent_id}
                  onValueChange={(value) => setNodeForm(prev => ({ ...prev, agent_id: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择要执行任务的智能体" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        暂无可用智能体，请先创建
                      </SelectItem>
                    ) : (
                      agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                          {agent.role && ` (${agent.role})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {agents.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    请先在项目中创建智能体
                  </p>
                )}
              </div>
            )}

            {/* 汇聚网关配置 */}
            {nodeForm.node_type === 'parallel' && (
              <div>
                <Label>汇聚策略</Label>
                <Select
                  value={nodeForm.merge_strategy}
                  onValueChange={(value: MergeStrategy) => setNodeForm(prev => ({ ...prev, merge_strategy: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有分支完成</SelectItem>
                    <SelectItem value="any">任一分支完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 延迟节点配置 */}
            {nodeForm.node_type === 'delay' && (
              <div>
                <Label>延迟时间（秒）</Label>
                <Input
                  type="number"
                  value={nodeForm.timeout_seconds}
                  onChange={(e) => setNodeForm(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 60 }))}
                  className="mt-1"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={updateSelectedNode} className="flex-1">
                更新节点
              </Button>
              <Button 
                variant="destructive" 
                onClick={deleteSelectedNode}
                disabled={nodeForm.node_type === 'start'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ProjectPipelineEditorPage() {
  return (
    <ReactFlowProvider>
      <PipelineEditorContent />
    </ReactFlowProvider>
  );
}
