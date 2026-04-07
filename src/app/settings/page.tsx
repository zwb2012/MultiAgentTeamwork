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
  Activity,
  GitBranch,
  Eye,
  EyeOff,
  MessageSquare
} from 'lucide-react';

interface GitConfig {
  user_name: string;
  user_email: string;
  default_branch: string;
  token?: string;
}

interface SettingsConfig {
  auto_health_check: boolean;
  health_check_interval: number;
}

interface MessageUIConfig {
  // 自动折叠阈值
  autoMinimize: { charCount: number; lineCount: number };
  autoSectionFold: { charCount: number; lineCount: number };
  autoTruncate: { charCount: number; lineCount: number };
  // 折叠显示长度
  collapsedPreviewLength: number;
  defaultMaxLength: number;
  codeBlockMaxLength: number;
  aggressiveTruncateLength: number;
  // 章节折叠默认展开数量
  defaultExpandedSections: number;
}

export default function SettingsPage() {
  const [gitConfig, setGitConfig] = useState<GitConfig>({
    user_name: 'AI Agent',
    user_email: 'agent@ai.local',
    default_branch: 'main',
    token: ''
  });

  const [settings, setSettings] = useState<SettingsConfig>({
    auto_health_check: true,
    health_check_interval: 30
  });

  const [messageUI, setMessageUI] = useState<MessageUIConfig>({
    autoMinimize: { charCount: 500, lineCount: 15 },
    autoSectionFold: { charCount: 200, lineCount: 8 },
    autoTruncate: { charCount: 80, lineCount: 3 },
    collapsedPreviewLength: 60,
    defaultMaxLength: 80,
    codeBlockMaxLength: 300,
    aggressiveTruncateLength: 150,
    defaultExpandedSections: 3
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();

      if (result.success) {
        if (result.data.git) {
          setGitConfig({
            user_name: result.data.git.user_name || 'AI Agent',
            user_email: result.data.git.user_email || 'agent@ai.local',
            default_branch: result.data.git.default_branch || 'main',
            token: '' // 不显示已保存的token
          });
        }
        if (result.data.settings) {
          setSettings(result.data.settings);
        }
        // 读取 UI 配置
        if (result.data.ui?.message) {
          setMessageUI(result.data.ui.message);
        }
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
        body: JSON.stringify({
          git: gitConfig,
          settings: settings,
          ui: { message: messageUI }
        })
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

  const updateMessageUI = (path: string, value: number) => {
    const keys = path.split('.');
    setMessageUI((prev: any) => {
      const updated = { ...prev };
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
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

      {/* Git 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git 配置
          </CardTitle>
          <CardDescription>
            配置 Git 用户信息和访问凭证
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>用户名</Label>
              <Input
                value={gitConfig.user_name}
                onChange={(e) => setGitConfig({ ...gitConfig, user_name: e.target.value })}
                placeholder="AI Agent"
              />
            </div>
            <div>
              <Label>邮箱</Label>
              <Input
                type="email"
                value={gitConfig.user_email}
                onChange={(e) => setGitConfig({ ...gitConfig, user_email: e.target.value })}
                placeholder="agent@ai.local"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>默认分支</Label>
              <Input
                value={gitConfig.default_branch}
                onChange={(e) => setGitConfig({ ...gitConfig, default_branch: e.target.value })}
                placeholder="main"
              />
            </div>
            <div>
              <Label>Token（可选）</Label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={gitConfig.token}
                  onChange={(e) => setGitConfig({ ...gitConfig, token: e.target.value })}
                  placeholder="输入 Git Token"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 自动健康检测 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            自动健康检测
          </CardTitle>
          <CardDescription>
            自动检测智能体健康状态
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>启用自动检测</Label>
              <p className="text-sm text-muted-foreground mt-1">
                创建智能体后自动进行健康检查
              </p>
            </div>
            <Switch
              checked={settings.auto_health_check}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, auto_health_check: checked })
              }
            />
          </div>
          <div>
            <Label>检测间隔（分钟）</Label>
            <Input
              type="number"
              value={settings.health_check_interval}
              onChange={(e) =>
                setSettings({ ...settings, health_check_interval: parseInt(e.target.value) || 30 })
              }
              min="1"
              max="1440"
            />
          </div>
        </CardContent>
      </Card>

      {/* 消息折叠配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            消息折叠配置
          </CardTitle>
          <CardDescription>
            控制消息内容自动折叠的阈值和显示方式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 自动折叠阈值 */}
          <div>
            <h3 className="font-semibold mb-3">自动折叠阈值</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>最小化折叠 - 字符数</Label>
                  <Input
                    type="number"
                    value={messageUI.autoMinimize.charCount}
                    onChange={(e) => updateMessageUI('autoMinimize.charCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div>
                  <Label>最小化折叠 - 行数</Label>
                  <Input
                    type="number"
                    value={messageUI.autoMinimize.lineCount}
                    onChange={(e) => updateMessageUI('autoMinimize.lineCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>章节折叠 - 字符数</Label>
                  <Input
                    type="number"
                    value={messageUI.autoSectionFold.charCount}
                    onChange={(e) => updateMessageUI('autoSectionFold.charCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div>
                  <Label>章节折叠 - 行数</Label>
                  <Input
                    type="number"
                    value={messageUI.autoSectionFold.lineCount}
                    onChange={(e) => updateMessageUI('autoSectionFold.lineCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>自动截断 - 字符数</Label>
                  <Input
                    type="number"
                    value={messageUI.autoTruncate.charCount}
                    onChange={(e) => updateMessageUI('autoTruncate.charCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div>
                  <Label>自动截断 - 行数</Label>
                  <Input
                    type="number"
                    value={messageUI.autoTruncate.lineCount}
                    onChange={(e) => updateMessageUI('autoTruncate.lineCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 折叠显示长度 */}
          <div>
            <h3 className="font-semibold mb-3">折叠显示长度</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>最小化预览长度（字符）</Label>
                <Input
                  type="number"
                  value={messageUI.collapsedPreviewLength}
                  onChange={(e) => updateMessageUI('collapsedPreviewLength', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div>
                <Label>普通消息最大长度</Label>
                <Input
                  type="number"
                  value={messageUI.defaultMaxLength}
                  onChange={(e) => updateMessageUI('defaultMaxLength', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div>
                <Label>代码块消息最大长度</Label>
                <Input
                  type="number"
                  value={messageUI.codeBlockMaxLength}
                  onChange={(e) => updateMessageUI('codeBlockMaxLength', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div>
                <Label>激进模式截断长度</Label>
                <Input
                  type="number"
                  value={messageUI.aggressiveTruncateLength}
                  onChange={(e) => updateMessageUI('aggressiveTruncateLength', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* 章节折叠配置 */}
          <div>
            <h3 className="font-semibold mb-3">章节折叠</h3>
            <div>
              <Label>默认展开章节数量</Label>
              <Input
                type="number"
                value={messageUI.defaultExpandedSections}
                onChange={(e) => updateMessageUI('defaultExpandedSections', parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
