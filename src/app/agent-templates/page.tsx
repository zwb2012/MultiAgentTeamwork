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
  Key,
  Globe,
  Copy,
  ArrowRight
} from 'lucide-react';
import { 
  AGENT_ROLE_TEMPLATES, 
  SUPPORTED_MODELS, 
  type Agent, 
  type AgentRole, 
  type AgentType,
  type ModelConfig,
  type CapabilityTag,
  CAPABILITY_TAG_CONFIG
} from '@/types/agent';

export default function AgentTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('developer');
  
  // 全局配置
  const [globalConfig, setGlobalConfig] = useState<{
    has_api_key: boolean;
    default_base_url: string;
    default_model: string;
  }>({
    has_api_key: false,
    default_base_url: 'https://api.coze.cn',
    default_model: 'doubao-seed-1-8-251228'
  });
  
  // 是否使用自定义配置
  const [useCustomConfig, setUseCustomConfig] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    agent_type: AgentType;
    // LLM配置
    model: string;
    model_config: ModelConfig;
    // 能力标签
    capability_tags: CapabilityTag[];
  }>({
    name: '',
    role: 'developer',
    system_prompt: '',
    agent_type: 'llm',
    model: 'doubao-seed-1-8-251228',
    model_config: {
      temperature: 0.3,
      thinking: 'enabled',
      caching: 'enabled'
    },
    capability_tags: []
  });

  // 自定义模型配置
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchGlobalConfig();
  }, []);

  const fetchGlobalConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      
      if (result.success) {
        setGlobalConfig({
          has_api_key: !!result.data.llm.default_api_key,
          default_base_url: result.data.llm.default_base_url,
          default_model: result.data.llm.default_model
        });
      }
    } catch (error) {
      console.error('获取全局配置失败:', error);
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
      setFormData({
        ...formData,
        name: template.name,
        role: template.role,
        system_prompt: template.system_prompt,
        agent_type: template.agent_type,
        model: template.suggested_model,
        model_config: template.suggested_model_config
      });
    }
  };

  const handleCreateTemplate = async () => {
    // 验证
    if (!formData.name) {
      alert('请输入模板名称');
      return;
    }
    
    if (formData.agent_type === 'llm') {
      if (!formData.model) {
        alert('请选择大模型');
        return;
      }
      
      if (!useCustomConfig && !globalConfig.has_api_key) {
        alert('请先在全局设置中配置默认API Key，或在此处使用自定义配置');
        return;
      }
      
      if (useCustomConfig && !customApiKey) {
        alert('使用自定义配置时，API Key 必填');
        return;
      }
    }

    try {
      const submitData: any = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt,
        agent_type: formData.agent_type,
        is_template: true
      };
      
      if (formData.agent_type === 'llm') {
        submitData.model = formData.model;
        submitData.model_config = { ...formData.model_config };
        
        if (useCustomConfig) {
          submitData.model_config.api_key = customApiKey;
          if (customModelUrl) {
            submitData.model_config.base_url = customModelUrl;
          }
        }
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
      model: 'doubao-seed-1-8-251228',
      model_config: {
        temperature: 0.3,
        thinking: 'enabled',
        caching: 'enabled'
      },
      capability_tags: []
    });
    setCustomModelUrl('');
    setCustomApiKey('');
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
                  {/* API配置选择 */}
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="font-medium">API 配置</Label>
                        <p className="text-xs text-muted-foreground">
                          {globalConfig.has_api_key 
                            ? '全局配置已设置，可直接使用或覆盖'
                            : '请先配置全局API Key，或使用自定义配置'}
                        </p>
                      </div>
                      {globalConfig.has_api_key && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          全局配置可用
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useCustomConfig}
                        onCheckedChange={setUseCustomConfig}
                      />
                      <Label className="text-sm">使用自定义API配置</Label>
                    </div>
                    
                    {!useCustomConfig && globalConfig.has_api_key && (
                      <div className="text-xs text-muted-foreground p-2 bg-green-50 dark:bg-green-950 rounded">
                        将使用全局配置的 API Key 和 Base URL
                      </div>
                    )}
                    
                    {!useCustomConfig && !globalConfig.has_api_key && (
                      <div className="text-xs text-red-600 p-2 bg-red-50 dark:bg-red-950 rounded">
                        未配置全局 API Key，请先在 
                        <a href="/settings" className="underline">全局设置</a> 
                        中配置，或启用自定义配置
                      </div>
                    )}
                  </div>

                  {/* 自定义API配置 */}
                  {useCustomConfig && (
                    <div className="space-y-4 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                      <h4 className="font-medium flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        自定义 API 配置
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>API Key *</Label>
                          <Input
                            type="password"
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            placeholder="sk-xxx"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Base URL</Label>
                          <Input
                            value={customModelUrl}
                            onChange={(e) => setCustomModelUrl(e.target.value)}
                            placeholder="https://api.coze.cn"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 选择大模型 */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      选择大模型
                    </Label>
                    <Select 
                      value={formData.model} 
                      onValueChange={(value) => setFormData({ ...formData, model: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择大模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 模型参数配置 */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">模型参数</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Temperature</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={formData.model_config.temperature}
                          onChange={(e) => setFormData({
                            ...formData,
                            model_config: { 
                              ...formData.model_config, 
                              temperature: parseFloat(e.target.value) 
                            }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>深度思考</Label>
                        <div className="flex items-center h-10">
                          <Switch
                            checked={formData.model_config.thinking === 'enabled'}
                            onCheckedChange={(checked) => setFormData({
                              ...formData,
                              model_config: { 
                                ...formData.model_config, 
                                thinking: checked ? 'enabled' : 'disabled' 
                              }
                            })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>缓存</Label>
                        <div className="flex items-center h-10">
                          <Switch
                            checked={formData.model_config.caching === 'enabled'}
                            onCheckedChange={(checked) => setFormData({
                              ...formData,
                              model_config: { 
                                ...formData.model_config, 
                                caching: checked ? 'enabled' : 'disabled' 
                              }
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
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
