'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  GitBranch,
  Clock,
  Key,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Monitor,
  Folder,
  Users,
  GitPullRequest,
  Ticket,
  MessageSquare,
  Plus,
  Copy
} from 'lucide-react';
import type { Project, LocalPathConfig } from '@/types/project';
import { SYNC_STATUS_CONFIG, SYNC_INTERVAL_OPTIONS, PLATFORM_CONFIG } from '@/types/project';
import type { Agent } from '@/types/agent';
import { LocalPathConfigInput } from '../components/local-path-config';

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  // 项目关联数据
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    git_url: '',
    git_branch: 'main',
    git_token: '',
    sync_enabled: true,
    sync_interval: 300,
    local_path_config: {} as LocalPathConfig
  });

  useEffect(() => {
    fetchProject();
    fetchProjectAgents();
    fetchTemplates();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        setProject(data);
        setFormData({
          name: data.name,
          description: data.description || '',
          git_url: data.git_url,
          git_branch: data.git_branch,
          git_token: '', // 不显示已保存的token
          sync_enabled: data.sync_enabled,
          sync_interval: data.sync_interval,
          local_path_config: data.local_path_config || {}
        });
      } else {
        alert('项目不存在');
        router.push('/projects');
      }
    } catch (error) {
      console.error('获取项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectAgents = async () => {
    try {
      setLoadingAgents(true);
      const response = await fetch(`/api/projects/${projectId}/agents`);
      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data || []);
      }
    } catch (error) {
      console.error('获取项目智能体失败:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await fetch('/api/agents?is_template=true');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('获取智能体模板失败:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleAddFromTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_ids: [templateId] })
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchProjectAgents();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建智能体失败:', error);
      alert('创建失败');
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.git_url) {
      alert('请填写项目名称和 Git 地址');
      return;
    }
    
    try {
      setSaving(true);
      
      const updateData: any = {
        name: formData.name,
        description: formData.description,
        git_url: formData.git_url,
        git_branch: formData.git_branch,
        sync_enabled: formData.sync_enabled,
        sync_interval: formData.sync_interval,
        local_path_config: formData.local_path_config
      };
      
      // 只有输入了新token才更新
      if (formData.git_token) {
        updateData.git_token = formData.git_token;
      }
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setProject(result.data);
        alert('保存成功');
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存项目失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('同步任务已启动');
        fetchProject();
      } else {
        alert('同步失败: ' + result.error);
      }
    } catch (error) {
      console.error('同步项目失败:', error);
      alert('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4 text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{project?.name}</h1>
            <p className="text-muted-foreground mt-1">
              编辑项目配置
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncing || project?.sync_status === 'syncing'}
          >
            {syncing || project?.sync_status === 'syncing' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            立即同步
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">基本设置</TabsTrigger>
          <TabsTrigger value="agents">
            <Users className="h-4 w-4 mr-1" />
            智能体
          </TabsTrigger>
          <TabsTrigger value="pipelines">
            <GitPullRequest className="h-4 w-4 mr-1" />
            流水线
          </TabsTrigger>
          <TabsTrigger value="tickets">
            <Ticket className="h-4 w-4 mr-1" />
            工单
          </TabsTrigger>
          <TabsTrigger value="sync">同步状态</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>
                  项目的基本信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">项目名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：我的前端项目"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">项目描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="项目的简要描述"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Git 配置
                </CardTitle>
                <CardDescription>
                  Git 仓库地址和访问凭证
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="git_url">Git 地址 *</Label>
                  <Input
                    id="git_url"
                    value={formData.git_url}
                    onChange={(e) => setFormData({ ...formData, git_url: e.target.value })}
                    placeholder="https://github.com/user/repo.git"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="git_branch">分支</Label>
                  <Input
                    id="git_branch"
                    value={formData.git_branch}
                    onChange={(e) => setFormData({ ...formData, git_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="git_token" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    访问令牌
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="git_token"
                      type={showToken ? 'text' : 'password'}
                      value={formData.git_token}
                      onChange={(e) => setFormData({ ...formData, git_token: e.target.value })}
                      placeholder="留空则不修改"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    已保存的令牌不显示，输入新值以更新
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  同步配置
                </CardTitle>
                <CardDescription>
                  配置自动同步间隔
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>启用自动同步</Label>
                    <p className="text-xs text-muted-foreground">
                      定时拉取最新代码
                    </p>
                  </div>
                  <Switch
                    checked={formData.sync_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, sync_enabled: checked })}
                  />
                </div>
                
                {formData.sync_enabled && (
                  <div className="space-y-2">
                    <Label>同步间隔</Label>
                    <Select
                      value={formData.sync_interval.toString()}
                      onValueChange={(value) => setFormData({ ...formData, sync_interval: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYNC_INTERVAL_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  本地路径配置
                </CardTitle>
                <CardDescription>
                  为不同平台配置本地存储路径
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LocalPathConfigInput
                  value={formData.local_path_config || {}}
                  onChange={(config) => setFormData({ ...formData, local_path_config: config })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    项目智能体
                  </CardTitle>
                  <CardDescription>
                    为此项目配置专属智能体，拥有独立的记忆空间
                  </CardDescription>
                </div>
                <Link href={`/agents/new?project_id=${projectId}`}>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    创建智能体
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 从模板添加 */}
              {templates.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">从模板快速添加</Label>
                  <div className="flex flex-wrap gap-2">
                    {templates.map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddFromTemplate(template.id)}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-3 w-3" />
                        {template.name}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    点击模板名称即可从模板创建项目专属智能体
                  </p>
                </div>
              )}
              
              <Separator />
              
              {/* 已有智能体列表 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">当前智能体 ({agents.length})</Label>
                
                {loadingAgents ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : agents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无智能体</p>
                    <p className="text-sm mt-1">从模板添加或创建新智能体</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {agents.map(agent => (
                      <div 
                        key={agent.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {agent.role} · {agent.agent_type === 'llm' ? agent.model : '进程'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={agent.online_status === 'online' ? 'default' : 'secondary'}>
                            {agent.online_status === 'online' ? '在线' : 
                             agent.online_status === 'offline' ? '离线' : '未知'}
                          </Badge>
                          <Link href={`/agents/${agent.id}`}>
                            <Button variant="ghost" size="sm">详情</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitPullRequest className="h-5 w-5" />
                项目流水线
              </CardTitle>
              <CardDescription>
                为此项目配置自动化工作流程
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <GitPullRequest className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无流水线</p>
                <p className="text-sm mt-1">创建流水线来自动化项目工作流程</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                项目工单
              </CardTitle>
              <CardDescription>
                管理此项目的Bug、功能请求和改进任务
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无工单</p>
                <p className="text-sm mt-1">创建工单来跟踪项目问题和任务</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>同步状态</CardTitle>
              <CardDescription>
                项目同步历史和状态信息
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">当前状态</Label>
                  <div>
                    {project && (
                      <Badge className={`${SYNC_STATUS_CONFIG[project.sync_status].bgColor} ${SYNC_STATUS_CONFIG[project.sync_status].color}`}>
                        {SYNC_STATUS_CONFIG[project.sync_status].label}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">最后同步</Label>
                  <div className="text-sm">{formatDate(project?.last_sync_at)}</div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">下次同步</Label>
                  <div className="text-sm">{formatDate(project?.next_sync_at)}</div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">最后 Commit</Label>
                  <div className="text-sm font-mono">
                    {project?.last_commit_sha?.substring(0, 8) || '-'}
                  </div>
                </div>
              </div>

              {project?.sync_error && (
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <Label className="text-red-600 font-medium">同步错误</Label>
                  <p className="text-sm text-red-600 mt-1">{project.sync_error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
