'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { OutputMapping, TaskType, TASK_TYPE_LABELS, TASK_TYPE_COLORS } from '@/types/pipeline';
import type { Node, Edge } from 'reactflow';
import { useState } from 'react';

interface OutputMappingConfigProps {
  nodeId: string;
  agentId: string;
  edges: Edge[];
  nodes: Node[];
  agents: any[];
  onConfigChange: (mappings: OutputMapping[]) => void;
}

export function OutputMappingConfig({
  nodeId,
  agentId,
  edges,
  nodes,
  agents,
  onConfigChange
}: OutputMappingConfigProps) {
  // 获取当前节点的下游节点
  const downstreamEdges = edges.filter(e => e.source === nodeId);
  const downstreamNodes = downstreamEdges.map(edge => {
    const node = nodes.find(n => n.id === edge.target);
    return {
      id: edge.target,
      name: node?.data?.label || '未命名节点',
      nodeType: node?.data?.nodeType
    };
  });

  // 如果没有下游节点或只有一个，不显示配置
  if (downstreamNodes.length <= 1) {
    return null;
  }

  const [mappings, setMappings] = useState<OutputMapping[]>([]);

  const handleAddMapping = () => {
    setMappings(prev => [...prev, {
      targetNodeId: downstreamNodes[0].id,
      taskType: 'general' as TaskType,
      template: ''
    }]);
  };

  const handleUpdateMapping = (index: number, updates: Partial<OutputMapping>) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  const handleDeleteMapping = (index: number) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };

  // 当 mappings 变化时通知父组件
  const handleNotifyChange = () => {
    onConfigChange(mappings);
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>任务分发配置</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleAddMapping}
            className="h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            添加映射
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          配置如何将输出分发给下游节点（共 {downstreamNodes.length} 个下游）
        </p>

        {mappings.map((mapping, index) => (
          <div key={index} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">映射 #{index + 1}</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteMapping(index)}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">目标节点</Label>
                <Select
                  value={mapping.targetNodeId}
                  onValueChange={(value) => handleUpdateMapping(index, { targetNodeId: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="选择节点" />
                  </SelectTrigger>
                  <SelectContent>
                    {downstreamNodes.map(node => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">任务类型</Label>
                <Select
                  value={mapping.taskType}
                  onValueChange={(value) => handleUpdateMapping(index, { taskType: value as TaskType })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_TYPE_LABELS).map(([type, label]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={`${TASK_TYPE_COLORS[type as TaskType]} text-white text-[10px] px-1`}
                          >
                            {label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">消息模板（可选）</Label>
              <Textarea
                value={mapping.template}
                onChange={(e) => handleUpdateMapping(index, { template: e.target.value })}
                placeholder="自定义发送给下游的消息，使用 {{output}} 插入上游输出"
                className="h-16 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                示例：请处理前端任务：{'{{output}}'}
              </p>
            </div>
          </div>
        ))}

        {mappings.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            点击"添加映射"配置任务分发规则
          </div>
        )}

        {mappings.length > 0 && (
          <Button 
            size="sm" 
            className="w-full" 
            onClick={handleNotifyChange}
          >
            应用配置
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
