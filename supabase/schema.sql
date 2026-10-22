-- ============================================================
-- Sympt'mes — schéma Supabase
-- À coller dans Supabase : SQL Editor → New query → Run.
-- Le script peut être relancé sans risque (idempotent).
-- ============================================================

-- Fonction commune : horodatage serveur + « la modification la plus récente gagne »
create or replace function public.sm_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    -- Modification plus ancienne que celle déjà enregistrée : on l'ignore
    return old;
  end if;
  new.synced_at := now();
  return new;
end;
$$;

-- Un symptôme coché pour un jour donné
create table if not exists public.symptom_logs (
  owner        uuid        not null default auth.uid() references auth.users on delete cascade,
  day          date        not null,
  symptom_key  text        not null,
  intensity    smallint    check (intensity between 0 and 10),
  details      jsonb       not null default '{}'::jsonb,
  deleted      boolean     not null default false,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now(),
  primary key (owner, day, symptom_key)
);

-- Un repas (ou une collation / boisson)
create table if not exists public.meals (
  id           uuid        primary key,
  owner        uuid        not null default auth.uid() references auth.users on delete cascade,
  day          date        not null,
  slot         text        not null check (slot in ('breakfast','lunch','dinner','snack','drinks')),
  time         text,
  items        text[]      not null default '{}',
  tags         text[]      not null default '{}',
  deleted      boolean     not null default false,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now()
);

-- Note libre + « rien à signaler » pour un jour
create table if not exists public.day_notes (
  owner        uuid        not null default auth.uid() references auth.users on delete cascade,
  day          date        not null,
  note         text        not null default '',
  nothing      boolean     not null default false,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now(),
  primary key (owner, day)
);

-- Symptômes ajoutés à la main
create table if not exists public.custom_symptoms (
  owner        uuid        not null default auth.uid() references auth.users on delete cascade,
  key          text        not null,
  label        text        not null,
  category     text        not null,
  urgent       boolean     not null default false,
  archived     boolean     not null default false,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now(),
  primary key (owner, key)
);

-- Réglages partagés et dates de sauvegarde
create table if not exists public.app_meta (
  owner        uuid        not null default auth.uid() references auth.users on delete cascade,
  key          text        not null,
  value        jsonb,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now(),
  primary key (owner, key)
);

create index if not exists symptom_logs_synced_idx   on public.symptom_logs   (owner, synced_at);
create index if not exists meals_synced_idx          on public.meals          (owner, synced_at);
create index if not exists day_notes_synced_idx      on public.day_notes      (owner, synced_at);
create index if not exists custom_symptoms_synced_idx on public.custom_symptoms (owner, synced_at);
create index if not exists app_meta_synced_idx       on public.app_meta       (owner, synced_at);

-- Déclencheurs + sécurité au niveau des lignes (RLS)
do $$
declare t text;
begin
  foreach t in array array['symptom_logs','meals','day_notes','custom_symptoms','app_meta'] loop
    execute format('drop trigger if exists sm_touch on public.%I', t);
    execute format('create trigger sm_touch before insert or update on public.%I
                    for each row execute function public.sm_touch()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner only" on public.%I', t);
    execute format('create policy "owner only" on public.%I
                    for all to authenticated
                    using (owner = (select auth.uid()))
                    with check (owner = (select auth.uid()))', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
