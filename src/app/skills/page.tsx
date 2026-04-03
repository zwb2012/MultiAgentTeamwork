'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Code, PenTool, Search, Palette, Link2, BarChart3, BookOpen } from 'lucide-react';

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
        <Link href="/skills/stats">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            统计监控
          </Button>
        </Link>
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
          <TabsTrigger value="examples">
            <BookOpen className="w-4 h-4 mr-2" />
            使用示例
          </TabsTrigger>
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

        <TabsContent value="examples" className="mt-6">
          <UsageExamples />
        </TabsContent>
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

function getCategoryColor(categoryId: string) {
  const colors: Record<string, string> = {
    code: 'bg-blue-500',
    text: 'bg-green-500',
    analysis: 'bg-purple-500',
    design: 'bg-pink-500',
    integration: 'bg-orange-500'
  };
  return colors[categoryId] || 'bg-gray-500';
}

function UsageExamples() {
  const examples = [
    {
      title: '使用代码生成技能',
      description: '让智能体为您编写代码',
      prompt: '请帮我创建一个React组件，实现一个待办事项列表，支持添加、删除和完成状态切换',
      agent: '代码助手',
      steps: [
        '1. 创建智能体并启用"代码生成"、"文件创建"技能',
        '2. 在会话中输入需求',
        '3. 智能体会自动识别需要调用代码生成技能',
        '4. 生成完整的组件代码'
      ]
    },
    {
      title: '使用PRD设计技能',
      description: '让智能体帮您撰写产品需求文档',
      prompt: '我有一个社交App的想法，核心功能是短视频分享和实时聊天，请帮我写一个详细的产品需求文档',
      agent: '产品经理',
      steps: [
        '1. 创建智能体并启用"PRD设计"、"需求分析"技能',
        '2. 描述产品想法和核心功能',
        '3. 智能体会调用PRD设计技能',
        '4. 输出完整的产品需求文档结构'
      ]
    },
    {
      title: '组合使用多个技能',
      description: '一次对话中调用多个技能完成复杂任务',
      prompt: '请帮我创建一个简单的Web服务器，实现用户注册登录功能，并编写部署文档',
      agent: '全栈开发者',
      steps: [
        '1. 启用"代码生成"、"文件创建"、"文件读取"等多个技能',
        '2. 提出完整需求',
        '3. 智能体会依次调用技能：代码生成、文件创建等',
        '4. 完成服务器代码、路由、部署文档等多个文件'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="w-6 h-6 mr-2" />
            技能使用示例
          </CardTitle>
          <CardDescription>
            了解如何在智能体中使用技能，让AI更智能地完成各种任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">快速开始</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>创建一个LLM智能体，访问 <strong>/agents/[id]/skills</strong> 配置技能</li>
              <li>启用您需要的技能（如代码生成、文件创建等）</li>
              <li>在会话中与智能体对话，它会根据需求自动调用技能</li>
              <li>查看技能执行统计：<Link href="/skills/stats" className="text-blue-600 underline hover:text-blue-800">技能统计</Link></li>
            </ol>
          </div>

          <div className="space-y-6">
            {examples.map((example, index) => (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="text-lg">{example.title}</CardTitle>
                  <CardDescription>{example.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">推荐智能体</p>
                    <Badge variant="secondary">{example.agent}</Badge>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">示例对话</p>
                    <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                      <p className="text-gray-600">你：</p>
                      <p className="mt-1 text-gray-900">{example.prompt}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">执行流程</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {example.steps.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">提示</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• 智能体会根据对话内容自动判断是否需要调用技能</li>
              <li>• 您可以明确要求"请使用XXX技能"来触发特定技能</li>
              <li>• 每次技能调用都会记录在日志中，方便追溯</li>
              <li>• 可以在智能体配置页面设置技能优先级和组合</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
