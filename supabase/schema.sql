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

-- Tout est rangé en clé → valeur : axolotl, jours de repas (care:AAAA-MM-JJ), jeux, boutiques, réglages partagés
create table if not exists public.app_meta (
  owner        uuid        not null default auth.uid() references auth.users on delete cascade,
  key          text        not null,
  value        jsonb,
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz not null default now(),
  primary key (owner, key)
);

create index if not exists app_meta_synced_idx on public.app_meta (owner, synced_at);

-- Déclencheurs + sécurité au niveau des lignes (RLS)
do $$
declare t text;
begin
  foreach t in array array['app_meta'] loop
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
