'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Loader2, Code, PenTool, Search, Palette, Link2 } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  capabilities: {
    function_definition: {
      name: string;
      description: string;
      parameters: any;
    };
    requires_llm: boolean;
    requires_local_execution: boolean;
  };
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface AgentSkillConfig {
  agentId: string;
  enabled_skills: string[];
  skill_priorities: Record<string, number>;
  skill_combinations: any[];
  all_skills: Skill[];
  skills_by_category: Record<string, Skill[]>;
}

export default function AgentSkillsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [config, setConfig] = useState<AgentSkillConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 切换技能启用状态
  const toggleSkill = (skillId: string) => {
    if (!config) return;

    const isEnabled = config.enabled_skills.includes(skillId);
    let newEnabledSkills: string[];

    if (isEnabled) {
      newEnabledSkills = config.enabled_skills.filter(id => id !== skillId);
    } else {
      newEnabledSkills = [...config.enabled_skills, skillId];
    }

    setConfig({
      ...config,
      enabled_skills: newEnabledSkills
    });
  };

  // 保存配置
  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled_skills: config.enabled_skills,
          skill_priorities: config.skill_priorities,
          skill_combinations: config.skill_combinations
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('技能配置已保存');
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 获取分类图标
  const getCategoryIcon = (categoryId: string) => {
    const icons: Record<string, any> = {
      code: Code,
      text: PenTool,
      analysis: Search,
      design: Palette,
      integration: Link2
    };
    return icons[categoryId] || Code;
  };

  // 获取分类颜色
  const getCategoryColor = (categoryId: string) => {
    const colors: Record<string, string> = {
      code: 'bg-blue-500',
      text: 'bg-green-500',
      analysis: 'bg-purple-500',
      design: 'bg-pink-500',
      integration: 'bg-orange-500'
    };
    return colors[categoryId] || 'bg-gray-500';
  };

  // 获取过滤后的技能
  const getFilteredSkills = (): Skill[] => {
    if (!config) return [];

    if (selectedCategory === 'all') {
      return config.all_skills;
    }

    return config.skills_by_category[selectedCategory] || [];
  };

  useEffect(() => {
    fetchData();
  }, [agentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取技能配置和分类
      const [configRes, categoriesRes] = await Promise.all([
        fetch(`/api/agents/${agentId}/skills`),
        fetch('/api/skills/categories')
      ]);

      const configData = await configRes.json();
      const categoriesData = await categoriesRes.json();

      if (configData.success) {
        setConfig(configData.data);
      }

      if (categoriesData.success) {
        setCategories(categoriesData.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">加载配置失败</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold">智能体技能配置</h1>
            <p className="text-gray-600 mt-2">
              为智能体配置可用的技能，让LLM主动调用工具完成任务
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="outline">
            已启用 {config.enabled_skills.length} / {config.all_skills.length} 个技能
          </Badge>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存配置
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {categories.map(cat => {
          const Icon = getCategoryIcon(cat.id);
          const skillsInCategory = config.skills_by_category[cat.id] || [];
          const enabledInCategory = skillsInCategory.filter(s =>
            config.enabled_skills.includes(s.id)
          ).length;

          return (
            <Card
              key={cat.id}
              className={`cursor-pointer transition-all ${
                selectedCategory === cat.id
                  ? 'ring-2 ring-blue-500'
                  : 'hover:shadow-md'
              }`}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(cat.id)} text-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{cat.name}</p>
                      <p className="text-sm text-gray-500">
                        {enabledInCategory} / {skillsInCategory.length}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={
                      enabledInCategory > 0 &&
                      enabledInCategory === skillsInCategory.length
                    }
                    onCheckedChange={(checked) => {
                      // 批量切换该分类的所有技能
                      const newEnabled = checked
                        ? [...new Set([...config.enabled_skills, ...skillsInCategory.map(s => s.id)])]
                        : config.enabled_skills.filter(id => !skillsInCategory.find(s => s.id === id));
                      setConfig({ ...config, enabled_skills: newEnabled });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card
          className={`cursor-pointer transition-all ${
            selectedCategory === 'all' ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
          }`}
          onClick={() => setSelectedCategory('all')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gray-500 text-white">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">全部技能</p>
                  <p className="text-sm text-gray-500">
                    {config.enabled_skills.length} / {config.all_skills.length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 技能列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getFilteredSkills().map(skill => {
          const isEnabled = config.enabled_skills.includes(skill.id);
          const category = categories.find(c => c.id === skill.category);
          const Icon = category ? getCategoryIcon(category.id) : Code;

          return (
            <Card
              key={skill.id}
              className={`transition-all ${
                isEnabled ? 'ring-2 ring-green-500 bg-green-50' : 'hover:shadow-md'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">{skill.icon}</div>
                    <div>
                      <CardTitle className="text-xl">{skill.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {category?.name || skill.category}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleSkill(skill.id)}
                  />
                </div>
                <CardDescription className="mt-2">
                  {skill.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {skill.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    {skill.capabilities.requires_llm && (
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                        需要LLM
                      </div>
                    )}
                    {skill.capabilities.requires_local_execution && (
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                        本地执行
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">函数定义</p>
                    <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
                      {skill.capabilities.function_definition.name}
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
