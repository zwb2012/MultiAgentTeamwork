'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft,
  GitBranch,
  Clock,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  Users
} from 'lucide-react';
import { SYNC_INTERVAL_OPTIONS } from '@/types/project';
import { LocalPathConfigInput } from '../components/local-path-config';
import type { LocalPathConfig } from '@/types/project';
import type { Agent } from '@/types/agent';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  
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
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/agents?is_template=true');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('获取智能体模板失败:', error);
    }
  };

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.git_url) {
      alert('请填写项目名称和 Git 地址');
      return;
    }
    
    try {
      setLoading(true);
      
      // 创建项目
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        const projectId = result.data.id;
        
        // 如果选择了模板，创建项目智能体
        if (selectedTemplates.length > 0) {
          await fetch(`/api/projects/${projectId}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_ids: selectedTemplates })
          });
        }
        
        router.push(`/projects/${projectId}`);
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      alert('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">添加项目</h1>
          <p className="text-muted-foreground mt-1">
            配置 Git 仓库，开启自动同步
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
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

        <Card className="mt-6">
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
              <p className="text-xs text-muted-foreground">
                支持 HTTPS 和 SSH 格式
              </p>
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
                访问令牌（私密仓库必填）
              </Label>
              <div className="flex gap-2">
                <Input
                  id="git_token"
                  type={showToken ? 'text' : 'password'}
                  value={formData.git_token}
                  onChange={(e) => setFormData({ ...formData, git_token: e.target.value })}
                  placeholder="ghp_xxxx 或其他平台 token"
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
                用于访问私有仓库，将加密存储。GitHub 使用 Personal Access Token，GitLab 使用 Access Token
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 本地路径配置 */}
        <LocalPathConfigInput
          value={formData.local_path_config}
          onChange={(config) => setFormData({ ...formData, local_path_config: config })}
          projectName={formData.name}
        />

        {/* 智能体模板选择 */}
        {templates.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                初始化智能体
              </CardTitle>
              <CardDescription>
                选择要为项目创建的智能体，它们将拥有独立的记忆空间
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {templates.map(template => (
                  <div 
                    key={template.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      id={template.id}
                      checked={selectedTemplates.includes(template.id)}
                      onCheckedChange={() => handleTemplateToggle(template.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={template.id} className="font-medium cursor-pointer">
                        {template.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {template.role} · {template.agent_type === 'llm' ? template.model : '进程'}
                      </p>
                    </div>
                    <Badge variant="outline">{template.role}</Badge>
                  </div>
                ))}
              </div>
              {selectedTemplates.length > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  已选择 {selectedTemplates.length} 个智能体模板
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
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

        <Separator className="my-6" />

        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/projects">取消</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            创建项目
          </Button>
        </div>
      </form>
    </div>
  );
}
