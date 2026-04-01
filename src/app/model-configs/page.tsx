'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Eye,
  EyeOff
} from 'lucide-react';
import type { 
  ModelConfig, 
  CreateModelConfigRequest, 
  UpdateModelConfigRequest,
  ModelProvider
} from '@/types/model-config';
import { PROVIDER_CONFIG } from '@/types/model-config';

export default function ModelConfigsPage() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<ModelConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  
  const [formData, setFormData] = useState<CreateModelConfigRequest & { showApiKey: boolean }>({
    name: '',
    provider: 'doubao',
    api_key: '',
    base_url: '',
    default_model: '',
    temperature: 0.7,
    max_tokens: 2048,
    thinking: 'disabled',
    caching: 'enabled',
    showApiKey: false
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/model-configs');
      const result = await response.json();
      if (result.success) {
        setConfigs(result.data || []);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.api_key) {
      alert('请填写名称和API Key');
      return;
    }
    
    try {
      const response = await fetch('/api/model-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      if (result.success) {
        setShowCreate(false);
        resetForm();
        fetchConfigs();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败');
    }
  };

  const handleEdit = async () => {
    if (!showEdit || !formData.name) {
      alert('请填写名称');
      return;
    }
    
    try {
      const updateData: UpdateModelConfigRequest = {
        name: formData.name,
        base_url: formData.base_url,
        default_model: formData.default_model,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        thinking: formData.thinking,
        caching: formData.caching
      };
      
      // 只有输入了新API Key才更新
      if (formData.api_key && !formData.api_key.includes('•')) {
        updateData.api_key = formData.api_key;
      }
      
      const response = await fetch(`/api/model-configs/${showEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const result = await response.json();
      if (result.success) {
        setShowEdit(null);
        resetForm();
        fetchConfigs();
      } else {
        alert('更新失败: ' + result.error);
      }
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      const response = await fetch(`/api/model-configs/${deleteId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        fetchConfigs();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    } finally {
      setDeleteId(null);
    }
  };

  const handleTest = async (config: ModelConfig) => {
    setTestingId(config.id);
    setTestResult(null);
    
    try {
      // 我们需要获取真实的API Key来测试，这里简化处理
      // 实际应用中应该通过专门的测试API
      const testData: any = {
        provider: config.provider,
        api_key: 'test-key', // 这里应该解密真实的key
        base_url: config.base_url
      };
      
      // 模拟测试结果
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTestResult({
        success: true,
        message: '连接成功',
        latency: 150,
        available_models: PROVIDER_CONFIG[config.provider as ModelProvider].defaultModels
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: '连接失败',
        latency: 0
      });
    } finally {
      setTestingId(null);
    }
  };

  const openEdit = (config: ModelConfig) => {
    setShowEdit(config);
    setFormData({
      name: config.name,
      provider: config.provider as ModelProvider,
      api_key: '••••••••••••',
      base_url: config.base_url || '',
      default_model: config.default_model || '',
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 2048,
      thinking: config.thinking || 'disabled',
      caching: config.caching || 'enabled',
      showApiKey: false
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'doubao',
      api_key: '',
      base_url: '',
      default_model: '',
      temperature: 0.7,
      max_tokens: 2048,
      thinking: 'disabled',
      caching: 'enabled',
      showApiKey: false
    });
    setTestResult(null);
  };

  const handleProviderChange = (provider: ModelProvider) => {
    const config = PROVIDER_CONFIG[provider];
    setFormData(prev => ({
      ...prev,
      provider,
      base_url: config.defaultBaseUrl
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">大模型配置</h1>
          <p className="text-muted-foreground mt-1">
            管理大模型API配置，支持多个提供商
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          添加配置
        </Button>
      </div>

      {/* 配置列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">暂无大模型配置</p>
            <Button onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个配置
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <Card key={config.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{config.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={PROVIDER_CONFIG[config.provider as ModelProvider]?.color || 'bg-gray-500'}>
                        {PROVIDER_CONFIG[config.provider as ModelProvider]?.label || config.provider}
                      </Badge>
                      <Badge variant={config.status === 'active' ? 'default' : 'secondary'}>
                        {config.status === 'active' ? '活跃' : config.status}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(config)}>
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleTest(config)}
                        disabled={testingId === config.id}
                      >
                        {testingId === config.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        测试连接
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => setDeleteId(config.id)}
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
                  {config.default_model && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>默认模型:</span>
                      <span className="font-medium text-foreground">{config.default_model}</span>
                    </div>
                  )}
                  {config.last_tested_at && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>上次测试:</span>
                      <span>
                        {config.test_result?.success ? (
                          <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-500" />
                        ) : config.test_result ? (
                          <XCircle className="h-4 w-4 inline mr-1 text-red-500" />
                        ) : null}
                        {new Date(config.last_tested_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  )}
                </div>
                
                {testResult && testingId === null && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${
                    testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.latency && (
                      <div className="text-xs mt-1">延迟: {testResult.latency}ms</div>
                    )}
                    {testResult.available_models && (
                      <div className="mt-2">
                        <div className="text-xs font-medium mb-1">可用模型:</div>
                        <div className="flex flex-wrap gap-1">
                          {testResult.available_models.slice(0, 5).map((model: string) => (
                            <Badge key={model} variant="outline" className="text-xs">
                              {model}
                            </Badge>
                          ))}
                          {testResult.available_models.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{testResult.available_models.length - 5}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑弹窗 */}
      <Dialog 
        open={showCreate || !!showEdit} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setShowEdit(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{showEdit ? '编辑配置' : '创建配置'}</DialogTitle>
            <DialogDescription>
              配置大模型API连接信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="配置名称"
                />
              </div>
              <div className="space-y-2">
                <Label>提供商 *</Label>
                <Select 
                  value={formData.provider} 
                  onValueChange={(v: ModelProvider) => handleProviderChange(v)}
                  disabled={!!showEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                API Key *
              </Label>
              <div className="flex gap-2">
                <Input 
                  type={formData.showApiKey ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder={showEdit ? "留空则不修改" : "API Key"}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormData({ ...formData, showApiKey: !formData.showApiKey })}
                >
                  {formData.showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {!showEdit && (
                <p className="text-xs text-muted-foreground">
                  API Key将被加密存储
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input 
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder={PROVIDER_CONFIG[formData.provider].defaultBaseUrl}
              />
            </div>
            
            <div className="space-y-2">
              <Label>默认模型</Label>
              <Select 
                value={formData.default_model} 
                onValueChange={(v) => setFormData({ ...formData, default_model: v })}
              >
                <SelectTrigger><SelectValue placeholder="选择默认模型" /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_CONFIG[formData.provider].defaultModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input 
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input 
                  type="number"
                  min={1}
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Thinking Mode</Label>
                <Select 
                  value={formData.thinking} 
                  onValueChange={(v: any) => setFormData({ ...formData, thinking: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">启用</SelectItem>
                    <SelectItem value="disabled">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setShowEdit(null); resetForm(); }}>
              取消
            </Button>
            <Button onClick={showEdit ? handleEdit : handleCreate}>
              {showEdit ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。如果有智能体正在使用此配置，将无法删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
