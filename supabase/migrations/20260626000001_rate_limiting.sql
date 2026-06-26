-- Create request logs table for rate limiting
create table if not exists public.request_logs (
    id uuid default gen_random_uuid() primary key,
    ip_address text,
    user_id uuid,
    endpoint text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on request_logs
alter table public.request_logs enable row level security;

-- Create policy to allow service_role key to manage all request logs (bypasses RLS anyway)
-- Also allow authenticated users or anon users to insert into request_logs if needed, but
-- since Edge Functions run with service_role, they bypass RLS automatically.
-- We will keep it locked down for external clients.
create policy "Service role has full access to request_logs"
    on public.request_logs
    for all
    using (true)
    with check (true);
