'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Save, 
  ArrowLeft,
  Bot,
  GitBranch,
  Clock,
  Flag,
  PlayCircle,
  X,
  Trash2
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
import { OutputMappingConfig } from './output-mapping-config';
import type { 
  Pipeline, 
  PipelineNode, 
  NodeType,
  MergeStrategy,
  OutputMapping
} from '@/types/pipeline';

// ============================================
// 节点类型说明
// ============================================
// 
// 1. 开始节点：流水线的起点
// 2. 结束节点：流水线的终点
// 3. 智能体节点：执行具体任务的智能体
// 4. 并行网关：让流程分成多条线同时执行
//    - 拖入后会自动创建"分叉"和"汇聚"两个连接点
//    - 连接分叉点：多个下游节点并行执行
//    - 连接汇聚点：等待所有并行节点完成
// 5. 延迟节点：等待指定时间后继续
//
// ============================================

// 自定义节点组件 - 添加连接点
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
      {/* 输入连接点 - 左侧 */}
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
      
      {/* 输出连接点 - 右侧 */}
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

// 简化的节点模板
// 注意：并行分叉不需要单独的节点，直接从一个节点连多条线出去就是并行
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
    description: '等待多个上游节点完成后继续',
    color: 'text-purple-500'
  },
  {
    type: 'delay' as NodeType,
    name: '延迟',
    icon: Clock,
    description: '等待指定时间',
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
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [pipeline, setPipeline] = useState<Partial<Pipeline>>({
    name: '新流水线',
    description: '',
    status: 'draft',
    nodes: []
  });
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isNodeSheetOpen, setIsNodeSheetOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // 节点编辑表单
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
        // 转换节点
        if (result.data.nodes && result.data.nodes.length > 0) {
          convertNodesToFlow(result.data.nodes);
        }
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
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            animated: true
          });
        });
      }
    });
    
    setEdges(flowEdges);
    
    setTimeout(() => fitView(), 100);
  };

  // 连接节点
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        animated: true
      }, eds));
    },
    [setEdges]
  );

  // 点击节点
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    
    // 填充表单
    setNodeForm({
      name: node.data.label,
      description: '',
      node_type: node.data.nodeType,
      agent_id: node.data.agentId || '',
      parallelType: node.data.parallelType || 'split',
      merge_strategy: node.data.merge_strategy || 'all',
      timeout_seconds: 60
    });
    
    setIsNodeSheetOpen(true);
  }, []);

  // 点击画布空白处
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setIsNodeSheetOpen(false);
  }, []);

  // 添加新节点
  const handleAddNode = (template: typeof NODE_TEMPLATES[0]) => {
    const newNodeId = `node_${Date.now()}`;
    
    // 计算位置 - 在当前节点最右侧添加
    const lastNode = nodes.reduce((rightmost, node) => {
      return node.position.x > rightmost.position.x ? node : rightmost;
    }, { position: { x: 0, y: 200 } });
    
    const position = {
      x: lastNode.position.x + 250,
      y: lastNode.position.y
    };
    
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position,
      data: {
        label: template.name,
        nodeType: template.type,
        agentName: undefined,
        parallelType: 'split',
        merge_strategy: 'all'
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    
    // 添加到流水线节点列表
    const pipelineNode: Partial<PipelineNode> = {
      id: newNodeId,
      name: template.name,
      node_type: template.type,
      position
    };
    
    setPipeline(prev => ({
      ...prev,
      nodes: [...(prev.nodes || []), pipelineNode as PipelineNode]
    }));
  };

  // 更新节点配置
  const handleUpdateNode = () => {
    if (!selectedNodeId) return;
    
    setNodes((nds) => nds.map((n) => {
      if (n.id === selectedNodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            label: nodeForm.name,
            nodeType: nodeForm.node_type,
            agentName: agents.find(a => a.id === nodeForm.agent_id)?.name,
            agentId: nodeForm.agent_id,
            parallelType: nodeForm.parallelType,
            merge_strategy: nodeForm.merge_strategy
          }
        };
      }
      return n;
    }));
    
    // 更新流水线节点
    setPipeline(prev => ({
      ...prev,
      nodes: prev.nodes?.map(n => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            name: nodeForm.name,
            node_type: nodeForm.node_type,
            agent_id: nodeForm.agent_id,
            merge_strategy: nodeForm.merge_strategy,
            config: {
              ...n.config,
              parallelType: nodeForm.parallelType
            }
          };
        }
        return n;
      })
    }));
    
    setIsNodeSheetOpen(false);
  };

  // 删除节点
  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setPipeline(prev => ({
      ...prev,
      nodes: prev.nodes?.filter(n => n.id !== selectedNodeId)
    }));
    
    setIsDeleteDialogOpen(false);
    setIsNodeSheetOpen(false);
    setSelectedNodeId(null);
  };

  // 保存流水线
  const handleSave = async () => {
    try {
      // 从 React Flow 节点构建流水线节点
      const pipelineNodes = nodes.map((node, index) => {
        const existingNode = pipeline.nodes?.find(n => n.id === node.id);
        return {
          ...existingNode,
          id: node.id,
          name: node.data.label,
          node_type: node.data.nodeType,
          order_index: index,
          position: node.position,
          agent_id: node.data.agentId,
          merge_strategy: node.data.merge_strategy,
          config: {
            parallelType: node.data.parallelType
          },
          // 从边计算下游节点
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
      } else {
        alert('执行失败: ' + result.error);
      }
    } catch (error) {
      console.error('执行失败:', error);
    }
  };

  // 获取选中节点
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部工具栏 */}
      <header className="border-b bg-background px-4 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link href="/pipelines">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
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

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧节点面板 */}
        <aside className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
          <h3 className="font-medium mb-4">拖拽添加节点</h3>
          <div className="space-y-2">
            {NODE_TEMPLATES.map((template, index) => (
              <Card
                key={index}
                className="cursor-pointer hover:bg-accent transition-colors border-2 hover:border-primary/50"
                onClick={() => handleAddNode(template)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <template.icon className={`h-5 w-5 ${template.color}`} />
                    <div>
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {template.description}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* 使用说明 */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-2">
            <div className="font-medium">💡 使用说明</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>点击左侧节点添加到画布</li>
              <li>从节点右侧圆点拖出连线</li>
              <li>点击节点打开配置面板</li>
              <li>按 Delete 键删除选中节点</li>
            </ul>
          </div>

          {/* 并行网关说明 */}
          <div className="mt-4 p-3 bg-purple-50 rounded-lg text-xs text-purple-700 space-y-2">
            <div className="font-medium">🔀 并行网关说明</div>
            <p>并行网关用于让多个智能体同时工作：</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>分叉</strong>：一个输入，多个输出，让流程分成多条线并行执行</li>
              <li><strong>汇聚</strong>：多个输入，一个输出，等待所有分支完成后继续</li>
            </ul>
            <p className="mt-2">示例：需求分析 → 并行分叉 → [技术评审, 成本评估] → 并行汇聚 → 生成报告</p>
          </div>
        </aside>

        {/* 主画布区域 */}
        <main className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#94a3b8', strokeWidth: 2 },
              animated: true
            }}
          >
            <Background color="#e2e8f0" gap={20} />
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
                placeholder="输入节点名称"
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
                  <SelectItem value="start">开始</SelectItem>
                  <SelectItem value="agent">智能体</SelectItem>
                  <SelectItem value="parallel">并行网关</SelectItem>
                  <SelectItem value="delay">延迟</SelectItem>
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
                    <SelectValue placeholder="选择要执行任务的智能体" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.length === 0 ? (
                      <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                        暂无可用智能体，请先创建
                      </div>
                    ) : (
                      agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <span>{agent.name}</span>
                            <span className="text-xs text-muted-foreground">({agent.role})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                
                {/* 输出映射配置 - 当节点有多个下游时显示 */}
                {nodeForm.agent_id && (
                  <OutputMappingConfig
                    nodeId={selectedNodeId || ''}
                    agentId={nodeForm.agent_id}
                    edges={edges}
                    nodes={nodes}
                    agents={agents}
                    onConfigChange={(mappings) => {
                      setPipeline(prev => ({
                        ...prev,
                        nodes: prev.nodes?.map(n => 
                          n.id === selectedNodeId 
                            ? { 
                                ...n, 
                                config: { 
                                  ...n.config, 
                                  outputMappings: mappings 
                                } 
                              }
                            : n
                        )
                      }));
                    }}
                  />
                )}
              </div>
            )}

            {/* 并行网关配置 */}
            {nodeForm.node_type === 'parallel' && (
              <>
                <div className="space-y-2">
                  <Label>网关类型</Label>
                  <Select
                    value={nodeForm.parallelType}
                    onValueChange={(value) => setNodeForm(prev => ({ 
                      ...prev, 
                      parallelType: value as 'split' | 'join' 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="split">
                        <div>
                          <div className="font-medium">分叉点（1→多）</div>
                          <div className="text-xs text-muted-foreground">一条线分成多条并行执行</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="join">
                        <div>
                          <div className="font-medium">汇聚点（多→1）</div>
                          <div className="text-xs text-muted-foreground">等待多条线完成后合并</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {nodeForm.parallelType === 'join' && (
                  <div className="space-y-2">
                    <Label>汇聚策略</Label>
                    <Select
                      value={nodeForm.merge_strategy}
                      onValueChange={(value) => setNodeForm(prev => ({ 
                        ...prev, 
                        merge_strategy: value as MergeStrategy 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div>
                            <div className="font-medium">全部完成</div>
                            <div className="text-xs text-muted-foreground">等待所有上游节点完成</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="any">
                          <div>
                            <div className="font-medium">任一完成</div>
                            <div className="text-xs text-muted-foreground">任一上游节点完成即可</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                  onChange={(e) => setNodeForm(prev => ({ 
                    ...prev, 
                    timeout_seconds: parseInt(e.target.value) || 0 
                  }))}
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                variant="destructive" 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除节点
              </Button>
              <Button className="flex-1" onClick={handleUpdateNode}>
                保存配置
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除节点 "{selectedNode?.data.label}" 吗？相关的连线也会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNode} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// 包装 ReactFlow Provider
export default function PipelineEditorPage() {
  return (
    <ReactFlowProvider>
      <PipelineEditorContent />
    </ReactFlowProvider>
  );
}
