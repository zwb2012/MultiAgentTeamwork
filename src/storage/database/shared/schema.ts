import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index, serial } from "drizzle-orm/pg-core";

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
    
    // 大模型配置 (当 agent_type = llm 时使用)
    model: varchar("model", { length: 64 }).default("doubao-seed-1-8-251228"),
    model_config: jsonb("model_config"), // { api_key, base_url, temperature, thinking, caching, max_tokens }
    
    // 进程配置 (当 agent_type = process 时使用)
    process_config: jsonb("process_config"), // { command, args, env, cwd, platform }
    
    // 状态管理
    status: varchar("status", { length: 20 }).notNull().default("idle"), // idle, working, paused, error
    process_pid: integer("process_pid"), // 进程PID (当 agent_type = process 时)
    
    // 其他配置
    config: jsonb("config"), // 其他通用配置
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("agents_role_idx").on(table.role),
    index("agents_status_idx").on(table.status),
    index("agents_is_active_idx").on(table.is_active),
    index("agents_agent_type_idx").on(table.agent_type),
  ]
);

// 会话表
export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, archived, completed
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("conversations_status_idx").on(table.status),
    index("conversations_created_at_idx").on(table.created_at),
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
    content: text("content").notNull(),
    metadata: jsonb("metadata"), // 额外信息: tokens, model等
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversation_id),
    index("messages_agent_id_idx").on(table.agent_id),
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
  ]
);

// 工单表
export const tickets = pgTable(
  "tickets",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    task_id: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
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
    
    // 流水线配置
    trigger_type: varchar("trigger_type", { length: 20 }).default("manual"), // manual, scheduled, webhook
    trigger_config: jsonb("trigger_config"), // 定时任务或webhook配置
    
    // 全局配置
    config: jsonb("config"), // { timeout, retry_policy, notification }
    
    // 状态
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, active, paused, archived
    is_active: boolean("is_active").default(true).notNull(),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("pipelines_status_idx").on(table.status),
    index("pipelines_is_active_idx").on(table.is_active),
    index("pipelines_created_at_idx").on(table.created_at),
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
    node_type: varchar("node_type", { length: 20 }).notNull(), // agent, task, condition, parallel, delay
    
    // 执行顺序
    order_index: integer("order_index").notNull().default(0), // 执行顺序
    
    // 节点配置
    agent_id: varchar("agent_id", { length: 36 }).references(() => agents.id, { onDelete: "set null" }),
    task_id: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "set null" }),
    
    // 执行模式
    execution_mode: varchar("execution_mode", { length: 20 }).notNull().default("sequential"), // sequential, parallel
    parallel_group: varchar("parallel_group", { length: 50 }), // 并行组标识，同组节点并行执行
    
    // 执行条件
    condition: jsonb("condition"), // 条件表达式
    
    // 重试和超时
    retry_count: integer("retry_count").default(0),
    timeout_seconds: integer("timeout_seconds"),
    
    // 输入输出配置
    input_config: jsonb("input_config"), // 输入参数映射
    output_config: jsonb("output_config"), // 输出参数映射
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("pipeline_nodes_pipeline_id_idx").on(table.pipeline_id),
    index("pipeline_nodes_agent_id_idx").on(table.agent_id),
    index("pipeline_nodes_task_id_idx").on(table.task_id),
    index("pipeline_nodes_order_idx").on(table.order_index),
    index("pipeline_nodes_parallel_group_idx").on(table.parallel_group),
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
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, running, success, failed, skipped
    
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
