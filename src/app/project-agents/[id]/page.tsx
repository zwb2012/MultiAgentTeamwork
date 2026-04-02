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
import { Separator } from '@/components/ui/separator';
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
import type { Project } from '@/types/project';
import type { ModelConfig } from '@/types/model-config';
import type { AgentRoleConfig } from '@/types/agent-role';

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
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
    project_id: string | null;
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
    model_config_id: '',
    process_command: '',
    process_args: '',
    process_env: '',
    process_platform: 'auto',
    process_auto_restart: false,
    capability_tags: []
  });

  useEffect(() => {
    fetchAgent();
    fetchProjects();
    fetchRoleConfigs();
  }, [agentId]);

  useEffect(() => {
    if (formData.agent_type === 'llm') {
      fetchModelConfigs();
    }
  }, [formData.agent_type]);

  const fetchAgent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${agentId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const agentData = result.data;
        setAgent(agentData);
        setFormData({
          name: agentData.name,
          role: agentData.role,
          system_prompt: agentData.system_prompt,
          agent_type: agentData.agent_type,
          project_id: agentData.project_id,
          model_config_id: agentData.model_config_id || '',
          process_command: agentData.process_config?.command || '',
          process_args: agentData.process_config?.args?.join(' ') || '',
          process_env: agentData.process_config?.env ? JSON.stringify(agentData.process_config.env) : '',
          process_platform: agentData.process_config?.platform || 'auto',
          process_auto_restart: agentData.process_config?.auto_restart || false,
          capability_tags: agentData.capability_tags || []
        });
      } else {
        alert('智能体不存在');
        router.push('/project-agents');
      }
    } catch (error) {
      console.error('获取智能体失败:', error);
      alert('获取智能体失败');
      router.push('/project-agents');
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

  // 根据角色生成默认提示词
  const generateDefaultPrompt = (roleKey: string, agentName: string): string => {
    const roleConfig = roleConfigs.find(r => r.role_key === roleKey);
    if (roleConfig) {
      if (!agentName) {
        return roleConfig.system_prompt_template;
      }
      return roleConfig.system_prompt_template.replace(/{name}/g, agentName);
    }
    return `你是一个智能助手，名字叫${agentName || '{name}'}。请根据具体任务提供专业的帮助。`;
  };

  // 处理角色变化
  const handleRoleChange = (roleKey: string) => {
    const roleConfig = roleConfigs.find(r => r.role_key === roleKey);
    const defaultPrompt = generateDefaultPrompt(roleKey, formData.name);
    setFormData(prev => ({
      ...prev,
      role: roleKey as AgentRole,
      system_prompt: defaultPrompt,
      agent_type: (roleConfig?.suggested_agent_type as AgentType) || 'llm'
    }));
  };

  // 处理名称变化
  const handleNameChange = (name: string) => {
    const roleConfig = roleConfigs.find(r => r.role_key === formData.role);
    
    if (roleConfig) {
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

  const handleSave = async () => {
    // 验证
    if (!formData.name) {
      alert('请输入智能体名称');
      return;
    }
    
    if (formData.agent_type === 'llm' && !formData.model_config_id) {
      alert('请选择大模型配置');
      return;
    }
    
    if (formData.agent_type === 'process' && !formData.process_command) {
      alert('请输入启动命令');
      return;
    }

    try {
      setSaving(true);
      const submitData: Record<string, unknown> = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt,
        agent_type: formData.agent_type,
        project_id: formData.project_id
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

      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('保存成功');
        router.push('/project-agents');
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存智能体失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const getProjectName = (projectId: string | null | undefined) => {
    if (!projectId) return '全局智能体';
    const project = projects.find(p => p.id === projectId);
    return project?.name || '未知项目';
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

  if (!agent) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>智能体不存在</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/project-agents">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">编辑智能体</h1>
          <p className="text-muted-foreground">
            修改智能体 {agent.name} 的配置
          </p>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本信息</CardTitle>
          <CardDescription>智能体的基本配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">智能体名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="输入智能体名称"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">角色</Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roleConfigs.map(role => (
                    <SelectItem key={role.role_key} value={role.role_key}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">所属项目</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="system_prompt">系统提示词</Label>
            <Textarea
              id="system_prompt"
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="智能体的系统提示词"
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              {'{name}'} 会被替换为智能体名称
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
                  <CardTitle className="text-sm">进程智能体</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  本地进程智能体
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

      {/* 进程配置 */}
      {formData.agent_type === 'process' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">进程配置</CardTitle>
            <CardDescription>本地进程智能体的启动配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="process_command">启动命令 *</Label>
              <Input
                id="process_command"
                value={formData.process_command}
                onChange={(e) => setFormData({ ...formData, process_command: e.target.value })}
                placeholder="例如：python server.py"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="process_args">启动参数</Label>
              <Input
                id="process_args"
                value={formData.process_args}
                onChange={(e) => setFormData({ ...formData, process_args: e.target.value })}
                placeholder="参数用空格分隔"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="process_env">环境变量 (JSON格式)</Label>
              <Textarea
                id="process_env"
                value={formData.process_env}
                onChange={(e) => setFormData({ ...formData, process_env: e.target.value })}
                placeholder='{"API_KEY": "xxx", "DEBUG": "true"}'
                rows={3}
              />
            </div>
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
          <Link href="/project-agents">取消</Link>
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
