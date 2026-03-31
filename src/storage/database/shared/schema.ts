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

// 保留系统表
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
