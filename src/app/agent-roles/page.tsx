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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Shield, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { AgentRoleConfig, AgentRoleFormData } from '@/types/agent-role';
import { DEFAULT_AGENT_ROLES } from '@/types/agent-role';

export default function AgentRolesPage() {
  const [roles, setRoles] = useState<AgentRoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AgentRoleConfig | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<AgentRoleConfig | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<AgentRoleFormData>({
    role_key: '',
    name: '',
    description: '',
    system_prompt_template: '',
    suggested_agent_type: 'llm',
    suggested_model: '',
    suggested_temperature: 0.3,
    capability_tags: [],
    sort_order: 0,
    is_active: true
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agent-roles');
      const result = await response.json();
      
      if (result.success) {
        setRoles(result.data || []);
      }
    } catch (error) {
      console.error('获取角色列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!formData.role_key || !formData.name || !formData.system_prompt_template) {
      alert('请填写角色标识、名称和提示词模板');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/agent-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        resetForm();
        fetchRoles();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建角色失败:', error);
      alert('创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !formData.name || !formData.system_prompt_template) {
      alert('请填写名称和提示词模板');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/agent-roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsEditDialogOpen(false);
        setEditingRole(null);
        resetForm();
        fetchRoles();
      } else {
        alert('更新失败: ' + result.error);
      }
    } catch (error) {
      console.error('更新角色失败:', error);
      alert('更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteConfirmRole) return;

    try {
      const response = await fetch(`/api/agent-roles/${deleteConfirmRole.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDeleteConfirmRole(null);
        fetchRoles();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除角色失败:', error);
      alert('删除失败');
    }
  };

  const handleReinitialize = async () => {
    if (!confirm('确定要重新初始化默认角色吗？这将添加缺失的默认角色。')) return;
    
    try {
      const response = await fetch('/api/agent-roles', {
        method: 'PUT'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('初始化成功');
        fetchRoles();
      } else {
        alert('初始化失败: ' + result.error);
      }
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败');
    }
  };

  const openEditDialog = (role: AgentRoleConfig) => {
    setEditingRole(role);
    setFormData({
      role_key: role.role_key,
      name: role.name,
      description: role.description || '',
      system_prompt_template: role.system_prompt_template,
      suggested_agent_type: role.suggested_agent_type || 'llm',
      suggested_model: role.suggested_model || '',
      suggested_temperature: role.suggested_temperature || 0.3,
      suggested_thinking: role.suggested_thinking,
      suggested_caching: role.suggested_caching,
      capability_tags: role.capability_tags || [],
      sort_order: role.sort_order || 0,
      is_active: role.is_active
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      role_key: '',
      name: '',
      description: '',
      system_prompt_template: '',
      suggested_agent_type: 'llm',
      suggested_model: '',
      suggested_temperature: 0.3,
      capability_tags: [],
      sort_order: 0,
      is_active: true
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  // 从默认角色中选择模板
  const handleSelectRoleTemplate = (roleKey: string) => {
    const template = DEFAULT_AGENT_ROLES.find(r => r.role_key === roleKey);
    if (template) {
      setFormData({
        role_key: template.role_key,
        name: template.name,
        description: template.description || '',
        system_prompt_template: template.system_prompt_template,
        suggested_agent_type: template.suggested_agent_type || 'llm',
        suggested_model: template.suggested_model || '',
        suggested_temperature: template.suggested_temperature || 0.3,
        suggested_thinking: template.suggested_thinking,
        suggested_caching: template.suggested_caching,
        capability_tags: template.capability_tags || [],
        sort_order: template.sort_order || 0,
        is_active: true
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">角色管理</h1>
          <p className="text-muted-foreground mt-1">
            管理智能体角色配置，定义默认提示词和建议参数
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReinitialize}>
            <RefreshCw className="h-4 w-4 mr-2" />
            初始化默认角色
          </Button>
          
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            创建角色
          </Button>
        </div>
      </div>

      {/* 角色列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">暂无角色配置</p>
            <p className="text-sm text-muted-foreground mb-4">
              点击"初始化默认角色"创建系统预设角色
            </p>
            <Button onClick={handleReinitialize}>
              <RefreshCw className="h-4 w-4 mr-2" />
              初始化默认角色
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className={`hover:shadow-md transition-shadow ${!role.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role.name}
                      {role.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          系统
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {role.role_key}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmRole(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {role.description && (
                  <p className="text-sm text-muted-foreground">
                    {role.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    {role.suggested_agent_type === 'llm' ? 'LLM' : '进程'}
                  </Badge>
                  {role.suggested_model && (
                    <Badge variant="outline" className="text-xs">
                      {role.suggested_model}
                    </Badge>
                  )}
                  {role.capability_tags?.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">提示词预览：</span>
                  <p className="mt-1 line-clamp-2">
                    {role.system_prompt_template.substring(0, 100)}...
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建角色对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建角色</DialogTitle>
            <DialogDescription>
              创建新的智能体角色配置
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* 从模板选择 */}
            <div className="space-y-2">
              <Label>从模板选择</Label>
              <Select onValueChange={handleSelectRoleTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="选择预设模板快速填充" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_AGENT_ROLES.map(template => (
                    <SelectItem key={template.role_key} value={template.role_key}>
                      {template.name} - {template.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role_key">角色标识 *</Label>
                <Input
                  id="role_key"
                  value={formData.role_key}
                  onChange={(e) => setFormData({ ...formData, role_key: e.target.value })}
                  placeholder="例如：developer, tester"
                />
                <p className="text-xs text-muted-foreground">唯一标识，用于系统识别</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">显示名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：开发工程师"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="角色职责简述"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_prompt_template">提示词模板 *</Label>
              <Textarea
                id="system_prompt_template"
                value={formData.system_prompt_template}
                onChange={(e) => setFormData({ ...formData, system_prompt_template: e.target.value })}
                placeholder="使用 {name} 作为智能体名称占位符"
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                {'{name}'} 会被替换为实际的智能体名称
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>建议模型</Label>
                <Input
                  value={formData.suggested_model || ''}
                  onChange={(e) => setFormData({ ...formData, suggested_model: e.target.value })}
                  placeholder="doubao-seed-1-8-251228"
                />
              </div>
              
              <div className="space-y-2">
                <Label>建议温度</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.suggested_temperature || 0.3}
                  onChange={(e) => setFormData({ ...formData, suggested_temperature: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateRole} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                创建角色
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑角色对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑角色</DialogTitle>
            <DialogDescription>
              修改角色配置
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_role_key">角色标识</Label>
                <Input
                  id="edit_role_key"
                  value={formData.role_key}
                  disabled={editingRole?.is_system}
                  className={editingRole?.is_system ? 'bg-muted' : ''}
                />
                {editingRole?.is_system && (
                  <p className="text-xs text-muted-foreground">系统角色标识不可修改</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_name">显示名称 *</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">描述</Label>
              <Input
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_system_prompt_template">提示词模板 *</Label>
              <Textarea
                id="edit_system_prompt_template"
                value={formData.system_prompt_template}
                onChange={(e) => setFormData({ ...formData, system_prompt_template: e.target.value })}
                rows={10}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>建议模型</Label>
                <Input
                  value={formData.suggested_model || ''}
                  onChange={(e) => setFormData({ ...formData, suggested_model: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>建议温度</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.suggested_temperature || 0.3}
                  onChange={(e) => setFormData({ ...formData, suggested_temperature: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>启用此角色</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdateRole} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                保存修改
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirmRole} onOpenChange={() => setDeleteConfirmRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色 "{deleteConfirmRole?.name}" 吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
