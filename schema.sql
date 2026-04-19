-- =========================================================
-- Edu-match — Supabase Schema (em_ 접두사)
-- =========================================================
-- 기존 ERP 프로젝트(pkwbqbxuujpcvndpacsc)와 테이블을 공유하기 위해
-- Edu-match 전용 테이블은 em_ 접두사를 사용합니다.
-- =========================================================

create table if not exists public.em_instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  title text,
  bio text,
  category text,
  expertise text[] default '{}',
  experience_years int default 0,
  rating numeric(2,1) default 0,
  review_count int default 0,
  avatar_initial text,
  avatar_color text,
  badge text,
  is_featured boolean default false,
  created_at timestamptz default now()
);
alter table public.em_instructors enable row level security;

drop policy if exists "em_instructors: public read" on public.em_instructors;
create policy "em_instructors: public read" on public.em_instructors for select using (true);

drop policy if exists "em_instructors: public insert" on public.em_instructors;
create policy "em_instructors: public insert" on public.em_instructors for insert with check (true);

drop policy if exists "em_instructors: public update" on public.em_instructors;
create policy "em_instructors: public update" on public.em_instructors for update using (true);

drop policy if exists "em_instructors: public delete" on public.em_instructors;
create policy "em_instructors: public delete" on public.em_instructors for delete using (true);

create table if not exists public.em_job_postings (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  organization text not null,
  title text not null,
  description text,
  category text,
  format text default 'offline',
  period text,
  target_audience text,
  budget text,
  tags text[] default '{}',
  is_urgent boolean default false,
  status text default 'open',
  source text default 'manual',
  created_at timestamptz default now()
);
alter table public.em_job_postings enable row level security;

drop policy if exists "em_job_postings: public read" on public.em_job_postings;
create policy "em_job_postings: public read" on public.em_job_postings for select using (true);

drop policy if exists "em_job_postings: public insert" on public.em_job_postings;
create policy "em_job_postings: public insert" on public.em_job_postings for insert with check (true);

drop policy if exists "em_job_postings: public update" on public.em_job_postings;
create policy "em_job_postings: public update" on public.em_job_postings for update using (true);

drop policy if exists "em_job_postings: public delete" on public.em_job_postings;
create policy "em_job_postings: public delete" on public.em_job_postings for delete using (true);

create table if not exists public.em_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.em_job_postings(id) on delete cascade,
  instructor_id uuid references public.em_instructors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  applicant_name text,
  applicant_email text,
  message text,
  status text default 'pending',
  created_at timestamptz default now()
);
alter table public.em_applications enable row level security;

drop policy if exists "em_applications: public read" on public.em_applications;
create policy "em_applications: public read" on public.em_applications for select using (true);

drop policy if exists "em_applications: public insert" on public.em_applications;
create policy "em_applications: public insert" on public.em_applications for insert with check (true);

drop policy if exists "em_applications: public update" on public.em_applications;
create policy "em_applications: public update" on public.em_applications for update using (true);

drop policy if exists "em_applications: public delete" on public.em_applications;
create policy "em_applications: public delete" on public.em_applications for delete using (true);

create table if not exists public.em_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  name text,
  phone text,
  role text default 'user',
  category text,
  created_at timestamptz default now()
);
alter table public.em_profiles enable row level security;

drop policy if exists "em_profiles: public read" on public.em_profiles;
create policy "em_profiles: public read" on public.em_profiles for select using (true);

drop policy if exists "em_profiles: public insert" on public.em_profiles;
create policy "em_profiles: public insert" on public.em_profiles for insert with check (true);

drop policy if exists "em_profiles: public update" on public.em_profiles;
create policy "em_profiles: public update" on public.em_profiles for update using (true);

drop policy if exists "em_profiles: public delete" on public.em_profiles;
create policy "em_profiles: public delete" on public.em_profiles for delete using (true);

create index if not exists idx_em_instructors_category on public.em_instructors(category);
create index if not exists idx_em_jobs_category on public.em_job_postings(category);
create index if not exists idx_em_jobs_status on public.em_job_postings(status);
create index if not exists idx_em_apps_job on public.em_applications(job_id);
