'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Code, PenTool, Search, Palette, Link2 } from 'lucide-react';

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

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取技能和分类
      const [skillsRes, categoriesRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/skills/categories')
      ]);

      const skillsData = await skillsRes.json();
      const categoriesData = await categoriesRes.json();

      if (skillsData.success) {
        setSkills(skillsData.data);
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

  const filteredSkills = selectedCategory === 'all'
    ? skills
    : skills.filter(s => s.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">技能插槽系统</h1>
          <p className="text-gray-600 mt-2">
            为LLM智能体配备各种专业能力，通过Function Calling让智能体主动调用工具
          </p>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">
            全部技能 ({skills.length})
          </TabsTrigger>
          {categories.map(cat => {
            const Icon = getCategoryIcon(cat.id);
            return (
              <TabsTrigger key={cat.id} value={cat.id}>
                <Icon className="w-4 h-4 mr-2" />
                {cat.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <SkillsGrid skills={skills} categories={categories} />
        </TabsContent>

        {categories.map(cat => (
          <TabsContent key={cat.id} value={cat.id} className="mt-6">
            <SkillsGrid
              skills={skills.filter(s => s.category === cat.id)}
              categories={categories}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SkillsGrid({ skills, categories }: { skills: Skill[]; categories: Category[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {skills.map(skill => {
        const category = categories.find(c => c.id === skill.category);
        const Icon = category ? getCategoryIcon(category.id) : Code;

        return (
          <Card key={skill.id} className="hover:shadow-lg transition-shadow">
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
                  <p className="text-xs text-gray-500 mt-1">
                    {skill.capabilities.function_definition.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getCategoryIcon(categoryId: string) {
  const icons: Record<string, any> = {
    code: Code,
    text: PenTool,
    analysis: Search,
    design: Palette,
    integration: Link2
  };
  return icons[categoryId] || Code;
}
