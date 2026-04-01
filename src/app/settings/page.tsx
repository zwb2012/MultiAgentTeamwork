'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Settings as SettingsIcon, 
  Save,
  Loader2,
  Activity
} from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState({
    settings: {
      auto_health_check: true,
      health_check_interval: 30
    }
  });
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      
      if (result.success && result.data.settings) {
        setConfig({ settings: result.data.settings });
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
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

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">基础配置</h1>
          <p className="text-muted-foreground mt-1">
            管理平台的基础设置
          </p>
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

      {/* 健康检查设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            智能体健康检查
          </CardTitle>
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
    </div>
  );
}
