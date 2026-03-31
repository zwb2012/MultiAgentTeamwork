CREATE TABLE "agents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"role" varchar(64) NOT NULL,
	"system_prompt" text NOT NULL,
	"agent_type" varchar(20) DEFAULT 'llm' NOT NULL,
	"model" varchar(64) DEFAULT 'doubao-seed-1-8-251228',
	"model_config" jsonb,
	"process_config" jsonb,
	"online_status" varchar(20) DEFAULT 'unknown',
	"work_status" varchar(20) DEFAULT 'idle',
	"status" varchar(20) DEFAULT 'idle' NOT NULL,
	"process_pid" integer,
	"last_health_check" timestamp with time zone,
	"health_check_result" jsonb,
	"config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"agent_id" varchar(36) NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"agent_id" varchar(36),
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_node_runs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_run_id" varchar(36) NOT NULL,
	"node_id" varchar(36) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"input_data" jsonb,
	"output_data" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_nodes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"node_type" varchar(20) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"agent_id" varchar(36),
	"task_id" varchar(36),
	"execution_mode" varchar(20) DEFAULT 'sequential' NOT NULL,
	"parallel_group" varchar(50),
	"condition" jsonb,
	"retry_count" integer DEFAULT 0,
	"timeout_seconds" integer,
	"input_config" jsonb,
	"output_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" varchar(36) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"current_node_id" varchar(36),
	"trigger_by" varchar(20) DEFAULT 'manual',
	"trigger_user" varchar(36),
	"total_nodes" integer DEFAULT 0,
	"completed_nodes" integer DEFAULT 0,
	"failed_nodes" integer DEFAULT 0,
	"logs" jsonb,
	"input_data" jsonb,
	"output_data" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" varchar(20) DEFAULT 'manual',
	"trigger_config" jsonb,
	"config" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar(36),
	"agent_id" varchar(36),
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"report" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ticket_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar(36) NOT NULL,
	"from_status" varchar(20),
	"to_status" varchar(20) NOT NULL,
	"from_assignee_id" varchar(36),
	"to_assignee_id" varchar(36),
	"operator_id" varchar(36),
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36),
	"type" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"assignee_id" varchar(36),
	"reporter_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_node_runs" ADD CONSTRAINT "pipeline_node_runs_pipeline_run_id_pipeline_runs_id_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_node_runs" ADD CONSTRAINT "pipeline_node_runs_node_id_pipeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."pipeline_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_nodes" ADD CONSTRAINT "pipeline_nodes_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_nodes" ADD CONSTRAINT "pipeline_nodes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_nodes" ADD CONSTRAINT "pipeline_nodes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_current_node_id_pipeline_nodes_id_fk" FOREIGN KEY ("current_node_id") REFERENCES "public"."pipeline_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_from_assignee_id_agents_id_fk" FOREIGN KEY ("from_assignee_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_to_assignee_id_agents_id_fk" FOREIGN KEY ("to_assignee_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_operator_id_agents_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_agents_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_agents_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_role_idx" ON "agents" USING btree ("role");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agents_online_status_idx" ON "agents" USING btree ("online_status");--> statement-breakpoint
CREATE INDEX "agents_is_active_idx" ON "agents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agents_agent_type_idx" ON "agents" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_participants_agent_id_idx" ON "conversation_participants" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_agent_id_idx" ON "messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pipeline_node_runs_run_id_idx" ON "pipeline_node_runs" USING btree ("pipeline_run_id");--> statement-breakpoint
CREATE INDEX "pipeline_node_runs_node_id_idx" ON "pipeline_node_runs" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "pipeline_node_runs_status_idx" ON "pipeline_node_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipeline_nodes_pipeline_id_idx" ON "pipeline_nodes" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_nodes_agent_id_idx" ON "pipeline_nodes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "pipeline_nodes_task_id_idx" ON "pipeline_nodes" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "pipeline_nodes_order_idx" ON "pipeline_nodes" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "pipeline_nodes_parallel_group_idx" ON "pipeline_nodes" USING btree ("parallel_group");--> statement-breakpoint
CREATE INDEX "pipeline_runs_pipeline_id_idx" ON "pipeline_runs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipeline_runs_current_node_idx" ON "pipeline_runs" USING btree ("current_node_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_created_at_idx" ON "pipeline_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pipelines_status_idx" ON "pipelines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipelines_is_active_idx" ON "pipelines" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pipelines_created_at_idx" ON "pipelines" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_conversation_id_idx" ON "tasks" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "tasks_agent_id_idx" ON "tasks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ticket_history_ticket_id_idx" ON "ticket_history" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_history_operator_id_idx" ON "ticket_history" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "ticket_history_created_at_idx" ON "ticket_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tickets_task_id_idx" ON "tickets" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tickets_type_idx" ON "tickets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_priority_idx" ON "tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tickets_assignee_id_idx" ON "tickets" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tickets_reporter_id_idx" ON "tickets" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "tickets_created_at_idx" ON "tickets" USING btree ("created_at");