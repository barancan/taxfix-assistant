-- Taxfix AI Tax Assistant (POC) — initial schema.
-- Apply with the Supabase SQL editor or CLI. Access is server-side via the
-- service-role key (which bypasses RLS). RLS is enabled with NO anon policies so
-- the anon/public key can never read or write these tables.

create extension if not exists "pgcrypto";

-- Concurrency-safe sequential invoice numbering, per year.
create table if not exists invoice_counters (
  year int primary key,
  seq  int not null default 0
);

create or replace function allocate_invoice_number(p_year int)
returns int
language sql
as $$
  insert into invoice_counters (year, seq)
  values (p_year, 1)
  on conflict (year) do update set seq = invoice_counters.seq + 1
  returning seq;
$$;

create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null,
  invoice_number   text not null unique,
  status           text not null default 'issued',
  decision_code    text not null,
  customer_name    text not null,
  currency         text not null,
  subtotal_minor   bigint not null,
  vat_minor        bigint not null,
  total_minor      bigint not null,
  totals           jsonb not null,
  fx               jsonb,
  pdf_object_path  text,
  created_at       timestamptz not null default now()
);
create index if not exists invoices_session_idx on invoices (session_id, created_at desc);

create table if not exists review_cases (
  id                uuid primary key default gen_random_uuid(),
  session_id        text not null,
  reason            text not null,
  decision_code     text not null,
  customer_name     text not null,
  missing_facts     jsonb not null default '[]',
  escalation_reasons jsonb not null default '[]',
  expert_question   text not null,
  created_at        timestamptz not null default now()
);
create index if not exists review_session_idx on review_cases (session_id, created_at desc);

create table if not exists decision_runs (
  id             uuid primary key default gen_random_uuid(),
  session_id     text not null,
  status         text not null,
  decision_code  text not null,
  corpus_version text not null,
  created_at     timestamptz not null default now()
);

alter table invoices       enable row level security;
alter table review_cases   enable row level security;
alter table decision_runs  enable row level security;
alter table invoice_counters enable row level security;
-- No policies are created: only the service-role key (server-side) may access.

-- Private storage bucket for generated invoice PDFs.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;
