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
import { 
  Bot, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Edit,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { AGENT_ROLE_TEMPLATES, type Agent, type AgentRole, type AgentConfig } from '@/types/agent';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('developer');
  const [formData, setFormData] = useState<{
    name: string;
    role: AgentRole;
    system_prompt: string;
    model: string;
    config: AgentConfig;
  }>({
    name: '',
    role: 'developer',
    system_prompt: '',
    model: 'doubao-seed-1-8-251228',
    config: {
      temperature: 0.3,
      thinking: 'enabled',
      caching: 'enabled'
    }
  });

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
        name: template.name,
        role: template.role,
        system_prompt: template.system_prompt,
        model: template.suggested_model,
        config: template.suggested_config
      });
    }
  };

  const handleCreateAgent = async () => {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        fetchAgents();
        // 重置表单
        setFormData({
          name: '',
          role: 'developer',
          system_prompt: '',
          model: 'doubao-seed-1-8-251228',
          config: {
            temperature: 0.3,
            thinking: 'enabled',
            caching: 'enabled'
          }
        });
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建智能体失败:', error);
      alert('创建失败');
    }
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
      paused: { label: '已暂停', variant: 'outline' }
    };
    const config = statusMap[status] || statusMap.idle;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const template = AGENT_ROLE_TEMPLATES.find(t => t.role === role);
    return <Badge variant="outline">{template?.name || role}</Badge>;
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>创建智能体</DialogTitle>
                <DialogDescription>
                  选择预设角色或自定义创建智能体
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="template" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="template">角色模板</TabsTrigger>
                  <TabsTrigger value="custom">自定义</TabsTrigger>
                </TabsList>
                
                <TabsContent value="template" className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
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
                        <CardHeader className="p-4">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>智能体名称</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="给智能体起个名字"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>系统提示词</Label>
                    <Textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      rows={8}
                      placeholder="定义智能体的角色和行为"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <Select 
                        value={formData.model} 
                        onValueChange={(value) => setFormData({ ...formData, model: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="doubao-seed-1-8-251228">Doubao Seed 1.8 (推荐)</SelectItem>
                          <SelectItem value="doubao-seed-2-0-pro-260215">Doubao Seed 2.0 Pro</SelectItem>
                          <SelectItem value="doubao-seed-1-6-251015">Doubao Seed 1.6</SelectItem>
                          <SelectItem value="kimi-k2-5-260127">Kimi K2.5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Temperature</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={formData.config.temperature}
                        onChange={(e) => setFormData({
                          ...formData,
                          config: { ...formData.config, temperature: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="custom" className="space-y-4">
                  <div className="space-y-2">
                    <Label>智能体名称 *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="给智能体起个名字"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>角色类型 *</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(value: AgentRole) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="developer">开发工程师</SelectItem>
                        <SelectItem value="frontend_dev">前端工程师</SelectItem>
                        <SelectItem value="backend_dev">后端工程师</SelectItem>
                        <SelectItem value="tester">测试工程师</SelectItem>
                        <SelectItem value="reviewer">代码审核员</SelectItem>
                        <SelectItem value="architect">架构师</SelectItem>
                        <SelectItem value="pm">产品经理</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>系统提示词 *</Label>
                    <Textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      rows={8}
                      placeholder="定义智能体的角色和行为"
                    />
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
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
                    <div className="flex items-center gap-2 mt-2">
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
                  <span>模型: {agent.model.split('-').slice(0, 2).join(' ')}</span>
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
