-- Enable UUID generation extension
create extension if not exists "uuid-ossp";

-- =========================================================================
-- CORE TABLES
-- =========================================================================

-- Profiles table (extends auth.users)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    full_name text,
    avatar_url text,
    role text default 'user'::text check (role in ('guest', 'user', 'admin', 'medical_advisor', 'support'))
);

-- User settings
create table public.user_settings (
    id uuid references public.profiles(id) on delete cascade primary key,
    theme text default 'light'::text,
    large_text boolean default false,
    high_contrast boolean default false,
    email_notifications boolean default true,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Uploaded documents
create table public.documents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    name text not null,
    file_path text not null,
    mime_type text not null,
    size bigint not null,
    status text default 'uploaded'::text check (status in ('uploaded', 'processing', 'completed', 'failed')),
    document_type text default 'unknown'::text check (document_type in ('prescription', 'blood_report', 'diagnostic_report', 'hospital_bill', 'discharge_summary', 'medicine_label', 'unknown')),
    is_medical boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

-- Extracted text from OCR
create table public.extracted_text (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    raw_text text not null,
    ocr_provider text not null check (ocr_provider in ('google_vision', 'aws_textract', 'tesseract')),
    confidence double precision not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Medical explanations & analyses
create table public.analyses (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    summary text not null,
    structured_output jsonb not null,
    doctor_questions jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Medicines extracted and explained
create table public.medicines (
    id uuid default gen_random_uuid() primary key,
    analysis_id uuid references public.analyses(id) on delete cascade not null,
    brand_name text not null,
    generic_name text,
    category text,
    common_uses text,
    how_it_works text,
    side_effects text,
    food_restrictions text,
    precautions text,
    confidence_score double precision default 100.0 not null
);

-- Confidence scores
create table public.confidence_scores (
    id uuid default gen_random_uuid() primary key,
    analysis_id uuid references public.analyses(id) on delete cascade not null,
    ocr_confidence double precision not null,
    ai_confidence double precision not null,
    overall_confidence double precision not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Review flags for manual verification
create table public.review_flags (
    id uuid default gen_random_uuid() primary key,
    analysis_id uuid references public.analyses(id) on delete cascade not null,
    flag_reason text not null,
    flagged_by uuid references public.profiles(id) on delete set null,
    status text default 'pending'::text check (status in ('pending', 'resolved', 'ignored')),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Document exports tracking
create table public.exports (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    export_type text not null check (export_type in ('pdf', 'json', 'csv')),
    status text default 'completed'::text check (status in ('pending', 'completed', 'failed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Feedback from users
create table public.feedback (
    id uuid default gen_random_uuid() primary key,
    analysis_id uuid references public.analyses(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    rating integer not null check (rating >= 1 and rating <= 5),
    comments text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- OCR PROCESSING TABLES
-- =========================================================================

create table public.ocr_results (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    provider text not null,
    raw_output jsonb not null,
    duration_ms integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.ocr_corrections (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    original_text text not null,
    corrected_text text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.ocr_providers (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    is_active boolean default true not null,
    priority integer default 1 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.ocr_failures (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    provider text not null,
    error_message text not null,
    stack_trace text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- MEDICAL CREDIBILITY & TRUST TABLES
-- =========================================================================

create table public.medical_advisors (
    id uuid references public.profiles(id) on delete cascade primary key,
    license_number text not null,
    specialization text,
    is_verified boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.medical_sources (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    url text,
    source_type text check (source_type in ('journal', 'database', 'guideline', 'book', 'other')),
    last_reviewed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.analysis_sources (
    id uuid default gen_random_uuid() primary key,
    analysis_id uuid references public.analyses(id) on delete cascade not null,
    source_id uuid references public.medical_sources(id) on delete cascade not null,
    snippet_referenced text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.trust_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    event_type text not null,
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- LEGAL & COMPLIANCE TABLES
-- =========================================================================

create table public.legal_acceptances (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    document_version text not null,
    accepted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.privacy_consents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    consent_type text not null,
    is_granted boolean default false not null,
    granted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.consent_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    action text not null check (action in ('grant', 'revoke')),
    consent_type text not null,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.ai_disclosures (
    id uuid default gen_random_uuid() primary key,
    version text not null,
    content text not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.medical_disclaimers (
    id uuid default gen_random_uuid() primary key,
    version text not null,
    content text not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.data_deletion_requests (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    status text default 'pending'::text check (status in ('pending', 'processing', 'completed', 'failed')),
    requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
    completed_at timestamp with time zone
);

create table public.cookie_consents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    visitor_id text not null,
    consent_settings jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.retention_logs (
    id uuid default gen_random_uuid() primary key,
    table_name text not null,
    row_id uuid not null,
    deleted_at timestamp with time zone default timezone('utc'::text, now()) not null,
    reason text not null
);


-- =========================================================================
-- SECURITY & AUDIT TABLES
-- =========================================================================

create table public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    action text not null,
    table_name text,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.security_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    event_type text not null,
    severity text check (severity in ('low', 'medium', 'high', 'critical')),
    description text not null,
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.login_attempts (
    id uuid default gen_random_uuid() primary key,
    email text not null,
    is_successful boolean default false not null,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.device_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    device_id text not null,
    ip_address text,
    user_agent text,
    last_active_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.api_keys (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    key_hash text not null unique,
    is_active boolean default true not null,
    expires_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.api_usage (
    id uuid default gen_random_uuid() primary key,
    api_key_id uuid references public.api_keys(id) on delete cascade not null,
    endpoint text not null,
    status_code integer not null,
    duration_ms integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.rate_limit_events (
    id uuid default gen_random_uuid() primary key,
    identifier text not null,
    endpoint text not null,
    limit_count integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.failed_uploads (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    file_name text not null,
    error_message text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- VOICE ASSISTANT TABLES (VERSION 2)
-- =========================================================================

create table public.voice_preferences (
    id uuid references public.profiles(id) on delete cascade primary key,
    voice_gender text default 'female'::text,
    speech_rate double precision default 1.0 not null,
    pitch double precision default 1.0 not null,
    language_code text default 'en-US'::text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.voice_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    duration_seconds integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.voice_analytics (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    feature_used text not null,
    duration_ms integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.voice_commands (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    command_text text not null,
    interpreted_intent text not null,
    is_successful boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.voice_languages (
    id uuid default gen_random_uuid() primary key,
    code text not null unique,
    name text not null,
    is_supported boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- ANALYTICS TABLES
-- =========================================================================

create table public.user_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    event_name text not null,
    properties jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.feature_usage (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    feature_name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.search_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    query_text text not null,
    results_count integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.error_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    error_message text not null,
    stack_trace text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.performance_metrics (
    id uuid default gen_random_uuid() primary key,
    metric_name text not null,
    duration_ms integer not null,
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- NOTIFICATION & MAIL LOG TABLES
-- =========================================================================

create table public.notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    message text not null,
    is_read boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.notification_preferences (
    id uuid references public.profiles(id) on delete cascade primary key,
    email boolean default true not null,
    push boolean default false not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.email_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    recipient_email text not null,
    subject text not null,
    status text default 'sent'::text check (status in ('sent', 'failed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- FILE MANAGEMENT TABLES
-- =========================================================================

create table public.file_uploads (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    file_name text not null,
    file_size bigint not null,
    mime_type text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.deleted_documents (
    id uuid default gen_random_uuid() primary key,
    document_id uuid not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    deleted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.document_versions (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    version_number integer not null,
    file_path text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on core tables
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.documents enable row level security;
alter table public.extracted_text enable row level security;
alter table public.analyses enable row level security;
alter table public.medicines enable row level security;
alter table public.confidence_scores enable row level security;
alter table public.review_flags enable row level security;
alter table public.exports enable row level security;
alter table public.feedback enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.privacy_consents enable row level security;
alter table public.consent_logs enable row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.cookie_consents enable row level security;
alter table public.voice_preferences enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.voice_analytics enable row level security;
alter table public.voice_commands enable row level security;
alter table public.user_events enable row level security;
alter table public.feature_usage enable row level security;
alter table public.search_events enable row level security;
alter table public.error_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.file_uploads enable row level security;
alter table public.deleted_documents enable row level security;
alter table public.document_versions enable row level security;

-- Define Policies

-- Profiles Policies
create policy "Users can view own profile" on public.profiles
    for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
    for update using (auth.uid() = id);

create policy "Admins have full profile access" on public.profiles
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- User Settings Policies
create policy "Users can manage own settings" on public.user_settings
    for all using (auth.uid() = id);

-- Documents Policies
create policy "Users can select own or guest documents" on public.documents
    for select using (user_id is null or auth.uid() = user_id);

create policy "Users can insert own or guest documents" on public.documents
    for insert with check (user_id is null or auth.uid() = user_id);

create policy "Users can update own or guest documents" on public.documents
    for update using (user_id is null or auth.uid() = user_id);

create policy "Users can delete own or guest documents" on public.documents
    for delete using (user_id is null or auth.uid() = user_id);

-- Extracted Text Policies
create policy "Users can view own or guest extracted text" on public.extracted_text
    for select using (
        exists (
            select 1 from public.documents
            where documents.id = extracted_text.document_id
            and (documents.user_id is null or documents.user_id = auth.uid())
        )
    );

-- Analyses Policies
create policy "Users can view own or guest analyses" on public.analyses
    for select using (
        exists (
            select 1 from public.documents
            where documents.id = analyses.document_id
            and (documents.user_id is null or documents.user_id = auth.uid())
        )
    );

-- Medicines Policies
create policy "Users can view own or guest medicines" on public.medicines
    for select using (
        exists (
            select 1 from public.analyses
            join public.documents on documents.id = analyses.document_id
            where analyses.id = medicines.analysis_id
            and (documents.user_id is null or documents.user_id = auth.uid())
        )
    );

-- Consent Policies
create policy "Users can manage own consents" on public.privacy_consents
    for all using (auth.uid() = user_id);

create policy "Users can manage own legal acceptances" on public.legal_acceptances
    for all using (auth.uid() = user_id);

create policy "Users can manage own consent logs" on public.consent_logs
    for all using (auth.uid() = user_id);

-- Data Deletion Request Policies
create policy "Users can manage own deletion requests" on public.data_deletion_requests
    for all using (auth.uid() = user_id);

-- Notifications Policies
create policy "Users can manage own notifications" on public.notifications
    for all using (auth.uid() = user_id);

-- File Upload Policies
create policy "Users can manage own file uploads" on public.file_uploads
    for all using (auth.uid() = user_id);


-- =========================================================================
-- SYSTEM TRIGGERS (AUTOMATED PROFILE & SETTINGS CREATION)
-- =========================================================================

-- Trigger to automatically create a profile & default settings for new auth users
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, avatar_url, role)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        coalesce(new.raw_user_meta_data->>'avatar_url', ''),
        'user'
    );
    
    insert into public.user_settings (id, theme, large_text, high_contrast, email_notifications)
    values (
        new.id,
        'light',
        false,
        false,
        true
    );
    
    insert into public.notification_preferences (id, email, push)
    values (
        new.id,
        true,
        false
    );
    
    insert into public.voice_preferences (id, voice_gender, speech_rate, pitch, language_code)
    values (
        new.id,
        'female',
        1.0,
        1.0,
        'en-US'
    );
    
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
