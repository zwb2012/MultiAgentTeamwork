'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Play, 
  Save, 
  ArrowLeft,
  Bot,
  GitBranch,
  GitMerge,
  GitFork,
  Clock,
  Flag,
  PlayCircle,
  Settings
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
  NodeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { 
  Pipeline, 
  PipelineNode, 
  NodeType, 
  GatewayType,
  MergeStrategy 
} from '@/types/pipeline';
import { NODE_TEMPLATES } from '@/types/pipeline';

// 图标映射
const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    Play: PlayCircle,
    Flag: Flag,
    Bot: Bot,
    GitBranch: GitBranch,
    GitMerge: GitMerge,
    GitFork: GitFork,
    Clock: Clock,
    PlayCircle: PlayCircle
  };
  return icons[iconName] || Bot;
};

// 自定义节点组件
const CustomNode = ({ data }: { data: any }) => {
  const getNodeIcon = () => {
    switch (data.nodeType) {
      case 'start':
        return <PlayCircle className="h-5 w-5 text-green-500" />;
      case 'end':
        return <Flag className="h-5 w-5 text-red-500" />;
      case 'agent':
        return <Bot className="h-5 w-5 text-blue-500" />;
      case 'gateway':
        if (data.gatewayType === 'parallel_split') {
          return <GitBranch className="h-5 w-5 text-orange-500" />;
        } else if (data.gatewayType === 'parallel_join') {
          return <GitMerge className="h-5 w-5 text-purple-500" />;
        }
        return <GitFork className="h-5 w-5 text-yellow-500" />;
      case 'condition':
        return <GitFork className="h-5 w-5 text-yellow-500" />;
      case 'delay':
        return <Clock className="h-5 w-5 text-gray-500" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'border-blue-500 bg-blue-50';
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'failed':
        return 'border-red-500 bg-red-50';
      case 'waiting':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  return (
    <div 
      className={`px-4 py-2 rounded-lg border-2 shadow-sm min-w-[150px] ${getStatusColor()} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={data.onClick}
    >
      <div className="flex items-center gap-2">
        {getNodeIcon()}
        <div>
          <div className="font-medium text-sm">{data.label}</div>
          {data.agentName && (
            <div className="text-xs text-muted-foreground">{data.agentName}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export default function PipelineEditorPage() {
  const [pipeline, setPipeline] = useState<Partial<Pipeline>>({
    name: '新流水线',
    description: '',
    status: 'draft',
    nodes: []
  });
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isNodeSheetOpen, setIsNodeSheetOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  
  // 节点编辑表单
  const [nodeForm, setNodeForm] = useState({
    name: '',
    description: '',
    node_type: 'agent' as NodeType,
    agent_id: '',
    gateway_type: 'parallel_split' as GatewayType,
    merge_strategy: 'all' as MergeStrategy,
    upstream_nodes: [] as string[],
    timeout_seconds: 60
  });

  useEffect(() => {
    fetchAgents();
    
    // 从URL获取流水线ID
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setPipelineId(id);
      fetchPipeline(id);
    }
  }, []);

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

  const fetchPipeline = async (id: string) => {
    try {
      const response = await fetch(`/api/pipelines/${id}`);
      const result = await response.json();
      if (result.success) {
        setPipeline(result.data);
        convertNodesToFlow(result.data.nodes || []);
      }
    } catch (error) {
      console.error('获取流水线失败:', error);
    }
  };

  // 将数据库节点转换为React Flow节点
  const convertNodesToFlow = (pipelineNodes: PipelineNode[]) => {
    const flowNodes: Node[] = pipelineNodes.map(node => ({
      id: node.id,
      type: 'custom',
      position: node.position || { x: 0, y: 0 },
      data: {
        label: node.name,
        nodeType: node.node_type,
        gatewayType: node.gateway_type,
        status: 'pending',
        agentName: agents.find(a => a.id === node.agent_id)?.name,
        onClick: () => handleNodeClick(node.id)
      }
    }));
    
    setNodes(flowNodes);
    
    // 生成边
    const flowEdges: Edge[] = [];
    pipelineNodes.forEach(node => {
      if (node.downstream_nodes) {
        (node.downstream_nodes as string[]).forEach(targetId => {
          flowEdges.push({
            id: `${node.id}-${targetId}`,
            source: node.id,
            target: targetId,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: true
          });
        });
      }
    });
    
    setEdges(flowEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: true
      }, eds));
    },
    [setEdges]
  );

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      // 填充表单
      const pipelineNode = pipeline.nodes?.find(n => n.id === nodeId);
      if (pipelineNode) {
        setNodeForm({
          name: pipelineNode.name,
          description: pipelineNode.description || '',
          node_type: pipelineNode.node_type,
          agent_id: pipelineNode.agent_id || '',
          gateway_type: pipelineNode.gateway_type || 'parallel_split',
          merge_strategy: pipelineNode.merge_strategy || 'all',
          upstream_nodes: (pipelineNode.upstream_nodes as string[]) || [],
          timeout_seconds: pipelineNode.timeout_seconds || 60
        });
      }
      setIsNodeSheetOpen(true);
    }
  };

  // 添加新节点
  const handleAddNode = (template: typeof NODE_TEMPLATES[0]) => {
    const newNodeId = `node_${Date.now()}`;
    const position = {
      x: nodes.length * 200 + 100,
      y: 100
    };
    
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position,
      data: {
        label: template.name,
        nodeType: template.type,
        gatewayType: template.default_config.gateway_type,
        status: 'pending',
        onClick: () => handleNodeClick(newNodeId)
      }
    };
    
    setNodes([...nodes, newNode]);
    
    // 添加到流水线节点列表
    const pipelineNode: Partial<PipelineNode> = {
      id: newNodeId,
      name: template.name,
      node_type: template.type,
      ...template.default_config,
      position
    };
    
    setPipeline(prev => ({
      ...prev,
      nodes: [...(prev.nodes || []), pipelineNode as PipelineNode]
    }));
  };

  // 保存流水线
  const handleSave = async () => {
    try {
      const pipelineNodes = nodes.map((node, index) => {
        const existingNode = pipeline.nodes?.find(n => n.id === node.id);
        return {
          ...existingNode,
          id: node.id,
          name: node.data.label,
          node_type: node.data.nodeType,
          gateway_type: node.data.gatewayType,
          order_index: index,
          position: node.position,
          downstream_nodes: edges
            .filter(e => e.source === node.id)
            .map(e => e.target)
        };
      });
      
      const payload = {
        ...pipeline,
        nodes: pipelineNodes
      };
      
      const url = pipelineId ? `/api/pipelines/${pipelineId}` : '/api/pipelines';
      const method = pipelineId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('保存成功');
        if (!pipelineId && result.data?.id) {
          setPipelineId(result.data.id);
          window.history.pushState({}, '', `?id=${result.data.id}`);
        }
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  // 运行流水线
  const handleRun = async () => {
    if (!pipelineId) {
      alert('请先保存流水线');
      return;
    }
    
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/run`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('流水线已开始执行');
        // 跳转到执行监控页面
        window.location.href = `/pipelines/${pipelineId}/runs/${result.data.id}`;
      } else {
        alert('执行失败: ' + result.error);
      }
    } catch (error) {
      console.error('执行失败:', error);
    }
  };

  // 更新节点配置
  const handleUpdateNode = () => {
    if (!selectedNode) return;
    
    setNodes(nodes.map(n => {
      if (n.id === selectedNode.id) {
        return {
          ...n,
          data: {
            ...n.data,
            label: nodeForm.name,
            nodeType: nodeForm.node_type,
            gatewayType: nodeForm.gateway_type,
            agentName: agents.find(a => a.id === nodeForm.agent_id)?.name
          }
        };
      }
      return n;
    }));
    
    setPipeline(prev => ({
      ...prev,
      nodes: prev.nodes?.map(n => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            ...nodeForm
          };
        }
        return n;
      })
    }));
    
    setIsNodeSheetOpen(false);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部工具栏 */}
      <header className="border-b bg-background px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          </Link>
          <Input
            value={pipeline.name || ''}
            onChange={(e) => setPipeline(prev => ({ ...prev, name: e.target.value }))}
            className="w-64"
            placeholder="流水线名称"
          />
          <Badge variant={pipeline.status === 'active' ? 'default' : 'secondary'}>
            {pipeline.status}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            保存
          </Button>
          <Button onClick={handleRun} disabled={!pipelineId}>
            <Play className="h-4 w-4 mr-2" />
            运行
          </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* 左侧节点面板 */}
        <aside className="w-64 border-r bg-muted/30 p-4">
          <h3 className="font-medium mb-4">节点类型</h3>
          <div className="space-y-2">
            {NODE_TEMPLATES.map((template, index) => {
              const IconComponent = getIconComponent(template.icon);
              return (
                <Card
                  key={index}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleAddNode(template)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {template.description}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </aside>

        {/* 主画布区域 */}
        <main className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </main>
      </div>

      {/* 节点配置面板 */}
      <Sheet open={isNodeSheetOpen} onOpenChange={setIsNodeSheetOpen}>
        <SheetContent className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>节点配置</SheetTitle>
            <SheetDescription>
              配置节点的详细参数
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>节点名称</Label>
              <Input
                value={nodeForm.name}
                onChange={(e) => setNodeForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>节点描述</Label>
              <Textarea
                value={nodeForm.description}
                onChange={(e) => setNodeForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>节点类型</Label>
              <Select
                value={nodeForm.node_type}
                onValueChange={(value) => setNodeForm(prev => ({ ...prev, node_type: value as NodeType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">智能体</SelectItem>
                  <SelectItem value="gateway">网关</SelectItem>
                  <SelectItem value="condition">条件</SelectItem>
                  <SelectItem value="delay">延迟</SelectItem>
                  <SelectItem value="start">开始</SelectItem>
                  <SelectItem value="end">结束</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 智能体节点配置 */}
            {nodeForm.node_type === 'agent' && (
              <div className="space-y-2">
                <Label>选择智能体</Label>
                <Select
                  value={nodeForm.agent_id}
                  onValueChange={(value) => setNodeForm(prev => ({ ...prev, agent_id: value }))}
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
            )}

            {/* 网关节点配置 */}
            {nodeForm.node_type === 'gateway' && (
              <>
                <div className="space-y-2">
                  <Label>网关类型</Label>
                  <Select
                    value={nodeForm.gateway_type}
                    onValueChange={(value) => setNodeForm(prev => ({ ...prev, gateway_type: value as GatewayType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parallel_split">并行分叉</SelectItem>
                      <SelectItem value="parallel_join">并行汇聚</SelectItem>
                      <SelectItem value="exclusive">排他网关</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {nodeForm.gateway_type === 'parallel_join' && (
                  <div className="space-y-2">
                    <Label>汇聚策略</Label>
                    <Select
                      value={nodeForm.merge_strategy}
                      onValueChange={(value) => setNodeForm(prev => ({ ...prev, merge_strategy: value as MergeStrategy }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有上游节点完成</SelectItem>
                        <SelectItem value="any">任一上游节点完成</SelectItem>
                        <SelectItem value="custom">自定义条件</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      默认为"所有上游节点完成"，即等待所有并行分支完成后才继续
                    </p>
                  </div>
                )}
              </>
            )}

            {/* 延迟节点配置 */}
            {nodeForm.node_type === 'delay' && (
              <div className="space-y-2">
                <Label>延迟时间（秒）</Label>
                <Input
                  type="number"
                  value={nodeForm.timeout_seconds}
                  onChange={(e) => setNodeForm(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) }))}
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsNodeSheetOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleUpdateNode}>
                保存
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
