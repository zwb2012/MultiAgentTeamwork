'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Bot, 
  Plus, 
  Trash2, 
  Settings,
  Cpu,
  Terminal,
  Copy,
  Server,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { 
  AGENT_ROLE_TEMPLATES, 
  type Agent, 
  type AgentRole, 
  type AgentType,
  type CapabilityTag,
  CAPABILITY_TAG_CONFIG
} from '@/types/agent';
import type { ModelConfig } from '@/types/model-config';

export default function AgentTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('developer');
  
  // 大模型配置列表
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    agent_type: AgentType;
    // LLM配置
    model_config_id: string;
    model: string;
    temperature: number;
    max_tokens: number;
    thinking: 'enabled' | 'disabled';
    caching: 'enabled' | 'disabled';
    // 能力标签
    capability_tags: CapabilityTag[];
  }>({
    name: '',
    role: 'developer',
    system_prompt: '',
    agent_type: 'llm',
    model_config_id: '',
    model: '',
    temperature: 0.3,
    max_tokens: 2048,
    thinking: 'enabled',
    caching: 'enabled',
    capability_tags: []
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (isCreateDialogOpen && formData.agent_type === 'llm') {
      fetchModelConfigs();
    }
  }, [isCreateDialogOpen, formData.agent_type]);

  const fetchModelConfigs = async () => {
    try {
      setLoadingConfigs(true);
      const response = await fetch('/api/model-configs');
      const result = await response.json();
      
      if (result.success) {
        setModelConfigs(result.data || []);
        // 默认选择第一个配置
        if (result.data?.length > 0 && !formData.model_config_id) {
          const firstConfig = result.data[0];
          setFormData(prev => ({
            ...prev,
            model_config_id: firstConfig.id,
            model: firstConfig.default_model || '',
            temperature: firstConfig.temperature || 0.3,
            max_tokens: firstConfig.max_tokens || 2048,
            thinking: (firstConfig.thinking as 'enabled' | 'disabled') || 'disabled',
            caching: (firstConfig.caching as 'enabled' | 'disabled') || 'enabled'
          }));
        }
      }
    } catch (error) {
      console.error('获取大模型配置失败:', error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/agents?is_template=true');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('获取智能体模板列表失败:', error);
    }
  };

  // 打开创建对话框时自动选择第一个角色模板
  useEffect(() => {
    if (isCreateDialogOpen) {
      const template = AGENT_ROLE_TEMPLATES[0];
      if (template && !formData.name) {
        handleRoleSelect(template.role);
      }
    }
  }, [isCreateDialogOpen]);

  const handleRoleSelect = (role: AgentRole) => {
    setSelectedRole(role);
    const template = AGENT_ROLE_TEMPLATES.find(t => t.role === role);
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        role: template.role,
        system_prompt: template.system_prompt,
        agent_type: template.agent_type,
        model: template.suggested_model,
        thinking: template.suggested_model_config.thinking || 'enabled',
        caching: template.suggested_model_config.caching || 'enabled'
      }));
    }
  };

  // 选择大模型配置时
  const handleModelConfigChange = (configId: string) => {
    const config = modelConfigs.find(c => c.id === configId);
    if (config) {
      setFormData(prev => ({
        ...prev,
        model_config_id: configId,
        model: config.default_model || '',
        temperature: config.temperature || 0.3,
        max_tokens: config.max_tokens || 2048,
        thinking: (config.thinking as 'enabled' | 'disabled') || 'disabled',
        caching: (config.caching as 'enabled' | 'disabled') || 'enabled'
      }));
    }
  };

  const handleCreateTemplate = async () => {
    // 验证
    if (!formData.name) {
      alert('请输入模板名称');
      return;
    }
    
    if (formData.agent_type === 'llm') {
      if (!formData.model_config_id) {
        alert('请选择大模型配置');
        return;
      }
      if (!formData.model) {
        alert('请选择模型');
        return;
      }
    }

    try {
      const submitData: Record<string, unknown> = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt,
        agent_type: formData.agent_type,
        is_template: true
      };
      
      if (formData.agent_type === 'llm') {
        submitData.model_config_id = formData.model_config_id;
        submitData.model = formData.model;
        submitData.model_config = {
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          thinking: formData.thinking,
          caching: formData.caching
        };
      }
      
      if (formData.capability_tags.length > 0) {
        submitData.capability_tags = formData.capability_tags;
      }

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        fetchTemplates();
        resetForm();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建模板失败:', error);
      alert('创建失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'developer',
      system_prompt: '',
      agent_type: 'llm',
      model_config_id: '',
      model: '',
      temperature: 0.3,
      max_tokens: 2048,
      thinking: 'enabled',
      caching: 'enabled',
      capability_tags: []
    });
    setSelectedRole('developer');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('确定要删除这个模板吗？')) return;
    
    try {
      const response = await fetch(`/api/agents/${templateId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('删除模板失败:', error);
    }
  };

  // 从模板创建实例
  const handleCreateInstance = (template: Agent) => {
    router.push(`/project-agents?template_id=${template.id}`);
  };

  const getTypeBadge = (type: string) => {
    if (type === 'llm') {
      return <Badge className="bg-blue-500"><Cpu className="h-3 w-3 mr-1" />LLM</Badge>;
    }
    return <Badge className="bg-green-500"><Terminal className="h-3 w-3 mr-1" />进程</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const template = AGENT_ROLE_TEMPLATES.find(t => t.role === role);
    return <Badge variant="outline">{template?.name || role}</Badge>;
  };

  // 获取选中配置的可用模型列表
  const getAvailableModels = () => {
    const config = modelConfigs.find(c => c.id === formData.model_config_id);
    return config?.available_models || [];
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">智能体模板</h1>
          <p className="text-muted-foreground mt-1">
            创建可复用的智能体配置模板，为不同项目快速创建智能体实例
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建模板
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>创建智能体模板</DialogTitle>
              <DialogDescription>
                配置模板的基本信息，后续可基于模板创建实例
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* 智能体类型选择 */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">智能体类型</Label>
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
              </div>

              <Separator />

              {/* LLM配置 */}
              {formData.agent_type === 'llm' && (
                <>
                  {/* 大模型配置选择 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-base font-semibold">
                        <Server className="h-4 w-4" />
                        大模型配置
                      </Label>
                      <Link href="/model-configs" target="_blank">
                        <Button variant="outline" size="sm">
                          管理配置
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                    
                    {loadingConfigs ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : modelConfigs.length === 0 ? (
                      <div className="p-4 border border-dashed rounded-lg text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          暂无大模型配置，请先创建配置
                        </p>
                        <Link href="/model-configs" target="_blank">
                          <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
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
                            onValueChange={handleModelConfigChange}
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

                        {/* 选择模型 */}
                        <div className="space-y-2">
                          <Label>选择模型 *</Label>
                          <Select 
                            value={formData.model} 
                            onValueChange={(v) => setFormData({ ...formData, model: v })}
                            disabled={!formData.model_config_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择模型" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableModels().map(model => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {getAvailableModels().length === 0 && formData.model_config_id && (
                            <p className="text-xs text-muted-foreground">
                              该配置暂无可用模型列表，请手动输入模型名称
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 模型参数配置 */}
                  {formData.model_config_id && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-medium">模型参数（可覆盖配置默认值）</h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Temperature</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={formData.temperature}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              temperature: parseFloat(e.target.value) 
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Tokens</Label>
                          <Input
                            type="number"
                            min="1"
                            value={formData.max_tokens}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              max_tokens: parseInt(e.target.value) 
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>深度思考</Label>
                          <div className="flex items-center h-10">
                            <Switch
                              checked={formData.thinking === 'enabled'}
                              onCheckedChange={(checked) => setFormData({
                                ...formData,
                                thinking: checked ? 'enabled' : 'disabled' 
                              })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>缓存</Label>
                          <div className="flex items-center h-10">
                            <Switch
                              checked={formData.caching === 'enabled'}
                              onCheckedChange={(checked) => setFormData({
                                ...formData,
                                caching: checked ? 'enabled' : 'disabled' 
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 进程配置 */}
              {formData.agent_type === 'process' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    进程配置（将在实例中配置）
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    进程智能体的具体启动命令、参数等将在创建实例时配置
                  </p>
                </div>
              )}

              {/* 基本信息 */}
              <div className="space-y-4">
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
                  <Label>角色选择</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {AGENT_ROLE_TEMPLATES.map((t) => (
                      <Button
                        key={t.role}
                        type="button"
                        variant={selectedRole === t.role ? 'default' : 'outline'}
                        className="h-auto py-2 px-3"
                        onClick={() => handleRoleSelect(t.role)}
                      >
                        <div className="text-center">
                          <div className="text-sm">{t.name}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system_prompt">系统提示词</Label>
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="定义智能体的角色和行为..."
                    rows={6}
                  />
                </div>

                {/* 能力标签 */}
                <div className="space-y-2">
                  <Label>能力标签</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CAPABILITY_TAG_CONFIG) as CapabilityTag[]).map((tag) => (
                      <Badge
                        key={tag}
                        variant={formData.capability_tags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            capability_tags: formData.capability_tags.includes(tag)
                              ? formData.capability_tags.filter(t => t !== tag)
                              : [...formData.capability_tags, tag]
                          });
                        }}
                      >
                        {CAPABILITY_TAG_CONFIG[tag].label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateTemplate}>
                  创建模板
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">暂无模板</p>
            <p className="text-sm text-muted-foreground mb-4">
              创建智能体模板，快速为项目创建智能体实例
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getTypeBadge(template.agent_type)}
                      {getRoleBadge(template.role)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {template.system_prompt || '暂无描述'}
                </p>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleCreateInstance(template)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    创建实例
                  </Button>
                  <Link href={`/agent-templates/${template.id}`} className="flex-1">
                    <Button variant="default" size="sm" className="w-full">
                      <Settings className="h-3 w-3 mr-1" />
                      配置
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
