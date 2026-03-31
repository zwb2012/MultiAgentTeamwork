'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Ticket as TicketIcon, 
  Plus,
  Bug,
  Lightbulb,
  Wrench,
  ArrowRight,
  User,
  ListTodo
} from 'lucide-react';
import type { Ticket, Agent, TicketType, TicketPriority } from '@/types/agent';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isFlowDialogOpen, setIsFlowDialogOpen] = useState(false);
  const [flowData, setFlowData] = useState({
    status: '',
    assignee_id: '',
    comment: ''
  });
  
  // 创建工单表单
  const [createFormData, setCreateFormData] = useState({
    type: 'bug' as TicketType,
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    assignee_id: ''
  });

  useEffect(() => {
    fetchTickets();
    fetchAgents();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets');
      const result = await response.json();
      
      if (result.success) {
        setTickets(result.data);
      }
    } catch (error) {
      console.error('获取工单列表失败:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error('获取智能体列表失败:', error);
    }
  };

  // 创建工单
  const handleCreateTicket = async () => {
    if (!createFormData.title) {
      alert('请输入工单标题');
      return;
    }

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createFormData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        setCreateFormData({
          type: 'bug',
          title: '',
          description: '',
          priority: 'medium',
          assignee_id: ''
        });
        fetchTickets();
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建工单失败:', error);
      alert('创建失败');
    }
  };

  const handleFlowTicket = async () => {
    if (!selectedTicket) return;
    
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: flowData.status,
          assignee_id: flowData.assignee_id,
          comment: flowData.comment,
          operator_id: agents[0]?.id
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsFlowDialogOpen(false);
        fetchTickets();
        setFlowData({ status: '', assignee_id: '', comment: '' });
      } else {
        alert('流转失败: ' + result.error);
      }
    } catch (error) {
      console.error('流转工单失败:', error);
      alert('流转失败');
    }
  };

  const getTypeIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      bug: Bug,
      feature: Lightbulb,
      improvement: Wrench
    };
    return iconMap[type] || TicketIcon;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      open: { label: '待处理', variant: 'secondary' },
      in_progress: { label: '处理中', variant: 'default' },
      resolved: { label: '已解决', variant: 'outline' },
      closed: { label: '已关闭', variant: 'outline' }
    };
    const config = statusMap[status] || statusMap.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      low: { label: '低', variant: 'secondary' },
      medium: { label: '中', variant: 'outline' },
      high: { label: '高', variant: 'default' },
      critical: { label: '紧急', variant: 'destructive' }
    };
    const config = priorityMap[priority] || priorityMap.medium;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">工单流转</h1>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建工单
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8">
        <div className="grid gap-4">
          {tickets.map((ticket: any) => {
            const TypeIcon = getTypeIcon(ticket.type);
            return (
              <Card key={ticket.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <TypeIcon className="h-5 w-5 mt-1 text-muted-foreground" />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{ticket.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {ticket.description || '暂无描述'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {ticket.assignee && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>负责人: {ticket.assignee.name}</span>
                        </div>
                      )}
                      <span>
                        创建: {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setFlowData({
                          status: ticket.status,
                          assignee_id: ticket.assignee_id || '',
                          comment: ''
                        });
                        setIsFlowDialogOpen(true);
                      }}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      流转
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {tickets.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TicketIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">暂无工单</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建第一个工单
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* 创建工单对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建工单</DialogTitle>
            <DialogDescription>
              创建新的Bug单或工单
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>工单类型 *</Label>
              <Select 
                value={createFormData.type} 
                onValueChange={(value: TicketType) => setCreateFormData({ ...createFormData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      Bug修复
                    </div>
                  </SelectItem>
                  <SelectItem value="feature">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      新功能
                    </div>
                  </SelectItem>
                  <SelectItem value="improvement">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      改进优化
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input
                value={createFormData.title}
                onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                placeholder="输入工单标题"
              />
            </div>
            
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={createFormData.description}
                onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                placeholder="详细描述问题或需求"
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select 
                value={createFormData.priority} 
                onValueChange={(value: TicketPriority) => setCreateFormData({ ...createFormData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="critical">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>指派给</Label>
              <Select 
                value={createFormData.assignee_id} 
                onValueChange={(value) => setCreateFormData({ ...createFormData, assignee_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateTicket}>
              创建工单
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 流转对话框 */}
      <Dialog open={isFlowDialogOpen} onOpenChange={setIsFlowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>工单流转</DialogTitle>
            <DialogDescription>
              更新工单状态和负责人
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>状态</Label>
              <Select 
                value={flowData.status} 
                onValueChange={(value) => setFlowData({ ...flowData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">待处理</SelectItem>
                  <SelectItem value="in_progress">处理中</SelectItem>
                  <SelectItem value="resolved">已解决</SelectItem>
                  <SelectItem value="closed">已关闭</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>负责人</Label>
              <Select 
                value={flowData.assignee_id} 
                onValueChange={(value) => setFlowData({ ...flowData, assignee_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={flowData.comment}
                onChange={(e) => setFlowData({ ...flowData, comment: e.target.value })}
                placeholder="流转说明"
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsFlowDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleFlowTicket}>
              确认流转
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
