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
  Folder,
  Ticket
} from 'lucide-react';
import type { Project, LocalPathConfig } from '@/types/project';
import { SYNC_STATUS_CONFIG, SYNC_INTERVAL_OPTIONS } from '@/types/project';
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

  const handleSave = async () => {
    if (!formData.name || !formData.git_url) {
      alert('请填写项目名称和 Git 地址');
      return;
    }
    
    try {
      setSaving(true);
      
      const updateData: Record<string, unknown> = {
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
            {project?.description && (
              <p className="text-muted-foreground mt-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link href={`/projects/${projectId}/tickets`}>
            <Button variant="outline">
              <Ticket className="h-4 w-4 mr-2" />
              工单管理
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/pipelines`}>
            <Button variant="outline">
              <GitBranch className="h-4 w-4 mr-2" />
              流水线
            </Button>
          </Link>
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
