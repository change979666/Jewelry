-- Migration: Add AI Autonomous Operations Tables (V5.36)
-- Purpose: Track AI missions, actions, logs for command center and replay capability
-- Date: 2026-08-15

-- ============================================================
-- TABLE: ai_missions (AI 任务中心)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Mission metadata
    mission_id TEXT UNIQUE NOT NULL,  -- UUID for tracking
    mission_type TEXT NOT NULL,       -- 'gsc_analysis', 'growth_scan', 'seo_audit', 'bdf_check', etc.
    status TEXT DEFAULT 'scheduled',  -- 'scheduled' / 'running' / 'completed' / 'skipped' / 'blocked'
    
    -- Timing
    scheduled_at INTEGER,             -- Unix timestamp
    started_at INTEGER,               -- Unix timestamp
    completed_at INTEGER,             -- Unix timestamp
    duration_seconds INTEGER,         -- For performance analysis
    
    -- Agent & Model info
    agent_name TEXT,                  -- Which AI agent (Growth Analyst, SEO Agent, etc.)
    model_used TEXT,                  -- 'gpt-4' / 'deepseek-harness' / etc.
    prompt_version TEXT,              -- For reproducibility
    
    -- Input data
    input_data JSON,                  -- Structured input summary
    target_pages TEXT[],              -- Affected pages
    target_queries TEXT[],            -- Target queries
    
    -- Output
    output_summary TEXT,              -- Brief result summary
    actions_taken TEXT[],             -- What AI actually did
    tasks_created INTEGER,            -- Number of tasks generated
    recommendations_count INTEGER,    -- Number of recommendations
    
    -- Blocking & errors
    blocked_reason TEXT,              -- Why mission was blocked
    error_message TEXT,               -- Error details
    retry_count INTEGER DEFAULT 0,
    
    -- Cost tracking
    token_usage INTEGER,              -- Total tokens used
    cost_usd REAL,                    -- Actual cost in USD
    
    -- Human oversight
    human_approval_needed BOOLEAN DEFAULT FALSE,
    human_approved_by TEXT,
    human_approval_timestamp INTEGER,
    human_corrections TEXT,           -- Summary of corrections made
    
    -- Evaluation
    outcome TEXT,                     -- 'positive' / 'negative' / 'neutral'
    quality_score REAL,               -- 0-1 scale quality assessment
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_missions_status ON ai_missions(status);
CREATE INDEX IF NOT EXISTS idx_ai_missions_agent ON ai_missions(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_missions_model ON ai_missions(model_used);
CREATE INDEX IF NOT EXISTS idx_ai_missions_created ON ai_missions(created_at);

-- ============================================================
-- TABLE: ai_action_logs (AI 动作日志 - detailed execution)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Reference to parent mission
    mission_id TEXT NOT NULL,
    
    -- Action type
    action_type TEXT NOT NULL,        -- 'read_gsc', 'analyze_intent', 'generate_fix', etc.
    tool_used TEXT,                   -- Which tool/skill was invoked
    
    -- Execution details
    step_number INTEGER,              -- Order within mission
    
    -- Input/output for each step
    step_input JSON,
    step_output JSON,
    
    -- Tool call specifics
    tool_args JSON,
    
    -- Safety checks
    fact_check_result TEXT,           -- 'safe' / 'warning' / 'blocked'
    truthfulness_flags TEXT[],        -- Any flags raised by truthfulness.ts
    confidence_score REAL,            -- 0-1 confidence in this action
    
    -- Execution timing
    started_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER,
    
    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Production impact
    affected_files TEXT[],            -- Files that would be/were changed
    sandbox_mode BOOLEAN DEFAULT TRUE,-- Whether action is safe-to-test only
    
    -- Tracking
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (mission_id) REFERENCES ai_missions(mission_id)
);

CREATE INDEX IF NOT EXISTS idx_action_logs_mission ON ai_action_logs(mission_id);

-- ============================================================
-- TABLE: ai_cost_tracking (AI 成本追踪)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Date granularity
    date TEXT NOT NULL,               -- YYYY-MM-DD
    
    -- By model
    model_name TEXT NOT NULL,         -- 'gpt-4' / 'deepseek-harness' / etc.
    
    -- Usage metrics
    total_tokens INTEGER,
    request_count INTEGER,
    
    -- Cost in USD
    cost_usd REAL NOT NULL,
    
    -- Breakdown by task type
    gsc_tasks_cost REAL,
    growth_tasks_cost REAL,
    seo_tasks_cost REAL,
    content_tasks_cost REAL,
    
    -- Notes
    notes TEXT,
    
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_date ON ai_cost_tracking(date);

-- ============================================================
-- TABLE: ai_daily_report (每日报告模板)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_daily_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Report date
    report_date TEXT NOT NULL UNIQUE,
    
    -- Summary stats
    total_missions INTEGER DEFAULT 0,
    completed_missions INTEGER DEFAULT 0,
    skipped_missions INTEGER DEFAULT 0,
    blocked_missions INTEGER DEFAULT 0,
    
    -- Actions breakdown
    auto_executions INTEGER DEFAULT 0,
    human_reviewed INTEGER DEFAULT 0,
    analysis_only INTEGER DEFAULT 0,
    
    -- Topic breakdown
    seo_actions INTEGER DEFAULT 0,
    growth_actions INTEGER DEFAULT 0,
    content_actions INTEGER DEFAULT 0,
    bdf_actions INTEGER DEFAULT 0,
    
    -- Quality metrics
    factual_violations INTEGER DEFAULT 0,
    warnings_generated INTEGER DEFAULT 0,
    blocks_triggered INTEGER DEFAULT 0,
    
    -- Cost
    total_cost_usd REAL DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Top priorities for tomorrow
    priority_items TEXT[],            -- Array of top 3 priorities
    
    -- Risk alerts
    risk_alerts TEXT[],               -- Issues requiring attention
    
    -- AI recommendation
    ai_recommendation TEXT,           -- AI's own summary of what matters
    
    -- Generated timestamp
    generated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_date ON ai_daily_report(report_date);

-- ============================================================
-- TABLE: ai_mission_plan (计划与预测)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_mission_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Time horizon
    plan_date TEXT NOT NULL,          -- Date string
    horizon_type TEXT NOT NULL,       -- 'today' / 'tomorrow' / 'week_preview'
    
    -- Planned missions
    planned_missions JSON,            -- Array of {type, priority, target}
    
    -- Status tracking
    actual_completed INTEGER DEFAULT 0,
    actual_skipped INTEGER DEFAULT 0,
    
    -- Confidence
    confidence_score REAL,            -- How confident we are in this plan
    
    -- Created by which planner agent
    planner_agent TEXT,
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_date ON ai_mission_plan(plan_date);

-- ============================================================
-- SEED DATA: Initial plan for today
-- ============================================================
INSERT OR IGNORE INTO ai_mission_plan 
(plan_date, horizon_type, planned_missions, confidence_score, planner_agent, created_at, updated_at)
VALUES (
    date('now'),
    'today',
    json_array(
        json_object(
            'type', 'gsc_sync',
            'priority', 1,
            'target', '28_days',
            'status', 'pending'
        ),
        json_object(
            'type', 'growth_opportunity',
            'priority', 2,
            'target', 'all_active_pages',
            'status', 'pending'
        ),
        json_object(
            'type', 'seo_technical_audit',
            'priority', 3,
            'target', 'sitemap_pages',
            'status', 'pending'
        )
    ),
    0.85,
    'Mission Planner',
    unixepoch(),
    unixepoch()
);
