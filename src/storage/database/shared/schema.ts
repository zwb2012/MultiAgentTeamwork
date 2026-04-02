import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index, serial, real } from "drizzle-orm/pg-core";

// ==================== 大模型配置表 ====================
export const model_configs = pgTable(
  "model_configs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(), // doubao, deepseek, kimi, zhipu, openai, anthropic, custom
    
    // 连接配置
    api_key: text("api_key").notNull(),
    base_url: varchar("base_url", { length: 512 }),
    
    // 默认模型和参数
    default_model: varchar("default_model", { length: 64 }),
    available_models: jsonb("available_models"), // string[]
    
    // 高级参数（默认值）
    temperature: real("temperature"), // 0-2，控制生成随机性
    max_tokens: integer("max_tokens"),
    thinking: varchar("thinking", { length: 20 }), // enabled, disabled
    caching: varchar("caching", { length: 20 }), // enabled, disabled
    
    // 状态
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, inactive, testing
    last_tested_at: timestamp("last_tested_at", { withTimezone: true }),
    test_result: jsonb("test_result"), // { success, message, latency, available_models }
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("model_configs_provider_idx").on(table.provider),
    index("model_configs_status_idx").on(table.status),
  ]
);

// 智能体表
export const agents = pgTable(
  "agents",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    role: varchar("role", { length: 64 }).notNull(), // developer, tester, reviewer, etc.
    system_prompt: text("system_prompt").notNull(),
    
    // 智能体类型: llm(大模型) 或 process(本地进程)
    agent_type: varchar("agent_type", { length: 20 }).notNull().default("llm"),
    
    // 项目关联 (为空表示全局模板)
    project_id: varchar("project_id", { length: 36 }), // 关联项目
    is_template: boolean("is_template").default(false).notNull(), // 是否为模板
    template_id: varchar("template_id", { length: 36 }), // 从哪个模板创建的
    
    // 大模型配置 (当 agent_type = llm 时使用)
    model_config_id: varchar("model_config_id", { length: 36 }), // 关联模型配置（新方式）
    model: varchar("model", { length: 64 }).default("doubao-seed-1-8-251228"), // 保留兼容
    model_config: jsonb("model_config"), // { api_key, base_url, temperature, thinking, caching, max_tokens } (旧方式)
    
    // 进程配置 (当 agent_type = process 时使用)
    process_config: jsonb("process_config"), // { command, args, env, cwd, platform }
    
    // 新状态管理
    online_status: varchar("online_status", { length: 20 }).default("unknown"), // online, offline, checking, unknown
    work_status: varchar("work_status", { length: 20 }).default("idle"), // idle, working, error
    
    // 兼容旧版本
    status: varchar("status", { length: 20 }).notNull().default("idle"), // idle, working, paused, error
    process_pid: integer("process_pid"), // 进程PID (当 agent_type = process 时)
    
    // 健康检查
    last_health_check: timestamp("last_health_check", { withTimezone: true }),
    health_check_result: jsonb("health_check_result"), // { online, message, latency, checked_at }
    
    // 其他配置
    config: jsonb("config"), // 其他通用配置
    
    // 能力标签 - 用于任务分发匹配
    capability_tags: jsonb("capability_tags"), // ["frontend", "backend", "testing", "review"]
    
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("agents_role_idx").on(table.role),
    index("agents_status_idx").on(table.status),
    index("agents_online_status_idx").on(table.online_status),
    index("agents_is_active_idx").on(table.is_active),
    index("agents_agent_type_idx").on(table.agent_type),
    index("agents_project_id_idx").on(table.project_id),
    index("agents_is_template_idx").on(table.is_template),
  ]
);

// 会话表
export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    
    // 项目关联
    project_id: varchar("project_id", { length: 36 }), // 绑定项目，实现项目维度隔离
    
    // 会话类型: lobby(大厅), private(私聊), group(群组), pipeline(流水线专属)
    type: varchar("type", { length: 20 }).notNull().default("private"),
    
    // 会话配置
    config: jsonb("config"), // { is_public, pipeline_run_id, auto_notify, allow_invite }
    
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, archived, completed
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("conversations_type_idx").on(table.type),
    index("conversations_status_idx").on(table.status),
    index("conversations_created_at_idx").on(table.created_at),
    index("conversations_project_id_idx").on(table.project_id),
  ]
);

// 会话参与者表 (多对多关系)
export const conversation_participants = pgTable(
  "conversation_participants",
  {
    id: serial().primaryKey(),
    conversation_id: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
    agent_id: varchar("agent_id", { length: 36 }).notNull().references(() => agents.id, { onDelete: "cascade" }),
    joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversation_participants_conversation_id_idx").on(table.conversation_id),
    index("conversation_participants_agent_id_idx").on(table.agent_id),
  ]
);

// 消息表
export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    conversation_id: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
    agent_id: varchar("agent_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    role: varchar("role", { length: 20 }).notNull(), // system, user, assistant
    
    // 消息类型
    message_type: varchar("message_type", { length: 20 }).default("text"), // text, system, task_start, task_complete, task_failed, notification, node_transfer
    
    content: text("content").notNull(),
    metadata: jsonb("metadata"), // 额外信息: tokens, model, node_id, transfer_from, transfer_to等
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversation_id),
    index("messages_agent_id_idx").on(table.agent_id),
    index("messages_message_type_idx").on(table.message_type),
    index("messages_created_at_idx").on(table.created_at),
  ]
);

// 任务表
export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    conversation_id: varchar("conversation_id", { length: 36 }).references(() => conversations.id, { onDelete: "set null" }),
    agent_id: varchar("agent_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    
    // 项目关联
    project_id: varchar("project_id", { length: 36 }), // 绑定项目
    
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, failed
    priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high
    report: text("report"), // 任务报告
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_conversation_id_idx").on(table.conversation_id),
    index("tasks_agent_id_idx").on(table.agent_id),
    index("tasks_status_idx").on(table.status),
    index("tasks_priority_idx").on(table.priority),
    index("tasks_created_at_idx").on(table.created_at),
    index("tasks_project_id_idx").on(table.project_id),
  ]
);

// 工单表
export const tickets = pgTable(
  "tickets",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    task_id: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
    
    // 项目关联
    project_id: varchar("project_id", { length: 36 }), // 绑定项目
    
    type: varchar("type", { length: 20 }).notNull(), // bug, feature, improvement
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"), // low, medium, high, critical
    status: varchar("status", { length: 20 }).notNull().default("open"), // open, in_progress, resolved, closed
    assignee_id: varchar("assignee_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    reporter_id: varchar("reporter_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("tickets_task_id_idx").on(table.task_id),
    index("tickets_type_idx").on(table.type),
    index("tickets_status_idx").on(table.status),
    index("tickets_priority_idx").on(table.priority),
    index("tickets_assignee_id_idx").on(table.assignee_id),
    index("tickets_reporter_id_idx").on(table.reporter_id),
    index("tickets_created_at_idx").on(table.created_at),
    index("tickets_project_id_idx").on(table.project_id),
  ]
);

// 工单流转历史表
export const ticket_history = pgTable(
  "ticket_history",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    ticket_id: varchar("ticket_id", { length: 36 }).notNull().references(() => tickets.id, { onDelete: "cascade" }),
    from_status: varchar("from_status", { length: 20 }),
    to_status: varchar("to_status", { length: 20 }).notNull(),
    from_assignee_id: varchar("from_assignee_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    to_assignee_id: varchar("to_assignee_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    operator_id: varchar("operator_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    comment: text("comment"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ticket_history_ticket_id_idx").on(table.ticket_id),
    index("ticket_history_operator_id_idx").on(table.operator_id),
    index("ticket_history_created_at_idx").on(table.created_at),
  ]
);

// ==================== 流水线相关表 ====================

// 流水线表
export const pipelines = pgTable(
  "pipelines",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    
    // 项目关联
    project_id: varchar("project_id", { length: 36 }), // 绑定项目
    
    // 流水线配置
    trigger_type: varchar("trigger_type", { length: 20 }).default("manual"), // manual, scheduled, webhook
    trigger_config: jsonb("trigger_config"), // 定时任务或webhook配置
    
    // 全局配置
    config: jsonb("config"), // { timeout, retry_policy, notification }
    
    // 定义状态：draft(草稿), published(已发布), archived(已归档)
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    
    // 运行状态：idle(空闲), running(运行中), success(成功), failed(失败), cancelled(已取消)
    run_status: varchar("run_status", { length: 20 }).notNull().default("idle"),
    
    // 当前运行ID
    current_run_id: varchar("current_run_id", { length: 36 }),
    
    // 最后运行信息
    last_run_at: timestamp("last_run_at", { withTimezone: true }),
    last_run_status: varchar("last_run_status", { length: 20 }),
    
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("pipelines_status_idx").on(table.status),
    index("pipelines_run_status_idx").on(table.run_status),
    index("pipelines_is_active_idx").on(table.is_active),
    index("pipelines_created_at_idx").on(table.created_at),
    index("pipelines_project_id_idx").on(table.project_id),
  ]
);

// 流水线节点表
export const pipeline_nodes = pgTable(
  "pipeline_nodes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    pipeline_id: varchar("pipeline_id", { length: 36 }).notNull().references(() => pipelines.id, { onDelete: "cascade" }),
    
    // 节点基本信息
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    node_type: varchar("node_type", { length: 20 }).notNull(), // agent, task, gateway, condition, delay, start, end
    
    // 执行顺序
    order_index: integer("order_index").notNull().default(0), // 执行顺序
    
    // 节点配置
    agent_id: varchar("agent_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    task_id: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
    
    // 执行模式
    execution_mode: varchar("execution_mode", { length: 20 }).notNull().default("sequential"), // sequential, parallel
    parallel_group: varchar("parallel_group", { length: 50 }), // 并行组标识，同组节点并行执行
    
    // 网关配置（当 node_type === 'gateway' 时使用）
    gateway_type: varchar("gateway_type", { length: 20 }), // parallel_split, parallel_join, exclusive, inclusive
    
    // 汇聚配置（当 gateway_type === 'parallel_join' 时使用）
    merge_strategy: varchar("merge_strategy", { length: 20 }).default("all"), // all, any, custom
    upstream_nodes: jsonb("upstream_nodes"), // 上游节点ID列表 ["node_id_1", "node_id_2"]
    downstream_nodes: jsonb("downstream_nodes"), // 下游节点ID列表
    custom_condition: text("custom_condition"), // 自定义条件表达式
    
    // 执行条件
    condition: jsonb("condition"), // 条件表达式
    
    // 重试和超时
    retry_count: integer("retry_count").default(0),
    timeout_seconds: integer("timeout_seconds"),
    
    // 输入输出配置
    input_config: jsonb("input_config"), // 输入参数映射
    output_config: jsonb("output_config"), // 输出参数映射
    
    // 可视化位置
    position: jsonb("position"), // { x: number, y: number }
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("pipeline_nodes_pipeline_id_idx").on(table.pipeline_id),
    index("pipeline_nodes_agent_id_idx").on(table.agent_id),
    index("pipeline_nodes_task_id_idx").on(table.task_id),
    index("pipeline_nodes_order_idx").on(table.order_index),
    index("pipeline_nodes_parallel_group_idx").on(table.parallel_group),
    index("pipeline_nodes_node_type_idx").on(table.node_type),
    index("pipeline_nodes_gateway_type_idx").on(table.gateway_type),
  ]
);

// 流水线运行记录表
export const pipeline_runs = pgTable(
  "pipeline_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    pipeline_id: varchar("pipeline_id", { length: 36 }).notNull().references(() => pipelines.id, { onDelete: "cascade" }),
    
    // 运行状态
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, running, success, failed, cancelled
    current_node_id: varchar("current_node_id", { length: 36 }).references(() => pipeline_nodes.id, { onDelete: "set null" }),
    
    // 关联会话（群组协作）
    conversation_id: varchar("conversation_id", { length: 36 }).references(() => conversations.id, { onDelete: "set null" }),
    
    // 运行配置
    trigger_by: varchar("trigger_by", { length: 20 }).default("manual"), // manual, scheduled, webhook
    trigger_user: varchar("trigger_user", { length: 36 }), // 触发用户
    
    // 执行结果
    total_nodes: integer("total_nodes").default(0),
    completed_nodes: integer("completed_nodes").default(0),
    failed_nodes: integer("failed_nodes").default(0),
    
    // 运行日志
    logs: jsonb("logs"), // [{ node_id, status, start_time, end_time, output, error }]
    
    // 输入输出
    input_data: jsonb("input_data"), // 运行输入
    output_data: jsonb("output_data"), // 最终输出
    
    // 时间记录
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pipeline_runs_pipeline_id_idx").on(table.pipeline_id),
    index("pipeline_runs_status_idx").on(table.status),
    index("pipeline_runs_current_node_idx").on(table.current_node_id),
    index("pipeline_runs_conversation_id_idx").on(table.conversation_id),
    index("pipeline_runs_created_at_idx").on(table.created_at),
  ]
);

// 流水线节点执行记录表
export const pipeline_node_runs = pgTable(
  "pipeline_node_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    pipeline_run_id: varchar("pipeline_run_id", { length: 36 }).notNull().references(() => pipeline_runs.id, { onDelete: "cascade" }),
    node_id: varchar("node_id", { length: 36 }).notNull().references(() => pipeline_nodes.id, { onDelete: "cascade" }),
    
    // 执行状态
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, waiting, running, success, failed, skipped
    
    // 等待状态详情（当状态为 waiting 时使用）
    wait_status: jsonb("wait_status"), // { required_nodes: [], completed_nodes: [], merge_strategy: 'all' }
    
    // 执行结果
    input_data: jsonb("input_data"),
    output_data: jsonb("output_data"),
    error_message: text("error_message"),
    
    // 重试信息
    retry_count: integer("retry_count").default(0),
    
    // 时间记录
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pipeline_node_runs_run_id_idx").on(table.pipeline_run_id),
    index("pipeline_node_runs_node_id_idx").on(table.node_id),
    index("pipeline_node_runs_status_idx").on(table.status),
  ]
);

// 保留系统表
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============================================
// 项目管理表
// ============================================

// 项目表
export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // 基本信息
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    
    // Git 仓库配置
    git_url: varchar("git_url", { length: 512 }).notNull(),
    git_branch: varchar("git_branch", { length: 128 }).default("main"),
    git_token: text("git_token"), // 加密存储的访问令牌
    
    // 同步配置
    sync_enabled: boolean("sync_enabled").default(true).notNull(),
    sync_interval: integer("sync_interval").default(300), // 同步间隔(秒)，默认5分钟
    last_sync_at: timestamp("last_sync_at", { withTimezone: true }),
    next_sync_at: timestamp("next_sync_at", { withTimezone: true }),
    
    // 同步状态
    sync_status: varchar("sync_status", { length: 20 }).default("pending"), // pending, syncing, success, failed
    sync_error: text("sync_error"), // 同步失败错误信息
    last_commit_sha: varchar("last_commit_sha", { length: 64 }), // 最后同步的commit SHA
    
    // 本地存储路径配置（支持多平台）
    // 格式: { windows: "D:\\projects\\xxx", linux: "/home/projects/xxx", macos: "/Users/projects/xxx", default: "/tmp/projects/xxx" }
    local_path_config: jsonb("local_path_config"),
    
    // 实际使用的本地路径（运行时确定）
    local_path: varchar("local_path", { length: 512 }),
    
    // 项目配置
    config: jsonb("config"), // { build_command, test_command, deploy_command }
    
    // 状态
    is_active: boolean("is_active").default(true).notNull(),
    
    // 时间戳
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_name_idx").on(table.name),
    index("projects_sync_status_idx").on(table.sync_status),
    index("projects_is_active_idx").on(table.is_active),
    index("projects_next_sync_at_idx").on(table.next_sync_at),
  ]
);

// 项目同步历史表
export const project_sync_history = pgTable(
  "project_sync_history",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    project_id: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    
    // 同步类型
    sync_type: varchar("sync_type", { length: 20 }).notNull(), // auto, manual, webhook
    
    // 同步状态
    status: varchar("status", { length: 20 }).notNull(), // running, success, failed
    
    // Git 信息
    before_commit_sha: varchar("before_commit_sha", { length: 64 }),
    after_commit_sha: varchar("after_commit_sha", { length: 64 }),
    commits_count: integer("commits_count").default(0),
    
    // 同步详情
    changes: jsonb("changes"), // { added: [], modified: [], deleted: [] }
    error_message: text("error_message"),
    
    // 时间记录
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("project_sync_history_project_id_idx").on(table.project_id),
    index("project_sync_history_status_idx").on(table.status),
    index("project_sync_history_started_at_idx").on(table.started_at),
  ]
);

// ============================================
// 角色配置表
// ============================================

export const agent_roles = pgTable(
  "agent_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // 角色标识（唯一）
    role_key: varchar("role_key", { length: 64 }).notNull().unique(), // developer, frontend_dev, backend_dev, etc.
    
    // 基本信息
    name: varchar("name", { length: 128 }).notNull(), // 显示名称：开发工程师
    description: text("description"),
    
    // 默认提示词模板（{name} 会被替换为实际智能体名称）
    system_prompt_template: text("system_prompt_template").notNull(),
    
    // 建议配置
    suggested_agent_type: varchar("suggested_agent_type", { length: 20 }).default("llm"), // llm, process
    
    // 能力标签
    capability_tags: jsonb("capability_tags"), // string[]
    
    // 排序和状态
    sort_order: integer("sort_order").default(0),
    is_active: boolean("is_active").default(true).notNull(),
    is_system: boolean("is_system").default(false).notNull(), // 系统预设角色不可删除
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("agent_roles_role_key_idx").on(table.role_key),
    index("agent_roles_is_active_idx").on(table.is_active),
  ]
);
