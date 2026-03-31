# 开发-测试循环流水线示例

## 场景描述

这是一个典型的软件开发-测试循环流程：
1. 开发工程师完成功能开发
2. 提交给测试工程师测试
3. 测试通过 → 流程结束
4. 测试失败（发现Bug） → 反馈给开发工程师修复
5. 修复后重新测试
6. 重复3-5直到测试通过或达到最大循环次数

## 流水线可视化

```
┌──────────┐
│  开始    │
└────┬─────┘
     │
     ▼
┌──────────┐
│ 开发工程师 │ ◄─────────────┐
└────┬─────┘                │
     │                      │
     ▼                      │
┌──────────┐                │
│ 测试工程师 │                │
└────┬─────┘                │
     │                      │
     ▼                      │
┌──────────────┐            │
│  条件网关     │            │
│ 测试通过？    │            │
└───┬──────┬───┘            │
    │      │                │
 通过│      │失败            │
    │      └────────────────┘
    ▼
┌──────────┐
│   结束    │
└──────────┘
```

## 创建步骤

### 步骤1：创建智能体

首先创建两个智能体：

**1. 开发工程师智能体**
```typescript
{
  name: "前端开发工程师",
  role: "frontend_dev",
  capability_tags: ["frontend"],
  system_prompt: `你是一位专业的前端开发工程师...
  
  当收到Bug反馈时，请：
  1. 分析Bug原因
  2. 修复代码
  3. 说明修复内容
  `
}
```

**2. 测试工程师智能体**
```typescript
{
  name: "测试工程师",
  role: "tester",
  capability_tags: ["testing"],
  system_prompt: `你是一位严谨的测试工程师...
  
  测试完成后，请输出JSON格式结果：
  {
    "status": "passed" | "failed",
    "bugs": [
      {
        "id": "BUG-001",
        "description": "问题描述",
        "severity": "high" | "medium" | "low",
        "steps": ["重现步骤"]
      }
    ],
    "summary": "测试总结"
  }
  `
}
```

### 步骤2：创建流水线

在流水线编辑器中：

1. **添加开始节点**
   - 节点类型：开始
   - 名称：开始

2. **添加开发工程师节点**
   - 节点类型：智能体
   - 名称：前端开发工程师
   - 选择智能体：前端开发工程师

3. **添加测试工程师节点**
   - 节点类型：智能体
   - 名称：测试工程师
   - 选择智能体：测试工程师

4. **添加条件网关节点**
   - 节点类型：条件网关
   - 名称：测试结果判断
   - 条件表达式：`{{output.status}} === "passed"`
   - 分支配置：
     - 分支1（通过）：
       - 条件值：true
       - 目标节点：结束
       - 是否循环：否
     - 分支2（失败）：
       - 条件值：false
       - 目标节点：前端开发工程师
       - 是否循环：是
       - 最大循环次数：5
       - 携带数据字段：bugs, summary
       - 循环提示词：发现以下Bug需要修复，请根据Bug描述进行修复

5. **添加结束节点**
   - 节点类型：结束
   - 名称：结束

6. **连线**
   - 开始 → 前端开发工程师
   - 前端开发工程师 → 测试工程师
   - 测试工程师 → 条件网关（测试结果判断）
   - 条件网关 → 结束（通过分支）
   - 条件网关 → 前端开发工程师（失败分支，循环）

### 步骤3：执行流水线

执行时的工作流程：

**第1次循环**
```
用户需求: 实现一个登录页面
    ↓
开发工程师: 完成登录页面开发，提交代码
    ↓
测试工程师: 测试登录功能，发现2个Bug
    ↓
测试输出: { status: "failed", bugs: [...] }
    ↓
条件网关: status === "passed" ? false
    ↓
触发循环: 返回开发工程师
```

**第2次循环**
```
开发工程师: 收到Bug列表，修复Bug
    ↓
测试工程师: 重新测试，发现1个Bug
    ↓
测试输出: { status: "failed", bugs: [...] }
    ↓
条件网关: status === "passed" ? false
    ↓
触发循环: 返回开发工程师
```

**第3次循环**
```
开发工程师: 修复剩余Bug
    ↓
测试工程师: 全面测试，全部通过
    ↓
测试输出: { status: "passed", bugs: [] }
    ↓
条件网关: status === "passed" ? true
    ↓
流程结束
```

## 条件表达式示例

### 1. 简单状态判断
```javascript
{{output.status}} === "passed"
```

### 2. Bug数量判断
```javascript
{{output.bugs.length}} === 0
```

### 3. 复杂条件
```javascript
{{output.status}} === "passed" && {{output.bugs.length}} === 0
```

### 4. 多字段判断
```javascript
{{output.testResult.passed}} === true || {{output.override}} === true
```

## 循环数据传递

### 携带数据字段配置
```
bugs, summary
```

### 数据结构示例
```json
{
  "status": "failed",
  "bugs": [
    {
      "id": "BUG-001",
      "description": "登录按钮无响应",
      "severity": "high"
    }
  ],
  "summary": "发现1个高优先级Bug",
  "_loopContext": {
    "iteration": 2,
    "maxIterations": 5
  }
}
```

### 开发工程师收到的消息
```
发现以下Bug需要修复，请根据Bug描述进行修复

[循环上下文]
当前循环: 第2次/最多5次

[Bug列表]
BUG-001: 登录按钮无响应 (严重级别: high)

[测试总结]
发现1个高优先级Bug
```

## 注意事项

### 1. 设置合理的最大循环次数
- 建议：3-10次
- 太少：可能无法修复所有Bug
- 太多：可能陷入无限循环

### 2. 测试工程师的输出格式
务必使用固定的JSON格式输出，便于条件判断：
```json
{
  "status": "passed" | "failed",
  "bugs": [...],
  "summary": "..."
}
```

### 3. 循环提示词
为循环分支配置清晰的提示词，帮助开发工程师理解需要修复什么：
```
发现以下Bug需要修复：
{{#each bugs}}
- {{this.id}}: {{this.description}} (严重级别: {{this.severity}})
{{/each}}

请逐个修复上述Bug，修复完成后说明修改内容。
```

### 4. 退出条件
确保条件网关有非循环的退出分支，否则可能永远无法结束。

## 高级用法

### 1. 多级循环

```
开发 → 测试 → 代码审核 → (不通过) → 开发
```

### 2. 嵌套条件

```
条件1: 测试通过？
  - 是 → 条件2: 代码审核通过？
    - 是 → 结束
    - 否 → 返回开发
  - 否 → 返回开发
```

### 3. 并行测试

```
         ┌─ 功能测试 ─┐
开发 → ──┼─ 性能测试 ─┼→ 汇聚 → 条件判断 → ...
         └─ 安全测试 ─┘
```

## 代码示例

### 通过API创建循环流水线

```typescript
const createDevTestPipeline = async () => {
  const pipeline = {
    name: "开发-测试循环流水线",
    status: "draft",
    nodes: [
      { id: "start", node_type: "start", name: "开始" },
      { id: "dev", node_type: "agent", name: "开发工程师", agent_id: "dev-agent-id" },
      { id: "test", node_type: "agent", name: "测试工程师", agent_id: "test-agent-id" },
      { 
        id: "condition", 
        node_type: "condition", 
        name: "测试结果判断",
        condition_config: {
          conditionType: "expression",
          expression: '{{output.status}} === "passed"',
          branches: [
            {
              id: "branch-pass",
              label: "测试通过",
              conditionValue: true,
              targetNodeId: "end",
              isLoop: false
            },
            {
              id: "branch-fail",
              label: "测试失败，返回开发",
              conditionValue: false,
              targetNodeId: "dev",
              isLoop: true,
              loopConfig: {
                isLoop: true,
                maxIterations: 5,
                carryOver: ["bugs", "summary"],
                loopPrompt: "发现以下Bug需要修复，请根据Bug描述进行修复"
              }
            }
          ]
        }
      },
      { id: "end", node_type: "end", name: "结束" }
    ],
    edges: [
      { source: "start", target: "dev" },
      { source: "dev", target: "test" },
      { source: "test", target: "condition" },
      { source: "condition", target: "end" },
      { source: "condition", target: "dev", data: { isLoop: true } }
    ]
  };

  const response = await fetch('/api/pipelines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline)
  });

  return response.json();
};
```

## 调试技巧

### 1. 查看循环状态
```typescript
// 在执行引擎中查看循环信息
const engine = createCyclicPipelineEngine(pipeline);
const loops = engine.getLoopEdges();
console.log('检测到的循环边:', loops);
```

### 2. 验证流水线安全性
```typescript
const validation = engine.validateLoops();
if (!validation.valid) {
  console.error('流水线验证失败:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('警告:', validation.warnings);
}
```

### 3. 测试条件表达式
```typescript
const context = {
  output: {
    status: "failed",
    bugs: [{ id: "BUG-001" }]
  }
};

const result = engine.evaluateCondition('{{output.status}} === "passed"', context);
console.log('条件结果:', result); // false
```
