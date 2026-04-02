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
  RefreshCw,
  MoreVertical,
  Play,
  AlertCircle,
  CheckCircle2,
  Filter,
  Server,
  ArrowRight,
  Loader2,
  Activity
} from 'lucide-react';
import { 
  type Agent, 
  type AgentRole, 
  type AgentType,
  type CapabilityTag,
  CAPABILITY_TAG_CONFIG
} from '@/types/agent';
import type { Project } from '@/types/project';
import type { ModelConfig } from '@/types/model-config';
import type { AgentRoleConfig } from '@/types/agent-role';

export default function ProjectAgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template_id');
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<AgentRoleConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('all');
  
  // 是否从模板创建
  const [createFromTemplate, setCreateFromTemplate] = useState(false);
  
  // 模板原始提示词（用于名称变化时重新替换）
  const [templatePrompt, setTemplatePrompt] = useState<string>('');
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    agent_type: AgentType;
    project_id: string | null;
    template_id: string | null;
    // LLM配置
    model_config_id: string;
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
    model_config_id: '',
    process_command: '',
    process_args: '',
    process_env: '',
    process_platform: 'auto',
    process_auto_restart: false,
    capability_tags: []
  });

  useEffect(() => {
    fetchAgents();
    fetchProjects();
    fetchTemplates();
    fetchRoleConfigs();
    
    // 如果有模板ID参数，打开创建对话框
    if (templateId) {
      setCreateFromTemplate(true);
      loadTemplate(templateId);
      setIsCreateDialogOpen(true);
    }
  }, [templateId]);

  useEffect(() => {
    if (isCreateDialogOpen && formData.agent_type === 'llm') {
      fetchModelConfigs();
    }
  }, [isCreateDialogOpen, formData.agent_type]);

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
      setLoadingConfigs(true);
      const response = await fetch('/api/model-configs');
      const result = await response.json();
      
      if (result.success) {
        setModelConfigs(result.data || []);
        // 默认选择第一个配置
        if (result.data?.length > 0 && !formData.model_config_id) {
          setFormData(prev => ({
            ...prev,
            model_config_id: result.data[0].id
          }));
        }
      }
    } catch (error) {
      console.error('获取大模型配置失败:', error);
    } finally {
      setLoadingConfigs(false);
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
        // 生成实例名称（去掉可能的"(实例)"后缀，重新添加）
        const instanceName = template.name.replace(/\s*\(实例\)$/, '').replace(/\s*\(模板\)$/, '');
        const finalName = `${instanceName}`;
        
        // 存储模板原始提示词（包含 {name} 占位符）
        const originalPrompt = template.system_prompt || '';
        setTemplatePrompt(originalPrompt);
        
        // 替换系统提示词中的 {name} 变量为实际名称
        const systemPrompt = originalPrompt.replace(/{name}/g, finalName);
        
        setFormData(prev => ({
          ...prev,
          name: finalName,
          role: template.role,
          system_prompt: systemPrompt,
          agent_type: template.agent_type,
          template_id: template.id,
          model_config_id: template.model_config_id || '',
          capability_tags: template.capability_tags || []
        }));
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
      if (!formData.model_config_id) {
        alert('请选择大模型配置');
        return;
      }
    }
    
    if (formData.agent_type === 'process' && !formData.process_command) {
      alert('请输入启动命令');
      return;
    }

    try {
      const submitData: Record<string, unknown> = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt,
        agent_type: formData.agent_type,
        is_template: false,
        project_id: formData.project_id,
        template_id: formData.template_id
      };
      
      if (formData.agent_type === 'llm') {
        submitData.model_config_id = formData.model_config_id;
        // 获取选中的配置信息
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
      model_config_id: '',
      process_command: '',
      process_args: '',
      process_env: '',
      process_platform: 'auto',
      process_auto_restart: false,
      capability_tags: []
    });
    setCreateFromTemplate(false);
    setTemplatePrompt(''); // 清空模板原始提示词
  };

  // 根据角色生成默认提示词（使用从API获取的角色配置）
  const generateDefaultPrompt = (roleKey: string, agentName: string): string => {
    const roleConfig = roleConfigs.find(r => r.role_key === roleKey);
    if (roleConfig) {
      // 如果没有提供名称，保留 {name} 占位符，让用户输入名称后替换
      if (!agentName) {
        return roleConfig.system_prompt_template;
      }
      return roleConfig.system_prompt_template.replace(/{name}/g, agentName);
    }
    // 如果没有找到角色配置，返回基本提示词
    return `你是一个智能助手，名字叫${agentName || '{name}'}。请根据具体任务提供专业的帮助。`;
  };

  // 处理角色变化
  const handleRoleChange = (roleKey: string) => {
    const roleConfig = roleConfigs.find(r => r.role_key === roleKey);
    // 使用当前输入的名称生成提示词，如果没有则保留 {name} 占位符
    const defaultPrompt = generateDefaultPrompt(roleKey, formData.name);
    setFormData(prev => ({
      ...prev,
      role: roleKey as AgentRole,
      system_prompt: defaultPrompt,
      agent_type: (roleConfig?.suggested_agent_type as AgentType) || 'llm'
    }));
  };

  // 处理名称变化（同步更新提示词中的{name}）
  const handleNameChange = (name: string) => {
    // 如果是从模板创建，使用模板的原始提示词
    if (createFromTemplate && templatePrompt) {
      const newPrompt = templatePrompt.replace(/{name}/g, name || '{name}');
      setFormData(prev => ({
        ...prev,
        name,
        system_prompt: newPrompt
      }));
      return;
    }
    
    // 否则使用角色配置的提示词模板
    const roleConfig = roleConfigs.find(r => r.role_key === formData.role);
    
    if (roleConfig) {
      // 根据角色配置重新生成提示词，使用新名称
      const newPrompt = roleConfig.system_prompt_template.replace(/{name}/g, name || '{name}');
      
      setFormData(prev => ({
        ...prev,
        name,
        system_prompt: newPrompt
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        name
      }));
    }
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

  // 健康检查结果弹窗
  const [healthCheckResult, setHealthCheckResult] = useState<{
    agentName: string;
    result: {
      online: boolean;
      message: string;
      details?: string;
      latency?: number;
      checked_at?: string;
    } | null;
  } | null>(null);

  // 一键健康检测状态
  const [batchChecking, setBatchChecking] = useState(false);
  const [batchCheckResult, setBatchCheckResult] = useState<{
    total: number;
    healthy: number;
    unhealthy: number;
  } | null>(null);

  // 健康检查
  const handleHealthCheck = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    
    try {
      const response = await fetch(`/api/agents/${agentId}/health-check`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchAgents();
        // 显示检查结果
        setHealthCheckResult({
          agentName: agent?.name || '智能体',
          result: result.data
        });
      } else {
        setHealthCheckResult({
          agentName: agent?.name || '智能体',
          result: {
            online: false,
            message: result.error || '检查失败'
          }
        });
      }
    } catch (error) {
      console.error('健康检查失败:', error);
      setHealthCheckResult({
        agentName: agent?.name || '智能体',
        result: {
          online: false,
          message: '网络请求失败',
          details: '请检查网络连接'
        }
      });
    }
  };

  // 一键健康检测 - 检测当前页面的所有智能体
  const handleBatchHealthCheck = async () => {
    if (filteredAgents.length === 0) {
      alert('没有可检测的智能体');
      return;
    }

    setBatchChecking(true);
    setBatchCheckResult(null);

    try {
      let healthy = 0;
      let unhealthy = 0;

      // 逐个检测智能体
      for (const agent of filteredAgents) {
        try {
          const response = await fetch(`/api/agents/${agent.id}/health-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ check_type: 'manual' })
          });
          
          const result = await response.json();
          if (result.success && result.data?.online) {
            healthy++;
          } else {
            unhealthy++;
          }
        } catch {
          unhealthy++;
        }
      }

      setBatchCheckResult({
        total: filteredAgents.length,
        healthy,
        unhealthy
      });

      // 刷新智能体列表
      fetchAgents();
    } catch (error) {
      console.error('批量健康检测失败:', error);
      alert('批量健康检测失败');
    } finally {
      setBatchChecking(false);
    }
  };

  // 筛选智能体
  const filteredAgents = agents.filter(agent => {
    if (filterProject === 'all') return true;
    if (filterProject === 'global') return !agent.project_id;
    return agent.project_id === filterProject;
  });

  // 健康状态显示
  const getHealthBadge = (onlineStatus: string) => {
    const statusMap: Record<string, { label: string; className: string; pulse?: boolean }> = {
      online: { label: '健康', className: 'bg-green-500' },
      offline: { label: '异常', className: 'bg-red-500' },
      checking: { label: '检测中', className: 'bg-yellow-500', pulse: true },
      unknown: { label: '未检测', className: 'bg-gray-400' }
    };
    const config = statusMap[onlineStatus] || statusMap.unknown;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs ${config.className}`}>
        <span className={`w-1.5 h-1.5 rounded-full bg-white ${config.pulse ? 'animate-pulse' : ''}`}></span>
        {config.label}
      </span>
    );
  };

  // 兼容旧调用
  const getOnlineBadge = getHealthBadge;

  const getWorkStatusBadge = (workStatus: string) => {
    const statusMap: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
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

  const getRoleBadge = (roleKey: string) => {
    const roleConfig = roleConfigs.find(r => r.role_key === roleKey);
    return <Badge variant="outline">{roleConfig?.name || roleKey}</Badge>;
  };

  const getProjectName = (projectId: string | null | undefined) => {
    if (!projectId) return '全局智能体';
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
  };

  // 获取选中配置的信息
  const getSelectedConfigInfo = () => {
    return modelConfigs.find(c => c.id === formData.model_config_id);
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
        
        <div className="flex items-center gap-3">
          {/* 一键健康检测结果统计 */}
          {batchCheckResult && (
            <div className="flex items-center gap-4 px-4 py-2 bg-muted rounded-lg text-sm">
              <span className="text-muted-foreground">检测结果:</span>
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                健康 {batchCheckResult.healthy}
              </span>
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                异常 {batchCheckResult.unhealthy}
              </span>
            </div>
          )}
          
          <Button 
            variant="outline" 
            onClick={handleBatchHealthCheck}
            disabled={batchChecking || filteredAgents.length === 0}
          >
            {batchChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                检测中...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                一键检测
              </>
            )}
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (open && !createFromTemplate && !formData.system_prompt) {
              // 打开对话框时，如果不在模板模式且没有提示词，自动填充默认提示词
              const defaultPrompt = generateDefaultPrompt(formData.role, formData.name);
              setFormData(prev => ({ ...prev, system_prompt: defaultPrompt }));
            }
          }}>
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
                      // 关闭模板模式时，重置表单并填充默认提示词
                      const defaultPrompt = generateDefaultPrompt(formData.role, formData.name);
                      setFormData(prev => ({
                        ...prev,
                        template_id: null,
                        system_prompt: prev.system_prompt || defaultPrompt
                      }));
                    }
                  }}
                />
              </div>
              
              {/* 选择模板 */}
              {createFromTemplate && (
                <div className="space-y-2">
                  <Label>选择模板</Label>
                  {templates.length === 0 ? (
                    <div className="p-4 border border-dashed rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        暂无可用模板
                      </p>
                      <Link href="/agent-templates" target="_blank">
                        <Button variant="outline" size="sm">
                          去创建模板
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
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
                  )}
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
                            onValueChange={(v) => setFormData({ ...formData, model_config_id: v })}
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

                        {/* 显示选中配置的详情 */}
                        {getSelectedConfigInfo() && (
                          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                              <CheckCircle2 className="h-4 w-4" />
                              已选择配置，将使用以下设置
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              {getSelectedConfigInfo()?.default_model && (
                                <div>默认模型: <span className="text-foreground">{getSelectedConfigInfo()?.default_model}</span></div>
                              )}
                              {getSelectedConfigInfo()?.temperature !== null && getSelectedConfigInfo()?.temperature !== undefined && (
                                <div>Temperature: <span className="text-foreground">{getSelectedConfigInfo()?.temperature}</span></div>
                              )}
                              {getSelectedConfigInfo()?.max_tokens && (
                                <div>Max Tokens: <span className="text-foreground">{getSelectedConfigInfo()?.max_tokens}</span></div>
                              )}
                              <div>Thinking: <span className="text-foreground">{getSelectedConfigInfo()?.thinking || 'disabled'}</span></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
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
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="例如：开发工程师、代码审核员"
                  />
                  <p className="text-xs text-muted-foreground">
                    智能体会通过这个名字识别自己
                  </p>
                </div>

                {/* 角色选择（仅在不使用模板时显示） */}
                {!createFromTemplate && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>角色类型</Label>
                      <Link href="/agent-roles" target="_blank">
                        <Button variant="ghost" size="sm" className="text-xs h-6">
                          管理角色
                        </Button>
                      </Link>
                    </div>
                    {roleConfigs.length === 0 ? (
                      <div className="p-4 border border-dashed rounded-lg text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          暂无角色配置
                        </p>
                        <Link href="/agent-roles" target="_blank">
                          <Button variant="outline" size="sm">
                            去初始化角色
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <Select
                        value={formData.role}
                        onValueChange={(value) => handleRoleChange(value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择角色类型" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {roleConfigs.filter(r => r.is_active).map(role => (
                            <SelectItem key={role.role_key} value={role.role_key} className="py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{role.name}</span>
                                {role.description && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {role.description}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      选择角色后会自动填充对应的默认提示词
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="system_prompt">系统提示词</Label>
                    {!createFromTemplate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => {
                          const defaultPrompt = generateDefaultPrompt(formData.role, formData.name);
                          setFormData(prev => ({ ...prev, system_prompt: defaultPrompt }));
                        }}
                      >
                        重置为默认
                      </Button>
                    )}
                  </div>
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
      
      {/* 健康检查结果弹窗 */}
      <Dialog open={!!healthCheckResult} onOpenChange={() => setHealthCheckResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {healthCheckResult?.result?.online ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              健康检查结果
            </DialogTitle>
            <DialogDescription>
              {healthCheckResult?.agentName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm font-medium">状态</span>
              {healthCheckResult?.result?.online ? (
                <Badge className="bg-green-500">在线</Badge>
              ) : (
                <Badge className="bg-red-500">离线</Badge>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">消息</div>
              <p className="text-sm">{healthCheckResult?.result?.message}</p>
            </div>
            
            {healthCheckResult?.result?.details && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">详情</div>
                <p className="text-sm p-3 bg-muted rounded-lg">{healthCheckResult.result.details}</p>
              </div>
            )}
            
            {healthCheckResult?.result?.latency && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">延迟</span>
                <span>{healthCheckResult.result.latency}ms</span>
              </div>
            )}
            
            {healthCheckResult?.result?.checked_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">检查时间</span>
                <span>{new Date(healthCheckResult.result.checked_at).toLocaleString('zh-CN')}</span>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setHealthCheckResult(null)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
