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
import { presetConfigs } from '@/lib/message-content-config';

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
  collapseMode: 'default' | 'compact' | 'loose' | 'custom';
  customThresholds?: {
    autoMinimize: { charCount: number; lineCount: number };
    autoSectionFold: { charCount: number; lineCount: number };
    autoTruncate: { charCount: number; lineCount: number };
  };
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
    collapseMode: 'default'
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
            配置项目同步时的 Git 用户信息，未配置独立 Token 的项目将使用全局 Token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="git_user_name">用户名</Label>
              <Input
                id="git_user_name"
                value={gitConfig.user_name}
                onChange={(e) => setGitConfig({ ...gitConfig, user_name: e.target.value })}
                placeholder="Git 提交者名称"
              />
              <p className="text-xs text-muted-foreground">
                Git 提交时显示的提交者名称
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="git_user_email">邮箱</Label>
              <Input
                id="git_user_email"
                type="email"
                value={gitConfig.user_email}
                onChange={(e) => setGitConfig({ ...gitConfig, user_email: e.target.value })}
                placeholder="Git 提交者邮箱"
              />
              <p className="text-xs text-muted-foreground">
                Git 提交时显示的提交者邮箱
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="git_default_branch">默认分支</Label>
              <Input
                id="git_default_branch"
                value={gitConfig.default_branch}
                onChange={(e) => setGitConfig({ ...gitConfig, default_branch: e.target.value })}
                placeholder="main"
              />
              <p className="text-xs text-muted-foreground">
                新建仓库时的默认分支名称
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="git_token">全局 Token</Label>
              <div className="flex gap-2">
                <Input
                  id="git_token"
                  type={showToken ? 'text' : 'password'}
                  value={gitConfig.token}
                  onChange={(e) => setGitConfig({ ...gitConfig, token: e.target.value })}
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
                用于访问私有仓库，项目未配置 Token 时使用此值
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              checked={settings.auto_health_check}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                auto_health_check: checked
              })}
            />
          </div>

          <div className="space-y-2">
            <Label>自动检测间隔（分钟）</Label>
            <Input
              type="number"
              min={0}
              max={1440}
              value={settings.health_check_interval}
              onChange={(e) => setSettings({
                ...settings,
                health_check_interval: parseInt(e.target.value) || 30
              })}
            />
            <p className="text-xs text-muted-foreground">
              0 表示禁用自动检测
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 消息显示设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            消息显示设置
          </CardTitle>
          <CardDescription>
            配置聊天消息的折叠和显示行为
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 折叠模式选择 */}
          <div className="space-y-2">
            <Label>折叠模式</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant={messageUI.collapseMode === 'default' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageUI({
                  ...messageUI,
                  collapseMode: 'default',
                  customThresholds: undefined
                })}
              >
                默认
              </Button>
              <Button
                type="button"
                variant={messageUI.collapseMode === 'compact' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageUI({
                  ...messageUI,
                  collapseMode: 'compact',
                  customThresholds: undefined
                })}
              >
                紧凑
              </Button>
              <Button
                type="button"
                variant={messageUI.collapseMode === 'loose' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageUI({
                  ...messageUI,
                  collapseMode: 'loose',
                  customThresholds: undefined
                })}
              >
                宽松
              </Button>
              <Button
                type="button"
                variant={messageUI.collapseMode === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const defaults = presetConfigs.default;
                  setMessageUI({
                    collapseMode: 'custom',
                    customThresholds: {
                      autoMinimize: { ...defaults.autoMinimize },
                      autoSectionFold: { ...defaults.autoSectionFold },
                      autoTruncate: { ...defaults.autoTruncate }
                    }
                  });
                }}
              >
                自定义
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {messageUI.collapseMode === 'default' && '平衡模式，适合大多数场景'}
              {messageUI.collapseMode === 'compact' && '紧凑模式，消息更早折叠'}
              {messageUI.collapseMode === 'loose' && '宽松模式，显示更多内容'}
              {messageUI.collapseMode === 'custom' && '自定义模式，可调整阈值'}
            </p>
          </div>

          {/* 自定义阈值（仅在自定义模式下显示） */}
          {messageUI.collapseMode === 'custom' && messageUI.customThresholds && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">自定义阈值</Label>

              {/* 自动最小化 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">最小化字符数</Label>
                  <Input
                    type="number"
                    min={100}
                    max={2000}
                    value={messageUI.customThresholds.autoMinimize.charCount}
                    onChange={(e) => setMessageUI({
                      ...messageUI,
                      customThresholds: {
                        ...messageUI.customThresholds!,
                        autoMinimize: {
                          ...messageUI.customThresholds!.autoMinimize,
                          charCount: parseInt(e.target.value) || 500
                        }
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">最小化行数</Label>
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={messageUI.customThresholds.autoMinimize.lineCount}
                    onChange={(e) => setMessageUI({
                      ...messageUI,
                      customThresholds: {
                        ...messageUI.customThresholds!,
                        autoMinimize: {
                          ...messageUI.customThresholds!.autoMinimize,
                          lineCount: parseInt(e.target.value) || 15
                        }
                      }
                    })}
                  />
                </div>
              </div>

              {/* 自动章节折叠 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">章节折叠字符数</Label>
                  <Input
                    type="number"
                    min={50}
                    max={1000}
                    value={messageUI.customThresholds.autoSectionFold.charCount}
                    onChange={(e) => setMessageUI({
                      ...messageUI,
                      customThresholds: {
                        ...messageUI.customThresholds!,
                        autoSectionFold: {
                          ...messageUI.customThresholds!.autoSectionFold,
                          charCount: parseInt(e.target.value) || 200
                        }
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">章节折叠行数</Label>
                  <Input
                    type="number"
                    min={3}
                    max={30}
                    value={messageUI.customThresholds.autoSectionFold.lineCount}
                    onChange={(e) => setMessageUI({
                      ...messageUI,
                      customThresholds: {
                        ...messageUI.customThresholds!,
                        autoSectionFold: {
                          ...messageUI.customThresholds!.autoSectionFold,
                          lineCount: parseInt(e.target.value) || 8
                        }
                      }
                    })}
                  />
                </div>
              </div>

              {/* 自动截断 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">截断字符数</Label>
                  <Input
                    type="number"
                    min={30}
                    max={500}
                    value={messageUI.customThresholds.autoTruncate.charCount}
                    onChange={(e) => setMessageUI({
                      ...messageUI,
                      customThresholds: {
                        ...messageUI.customThresholds!,
                        autoTruncate: {
                          ...messageUI.customThresholds!.autoTruncate,
                          charCount: parseInt(e.target.value) || 80
                        }
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">截断行数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={messageUI.customThresholds.autoTruncate.lineCount}
                    onChange={(e) => setMessageUI({
                      ...messageUI,
                      customThresholds: {
                        ...messageUI.customThresholds!,
                        autoTruncate: {
                          ...messageUI.customThresholds!.autoTruncate,
                          lineCount: parseInt(e.target.value) || 3
                        }
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
