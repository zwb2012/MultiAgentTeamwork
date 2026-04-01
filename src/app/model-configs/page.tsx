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
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Eye,
  EyeOff,
  RefreshCw
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
  
  // 测试相关状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    latency?: number;
    available_models?: string[];
  } | null>(null);
  
  // 表单数据
  const [formData, setFormData] = useState<CreateModelConfigRequest & { 
    showApiKey: boolean;
    availableModels: string[];
  }>({
    name: '',
    provider: 'doubao',
    api_key: '',
    base_url: '',
    default_model: '',
    temperature: 0.7,
    max_tokens: 2048,
    thinking: 'disabled',
    caching: 'enabled',
    showApiKey: false,
    availableModels: []
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

  // 测试连接并获取模型列表
  const handleTest = async () => {
    if (!formData.api_key || formData.api_key.includes('•')) {
      alert('请先输入API Key');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/model-configs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formData.provider,
          api_key: formData.api_key,
          base_url: formData.base_url || PROVIDER_CONFIG[formData.provider].defaultBaseUrl
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setTestResult(result.data);
        if (result.data.available_models && result.data.available_models.length > 0) {
          setFormData(prev => ({
            ...prev,
            availableModels: result.data.available_models
          }));
        }
      } else {
        setTestResult({
          success: false,
          message: result.error || '测试失败'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '测试失败'
      });
    } finally {
      setTesting(false);
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
        body: JSON.stringify({
          name: formData.name,
          provider: formData.provider,
          api_key: formData.api_key,
          base_url: formData.base_url,
          default_model: formData.default_model,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          thinking: formData.thinking,
          caching: formData.caching
        })
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
      thinking: (config.thinking as 'enabled' | 'disabled') || 'disabled',
      caching: (config.caching as 'enabled' | 'disabled') || 'enabled',
      showApiKey: false,
      availableModels: config.available_models || []
    });
    setTestResult(null);
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
      showApiKey: false,
      availableModels: []
    });
    setTestResult(null);
  };

  const handleProviderChange = (provider: ModelProvider) => {
    const config = PROVIDER_CONFIG[provider];
    setFormData(prev => ({
      ...prev,
      provider,
      base_url: config.defaultBaseUrl,
      availableModels: [],
      default_model: ''
    }));
    setTestResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">大模型配置</h1>
          <p className="text-muted-foreground mt-1">
            管理大模型API配置，创建智能体时可直接选择使用
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
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(config)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-600"
                      onClick={() => setDeleteId(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                      <span className="flex items-center gap-1">
                        {config.test_result?.success ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : config.test_result ? (
                          <XCircle className="h-3 w-3 text-red-500" />
                        ) : null}
                        {new Date(config.last_tested_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  )}
                </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEdit ? '编辑配置' : '创建配置'}</DialogTitle>
            <DialogDescription>
              配置大模型API连接信息，测试成功后可选择模型
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>配置名称 *</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：豆包生产环境"
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
            
            {/* API配置 */}
            <div className="space-y-2">
              <Label>API Key *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type={formData.showApiKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => {
                      setFormData({ ...formData, api_key: e.target.value });
                      setTestResult(null);
                    }}
                    placeholder={showEdit ? "留空则不修改" : "输入API Key"}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setFormData({ ...formData, showApiKey: !formData.showApiKey })}
                  >
                    {formData.showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {!showEdit && (
                <p className="text-xs text-muted-foreground">
                  API Key将被加密存储，创建智能体时可直接选择此配置
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input 
                value={formData.base_url}
                onChange={(e) => {
                  setFormData({ ...formData, base_url: e.target.value });
                  setTestResult(null);
                }}
                placeholder={PROVIDER_CONFIG[formData.provider].defaultBaseUrl}
              />
              <p className="text-xs text-muted-foreground">
                默认: {PROVIDER_CONFIG[formData.provider].defaultBaseUrl}
              </p>
            </div>
            
            {/* 测试连接 */}
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={handleTest}
                disabled={testing || !formData.api_key || formData.api_key.includes('•')}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                测试连接
              </Button>
              
              {testResult && (
                <div className={`flex items-center gap-2 text-sm ${
                  testResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>{testResult.message}</span>
                  {testResult.latency && (
                    <span className="text-muted-foreground">({testResult.latency}ms)</span>
                  )}
                </div>
              )}
            </div>
            
            {/* 模型选择 - 测试成功后显示 */}
            {testResult?.success && testResult.available_models && testResult.available_models.length > 0 && (
              <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <Label className="text-green-700 dark:text-green-300">
                  可用模型 ({testResult.available_models.length}个)
                </Label>
                <Select 
                  value={formData.default_model} 
                  onValueChange={(v) => setFormData({ ...formData, default_model: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择默认模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {testResult.available_models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  选择一个默认模型，创建智能体时可以覆盖
                </p>
              </div>
            )}
            
            {/* 高级参数 */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
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
                <Label>Thinking</Label>
                <Select 
                  value={formData.thinking} 
                  onValueChange={(v: 'enabled' | 'disabled') => setFormData({ ...formData, thinking: v })}
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
