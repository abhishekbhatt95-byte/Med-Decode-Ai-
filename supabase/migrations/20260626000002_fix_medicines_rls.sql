-- Drop the old complex policy
drop policy if exists "Users can view own or guest medicines" on public.medicines;

-- Create a simplified policy that inherits security from the analyses table RLS
create policy "Users can view own or guest medicines" on public.medicines
    for select using (
        exists (
            select 1 from public.analyses
            where analyses.id = medicines.analysis_id
        )
    );
