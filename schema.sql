create table instructors(user_id uuid primary key references auth.users(id) on delete cascade);
create table students(id uuid primary key default gen_random_uuid(),dept text not null check(dept in('CYB','IT')),student_no text,name text not null,created_at timestamptz default now());
create unique index students_no_u on students(dept,student_no) where student_no is not null;
create table sessions(id uuid primary key default gen_random_uuid(),dept text not null check(dept in('CYB','IT')),date date not null,saved_at timestamptz default now(),unique(dept,date));
create table attendance(session_id uuid references sessions(id) on delete cascade,student_id uuid references students(id) on delete cascade,present boolean not null,primary key(session_id,student_id));
alter table instructors enable row level security;alter table students enable row level security;alter table sessions enable row level security;alter table attendance enable row level security;
create function is_instructor() returns boolean language sql security definer stable as $$select exists(select 1 from instructors where user_id=auth.uid())$$;
create policy s_all on students for all using(is_instructor()) with check(is_instructor());
create policy ss_all on sessions for all using(is_instructor()) with check(is_instructor());
create policy a_all on attendance for all using(is_instructor()) with check(is_instructor());
-- After creating your user in Auth > Users: insert into instructors values('<that user uuid>');
-- Then disable public sign-ups (Auth > Providers > Email).
