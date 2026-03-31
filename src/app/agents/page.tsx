'use client';

import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  Settings,
  Cpu,
  Terminal,
  Key,
  Globe
} from 'lucide-react';
import { 
  AGENT_ROLE_TEMPLATES, 
  SUPPORTED_MODELS, 
  type Agent, 
  type AgentRole, 
  type AgentType,
  type ModelConfig,
  type ProcessConfig 
} from '@/types/agent';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('developer');
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    agent_type: AgentType;
    // LLM配置
    model: string;
    model_config: ModelConfig;
    // 进程配置
    process_config: ProcessConfig;
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
    process_config: {
      command: '',
      args: [],
      env: {},
      platform: 'auto',
      auto_restart: false
    }
  });

  // 自定义模型配置
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [processCommand, setProcessCommand] = useState('');
  const [processArgs, setProcessArgs] = useState('');
  const [processEnv, setProcessEnv] = useState('');

  useEffect(() => {
    fetchAgents();
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

  const handleCreateAgent = async () => {
    // 验证
    if (!formData.name) {
      alert('请输入智能体名称');
      return;
    }
    
    if (formData.agent_type === 'llm' && !formData.model) {
      alert('请选择大模型');
      return;
    }
    
    if (formData.agent_type === 'process' && !processCommand) {
      alert('请输入启动命令');
      return;
    }

    try {
      const submitData: any = {
        name: formData.name,
        role: formData.role,
        system_prompt: formData.system_prompt,
        agent_type: formData.agent_type
      };
      
      if (formData.agent_type === 'llm') {
        submitData.model = formData.model;
        submitData.model_config = { ...formData.model_config };
        
        // 自定义模型配置
        if (formData.model === 'custom') {
          submitData.model = 'custom';
          submitData.model_config.base_url = customModelUrl;
          submitData.model_config.api_key = customApiKey;
        }
      }
      
      if (formData.agent_type === 'process') {
        submitData.process_config = {
          command: processCommand,
          args: processArgs ? processArgs.split(' ') : [],
          env: processEnv ? JSON.parse(processEnv) : {},
          platform: formData.process_config.platform,
          auto_restart: formData.process_config.auto_restart
        };
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
      model: 'doubao-seed-1-8-251228',
      model_config: {
        temperature: 0.3,
        thinking: 'enabled',
        caching: 'enabled'
      },
      process_config: {
        command: '',
        args: [],
        env: {},
        platform: 'auto',
        auto_restart: false
      }
    });
    setCustomModelUrl('');
    setCustomApiKey('');
    setProcessCommand('');
    setProcessArgs('');
    setProcessEnv('');
  };

  const handleUpdateStatus = async (agentId: string, status: 'idle' | 'working' | 'paused') => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchAgents();
      }
    } catch (error) {
      console.error('更新状态失败:', error);
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      idle: { label: '空闲', variant: 'secondary' },
      working: { label: '工作中', variant: 'default' },
      paused: { label: '已暂停', variant: 'outline' },
      error: { label: '错误', variant: 'destructive' }
    };
    const config = statusMap[status] || statusMap.idle;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const template = AGENT_ROLE_TEMPLATES.find(t => t.role === role);
    return <Badge variant="outline">{template?.name || role}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'llm') {
      return <Badge className="bg-blue-500"><Cpu className="h-3 w-3 mr-1" />LLM</Badge>;
    }
    return <Badge className="bg-green-500"><Terminal className="h-3 w-3 mr-1" />进程</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            <h1 className="text-xl font-bold">智能体管理</h1>
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
                <DialogTitle>创建智能体</DialogTitle>
                <DialogDescription>
                  配置智能体的类型、模型和角色
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

                    {/* 自定义模型配置 */}
                    {formData.model === 'custom' && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                        <h4 className="font-medium flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          自定义模型配置
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              API Base URL
                            </Label>
                            <Input
                              value={customModelUrl}
                              onChange={(e) => setCustomModelUrl(e.target.value)}
                              placeholder="https://api.example.com/v1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              API Key
                            </Label>
                            <Input
                              type="password"
                              value={customApiKey}
                              onChange={(e) => setCustomApiKey(e.target.value)}
                              placeholder="sk-xxx"
                            />
                          </div>
                        </div>
                      </div>
                    )}

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
                          value={processCommand}
                          onChange={(e) => setProcessCommand(e.target.value)}
                          placeholder="例如: python, node, ./start.sh"
                        />
                        <p className="text-xs text-muted-foreground">
                          输入可执行命令，如 python、node、./script.sh 等
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>命令参数</Label>
                        <Input
                          value={processArgs}
                          onChange={(e) => setProcessArgs(e.target.value)}
                          placeholder="例如: app.py --port 3000"
                        />
                        <p className="text-xs text-muted-foreground">
                          空格分隔的参数列表
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>环境变量 (JSON格式)</Label>
                        <Textarea
                          value={processEnv}
                          onChange={(e) => setProcessEnv(e.target.value)}
                          placeholder='{"PORT": "3000", "NODE_ENV": "development"}'
                          rows={3}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>平台</Label>
                          <Select 
                            value={formData.process_config.platform} 
                            onValueChange={(value: any) => setFormData({
                              ...formData,
                              process_config: { ...formData.process_config, platform: value }
                            })}
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
                              checked={formData.process_config.auto_restart}
                              onCheckedChange={(checked) => setFormData({
                                ...formData,
                                process_config: { 
                                  ...formData.process_config, 
                                  auto_restart: checked 
                                }
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* 角色模板选择 */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">选择角色模板</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {AGENT_ROLE_TEMPLATES.map(template => (
                      <Card 
                        key={template.role}
                        className={`cursor-pointer transition-all ${
                          selectedRole === template.role 
                            ? 'border-primary shadow-md' 
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => handleRoleSelect(template.role)}
                      >
                        <CardHeader className="p-3">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <CardDescription className="text-xs line-clamp-2">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 基本信息配置 */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>智能体名称 *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="给智能体起个名字，它会通过这个名字识别自己"
                    />
                    <p className="text-xs text-muted-foreground">
                      重要：智能体会通过这个名字识别自己，对话时直接叫这个名字即可唤起它
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>系统提示词</Label>
                    <Textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      rows={8}
                      placeholder="定义智能体的角色和行为，使用{name}作为名字占位符"
                    />
                    <p className="text-xs text-muted-foreground">
                      提示词中的 {'{name}'} 会被替换为智能体名称
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}>
                  取消
                </Button>
                <Button onClick={handleCreateAgent}>
                  创建智能体
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{agents.length} 个智能体</Badge>
            <Badge variant="outline">
              {agents.filter(a => a.agent_type === 'llm').length} LLM
            </Badge>
            <Badge variant="outline">
              {agents.filter(a => a.agent_type === 'process').length} 进程
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAgents}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {getTypeBadge(agent.agent_type)}
                      {getRoleBadge(agent.role)}
                      {getStatusBadge(agent.status)}
                    </div>
                  </div>
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {agent.system_prompt.substring(0, 100)}...
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  {agent.agent_type === 'llm' ? (
                    <span>模型: {agent.model?.split('-').slice(0, 2).join(' ')}</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Terminal className="h-3 w-3" />
                      {agent.process_config?.command}
                    </span>
                  )}
                  <span>
                    {new Date(agent.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {agent.status === 'idle' && (
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleUpdateStatus(agent.id, 'working')}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      启动
                    </Button>
                  )}
                  {agent.status === 'working' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUpdateStatus(agent.id, 'paused')}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      暂停
                    </Button>
                  )}
                  {agent.status === 'paused' && (
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleUpdateStatus(agent.id, 'working')}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      继续
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleUpdateStatus(agent.id, 'idle')}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    重置
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDeleteAgent(agent.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {agents.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">还没有创建智能体</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个智能体
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
