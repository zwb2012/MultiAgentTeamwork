'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Bot, 
  Plus, 
  Trash2, 
  Settings,
  Cpu,
  Terminal,
  Key,
  Globe,
  RefreshCw,
  MoreVertical,
  Wifi,
  WifiOff,
  HelpCircle,
  Play,
  AlertCircle,
  CheckCircle2,
  Filter
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
import type { Project } from '@/types/project';

export default function ProjectAgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template_id');
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('all');
  
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
  // 是否从模板创建
  const [createFromTemplate, setCreateFromTemplate] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    agent_type: AgentType;
    project_id: string | null;
    template_id: string | null;
    // LLM配置
    model: string;
    model_config: ModelConfig;
    // 进程配置
    process_command: string;
    process_args: string;
    process_env: string;
    process_platform: string;
    process_auto_restart: boolean;
    // 能力标签
    capability_tags: CapabilityTag[];
  }>({
    name: '',
    role: 'developer',
    system_prompt: '',
    agent_type: 'llm',
    project_id: null,
    template_id: null,
    model: 'doubao-seed-1-8-251228',
    model_config: {
      temperature: 0.3,
      thinking: 'enabled',
      caching: 'enabled'
    },
    process_command: '',
    process_args: '',
    process_env: '',
    process_platform: 'auto',
    process_auto_restart: false,
    capability_tags: []
  });

  // 自定义模型配置
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

  useEffect(() => {
    fetchAgents();
    fetchProjects();
    fetchTemplates();
    fetchGlobalConfig();
    
    // 如果有模板ID参数，打开创建对话框
    if (templateId) {
      setCreateFromTemplate(true);
      loadTemplate(templateId);
      setIsCreateDialogOpen(true);
    }
  }, [templateId]);

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

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/agents?is_template=true');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('获取模板列表失败:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      let url = '/api/agents?is_template=false';
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  const loadTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const template = result.data;
        setFormData({
          ...formData,
          name: template.name + ' (实例)',
          role: template.role,
          system_prompt: template.system_prompt,
          agent_type: template.agent_type,
          template_id: template.id,
          model: template.model || 'doubao-seed-1-8-251228',
          model_config: template.model_config || formData.model_config,
          capability_tags: template.capability_tags || []
        });
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  };

  const handleCreateAgent = async () => {
    // 验证
    if (!formData.name) {
      alert('请输入智能体名称');
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
    
    if (formData.agent_type === 'process' && !formData.process_command) {
      alert('请输入启动命令');
      return;
    }

    try {
      const submitData: any = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt,
        agent_type: formData.agent_type,
        is_template: false,
        project_id: formData.project_id,
        template_id: formData.template_id
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
      
      if (formData.agent_type === 'process') {
        submitData.process_config = {
          command: formData.process_command,
          args: formData.process_args ? formData.process_args.split(' ') : [],
          env: formData.process_env ? JSON.parse(formData.process_env) : {},
          platform: formData.process_platform,
          auto_restart: formData.process_auto_restart
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
        fetchAgents();
        resetForm();
        // 清除URL参数
        router.replace('/project-agents');
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建智能体失败:', error);
      alert('创建失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'developer',
      system_prompt: '',
      agent_type: 'llm',
      project_id: null,
      template_id: null,
      model: 'doubao-seed-1-8-251228',
      model_config: {
        temperature: 0.3,
        thinking: 'enabled',
        caching: 'enabled'
      },
      process_command: '',
      process_args: '',
      process_env: '',
      process_platform: 'auto',
      process_auto_restart: false,
      capability_tags: []
    });
    setCustomModelUrl('');
    setCustomApiKey('');
    setCreateFromTemplate(false);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('确定要删除这个智能体吗？')) return;
    
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchAgents();
      }
    } catch (error) {
      console.error('删除智能体失败:', error);
    }
  };

  // 健康检查
  const handleHealthCheck = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/health-check`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchAgents();
      } else {
        alert('健康检查失败: ' + result.error);
      }
    } catch (error) {
      console.error('健康检查失败:', error);
      alert('健康检查失败');
    }
  };

  // 筛选智能体
  const filteredAgents = agents.filter(agent => {
    if (filterProject === 'all') return true;
    if (filterProject === 'global') return !agent.project_id;
    return agent.project_id === filterProject;
  });

  // 在线状态显示
  const getOnlineBadge = (onlineStatus: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      online: { label: '在线', className: 'bg-green-500' },
      offline: { label: '离线', className: 'bg-red-500' },
      checking: { label: '检测中', className: 'bg-yellow-500' },
      unknown: { label: '未检测', className: 'bg-gray-400' }
    };
    const config = statusMap[onlineStatus] || statusMap.unknown;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${config.className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
        {config.label}
      </span>
    );
  };

  const getWorkStatusBadge = (workStatus: string) => {
    const statusMap: Record<string, { label: string; className: string; icon: any }> = {
      idle: { label: '空闲', className: 'bg-gray-100 text-gray-700', icon: CheckCircle2 },
      working: { label: '工作中', className: 'bg-blue-100 text-blue-700', icon: Play },
      error: { label: '异常', className: 'bg-red-100 text-red-700', icon: AlertCircle }
    };
    const config = statusMap[workStatus] || statusMap.idle;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
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

  const getProjectName = (projectId: string | null | undefined) => {
    if (!projectId) return '全局智能体';
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">项目智能体</h1>
          <p className="text-muted-foreground mt-1">
            管理项目中的智能体实例，监控在线状态和工作状态
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建智能体
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>创建项目智能体</DialogTitle>
              <DialogDescription>
                创建一个智能体实例，可以绑定到特定项目或作为全局智能体
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* 从模板创建 */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="font-medium">从模板创建</Label>
                  <p className="text-xs text-muted-foreground">
                    选择已有模板快速创建智能体
                  </p>
                </div>
                <Switch
                  checked={createFromTemplate}
                  onCheckedChange={(checked) => {
                    setCreateFromTemplate(checked);
                    if (!checked) {
                      setFormData({ ...formData, template_id: null });
                    }
                  }}
                />
              </div>
              
              {/* 选择模板 */}
              {createFromTemplate && templates.length > 0 && (
                <div className="space-y-2">
                  <Label>选择模板</Label>
                  <Select
                    value={formData.template_id || ''}
                    onValueChange={(value) => {
                      if (value) loadTemplate(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模板" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.agent_type === 'llm' ? 'LLM' : '进程'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* 项目选择 */}
              <div className="space-y-2">
                <Label className="font-medium">所属项目</Label>
                <Select
                  value={formData.project_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, project_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不绑定项目（全局智能体）</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  绑定项目后，智能体将专注于该项目的工作，记忆与项目隔离
                </p>
              </div>

              {/* 智能体类型选择 */}
              {!createFromTemplate && (
                <>
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
                </>
              )}

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
                    进程配置
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>启动命令 *</Label>
                      <Input
                        value={formData.process_command}
                        onChange={(e) => setFormData({ ...formData, process_command: e.target.value })}
                        placeholder="例如: python, node, ./start.sh"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>命令参数</Label>
                      <Input
                        value={formData.process_args}
                        onChange={(e) => setFormData({ ...formData, process_args: e.target.value })}
                        placeholder="例如: app.py --port 3000"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>环境变量 (JSON格式)</Label>
                      <Textarea
                        value={formData.process_env}
                        onChange={(e) => setFormData({ ...formData, process_env: e.target.value })}
                        placeholder='{"PORT": "3000", "NODE_ENV": "development"}'
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>平台</Label>
                        <Select 
                          value={formData.process_platform} 
                          onValueChange={(value) => setFormData({ ...formData, process_platform: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">自动检测</SelectItem>
                            <SelectItem value="linux">Linux</SelectItem>
                            <SelectItem value="windows">Windows</SelectItem>
                            <SelectItem value="macos">macOS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>自动重启</Label>
                        <div className="flex items-center h-10">
                          <Switch
                            checked={formData.process_auto_restart}
                            onCheckedChange={(checked) => setFormData({ 
                              ...formData, 
                              process_auto_restart: checked 
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">智能体名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：开发工程师、代码审核员"
                  />
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
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateAgent}>
                  创建智能体
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="按项目筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部智能体</SelectItem>
            <SelectItem value="global">全局智能体</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline">{filteredAgents.length} 个智能体</Badge>
      </div>

      {/* 智能体列表 */}
      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">暂无智能体</p>
            <p className="text-sm text-muted-foreground mb-4">
              创建智能体实例来开始工作
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个智能体
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTypeBadge(agent.agent_type)}
                      {getRoleBadge(agent.role)}
                      {getOnlineBadge(agent.online_status || 'unknown')}
                      {agent.work_status && getWorkStatusBadge(agent.work_status)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleHealthCheck(agent.id)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        健康检查
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/project-agents/${agent.id}`}>
                          <Settings className="h-4 w-4 mr-2" />
                          配置
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteAgent(agent.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>所属项目:</span>
                    <span className="font-medium text-foreground">{getProjectName(agent.project_id)}</span>
                  </div>
                  {agent.agent_type === 'llm' && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>模型:</span>
                      <span className="font-medium text-foreground">{agent.model || '-'}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2 mt-4">
                  {agent.system_prompt || '暂无描述'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
