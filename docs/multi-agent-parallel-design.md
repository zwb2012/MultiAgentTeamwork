# 多智能体并行响应方案设计

## 1. 问题分析

### 当前问题
在会话中同时@多个智能体时，只有一个智能体正常工作。

### 根本原因
1. **智能体识别逻辑问题**（`chat/route.ts` 第113-130行）
   - 检测到第一个匹配的智能体后就 `break`，停止后续检测
   - 最终只选择一个 `targetAgent`

2. **流式响应限制**（`chat/route.ts` 第276-336行）
   - 只对一个智能体进行LLM调用
   - SSE流只能输出一个智能体的响应

### 用户期望
- 同时@多个智能体时，所有智能体都应该并行工作
- 每个智能体都能独立响应
- 用户能够看到所有智能体的输出

## 2. 设计方案：混合并行流式响应

### 2.1 核心思路
```
用户消息: "@前端专家 @后端专家 请设计一个API"
              ↓
        检测所有@的智能体
              ↓
     并行启动2个LLM调用
              ↓
     ┌─────────────────────┐
     │                     │
  流1 (前端专家)       流2 (后端专家)
     │                     │
     └─────┬───────────────┘
           ↓
      流合并器
           ↓
      SSE流输出
```

### 2.2 架构设计

#### 组件划分
1. **智能体检测器**（AgentDetector）
   - 检测消息中所有@的智能体
   - 支持名称和角色双重识别
   - 返回目标智能体列表

2. **流合并器**（StreamMerger）
   - 合并多个智能体的输出流
   - 为每个输出块标记来源
   - 管理并发状态

3. **并行调用管理器**（ParallelCallManager）
   - 并行启动多个LLM调用
   - 收集所有响应
   - 处理错误和超时

4. **响应存储器**（ResponseStorage）
   - 异步保存每个智能体的完整响应
   - 保存到数据库
   - 更新智能体状态

### 2.3 数据流设计

#### 输入流（LLM Stream）
```typescript
{
  content: "你好",
  timestamp: 1234567890
}
```

#### 合并后的输出流（Merged Stream）
```typescript
{
  agent_id: "agent_1",
  agent_name: "前端专家",
  content: "你好",
  timestamp: 1234567890,
  stream_id: "stream_1"
}
```

## 3. 详细实现方案

### 3.1 智能体检测器

**文件位置**：`src/lib/chat/agent-detector.ts`

```typescript
import type { Agent } from '@/types/agent';
import { AGENT_ROLE_TEMPLATES } from '@/types/agent';

export interface DetectedAgent {
  agent: Agent;
  matchText: string; // 匹配的文本（用于排序）
}

export class AgentDetector {
  /**
   * 检测消息中所有@的智能体
   * @param message 用户消息
   * @param participants 会话参与者列表
   * @returns 检测到的智能体列表
   */
  detectMentionedAgents(message: string, participants: any[]): DetectedAgent[] {
    const mentions = message.match(/@([^\s@]+)/g) || [];
    const detectedAgents: DetectedAgent[] = [];

    for (const match of mentions) {
      const mentionName = match.slice(1).toLowerCase();
      const found = this.findAgentByName(mentionName, participants);
      if (found) {
        detectedAgents.push({
          agent: found.agent,
          matchText: match
        });
      }
    }

    // 按出现顺序排序
    return detectedAgents;
  }

  /**
   * 通过名称查找智能体
   */
  private findAgentByName(name: string, participants: any[]): { agent: Agent } | null {
    for (const p of participants) {
      const agent = p.agents as unknown as Agent;
      const agentName = agent.name?.toLowerCase();
      const roleName = this.getAgentRoleName(agent)?.toLowerCase();

      if ((agentName && agentName === name) || (roleName && roleName === name)) {
        return { agent };
      }
    }
    return null;
  }

  /**
   * 获取智能体的角色名称
   */
  private getAgentRoleName(agent: Agent): string | null {
    const roleTemplate = AGENT_ROLE_TEMPLATES.find(t => t.role === agent.role);
    return roleTemplate?.name || null;
  }
}
```

### 3.2 流合并器

**文件位置**：`src/lib/chat/stream-merger.ts`

```typescript
/**
 * 流合并器 - 合并多个智能体的输出流
 */
export class StreamMerger {
  private streams: Map<string, ReadableStream> = new Map();
  private encoder = new TextEncoder();
  private activeCount = 0;
  private controller?: ReadableStreamDefaultController;

  /**
   * 添加一个流
   * @param streamId 流ID
   * @param agent 智能体信息
   * @param stream 输入流
   */
  addStream(streamId: string, agent: any, stream: ReadableStream) {
    this.streams.set(streamId, stream);
    this.activeCount++;

    // 异步读取流数据
    this.readStream(streamId, agent, stream).catch(error => {
      console.error(`读取流 ${streamId} 失败:`, error);
      this.activeCount--;
      this.checkAllDone();
    });
  }

  /**
   * 读取流数据
   */
  private async readStream(streamId: string, agent: any, stream: ReadableStream) {
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (this.controller) {
        const data = JSON.stringify({
          content: value,
          agent_id: agent.id,
          agent_name: agent.name,
          stream_id: streamId
        });
        this.controller.enqueue(this.encoder.encode(`data: ${data}\n\n`));
      }
    }

    this.activeCount--;
    this.checkAllDone();
  }

  /**
   * 检查是否所有流都已完成
   */
  private checkAllDone() {
    if (this.activeCount === 0 && this.controller) {
      this.controller.enqueue(this.encoder.encode('data: [DONE]\n\n'));
      this.controller.close();
    }
  }

  /**
   * 获取合并后的流
   */
  getMergedStream(): ReadableStream {
    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      }
    });
  }

  /**
   * 取消所有流
   */
  cancelAll() {
    this.streams.forEach(stream => {
      stream.cancel();
    });
    if (this.controller) {
      this.controller.close();
    }
  }
}
```

### 3.3 并行调用管理器

**文件位置**：`src/lib/chat/parallel-call-manager.ts`

```typescript
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { StreamMerger } from './stream-merger';

export interface AgentCallResult {
  agent_id: string;
  agent_name: string;
  success: boolean;
  response?: string;
  error?: string;
}

export class ParallelCallManager {
  private merger = new StreamMerger();
  private results: Map<string, AgentCallResult> = new Map();

  /**
   * 并行调用多个智能体
   * @param agents 目标智能体列表
   * @param messages 消息列表
   * @param llmConfigs 每个智能体的LLM配置
   * @returns 合并后的流
   */
  async parallelCall(
    agents: any[],
    messages: any[],
    llmConfigs: any[]
  ): Promise<ReadableStream> {
    const promises = agents.map((agent, index) => {
      const streamId = `stream_${agent.id}`;
      const config = llmConfigs[index];
      const llmClient = new LLMClient(config);

      return this.createAgentStream(streamId, agent, llmClient, messages, config);
    });

    // 启动所有流（但不等待完成）
    await Promise.all(promises);

    return this.merger.getMergedStream();
  }

  /**
   * 为单个智能体创建流
   */
  private async createAgentStream(
    streamId: string,
    agent: any,
    llmClient: LLMClient,
    messages: any[],
    llmConfig: any
  ): Promise<void> {
    const encoder = new TextEncoder();

    try {
      const agentStream = new ReadableStream({
        async start(controller) {
          let fullResponse = '';

          try {
            const llmStream = llmClient.stream(messages, llmConfig);
            for await (const chunk of llmStream) {
              if (chunk.content) {
                const text = chunk.content.toString();
                fullResponse += text;
                controller.enqueue(text);
              }
            }

            // 保存结果
            this.results.set(agent.id, {
              agent_id: agent.id,
              agent_name: agent.name,
              success: true,
              response: fullResponse
            });
          } catch (error) {
            this.results.set(agent.id, {
              agent_id: agent.id,
              agent_name: agent.name,
              success: false,
              error: error instanceof Error ? error.message : '未知错误'
            });
            throw error;
          } finally {
            controller.close();
          }
        }
      });

      this.merger.addStream(streamId, agent, agentStream);
    } catch (error) {
      console.error(`创建智能体 ${agent.name} 的流失败:`, error);
    }
  }

  /**
   * 获取所有智能体的响应结果
   */
  getResults(): AgentCallResult[] {
    return Array.from(this.results.values());
  }

  /**
   * 取消所有调用
   */
  cancelAll() {
    this.merger.cancelAll();
  }
}
```

### 3.4 修改 Chat API

**文件位置**：`src/app/api/chat/route.ts`

**修改点1：检测所有@的智能体**
```typescript
// 原代码（第103-173行）：只选择一个智能体
let targetAgent: any = null;

// 新代码：检测所有@的智能体
import { AgentDetector } from '@/lib/chat/agent-detector';

const agentDetector = new AgentDetector();
const detectedAgents = agentDetector.detectMentionedAgents(user_message, participants);

if (detectedAgents.length === 0) {
  // 没有检测到@，使用原有逻辑
  // ...
} else if (detectedAgents.length === 1) {
  // 只有一个智能体，使用原有逻辑
  targetAgent = detectedAgents[0].agent;
  // ...
} else {
  // 多个智能体，使用并行响应逻辑
  return await handleParallelAgents(
    detectedAgents.map(d => d.agent),
    conversation_id,
    user_message,
    projectContext,
    participants
  );
}
```

**修改点2：添加并行处理函数**
```typescript
/**
 * 处理多智能体并行响应
 */
async function handleParallelAgents(
  agents: any[],
  conversation_id: string,
  user_message: string,
  projectContext: any,
  participants: any[]
): Promise<Response> {
  const client = getSupabaseClient();
  const encoder = new TextEncoder();

  // 1. 更新所有智能体状态为工作中
  await Promise.all(
    agents.map(agent =>
      client
        .from('agents')
        .update({ work_status: 'working', updated_at: new Date().toISOString() })
        .eq('id', agent.id)
    )
  );

  // 2. 获取历史消息
  const { data: historyMessages } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .limit(20);

  // 3. 为每个智能体构建消息
  const messagesArray = agents.map(agent => {
    let systemPrompt = injectProjectContext(agent.system_prompt, projectContext);
    const agentTasks = await getAgentTasks(agent.id);
    systemPrompt = injectTaskContext(systemPrompt, agentTasks);

    const messages = [{ role: 'system', content: systemPrompt }];

    if (historyMessages) {
      historyMessages.forEach((msg: any) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: user_message });
    return messages;
  });

  // 4. 构建每个智能体的LLM配置
  const llmConfigs = agents.map(agent => {
    const agentModelConfig = agent.model_config || {};
    const modelName = agent.model || 'doubao-seed-1-8-251228';

    return {
      model: modelName,
      temperature: agentModelConfig.temperature || 0.7,
      thinking: agentModelConfig.thinking || 'disabled',
      caching: agentModelConfig.caching || 'disabled'
    };
  });

  // 5. 保存用户消息（只保存一次）
  await client.from('messages').insert({
    conversation_id,
    agent_id: agents[0].id,
    role: 'user',
    content: user_message,
    message_type: 'text'
  });

  // 6. 并行调用所有智能体
  const { ParallelCallManager } = await import('@/lib/chat/parallel-call-manager');
  const manager = new ParallelCallManager();

  const stream = await manager.parallelCall(agents, messagesArray, llmConfigs);

  // 7. 创建新的流包装器，用于保存响应和更新状态
  const wrapperStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 转发数据
          controller.enqueue(value);

          // 解析数据以保存响应
          const text = value.toString();
          const match = text.match(/data: (.+)\n\n/);
          if (match) {
            const data = JSON.parse(match[1]);

            // 这里可以添加临时存储逻辑
            // 完整响应在流结束后保存
          }
        }

        // 8. 流结束后，保存所有智能体的响应
        const results = manager.getResults();
        await Promise.all(
          results.map(result => {
            if (result.success) {
              return client.from('messages').insert({
                conversation_id,
                agent_id: result.agent_id,
                role: 'assistant',
                content: result.response || '',
                message_type: 'text',
                metadata: {
                  agent_name: result.agent_name,
                  parallel_mode: true
                }
              });
            }
          })
        );

        // 9. 更新所有智能体状态为空闲
        await Promise.all(
          agents.map(agent =>
            client
              .from('agents')
              .update({ work_status: 'idle', updated_at: new Date().toISOString() })
              .eq('id', agent.id)
          )
        );

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('并行处理失败:', error);

        // 更新所有智能体状态为空闲
        await Promise.all(
          agents.map(agent =>
            client
              .from('agents')
              .update({ work_status: 'idle', updated_at: new Date().toISOString() })
              .eq('id', agent.id)
          )
        );

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: '并行处理失败' })}\n\n`)
        );
        controller.close();
      }
    }
  });

  return new Response(wrapperStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

## 4. 前端适配

### 4.1 消息显示优化

**问题**：多个智能体的输出混在一起，用户难以区分

**解决方案**：
1. 为每个智能体的输出添加标识标签
2. 按智能体分组显示
3. 使用不同颜色区分智能体

```typescript
// src/components/chat/ChatMessage.tsx
interface ChatMessageProps {
  message: Message;
  agents?: Agent[];
}

export function ChatMessage({ message, agents }: ChatMessageProps) {
  // 检测是否是多智能体并行响应
  const isParallelMode = message.metadata?.parallel_mode;

  if (isParallelMode) {
    return <ParallelAgentMessage message={message} agents={agents} />;
  }

  return <SingleAgentMessage message={message} />;
}
```

### 4.2 实时流处理优化

**当前问题**：前端可能无法正确处理多智能体的并行输出

**解决方案**：
1. 解析 `agent_id` 字段
2. 按智能体分别累积输出
3. 每个智能体的输出独立显示

```typescript
// src/hooks/useChatStream.ts
export function useChatStream() {
  const [agentOutputs, setAgentOutputs] = useState<Map<string, string>>(new Map());

  const handleMessage = (data: any) => {
    const { agent_id, content } = data;

    setAgentOutputs(prev => {
      const newOutputs = new Map(prev);
      const current = newOutputs.get(agent_id) || '';
      newOutputs.set(agent_id, current + content);
      return newOutputs;
    });
  };

  return { agentOutputs, handleMessage };
}
```

## 5. 测试计划

### 5.1 单元测试
1. **AgentDetector 测试**
   - 测试单个@检测
   - 测试多个@检测
   - 测试名称和角色双重识别

2. **StreamMerger 测试**
   - 测试两个流合并
   - 测试三个流合并
   - 测试流取消

3. **ParallelCallManager 测试**
   - 测试并行调用成功
   - 测试部分失败场景
   - 测试超时处理

### 5.2 集成测试
1. **场景1：单智能体@**
   - 输入：`@前端专家 请帮我写代码`
   - 期望：只有一个前端专家响应

2. **场景2：双智能体@**
   - 输入：`@前端专家 @后端专家 请设计API`
   - 期望：两个智能体都响应

3. **场景3：多智能体@**
   - 输入：`@前端 @后端 @测试 @运维 请评估方案`
   - 期望：所有4个智能体都响应

### 5.3 性能测试
1. 测试2个智能体并行的响应时间
2. 测试5个智能体并行的响应时间
3. 测试资源占用情况

## 6. 风险和注意事项

### 6.1 风险
1. **并发压力**：多个智能体同时调用LLM可能导致资源不足
   - 缓解方案：设置最大并发数限制

2. **流合并顺序**：输出顺序可能混乱
   - 缓解方案：按智能体ID排序显示

3. **错误处理**：一个智能体失败不应影响其他智能体
   - 缓解方案：独立错误处理

### 6.2 注意事项
1. **向后兼容**：保持单智能体逻辑不变
2. **性能优化**：避免不必要的等待
3. **用户体验**：清晰的输出标识

## 7. 实施步骤

1. ✅ 创建 `AgentDetector` 类
2. ✅ 创建 `StreamMerger` 类
3. ✅ 创建 `ParallelCallManager` 类
4. ⏳ 修改 `chat/route.ts` 支持并行响应
5. ⏳ 前端适配（消息显示优化）
6. ⏳ 单元测试
7. ⏳ 集成测试
8. ⏳ 性能测试
9. ⏳ 文档更新

## 8. 总结

本设计方案通过引入智能体检测器、流合并器和并行调用管理器，实现了多智能体并行响应功能。主要优势：

1. **用户体验**：同时@多个智能体时，所有智能体都能响应
2. **性能优化**：并行调用，响应更快
3. **代码复用**：复用流水线的并行概念
4. **向后兼容**：不影响单智能体功能

预计实施时间：2-3天
