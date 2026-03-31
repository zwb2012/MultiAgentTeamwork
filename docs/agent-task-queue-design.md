# 智能体任务队列设计

## 核心问题
智能体作为"员工"，需要能够：
1. 知道自己被分配了什么任务
2. 知道哪些会话需要自己参与
3. 在工单流转时收到通知

## 解决方案

### 1. 智能体任务队列 API

```typescript
// GET /api/agents/{id}/tasks - 获取智能体待办任务
{
  "tasks": [
    {
      "type": "ticket",           // 任务类型
      "ticket_id": "xxx",
      "title": "登录页Bug修复",
      "priority": "high",
      "status": "in_progress",
      "assigned_at": "2024-01-01T10:00:00Z",
      "due_date": "2024-01-03T18:00:00Z"
    },
    {
      "type": "conversation",     // 会话邀请
      "conversation_id": "xxx",
      "title": "需求讨论会",
      "mentioned": true,          // 被@了
      "created_at": "..."
    }
  ],
  "summary": {
    "pending_tickets": 3,
    "active_conversations": 2,
    "mentions": 1
  }
}
```

### 2. 工单流转时创建任务记录

```typescript
// 工单流转逻辑
async function assignTicket(ticketId: string, assigneeId: string) {
  // 1. 更新工单
  await updateTicket(ticketId, { assignee_id: assigneeId });
  
  // 2. 创建任务记录（关键！）
  await createAgentTask({
    agent_id: assigneeId,
    task_type: 'ticket',
    reference_id: ticketId,
    status: 'pending',
    notification_sent: false
  });
  
  // 3. 触发通知（可选：发送到外部系统）
  await notifyAgent(assigneeId, {
    type: 'ticket_assigned',
    ticket_id: ticketId,
    message: `你被分配了新工单：${ticket.title}`
  });
}
```

### 3. 对话时注入任务上下文

```typescript
// 智能体对话时，自动注入上下文
async function chat(agentId: string, message: string) {
  // 获取智能体信息
  const agent = await getAgent(agentId);
  
  // 获取待办任务（关键！）
  const tasks = await getAgentTasks(agentId);
  
  // 构建系统提示词
  const systemPrompt = `
${agent.system_prompt}

## 当前任务状态
你当前有 ${tasks.length} 个待处理任务：
${tasks.map(t => `- [${t.priority}] ${t.title} (状态: ${t.status})`).join('\n')}

当用户询问你的工作或任务时，请告知当前的待办事项。
`;
  
  // 调用LLM
  return await callLLM(systemPrompt, message);
}
```

### 4. 会话@机制与任务关联

```typescript
// 会话中@智能体时
async function mentionAgent(conversationId: string, agentId: string) {
  // 1. 添加为参与者
  await addParticipant(conversationId, agentId);
  
  // 2. 创建任务记录
  await createAgentTask({
    agent_id: agentId,
    task_type: 'conversation',
    reference_id: conversationId,
    status: 'pending',
    metadata: { mentioned: true }
  });
}
```

## 数据模型扩展

### agent_tasks 表

```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id),
  task_type VARCHAR(20) NOT NULL,  -- 'ticket' | 'conversation' | 'pipeline'
  reference_id UUID NOT NULL,       -- 工单ID/会话ID/流水线ID
  status VARCHAR(20) NOT NULL,      -- 'pending' | 'in_progress' | 'completed'
  priority VARCHAR(20),
  metadata JSONB,
  assigned_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 智能体身份认知增强

### 方案A：在 system_prompt 中注入身份标识

```typescript
const systemPrompt = `
你是一个AI智能体，名字是"${agent.name}"。

## 重要：身份识别规则
- 当有人提到"${agent.name}"或在对话中@你时，就是在和你说话
- 你的ID是 "${agent.id}"，任何分配给你ID的任务都是你的责任
- 当被问到"你是谁"时，请回答你的名字"${agent.name}"

## 当前工作状态
- 在线状态: ${agent.online_status}
- 工作状态: ${agent.work_status}
- 待处理任务: ${tasks.length} 个

${agent.system_prompt}
`;
```

### 方案B：结构化身份元数据

```typescript
// 智能体增加身份元数据
interface Agent {
  // ...existing fields
  
  identity: {
    name: string;           // 显示名称
    aliases: string[];      // 别名（可被识别的称呼）
    skills: string[];       // 技能标签
    responsibilities: string[]; // 职责范围
  };
}
```

## 实现优先级

### 第一阶段（基础）
1. 创建 `agent_tasks` 表
2. 实现 `/api/agents/{id}/tasks` API
3. 工单流转时创建任务记录
4. 对话时注入任务上下文

### 第二阶段（增强）
1. 会话@时创建任务
2. 任务完成状态同步
3. 任务优先级排序

### 第三阶段（智能化）
1. 任务到期提醒
2. 任务冲突检测
3. 自动任务分配建议
