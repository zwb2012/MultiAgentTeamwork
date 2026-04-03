'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Clock, CheckCircle, XCircle, TrendingUp, Loader2, Zap } from 'lucide-react';

interface SkillStats {
  total: number;
  success_rate: string;
  avg_execution_time: number;
  success_count: number;
  failed_count: number;
  by_skill: Array<{
    skill_id: string;
    total: number;
    success: number;
    failed: number;
    total_time: number;
    success_rate: string;
    avg_execution_time: number;
  }>;
  trend: Array<{ date: string; count: number }>;
}

interface Execution {
  id: string;
  skill_id: string;
  agent_id: string;
  params: any;
  result: any;
  execution_time: number;
  success: boolean;
  created_at: string;
}

export default function SkillStatsPage() {
  const [stats, setStats] = useState<SkillStats | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [agentFilter, setAgentFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [days, agentFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取统计数据和执行记录
      const [statsRes, executionsRes] = await Promise.all([
        fetch(`/api/skills/stats?days=${days}&agent_id=${agentFilter === 'all' ? '' : agentFilter}`),
        fetch(`/api/skills/executions?limit=50&agent_id=${agentFilter === 'all' ? '' : agentFilter}`)
      ]);

      const statsData = await statsRes.json();
      const executionsData = await executionsRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }

      if (executionsData.success) {
        setExecutions(executionsData.data);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">技能统计与监控</h1>
          <p className="text-gray-600 mt-2">
            查看技能使用情况、执行趋势和性能指标
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">最近1天</SelectItem>
              <SelectItem value="7">最近7天</SelectItem>
              <SelectItem value="30">最近30天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 总体统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总执行次数</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-gray-500 mt-1">近{days}天</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.success_rate || '0'}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.success_count || 0} 成功 / {stats?.failed_count || 0} 失败
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">平均执行时间</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avg_execution_time || 0}ms</div>
            <p className="text-xs text-gray-500 mt-1">单次执行平均耗时</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">活跃技能数</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.by_skill?.length || 0}</div>
            <p className="text-xs text-gray-500 mt-1">已使用技能总数</p>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <Tabs defaultValue="by-skill" className="w-full">
        <TabsList>
          <TabsTrigger value="by-skill">按技能统计</TabsTrigger>
          <TabsTrigger value="trend">执行趋势</TabsTrigger>
          <TabsTrigger value="logs">执行日志</TabsTrigger>
        </TabsList>

        <TabsContent value="by-skill" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats?.by_skill?.map(skillStat => {
              const successPercent = parseFloat(skillStat.success_rate);
              const barColor = successPercent >= 80 ? 'bg-green-500' : successPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500';

              return (
                <Card key={skillStat.skill_id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{skillStat.skill_id}</CardTitle>
                        <CardDescription>执行 {skillStat.total} 次</CardDescription>
                      </div>
                      <Badge variant={successPercent >= 80 ? 'default' : 'destructive'}>
                        {skillStat.success_rate}% 成功
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>成功率</span>
                        <span className="font-medium">{skillStat.success_rate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${barColor} h-2 rounded-full transition-all`}
                          style={{ width: `${skillStat.success_rate}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">成功</p>
                        <p className="text-xl font-bold text-green-600">{skillStat.success}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">失败</p>
                        <p className="text-xl font-bold text-red-600">{skillStat.failed}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">平均执行时间</p>
                      <p className="text-xl font-bold">{skillStat.avg_execution_time}ms</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="trend" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>执行趋势</CardTitle>
              <CardDescription>最近{days}天的技能使用趋势</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.trend?.map((item, index) => {
                  const maxCount = Math.max(...stats.trend.map(t => t.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                  return (
                    <div key={item.date} className="flex items-center space-x-4">
                      <div className="w-24 text-sm text-gray-500">{item.date}</div>
                      <div className="flex-1 bg-gray-100 rounded-lg h-8 relative">
                        <div
                          className="bg-blue-500 rounded-lg h-8 absolute left-0 top-0 transition-all"
                          style={{ width: `${height}%` }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>执行日志</CardTitle>
              <CardDescription>最近50条技能执行记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {executions.map(execution => (
                  <div
                    key={execution.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {execution.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{execution.skill_id}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(execution.created_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={execution.success ? 'default' : 'destructive'}>
                        {execution.execution_time}ms
                      </Badge>
                    </div>

                    {execution.result && (
                      <div className="mt-3 pl-8">
                        {execution.success ? (
                          <p className="text-sm text-green-700">
                            {execution.result.data
                              ? JSON.stringify(execution.result.data).slice(0, 100) + '...'
                              : '执行成功'}
                          </p>
                        ) : (
                          <p className="text-sm text-red-700">{execution.result.error || '执行失败'}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
