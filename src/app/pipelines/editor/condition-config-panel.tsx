'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowRight, RotateCcw } from 'lucide-react';
import type { ConditionConfig, ConditionBranch, ConditionType, LoopConfig } from '@/types/pipeline';

interface ConditionConfigPanelProps {
  nodeId: string;
  config?: ConditionConfig;
  downstreamNodes: Array<{ id: string; name: string }>;
  onConfigChange: (config: ConditionConfig) => void;
}

export function ConditionConfigPanel({
  nodeId,
  config,
  downstreamNodes,
  onConfigChange
}: ConditionConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<ConditionConfig>(
    config || {
      conditionType: 'expression',
      expression: '',
      branches: []
    }
  );

  const updateConfig = (updates: Partial<ConditionConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const addBranch = () => {
    const newBranch: ConditionBranch = {
      id: `branch-${Date.now()}`,
      label: `分支 ${(localConfig.branches?.length || 0) + 1}`,
      conditionValue: true,
      targetNodeId: downstreamNodes[0]?.id || '',
      isLoop: false
    };
    
    updateConfig({
      branches: [...(localConfig.branches || []), newBranch]
    });
  };

  const updateBranch = (index: number, updates: Partial<ConditionBranch>) => {
    const branches = [...(localConfig.branches || [])];
    branches[index] = { ...branches[index], ...updates };
    updateConfig({ branches });
  };

  const deleteBranch = (index: number) => {
    const branches = (localConfig.branches || []).filter((_, i) => i !== index);
    updateConfig({ branches });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">条件网关配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 条件类型 */}
        <div className="space-y-2">
          <Label className="text-xs">条件类型</Label>
          <Select
            value={localConfig.conditionType}
            onValueChange={(value) => updateConfig({ conditionType: value as ConditionType })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expression">表达式求值</SelectItem>
              <SelectItem value="output_match">输出匹配</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 条件表达式 */}
        <div className="space-y-2">
          <Label className="text-xs">条件表达式</Label>
          <Textarea
            value={localConfig.expression}
            onChange={(e) => updateConfig({ expression: e.target.value })}
            placeholder='例如: {{output.status}} === "passed"'
            className="h-20 text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            使用 {`{{output.xxx}}`} 引用上游节点输出，表达式返回 true/false
          </p>
        </div>

        {/* 分支配置 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">分支配置</Label>
            <Button size="sm" variant="outline" onClick={addBranch} className="h-7">
              <Plus className="h-3 w-3 mr-1" />
              添加分支
            </Button>
          </div>

          {(localConfig.branches || []).map((branch, index) => (
            <div key={branch.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Input
                  value={branch.label}
                  onChange={(e) => updateBranch(index, { label: e.target.value })}
                  className="h-7 w-32 text-xs"
                  placeholder="分支名称"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteBranch(index)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">条件值</Label>
                  <Select
                    value={branch.conditionValue === true ? 'true' : 'false'}
                    onValueChange={(v) => updateBranch(index, { conditionValue: v === 'true' })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">true（条件满足）</SelectItem>
                      <SelectItem value="false">false（条件不满足）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px]">目标节点</Label>
                  <Select
                    value={branch.targetNodeId}
                    onValueChange={(v) => updateBranch(index, { targetNodeId: v })}
                  >
                    <SelectTrigger className="h-7 text-xs">
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
              </div>

              {/* 循环配置 */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Switch
                  checked={branch.isLoop}
                  onCheckedChange={(checked) => updateBranch(index, { isLoop: checked })}
                />
                <Label className="text-xs flex items-center gap-1">
                  {branch.isLoop && <RotateCcw className="h-3 w-3" />}
                  这是循环分支
                </Label>
              </div>

              {branch.isLoop && (
                <div className="bg-yellow-50 dark:bg-yellow-950 p-2 rounded space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">最大循环次数</Label>
                      <Input
                        type="number"
                        value={branch.loopConfig?.maxIterations || 10}
                        onChange={(e) => updateBranch(index, {
                          loopConfig: {
                            isLoop: true,
                            maxIterations: parseInt(e.target.value) || 10
                          }
                        })}
                        className="h-7 text-xs"
                        min={1}
                        max={100}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">携带数据字段</Label>
                      <Input
                        value={branch.loopConfig?.carryOver?.join(', ') || ''}
                        onChange={(e) => updateBranch(index, {
                          loopConfig: {
                            isLoop: true,
                            maxIterations: branch.loopConfig?.maxIterations || 10,
                            carryOver: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          }
                        })}
                        className="h-7 text-xs"
                        placeholder="bugs, testReport"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">循环提示词（可选）</Label>
                    <Textarea
                      value={branch.loopConfig?.loopPrompt || ''}
                      onChange={(e) => updateBranch(index, {
                        loopConfig: {
                          isLoop: true,
                          maxIterations: branch.loopConfig?.maxIterations || 10,
                          carryOver: branch.loopConfig?.carryOver,
                          loopPrompt: e.target.value
                        }
                      })}
                      placeholder="每次循环时发送给目标节点的额外提示"
                      className="h-12 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* 分支预览 */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {branch.conditionValue === true ? '条件满足' : '条件不满足'}
                </Badge>
                <ArrowRight className="h-3 w-3" />
                <span>
                  {downstreamNodes.find(n => n.id === branch.targetNodeId)?.name || '未选择'}
                </span>
                {branch.isLoop && (
                  <Badge className="bg-yellow-500 text-white text-[10px]">
                    循环 (最多{branch.loopConfig?.maxIterations || 10}次)
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {(localConfig.branches || []).length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              点击"添加分支"配置条件分支
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs">
          <p className="font-medium mb-1">💡 使用说明</p>
          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
            <li>条件表达式返回 true 时，走条件值为 true 的分支</li>
            <li>循环分支用于回到上游节点（如测试失败返回开发）</li>
            <li>务必设置最大循环次数，防止无限循环</li>
            <li>携带数据字段会在每次循环时传递给目标节点</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
