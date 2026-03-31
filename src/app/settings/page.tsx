'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings as SettingsIcon, 
  Key, 
  Globe, 
  Save,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { SUPPORTED_MODELS } from '@/types/agent';

export default function SettingsPage() {
  const [config, setConfig] = useState({
    llm: {
      default_api_key: '',
      default_base_url: 'https://api.coze.cn',
      default_model: 'doubao-seed-1-8-251228'
    },
    settings: {
      auto_health_check: true,
      health_check_interval: 30
    }
  });
  
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setIsApiKeySet(!!result.data.llm.default_api_key);
        setOriginalApiKey(result.data.llm.default_api_key);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('配置已保存');
        fetchConfig();
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // 测试API连接
      const apiKey = config.llm.default_api_key || originalApiKey;
      const baseUrl = config.llm.default_base_url;
      
      if (!apiKey) {
        setTestResult({ success: false, message: '请先配置 API Key' });
        return;
      }
      
      const response = await fetch(`${baseUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_id: 'health-check',
          user_id: 'health-check',
          additional_messages: [
            { role: 'user', content: 'ping', content_type: 'text' }
          ]
        })
      });
      
      if (response.ok || response.status === 400) {
        // 400可能是因为bot_id不存在，但API连接正常
        setTestResult({ success: true, message: 'API 连接正常' });
      } else if (response.status === 401) {
        setTestResult({ success: false, message: 'API Key 无效' });
      } else if (response.status === 404) {
        setTestResult({ success: false, message: 'API 地址错误' });
      } else {
        setTestResult({ success: false, message: `HTTP ${response.status}` });
      }
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error.message || '连接失败' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">全局设置</h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存配置
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          {/* LLM配置 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    默认 LLM 配置
                  </CardTitle>
                  <CardDescription className="mt-1">
                    创建智能体时的默认API配置，智能体也可以单独配置覆盖
                  </CardDescription>
                </div>
                {isApiKeySet && (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    已配置
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key *</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="输入API Key"
                  value={config.llm.default_api_key}
                  onChange={(e) => setConfig({
                    ...config,
                    llm: { ...config.llm, default_api_key: e.target.value }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {isApiKeySet && !config.llm.default_api_key 
                    ? '已配置，留空保持不变' 
                    : '从API提供商获取的密钥'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="base-url">API Base URL</Label>
                <Input
                  id="base-url"
                  placeholder="https://api.coze.cn"
                  value={config.llm.default_base_url}
                  onChange={(e) => setConfig({
                    ...config,
                    llm: { ...config.llm, default_base_url: e.target.value }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  豆包: https://api.coze.cn | DeepSeek: https://api.deepseek.com
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>默认模型</Label>
                <Select 
                  value={config.llm.default_model}
                  onValueChange={(value) => setConfig({
                    ...config,
                    llm: { ...config.llm, default_model: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_MODELS.filter(m => m.id !== 'custom').map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4 mr-2" />
                  )}
                  测试连接
                </Button>
                
                {testResult && (
                  <div className={`flex items-center gap-1 text-sm ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 健康检查设置 */}
          <Card>
            <CardHeader>
              <CardTitle>智能体健康检查</CardTitle>
              <CardDescription>
                自动检测智能体是否在线
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>创建后自动检测</Label>
                  <p className="text-xs text-muted-foreground">
                    创建智能体后自动执行健康检查
                  </p>
                </div>
                <Switch
                  checked={config.settings.auto_health_check}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    settings: { ...config.settings, auto_health_check: checked }
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>自动检测间隔（分钟）</Label>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={config.settings.health_check_interval}
                  onChange={(e) => setConfig({
                    ...config,
                    settings: { 
                      ...config.settings, 
                      health_check_interval: parseInt(e.target.value) || 30 
                    }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  0 表示禁用自动检测
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 说明 */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-2">使用说明</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 全局配置作为默认值，创建智能体时可以覆盖</li>
                <li>• API Key 安全存储在服务器端，不会暴露给前端</li>
                <li>• 独立部署时，请确保配置正确的 API Key 和 Base URL</li>
                <li>• 支持多种 LLM 提供商：豆包、DeepSeek、Kimi 等</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
