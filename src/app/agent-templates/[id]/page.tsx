'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { 
  ArrowLeft,
  Bot, 
  Cpu,
  Terminal,
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  type Agent, 
  type AgentRole, 
  type AgentType,
  type CapabilityTag,
  CAPABILITY_TAG_CONFIG
} from '@/types/agent';
import type { ModelConfig } from '@/types/model-config';
import type { AgentRoleConfig } from '@/types/agent-role';

export default function AgentTemplateConfigPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;
  
  const [template, setTemplate] = useState<Agent | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<AgentRoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    agent_type: AgentType;
    // LLM配置
    model_config_id: string;
    capability_tags: CapabilityTag[];
  }>({
    name: '',
    role: 'developer',
    system_prompt: '',
    agent_type: 'llm',
    model_config_id: '',
    capability_tags: []
  });

  useEffect(() => {
    fetchTemplate();
    fetchRoleConfigs();
  }, [templateId]);

  useEffect(() => {
    if (formData.agent_type === 'llm') {
      fetchModelConfigs();
    }
  }, [formData.agent_type]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${templateId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const templateData = result.data;
        if (!templateData.is_template) {
          alert('该智能体不是模板');
          router.push('/agent-templates');
          return;
        }
        setTemplate(templateData);
        setFormData({
          name: templateData.name,
          role: templateData.role,
          system_prompt: templateData.system_prompt,
          agent_type: templateData.agent_type,
          model_config_id: templateData.model_config_id || '',
          capability_tags: templateData.capability_tags || []
        });
      } else {
        alert('模板不存在');
        router.push('/agent-templates');
      }
    } catch (error) {
      console.error('获取模板失败:', error);
      alert('获取模板失败');
      router.push('/agent-templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleConfigs = async () => {
    try {
      const response = await fetch('/api/agent-roles');
      const result = await response.json();
      
      if (result.success) {
        setRoleConfigs(result.data || []);
      }
    } catch (error) {
      console.error('获取角色配置失败:', error);
    }
  };

  const fetchModelConfigs = async () => {
    try {
      const response = await fetch('/api/model-configs');
      const result = await response.json();
      
      if (result.success) {
        setModelConfigs(result.data || []);
      }
    } catch (error) {
      console.error('获取大模型配置失败:', error);
    }
  };

  // 根据角色重置提示词
  const handleRoleChange = (roleKey: string) => {
    const roleConfig = roleConfigs.find(r => r.role_key === roleKey);
    if (roleConfig) {
      setFormData(prev => ({
        ...prev,
        role: roleKey as AgentRole,
        system_prompt: roleConfig.system_prompt_template,
        agent_type: (roleConfig.suggested_agent_type as AgentType) || 'llm'
      }));
    }
  };

  const handleSave = async () => {
    // 验证
    if (!formData.name) {
      alert('请输入模板名称');
      return;
    }
    
    if (formData.agent_type === 'llm' && !formData.model_config_id) {
      alert('请选择大模型配置');
      return;
    }

    try {
      setSaving(true);
      const submitData: Record<string, unknown> = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt
      };
      
      if (formData.agent_type === 'llm') {
        submitData.model_config_id = formData.model_config_id;
        const selectedConfig = modelConfigs.find(c => c.id === formData.model_config_id);
        if (selectedConfig) {
          submitData.model = selectedConfig.default_model;
          submitData.model_config = {
            temperature: selectedConfig.temperature,
            max_tokens: selectedConfig.max_tokens,
            thinking: selectedConfig.thinking,
            caching: selectedConfig.caching
          };
        }
      }
      
      if (formData.capability_tags.length > 0) {
        submitData.capability_tags = formData.capability_tags;
      }

      const response = await fetch(`/api/agents/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('保存成功');
        router.push('/agent-templates');
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存模板失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const getSelectedConfigInfo = () => {
    return modelConfigs.find(c => c.id === formData.model_config_id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>模板不存在</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agent-templates">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">编辑模板</h1>
          <p className="text-muted-foreground">
            修改模板 {template.name} 的配置
          </p>
        </div>
      </div>

      {/* 提示词警告 */}
      {!formData.system_prompt?.includes('{name}') && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-300">
                  提示词已固化，缺少 {'{name}'} 占位符
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                  建议重新选择角色或手动修改提示词，添加 {'{name}'} 占位符，以便创建实例时自动替换为智能体名称
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本信息</CardTitle>
          <CardDescription>模板的基本配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">模板名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：开发工程师、代码审核员"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">角色</Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roleConfigs.filter(r => r.is_active).map(role => (
                    <SelectItem key={role.role_key} value={role.role_key}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="system_prompt">系统提示词</Label>
            <Textarea
              id="system_prompt"
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="定义智能体的角色和行为..."
              rows={10}
            />
            <p className="text-xs text-muted-foreground">
              使用 {'{name}'} 作为智能体名称占位符，创建实例时会自动替换
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 智能体类型 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">智能体类型</CardTitle>
          <CardDescription>当前类型: {formData.agent_type === 'llm' ? '大模型智能体' : '进程智能体'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${
                formData.agent_type === 'llm' 
                  ? 'border-primary shadow-md' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setFormData({ ...formData, agent_type: 'llm' })}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-sm">大模型智能体</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  基于LLM的AI对话智能体
                </CardDescription>
              </CardHeader>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${
                formData.agent_type === 'process' 
                  ? 'border-primary shadow-md' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setFormData({ ...formData, agent_type: 'process' })}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm">本地进程智能体</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  启动本地命令行进程
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* LLM配置 */}
      {formData.agent_type === 'llm' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">大模型配置</CardTitle>
            <CardDescription>选择大模型配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelConfigs.length === 0 ? (
              <div className="p-4 border border-dashed rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  暂无大模型配置，请先创建配置
                </p>
                <Link href="/model-configs" target="_blank">
                  <Button variant="outline" size="sm">
                    创建大模型配置
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>选择配置 *</Label>
                  <Select
                    value={formData.model_config_id}
                    onValueChange={(value) => setFormData({ ...formData, model_config_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择大模型配置" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelConfigs.map(config => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name} ({config.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {getSelectedConfigInfo() && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">配置详情</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">模型:</span>
                        <span>{getSelectedConfigInfo()?.default_model || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">温度:</span>
                        <span>{getSelectedConfigInfo()?.temperature ?? '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">思考模式:</span>
                        <span>{getSelectedConfigInfo()?.thinking || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">缓存:</span>
                        <span>{getSelectedConfigInfo()?.caching || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 能力标签 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">能力标签</CardTitle>
          <CardDescription>标记智能体的能力，用于任务匹配</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CAPABILITY_TAG_CONFIG) as CapabilityTag[]).map(tag => {
              const config = CAPABILITY_TAG_CONFIG[tag];
              const isSelected = formData.capability_tags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer ${isSelected ? '' : 'hover:bg-muted'}`}
                  onClick={() => {
                    if (isSelected) {
                      setFormData({
                        ...formData,
                        capability_tags: formData.capability_tags.filter(t => t !== tag)
                      });
                    } else {
                      setFormData({
                        ...formData,
                        capability_tags: [...formData.capability_tags, tag]
                      });
                    }
                  }}
                >
                  {config.label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/agent-templates">取消</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存修改
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
