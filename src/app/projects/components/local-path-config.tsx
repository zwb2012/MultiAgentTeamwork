'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Info } from 'lucide-react';
import type { LocalPathConfig, Platform } from '@/types/project';
import { PLATFORM_CONFIG } from '@/types/project';

interface LocalPathConfigProps {
  value?: LocalPathConfig;
  onChange: (config: LocalPathConfig) => void;
  projectName?: string;
}

export function LocalPathConfigInput({ value, onChange, projectName }: LocalPathConfigProps) {
  const [activeTab, setActiveTab] = useState<Platform>('linux');

  const handlePathChange = (platform: Platform, path: string) => {
    onChange({
      ...value,
      [platform]: path
    });
  };

  const platforms: Platform[] = ['windows', 'linux', 'macos'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          本地存储路径配置
        </CardTitle>
        <CardDescription>
          为不同平台配置项目克隆的目标路径
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">配置说明</p>
            <ul className="list-disc list-inside space-y-1">
              <li>可以只配置当前使用的平台</li>
              <li>未配置的平台将使用"默认路径"</li>
              <li>留空则使用系统临时目录</li>
            </ul>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Platform)}>
          <TabsList className="grid w-full grid-cols-4">
            {platforms.map(platform => (
              <TabsTrigger key={platform} value={platform}>
                {PLATFORM_CONFIG[platform].label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="default">默认</TabsTrigger>
          </TabsList>

          {platforms.map(platform => (
            <TabsContent key={platform} value={platform} className="space-y-2">
              <Label htmlFor={`${platform}-path`} className="flex items-center gap-2">
                {PLATFORM_CONFIG[platform].label} 路径
              </Label>
              <Input
                id={`${platform}-path`}
                value={value?.[platform] || ''}
                onChange={(e) => handlePathChange(platform, e.target.value)}
                placeholder={PLATFORM_CONFIG[platform].placeholder}
              />
              <p className="text-xs text-muted-foreground">
                {PLATFORM_CONFIG[platform].example}
              </p>
            </TabsContent>
          ))}

          <TabsContent value="default" className="space-y-2">
            <Label htmlFor="default-path" className="flex items-center gap-2">
              默认路径
              <Badge variant="outline" className="text-xs">当平台未配置时使用</Badge>
            </Label>
            <Input
              id="default-path"
              value={value?.default || ''}
              onChange={(e) => handlePathChange('default' as any, e.target.value)}
              placeholder="/tmp/projects/my-project"
            />
            <p className="text-xs text-muted-foreground">
              当特定平台未配置路径时，将使用此默认路径
            </p>
          </TabsContent>
        </Tabs>

        {/* 显示当前配置的路径 */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium mb-2 block">当前配置预览</Label>
          <div className="grid gap-2 text-sm">
            {platforms.map(platform => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {PLATFORM_CONFIG[platform].label}:
                </span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {value?.[platform] || <span className="text-muted-foreground italic">未配置</span>}
                </code>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">默认:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {value?.default || <span className="text-muted-foreground italic">未配置</span>}
              </code>
            </div>
          </div>
        </div>

        {/* 如果项目名称已提供，显示实际将使用的路径 */}
        {projectName && (
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <Label className="text-sm font-medium text-green-700 dark:text-green-300">
              实际将使用的路径
            </Label>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              根据当前服务器平台自动选择
            </p>
            <code className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded mt-2 block">
              {getEffectivePath(value, projectName)}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 获取实际将使用的路径（前端预览用）
function getEffectivePath(config: LocalPathConfig | undefined, projectName: string): string {
  // 这只是预览，实际路径由后端决定
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  
  if (config?.linux) {
    return config.linux;
  }
  if (config?.default) {
    return config.default;
  }
  
  return `/tmp/projects/${sanitizedName}`;
}
