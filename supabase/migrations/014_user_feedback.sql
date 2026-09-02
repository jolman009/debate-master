-- 014_user_feedback.sql
-- Creates user_feedback table for bug reports, feature suggestions, and app quality signals

CREATE TABLE IF NOT EXISTS public.user_feedback (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'debate_quality', 'general')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    message TEXT NOT NULL,
    contact_email TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying feedback by category and creation time
CREATE INDEX IF NOT EXISTS idx_user_feedback_category_created 
ON public.user_feedback (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id 
ON public.user_feedback (user_id);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous users to insert feedback
CREATE POLICY "Anyone can insert feedback"
ON public.user_feedback
FOR INSERT
WITH CHECK (true);

-- Disallow public reads by default (protects user privacy and contact info)
CREATE POLICY "Users can only read own feedback"
ON public.user_feedback
FOR SELECT
USING (auth.uid() = user_id);
