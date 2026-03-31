# 并行节点汇聚方案设计

## 问题描述

当流水线中存在并行节点时，下游节点需要知道何时开始工作：

```
      ┌──> 节点A ──┐
开始 ─┤            ├──> 下游节点C
      └──> 节点B ──┘
```

关键问题：节点C何时开始执行？
- 所有并行节点都完成后？（AND策略）
- 任一并行节点完成后？（OR策略）
- 满足特定条件后？（自定义策略）

---

## 方案对比

### 方案A：冗余消息法

**工作原理：**
1. 每个并行节点完成后，主动向下游节点发送消息
2. 下游节点收到消息后检查前置条件
3. 满足条件后开始工作

**数据模型：**
```typescript
// pipeline_nodes 表新增字段
{
  wait_condition: {
    type: 'all' | 'any' | 'custom',
    upstream_nodes: ['node_a_id', 'node_b_id'],
    expression: 'completed_count >= 2' // 自定义条件
  }
}
```

**消息流程：**
```
节点A完成 -> 向节点C发送消息 -> C检查条件 -> 等待
节点B完成 -> 向节点C发送消息 -> C检查条件 -> 开始工作
```

**优点：**
- 简单直接，消息驱动
- 灵活，支持多种策略
- 无需修改节点类型

**缺点：**
- 下游节点需要维护等待状态
- 可能有冗余消息
- 并行节点需要知道下游节点是谁（耦合）

---

### 方案B：汇聚网关法

**工作原理：**
在并行节点和下游节点之间插入"汇聚网关"节点

**流水线结构：**
```
      ┌──> 节点A ──┐
开始 ─┤            ├──> [汇聚网关] ──> 节点C
      └──> 节点B ──┘
```

**网关配置：**
```typescript
{
  node_type: 'gateway',
  gateway_type: 'parallel_join', // 并行汇聚
  merge_strategy: 'all', // all | any | custom
  upstream_nodes: ['node_a_id', 'node_b_id']
}
```

**优点：**
- 职责清晰，符合BPMN规范
- 下游节点无需关心汇聚逻辑
- 可视化更直观

**缺点：**
- 增加了流水线复杂度
- 用户需要手动配置汇聚网关
- 流水线节点数增加

---

### 方案C：条件等待法

**工作原理：**
下游节点启动后进入"等待"状态，直到满足条件

**状态机：**
```
pending -> waiting -> running -> completed
                ↑
            检查条件满足后
```

**节点状态扩展：**
```typescript
// pipeline_node_runs 表
{
  status: 'pending' | 'waiting' | 'running' | 'completed' | 'failed',
  wait_status: {
    required_nodes: ['node_a_id', 'node_b_id'],
    completed_nodes: ['node_a_id'], // 已完成的前置节点
    merge_strategy: 'all'
  }
}
```

**优点：**
- 状态清晰
- 支持复杂条件
- 无需额外节点类型

**缺点：**
- 节点状态复杂化
- 需要额外的状态管理
- 等待中的节点占用资源

---

### 方案D：群组会话 + 汇聚策略（推荐）

**核心思想：**
将流水线执行与智能体协作分离，使用群组会话作为通信层

**架构设计：**

```
┌─────────────────────────────────────────┐
│            流水线执行层                   │
│  ┌─────┐   ┌─────┐   ┌─────┐           │
│  │节点A│   │节点B│   │节点C│           │
│  └──┬──┘   └──┬──┘   └──┬──┘           │
│     │         │         │               │
└─────┼─────────┼─────────┼───────────────┘
      │         │         │
      v         v         v
┌─────────────────────────────────────────┐
│            群组通信层                     │
│                                         │
│   [项目群组: pipeline-run-xxx]          │
│   成员: AgentA, AgentB, AgentC          │
│                                         │
│   AgentA: 我已完成任务A                   │
│   AgentB: 我已完成任务B                   │
│   系统: 所有前置节点已完成，AgentC请开始    │
│   AgentC: 收到，开始工作...              │
└─────────────────────────────────────────┘
```

**数据模型扩展：**

```typescript
// 1. 会话类型
// conversations 表新增字段
{
  type: 'private' | 'group' | 'pipeline', // 私聊 | 群组 | 流水线专属
  pipeline_run_id: string | null, // 关联的流水线运行ID
  config: {
    is_public: boolean, // 是否为大厅（所有人可见）
  }
}

// 2. 流水线节点新增汇聚策略
// pipeline_nodes 表新增字段
{
  merge_strategy: 'all' | 'any' | 'custom', // 汇聚策略
  upstream_nodes: string[], // 上游节点ID列表
  custom_condition: string, // 自定义条件表达式
}

// 3. 流水线运行关联群组
// pipeline_runs 表新增字段
{
  conversation_id: string, // 关联的群组会话ID
}
```

**执行流程：**

1. **流水线启动**
   - 创建群组会话
   - 所有相关智能体加入群组
   - 系统发送"流水线开始"消息

2. **并行节点执行**
   - 节点A、B同时开始执行
   - 智能体A、B在群组内发送工作消息
   - 独立会话进行详细对话

3. **汇聚检查**
   - 节点A完成后，智能体A在群组发送"任务A完成"
   - 系统检查汇聚策略
   - 节点B完成后，系统发现所有前置节点完成
   - 系统发送"所有前置节点已完成，智能体C请开始"

4. **下游节点启动**
   - 智能体C收到通知，开始工作
   - 在群组内发送工作状态

**优点：**
- ✅ 通信层与执行层分离，职责清晰
- ✅ 所有智能体协作可视化（在群组会话中）
- ✅ 支持独立会话（私聊）和群组会话
- ✅ 汇聚逻辑由系统处理，无需额外节点
- ✅ 便于调试和监控

**缺点：**
- 需要实现会话类型管理
- 消息数量可能较多（但可通过过滤解决）

---

## 推荐方案：D + B简化版

结合方案D和方案B的优点，提供两种模式：

### 模式1：自动汇聚（推荐给简单场景）
- 在节点配置中设置 `merge_strategy`
- 系统自动处理汇聚逻辑
- 通过群组会话通知

### 模式2：显式汇聚网关（推荐给复杂场景）
- 用户可插入"汇聚网关"节点
- 支持复杂的汇聚条件
- 更直观的可视化

---

## 实现细节

### 1. 会话类型扩展

```typescript
// src/types/conversation.ts
export type ConversationType = 'private' | 'group' | 'pipeline';

export interface Conversation {
  id: string;
  title: string;
  type: ConversationType;
  
  // 群组会话专属
  pipeline_run_id?: string;
  is_public?: boolean; // 大厅模式
  
  // 参与者
  participants: string[]; // agent_ids
  
  // 状态
  status: 'active' | 'archived' | 'completed';
}
```

### 2. 节点汇聚配置

```typescript
// src/types/pipeline.ts
export interface PipelineNode {
  id: string;
  name: string;
  node_type: 'agent' | 'task' | 'gateway' | 'condition' | 'delay';
  
  // 执行配置
  agent_id?: string;
  execution_mode: 'sequential' | 'parallel';
  parallel_group?: string;
  
  // 汇聚配置（当 node_type === 'gateway' 或需要自动汇聚时）
  merge_strategy?: 'all' | 'any' | 'custom';
  upstream_nodes?: string[];
  custom_condition?: string;
}
```

### 3. 群组消息类型

```typescript
// src/types/message.ts
export type MessageType = 
  | 'text'           // 普通文本
  | 'system'         // 系统消息
  | 'task_start'     // 任务开始
  | 'task_complete'  // 任务完成
  | 'task_failed'    // 任务失败
  | 'notification';  // 通知

export interface Message {
  id: string;
  conversation_id: string;
  agent_id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  
  // 消息类型
  message_type: MessageType;
  
  // 元数据
  metadata?: {
    task_id?: string;
    node_id?: string;
    pipeline_run_id?: string;
    [key: string]: any;
  };
}
```

### 4. 流水线执行引擎

```typescript
// src/lib/pipeline-engine.ts
export class PipelineEngine {
  // 执行流水线
  async run(pipelineId: string): Promise<PipelineRun> {
    // 1. 创建群组会话
    const conversation = await this.createPipelineGroup(pipelineId);
    
    // 2. 初始化节点状态
    await this.initializeNodeRuns(pipelineId);
    
    // 3. 开始执行
    await this.executeNodes(pipelineId);
    
    return run;
  }
  
  // 创建流水线群组
  async createPipelineGroup(pipelineId: string): Promise<Conversation> {
    const pipeline = await this.getPipeline(pipelineId);
    const agents = this.extractAgents(pipeline.nodes);
    
    // 创建群组会话
    const conversation = await this.createConversation({
      type: 'pipeline',
      title: `流水线: ${pipeline.name}`,
      participants: agents,
      pipeline_run_id: runId
    });
    
    // 发送欢迎消息
    await this.sendSystemMessage(conversation.id, 
      `流水线 "${pipeline.name}" 开始执行，共有 ${pipeline.nodes.length} 个节点`);
    
    return conversation;
  }
  
  // 执行节点
  async executeNodes(pipelineId: string): Promise<void> {
    const nodes = await this.getSortedNodes(pipelineId);
    
    // 分组：并行组和串行组
    const groups = this.groupNodes(nodes);
    
    for (const group of groups) {
      if (group.length === 1) {
        // 串行执行
        await this.executeNode(group[0]);
      } else {
        // 并行执行
        await Promise.all(group.map(node => this.executeNode(node)));
      }
      
      // 检查汇聚
      await this.checkMergeCondition(group);
    }
  }
  
  // 执行单个节点
  async executeNode(node: PipelineNode): Promise<void> {
    // 更新状态为运行中
    await this.updateNodeStatus(node.id, 'running');
    
    // 在群组发送消息
    await this.sendMessage({
      conversation_id: this.groupConversationId,
      agent_id: node.agent_id,
      message_type: 'task_start',
      content: `我开始执行任务: ${node.name}`
    });
    
    // 调用智能体执行
    const result = await this.invokeAgent(node.agent_id, node.input_config);
    
    // 更新状态为完成
    await this.updateNodeStatus(node.id, 'completed', result);
    
    // 在群组发送消息
    await this.sendMessage({
      conversation_id: this.groupConversationId,
      agent_id: node.agent_id,
      message_type: 'task_complete',
      content: `任务 "${node.name}" 已完成`
    });
  }
  
  // 检查汇聚条件
  async checkMergeCondition(completedGroup: PipelineNode[]): Promise<void> {
    // 找到下游节点
    const downstreamNodes = await this.findDownstreamNodes(completedGroup);
    
    for (const downstream of downstreamNodes) {
      const upstreamNodes = downstream.upstream_nodes || completedGroup.map(n => n.id);
      const strategy = downstream.merge_strategy || 'all';
      
      // 检查上游节点完成情况
      const completedUpstream = await this.getCompletedNodes(upstreamNodes);
      
      if (strategy === 'all' && completedUpstream.length === upstreamNodes.length) {
        // 所有上游节点完成，通知下游节点开始
        await this.notifyNodeStart(downstream);
      } else if (strategy === 'any' && completedUpstream.length > 0) {
        // 任一上游节点完成，通知下游节点开始
        await this.notifyNodeStart(downstream);
      }
      // custom 策略需要评估自定义条件...
    }
  }
  
  // 通知节点开始
  async notifyNodeStart(node: PipelineNode): Promise<void> {
    await this.sendSystemMessage(this.groupConversationId,
      `所有前置节点已完成，${node.name} 请开始工作`);
    
    // 启动节点执行
    await this.executeNode(node);
  }
}
```

### 5. 前端可视化

使用 React Flow 实现流水线可视化：

```typescript
// src/components/pipeline/PipelineFlow.tsx
import ReactFlow, { 
  Node, 
  Edge, 
  Background, 
  Controls,
  MarkerType 
} from 'reactflow';

export function PipelineFlow({ pipeline }: { pipeline: Pipeline }) {
  // 将流水线节点转换为React Flow节点
  const nodes: Node[] = pipeline.nodes.map((node, index) => ({
    id: node.id,
    type: node.node_type === 'gateway' ? 'gatewayNode' : 'agentNode',
    position: { x: index * 200, y: node.parallel_group ? 100 : 0 },
    data: {
      label: node.name,
      status: node.status,
      agent: node.agent_id
    }
  }));
  
  // 生成边（节点间的连接）
  const edges: Edge[] = [];
  
  // 根据执行顺序和并行组生成边
  for (let i = 0; i < pipeline.nodes.length - 1; i++) {
    const current = pipeline.nodes[i];
    const next = pipeline.nodes[i + 1];
    
    // 并行节点不相互连接
    if (current.parallel_group !== next.parallel_group) {
      edges.push({
        id: `${current.id}-${next.id}`,
        source: current.id,
        target: next.id,
        markerEnd: { type: MarkerType.ArrowClosed }
      });
    }
  }
  
  return (
    <div className="h-96">
      <ReactFlow nodes={nodes} edges={edges}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

---

## 用户界面设计

### 1. 会话列表

```
┌─────────────────────────────┐
│ 会话列表                      │
├─────────────────────────────┤
│ 🔵 流水线: 需求分析流程        │ <- pipeline类型，多人协作
│    AgentA: 我已完成...        │
├─────────────────────────────┤
│ 👥 项目讨论组                 │ <- group类型，群组会话
│    AgentB: 好的，我来看...    │
├─────────────────────────────┤
│ 💬 AgentA                    │ <- private类型，私聊
│    你好，有什么可以帮你的...   │
└─────────────────────────────┘
```

### 2. 流水线编辑器

```
┌─────────────────────────────────────────┐
│ 流水线: 需求分析流程                       │
├─────────────────────────────────────────┤
│                                         │
│   [开始] ──> [需求收集] ──┬──> [需求分析] │
│                          │              │
│                          └──> [技术评审] │
│                                         │
│                          ┌── [汇聚网关]  │
│                          │              │
│                          └──> [生成文档] │
│                                         │
├─────────────────────────────────────────┤
│ 节点配置:                                │
│ 名称: 需求分析                            │
│ 智能体: AgentA                           │
│ 执行模式: 并行                            │
│ 汇聚策略: 所有前置节点完成                │
└─────────────────────────────────────────┘
```

### 3. 流水线执行视图

```
┌─────────────────────────────────────────┐
│ 流水线执行: 需求分析流程 #run-123         │
├─────────────────────────────────────────┤
│ 状态: 运行中  进度: 3/5 节点              │
├─────────────────────────────────────────┤
│                                         │
│   ✅ [需求收集] 已完成                    │
│          │                              │
│          ├── 🔄 [需求分析] 执行中...      │
│          │                              │
│          └── ⏳ [技术评审] 等待中         │
│                                         │
│   ⏳ [汇聚网关] 等待前置节点              │
│          │                              │
│          └── ⏸️ [生成文档] 待执行         │
│                                         │
├─────────────────────────────────────────┤
│ 群组消息:                                │
│ AgentA: 我已完成需求收集                  │
│ AgentB: 收到，开始需求分析...             │
│ AgentC: 我在等需求分析完成               │
└─────────────────────────────────────────┘
```

---

## 总结

**推荐方案：D + B简化版**

1. **核心机制：群组会话 + 自动汇聚**
   - 每个流水线运行创建一个群组会话
   - 智能体在群组内协作
   - 系统自动处理并行节点汇聚

2. **可选机制：显式汇聚网关**
   - 复杂场景可插入汇聚网关节点
   - 支持自定义汇聚条件

3. **双会话模式**
   - 群组会话：协作、通知、状态同步
   - 独立会话：详细对话、私聊

4. **可视化**
   - React Flow 展示流程图
   - 节点状态实时更新
   - 消息流实时展示
