-- Presupuesto compartido · esquema de base de datos
-- Pegar completo en Supabase → SQL Editor → Run.
-- Regla de privacidad: lo personal (cuentas, sobres, presupuesto, préstamos)
-- solo lo ve su dueño; lo de un grupo lo ven solo sus miembros.

create extension if not exists "pgcrypto";

-- ───────────── Perfiles ─────────────
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  email text not null default ''
);

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- ───────────── Grupos compartidos ─────────────
create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_por uuid not null references auth.users default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.miembros (
  grupo_id uuid not null references public.grupos on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (grupo_id, user_id)
);

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos on delete cascade,
  email text not null,
  invitado_por uuid not null references auth.users default auth.uid(),
  unique (grupo_id, email)
);

create or replace function public.es_miembro(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from miembros where grupo_id = g and user_id = auth.uid());
$$;

create or replace function public.comparte_grupo(otro uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from miembros a join miembros b on a.grupo_id = b.grupo_id
    where a.user_id = auth.uid() and b.user_id = otro
  );
$$;

-- Quien crea un grupo queda como miembro.
create or replace function public.agregar_creador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into miembros (grupo_id, user_id) values (new.id, new.creado_por) on conflict do nothing;
  return new;
end $$;

drop trigger if exists al_crear_grupo on public.grupos;
create trigger al_crear_grupo after insert on public.grupos
  for each row execute function public.agregar_creador();

-- Acepta todas las invitaciones pendientes del correo de quien entra.
create or replace function public.aceptar_invitaciones()
returns void language plpgsql security definer set search_path = public as $$
declare correo text := lower(auth.jwt()->>'email');
begin
  insert into miembros (grupo_id, user_id)
    select grupo_id, auth.uid() from invitaciones where lower(email) = correo
  on conflict do nothing;
  delete from invitaciones where lower(email) = correo;
end $$;

-- Gastos de grupo: quién pagó y cuánto le toca a cada quien.
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos on delete cascade,
  fecha date not null default current_date,
  descripcion text not null,
  categoria text not null default 'Extra',
  monto numeric(14,2) not null check (monto >= 0),
  pagado_por uuid not null references auth.users,
  division text not null default 'mitad' check (division in ('mitad', 'partes', 'solo')),
  medio text not null default '',
  creado_por uuid not null references auth.users default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.partes (
  gasto_id uuid not null references public.gastos on delete cascade,
  user_id uuid not null references auth.users,
  monto numeric(14,2) not null,
  primary key (gasto_id, user_id)
);

-- Pagos entre miembros ("ya me pagó").
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos on delete cascade,
  de uuid not null references auth.users,
  a uuid not null references auth.users,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  nota text not null default ''
);

-- ───────────── Lo personal (privado) ─────────────
create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  nombre text not null,
  tipo text not null default 'tarjeta',
  efectivo_suelto numeric(14,2) not null default 0,
  orden int not null default 0
);

create table if not exists public.sobres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  nombre text not null,
  monto numeric(14,2) not null default 0,
  cuenta_id uuid references public.cuentas on delete set null,
  orden int not null default 0
);

-- Plantillas: lo que se repite cada mes (salarios, gastos fijos).
create table if not exists public.plantillas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  tipo text not null check (tipo in ('entrada', 'fijo')),
  nombre text not null,
  monto numeric(14,2) not null default 0,
  dia_vence int check (dia_vence between 1 and 31),
  cuenta_id uuid references public.cuentas on delete set null,
  orden int not null default 0
);

-- Renglones del presupuesto de cada mes.
create table if not exists public.renglones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  tipo text not null check (tipo in ('entrada', 'fijo', 'extra', 'transporte')),
  nombre text not null,
  monto numeric(14,2) not null default 0,
  hecho boolean not null default false,
  dia_vence int check (dia_vence between 1 and 31),
  cuenta_id uuid references public.cuentas on delete set null,
  gasto_id uuid references public.gastos on delete set null,
  orden int not null default 0
);

create table if not exists public.prestamos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  nombre text not null,
  direccion text not null default 'debo' check (direccion in ('debo', 'me_deben')),
  monto_total numeric(14,2) not null default 0,
  cuota numeric(14,2) not null default 0,
  cuotas_total int not null default 1,
  cuotas_pagadas int not null default 0,
  dia_pago int check (dia_pago between 1 and 31),
  cuenta_id uuid references public.cuentas on delete set null
);

-- ───────────── Permisos (RLS) ─────────────
alter table public.perfiles enable row level security;
alter table public.grupos enable row level security;
alter table public.miembros enable row level security;
alter table public.invitaciones enable row level security;
alter table public.gastos enable row level security;
alter table public.partes enable row level security;
alter table public.pagos enable row level security;
alter table public.cuentas enable row level security;
alter table public.sobres enable row level security;
alter table public.plantillas enable row level security;
alter table public.renglones enable row level security;
alter table public.prestamos enable row level security;

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select
  using (id = auth.uid() or public.comparte_grupo(id));
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update using (id = auth.uid());

drop policy if exists grupos_ver on public.grupos;
create policy grupos_ver on public.grupos for select using (public.es_miembro(id) or creado_por = auth.uid());
drop policy if exists grupos_crear on public.grupos;
create policy grupos_crear on public.grupos for insert with check (creado_por = auth.uid());
drop policy if exists grupos_editar on public.grupos;
create policy grupos_editar on public.grupos for update using (public.es_miembro(id));
drop policy if exists grupos_borrar on public.grupos;
create policy grupos_borrar on public.grupos for delete using (creado_por = auth.uid());

drop policy if exists miembros_ver on public.miembros;
create policy miembros_ver on public.miembros for select using (public.es_miembro(grupo_id));
drop policy if exists miembros_salir on public.miembros;
create policy miembros_salir on public.miembros for delete using (user_id = auth.uid());

drop policy if exists invitaciones_ver on public.invitaciones;
create policy invitaciones_ver on public.invitaciones for select
  using (public.es_miembro(grupo_id) or lower(email) = lower(auth.jwt()->>'email'));
drop policy if exists invitaciones_crear on public.invitaciones;
create policy invitaciones_crear on public.invitaciones for insert
  with check (public.es_miembro(grupo_id) and invitado_por = auth.uid());
drop policy if exists invitaciones_borrar on public.invitaciones;
create policy invitaciones_borrar on public.invitaciones for delete using (public.es_miembro(grupo_id));

drop policy if exists gastos_todo on public.gastos;
create policy gastos_todo on public.gastos for all
  using (public.es_miembro(grupo_id)) with check (public.es_miembro(grupo_id));

drop policy if exists partes_todo on public.partes;
create policy partes_todo on public.partes for all
  using (exists (select 1 from public.gastos g where g.id = gasto_id and public.es_miembro(g.grupo_id)))
  with check (exists (select 1 from public.gastos g where g.id = gasto_id and public.es_miembro(g.grupo_id)));

drop policy if exists pagos_todo on public.pagos;
create policy pagos_todo on public.pagos for all
  using (public.es_miembro(grupo_id)) with check (public.es_miembro(grupo_id));

drop policy if exists cuentas_propias on public.cuentas;
create policy cuentas_propias on public.cuentas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sobres_propios on public.sobres;
create policy sobres_propios on public.sobres for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists plantillas_propias on public.plantillas;
create policy plantillas_propias on public.plantillas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists renglones_propios on public.renglones;
create policy renglones_propios on public.renglones for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists prestamos_propios on public.prestamos;
create policy prestamos_propios on public.prestamos for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Para que los cambios del grupo se vean al instante en el otro celular.
do $$ begin
  alter publication supabase_realtime add table public.gastos, public.partes, public.pagos;
exception when others then null;
end $$;
