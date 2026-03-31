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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ListTodo, 
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import type { Task } from '@/types/agent';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const result = await response.json();
      
      if (result.success) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
      pending: { label: '待处理', variant: 'secondary', icon: Clock },
      in_progress: { label: '进行中', variant: 'default', icon: AlertCircle },
      completed: { label: '已完成', variant: 'outline', icon: CheckCircle2 },
      failed: { label: '失败', variant: 'destructive', icon: AlertCircle }
    };
    const config = statusMap[status] || statusMap.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
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

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center gap-2">
            <ListTodo className="h-6 w-6" />
            <h1 className="text-xl font-bold">任务报告</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        <div className="grid gap-4">
          {tasks.map(task => (
            <Card 
              key={task.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleViewTask(task)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {task.description || '暂无描述'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>创建时间: {new Date(task.created_at).toLocaleString()}</span>
                    {task.completed_at && (
                      <span>完成时间: {new Date(task.completed_at).toLocaleString()}</span>
                    )}
                  </div>
                  {task.report && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      有报告
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {tasks.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无任务</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>
              查看任务报告和执行情况
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <ScrollArea className="max-h-[60vh] mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{selectedTask.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.description || '暂无描述'}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {getStatusBadge(selectedTask.status)}
                  {getPriorityBadge(selectedTask.priority)}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">创建时间:</span>
                    <p>{new Date(selectedTask.created_at).toLocaleString()}</p>
                  </div>
                  {selectedTask.completed_at && (
                    <div>
                      <span className="text-muted-foreground">完成时间:</span>
                      <p>{new Date(selectedTask.completed_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
                
                {selectedTask.report && (
                  <div>
                    <h4 className="font-semibold mb-2">任务报告</h4>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">{selectedTask.report}</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
