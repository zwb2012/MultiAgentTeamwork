# 自循环流水线设计文档

## 需求场景

开发-测试循环流程：
1. 开发智能体完成开发任务
2. 提交给测试智能体测试
3. 测试通过 → 流程结束
4. 测试失败（发现Bug） → 反馈给开发智能体修复
5. 修复后重新测试
6. 重复3-5直到测试通过

## 核心概念

### 1. 条件网关（Condition Gateway）

用于根据条件决定流程走向：
- **条件表达式**：基于上游节点输出判断
- **分支路径**：满足条件走一条路径，不满足走另一条
- **循环标识**：标记该分支是否为循环（回到上游节点）

```
                ┌──────────┐
                │ 开发节点  │
                └────┬─────┘
                     │
                     ▼
                ┌──────────┐
                │ 测试节点  │
                └────┬─────┘
                     │
                     ▼
            ┌────────────────┐
            │  条件网关       │
            │  测试通过？     │
            └───┬────────┬───┘
                │        │
         通过 ▼        ▼ 失败（循环）
        ┌──────────┐    │
        │ 结束节点  │    │
        └──────────┘    │
                        │
                        └──────► 回到开发节点
```

### 2. 循环边（Loop Edge）

从下游节点连回上游节点的特殊边：
- **循环条件**：在边上配置条件表达式
- **最大次数**：限制最大循环次数，防止无限循环
- **循环数据**：传递循环上下文（第几次循环、历史输出等）

### 3. 循环控制参数

```typescript
interface LoopConfig {
  // 是否为循环边
  isLoop: boolean;
  
  // 循环条件（表达式）
  loopCondition: string; // 例如: "{{testResult.status}} === 'failed'"
  
  // 最大循环次数
  maxIterations: number; // 默认: 10
  
  // 循环数据映射
  loopDataMapping?: {
    // 每次循环携带的数据
    carryOver?: string[]; // 例如: ["bugs", "fixHistory"]
  };
}
```

## 实现方案

### 方案一：条件网关节点

在流水线中添加"条件网关"节点类型：

**优点**：
- 可视化清晰
- 条件配置集中管理
- 易于理解和维护

**配置示例**：
```typescript
{
  node_type: 'condition',
  name: '测试结果判断',
  config: {
    conditionExpression: "{{output.status}} === 'passed'",
    branches: [
      {
        condition: true,
        targetNodeId: 'end_node',
        label: '测试通过'
      },
      {
        condition: false,
        targetNodeId: 'dev_agent',
        isLoop: true,
        label: '测试失败，返回开发'
      }
    ]
  }
}
```

### 方案二：边条件配置

直接在边上配置条件：

**优点**：
- 更灵活
- 减少节点数量
- 适合简单场景

**配置示例**：
```typescript
{
  source: 'test_agent',
  target: 'dev_agent',
  data: {
    condition: "{{output.status}} === 'failed'",
    isLoop: true,
    maxIterations: 5
  }
}
```

### 推荐方案：条件网关 + 边条件结合

1. **条件网关**：用于复杂的分支逻辑
2. **边条件**：用于简单的循环判断

## 数据结构

### 1. 扩展 NodeType

```typescript
export type NodeType = 
  | 'agent'
  | 'start'
  | 'end'
  | 'parallel'
  | 'condition'  // 条件网关（新增）
  | 'delay';
```

### 2. 条件网关配置

```typescript
interface ConditionConfig {
  // 条件表达式
  expression: string;
  
  // 条件类型
  conditionType: 'expression' | 'output_match' | 'script';
  
  // 分支配置
  branches: ConditionBranch[];
  
  // 默认分支（当所有条件都不满足时）
  defaultBranch?: string;
}

interface ConditionBranch {
  // 分支名称
  label: string;
  
  // 条件值（当表达式结果等于此值时走此分支）
  value: any;
  
  // 目标节点ID
  targetNodeId: string;
  
  // 是否为循环分支
  isLoop: boolean;
  
  // 循环配置（当 isLoop 为 true 时）
  loopConfig?: LoopConfig;
}
```

### 3. 扩展 Edge 数据

```typescript
interface EdgeData {
  // 边标签
  label?: string;
  
  // 条件表达式
  condition?: string;
  
  // 是否为循环边
  isLoop?: boolean;
  
  // 循环配置
  loopConfig?: LoopConfig;
}
```

## 执行引擎更新

### 循环检测

```typescript
function detectLoops(pipeline: Pipeline): LoopInfo[] {
  // 使用 DFS 检测图中的环
  // 标记所有回边为循环边
}
```

### 循环执行

```typescript
async function executeWithLoop(
  node: PipelineNode,
  context: ExecutionContext,
  iteration: number = 0
): Promise<NodeResult> {
  // 1. 执行节点
  const result = await executeNode(node, context);
  
  // 2. 检查是否有循环边
  const loopEdges = getLoopEdges(node);
  
  // 3. 评估循环条件
  for (const edge of loopEdges) {
    const shouldLoop = evaluateCondition(edge.condition, result);
    
    if (shouldLoop && iteration < edge.maxIterations) {
      // 4. 执行循环
      const targetNode = getNode(edge.target);
      return executeWithLoop(targetNode, context, iteration + 1);
    }
  }
  
  // 5. 没有循环，继续正常流程
  return result;
}
```

## UI 交互

### 1. 可视化标识

- **循环边**：用虚线表示，带循环箭头图标
- **条件网关**：菱形节点，显示条件表达式
- **循环次数**：节点上显示已循环次数

### 2. 配置面板

**条件网关配置**：
- 条件类型选择（表达式/输出匹配/脚本）
- 条件表达式编辑器
- 分支列表管理
- 循环参数设置

**边条件配置**：
- 条件表达式
- 循环次数限制
- 循环数据映射

## 示例：开发-测试循环

```typescript
const devTestPipeline = {
  nodes: [
    { id: 'start', node_type: 'start', name: '开始' },
    { id: 'dev', node_type: 'agent', name: '开发工程师', agent_id: 'dev_agent' },
    { id: 'test', node_type: 'agent', name: '测试工程师', agent_id: 'test_agent' },
    { 
      id: 'check', 
      node_type: 'condition', 
      name: '测试结果判断',
      config: {
        expression: "{{output.bugs.length}} === 0",
        branches: [
          { label: '测试通过', value: true, targetNodeId: 'end' },
          { 
            label: '有Bug需修复', 
            value: false, 
            targetNodeId: 'dev',
            isLoop: true,
            loopConfig: {
              maxIterations: 10,
              carryOver: ['bugs', 'testReport']
            }
          }
        ]
      }
    },
    { id: 'end', node_type: 'end', name: '结束' }
  ],
  edges: [
    { source: 'start', target: 'dev' },
    { source: 'dev', target: 'test' },
    { source: 'test', target: 'check' },
    { source: 'check', target: 'end', data: { condition: 'passed' } },
    { 
      source: 'check', 
      target: 'dev', 
      data: { 
        condition: 'failed',
        isLoop: true,
        loopConfig: { maxIterations: 10 }
      }
    }
  ]
};
```

## 安全控制

### 1. 最大循环次数

强制要求设置最大循环次数，防止无限循环：
- 默认值：10
- 最小值：1
- 最大值：100

### 2. 循环超时

设置循环总超时时间：
- 单次循环超时
- 总循环超时

### 3. 资源限制

监控循环过程中的资源消耗：
- Token 使用量
- 执行时间
- API 调用次数

## 测试验证

### 测试用例

1. **正常循环**：Bug修复后测试通过
2. **达到最大次数**：循环达到上限仍未通过
3. **一次通过**：无需循环直接通过
4. **条件评估**：各种条件表达式的正确性

### 监控指标

- 循环次数统计
- 循环耗时分析
- 条件评估成功率
