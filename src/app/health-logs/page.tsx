'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  RefreshCw,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { Agent } from '@/types/agent';

interface HealthLog {
  id: string;
  agent_id: string;
  check_type: string;
  online_status: string;
  check_result: {
    online: boolean;
    message?: string;
    details?: string;
    latency?: number;
  };
  error_message: string | null;
  created_at: string;
}

export default function HealthLogsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedAgentId, page]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();
      if (result.success) {
        setAgents(result.data || []);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const agentId = selectedAgentId === 'all' ? '' : selectedAgentId;
      let url = '/api/health-logs';
      if (agentId) {
        url = `/api/agents/${agentId}/health-logs`;
      }
      
      const response = await fetch(`${url}?limit=${pageSize}&offset=${page * pageSize}`);
      const result = await response.json();
      
      if (result.success) {
        setLogs(result.data || []);
        setTotal(result.total || 0);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('确定要清理30天前的日志吗？')) return;
    
    try {
      const agentId = selectedAgentId === 'all' ? '' : selectedAgentId;
      if (agentId) {
        const response = await fetch(`/api/agents/${agentId}/health-logs?days=30`, {
          method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
          alert(result.message);
          fetchLogs();
        }
      }
    } catch (error) {
      console.error('清理日志失败:', error);
    }
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || agentId.substring(0, 8);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">健康检查日志</h1>
          <p className="text-muted-foreground mt-1">
            查看智能体健康检查历史记录，包括检查类型、状态和失败原因
          </p>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">智能体:</span>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择智能体" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部智能体</SelectItem>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>

        {selectedAgentId !== 'all' && (
          <Button variant="outline" onClick={handleClearLogs}>
            <Trash2 className="h-4 w-4 mr-2" />
            清理30天前日志
          </Button>
        )}

        <Badge variant="outline">共 {total} 条记录</Badge>
      </div>

      {/* 日志列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无健康检查日志</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card 
              key={log.id}
              className={`${
                log.online_status === 'online' 
                  ? 'border-l-4 border-l-green-500' 
                  : 'border-l-4 border-l-red-500'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <span className="font-medium">{getAgentName(log.agent_id)}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        log.online_status === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm">
                        {log.online_status === 'online' ? '连接成功' : '连接失败'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.check_type === 'manual' ? '手动检测' : '自动检测'}
                      </Badge>
                    </div>
                    
                    {log.check_result && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-4">
                          <span>消息: <span className="text-foreground">{log.check_result.message}</span></span>
                          {log.check_result.latency && (
                            <span>延迟: <span className="text-foreground">{log.check_result.latency}ms</span></span>
                          )}
                        </div>
                        {log.check_result.details && (
                          <div className="bg-muted/50 p-2 rounded text-xs break-all mt-2">
                            {log.check_result.details}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {log.error_message && !log.check_result?.message && (
                      <div className="text-sm text-red-600 mt-1">
                        错误: {log.error_message}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground text-right">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
