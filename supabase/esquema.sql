-- =====================================================================
--  NUESTROS GASTOS — Base de datos
-- =====================================================================
--  Miguel: copia TODO este archivo y pégalo en Supabase → SQL Editor →
--  "New query" → Run. Solo hay que hacerlo una vez.
--  Es seguro ejecutarlo varias veces (no borra datos existentes).
--
--  CONVIVE CON OTRAS APPS EN EL MISMO PROYECTO:
--
--   1. Todas las tablas empiezan por `casa_`, así que no pueden chocar
--      con las que ya tenga tu otra aplicación.
--   2. NO se instala ningún disparador sobre los usuarios: quien se
--      registre en tu otra app no se entera de que esto existe.
--   3. Quien entre aquí sin ser miembro de la casa no ve absolutamente
--      nada: las políticas de seguridad le devuelven cero filas.
--   4. Solo pueden unirse a la casa DOS personas. Las dos primeras que
--      entren (vosotros). A partir de ahí, la puerta se cierra sola.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La casa y sus miembros
-- ---------------------------------------------------------------------

create table if not exists public.casa_hogares (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null default 'Nuestra casa',
  creado_en  timestamptz not null default now()
);

create table if not exists public.casa_miembros (
  id        uuid primary key references auth.users(id) on delete cascade,
  hogar_id  uuid not null references public.casa_hogares(id) on delete cascade,
  nombre    text not null,
  email     text
);

-- El hogar del usuario que hace la petición.
-- SECURITY DEFINER para que no entre en bucle con las políticas RLS.
create or replace function public.casa_hogar()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hogar_id from public.casa_miembros where id = auth.uid()
$$;

/*
  Entrar en la casa.

  La llama la app nada más iniciar sesión. Si ya eres miembro no hace
  nada; si no, te apunta —pero solo si quedan plazas—. Con dos miembros
  la casa se cierra: cualquier otro usuario del proyecto que abra la app
  se queda fuera y no ve ni un dato.
*/
create or replace function public.casa_entrar(nombre_visible text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  destino  uuid;
  cuantos  int;
  correo   text;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión primero';
  end if;

  select hogar_id into destino from public.casa_miembros where id = auth.uid();
  if destino is not null then
    return destino;
  end if;

  select id into destino from public.casa_hogares order by creado_en limit 1;
  if destino is null then
    insert into public.casa_hogares (nombre) values ('Nuestra casa')
    returning id into destino;
  end if;

  select count(*) into cuantos from public.casa_miembros where hogar_id = destino;
  if cuantos >= 2 then
    raise exception 'Esta casa ya tiene sus dos miembros';
  end if;

  select email into correo from auth.users where id = auth.uid();

  insert into public.casa_miembros (id, hogar_id, nombre, email)
  values (
    auth.uid(),
    destino,
    coalesce(nullif(nombre_visible, ''), split_part(coalesce(correo, 'Yo'), '@', 1)),
    correo
  );

  return destino;
end;
$$;

grant execute on function public.casa_entrar(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Tablas de la app
-- ---------------------------------------------------------------------

create table if not exists public.casa_categorias (
  id        uuid primary key default gen_random_uuid(),
  hogar_id  uuid not null default public.casa_hogar() references public.casa_hogares(id) on delete cascade,
  nombre    text not null,
  icono     text not null default '📦',
  color     text not null default '#9a9aa6',
  orden     int  not null default 100,
  archivada boolean not null default false,
  -- Los movimientos de esta categoría no suman en los totales del mes:
  -- traspasos entre vuestras propias cuentas, dinero que os devuelven…
  excluida_de_totales boolean not null default false
);

create table if not exists public.casa_gastos (
  id           uuid primary key default gen_random_uuid(),
  hogar_id     uuid not null default public.casa_hogar() references public.casa_hogares(id) on delete cascade,
  importe      integer not null check (importe > 0),  -- en CÉNTIMOS
  categoria_id uuid references public.casa_categorias(id) on delete set null,
  fecha        date not null default current_date,
  nota         text,
  ticket_path  text,
  origen       text not null default 'manual' check (origen in ('manual','csv','fijo')),
  -- Nullable a propósito: si algún día se borra la cuenta, el gasto se queda
  -- (el dinero se gastó igual), solo pierde el "quién lo apuntó".
  creado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en    timestamptz not null default now()
);

create index if not exists idx_casa_gastos_fecha on public.casa_gastos (hogar_id, fecha desc);

create table if not exists public.casa_presupuestos (
  categoria_id uuid primary key references public.casa_categorias(id) on delete cascade,
  hogar_id     uuid not null default public.casa_hogar() references public.casa_hogares(id) on delete cascade,
  importe      integer not null default 0 check (importe >= 0)  -- céntimos al mes
);

create table if not exists public.casa_fijos (
  id                  uuid primary key default gen_random_uuid(),
  hogar_id            uuid not null default public.casa_hogar() references public.casa_hogares(id) on delete cascade,
  nombre              text not null,
  importe             integer not null check (importe > 0),
  categoria_id        uuid references public.casa_categorias(id) on delete set null,
  -- Hasta 31: si el mes es más corto, la app lo apunta el último día.
  dia_del_mes         int not null default 1 check (dia_del_mes between 1 and 31),
  activo              boolean not null default true,
  ultimo_mes_generado text
);

create table if not exists public.casa_reglas_import (
  id           uuid primary key default gen_random_uuid(),
  hogar_id     uuid not null default public.casa_hogar() references public.casa_hogares(id) on delete cascade,
  patron       text not null,
  categoria_id uuid not null references public.casa_categorias(id) on delete cascade,
  aciertos     int not null default 1,
  unique (hogar_id, patron)
);

-- ---------------------------------------------------------------------
-- 3. Seguridad: cada casa solo ve lo suyo
-- ---------------------------------------------------------------------

alter table public.casa_hogares       enable row level security;
alter table public.casa_miembros      enable row level security;
alter table public.casa_categorias    enable row level security;
alter table public.casa_gastos        enable row level security;
alter table public.casa_presupuestos  enable row level security;
alter table public.casa_fijos         enable row level security;
alter table public.casa_reglas_import enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'casa_categorias', 'casa_gastos', 'casa_presupuestos',
    'casa_fijos', 'casa_reglas_import'
  ]
  loop
    execute format('drop policy if exists acceso_casa on public.%I', t);
    execute format(
      'create policy acceso_casa on public.%I for all to authenticated
         using (hogar_id = public.casa_hogar())
         with check (hogar_id = public.casa_hogar())', t);
  end loop;
end $$;

drop policy if exists ver_mi_casa on public.casa_hogares;
create policy ver_mi_casa on public.casa_hogares
  for select to authenticated using (id = public.casa_hogar());

drop policy if exists ver_mis_companeros on public.casa_miembros;
create policy ver_mis_companeros on public.casa_miembros
  for select to authenticated using (hogar_id = public.casa_hogar());

drop policy if exists editar_mi_perfil on public.casa_miembros;
create policy editar_mi_perfil on public.casa_miembros
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. Sincronización en tiempo real entre los dos móviles
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['casa_gastos','casa_categorias','casa_presupuestos','casa_fijos']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Fotos de los tickets
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('casa-tickets', 'casa-tickets', false)
on conflict (id) do nothing;

-- Solo los miembros de la casa. Un usuario de otra app del mismo proyecto
-- no es miembro de ninguna, así que no ve ni sube nada.
drop policy if exists casa_tickets on storage.objects;
create policy casa_tickets on storage.objects
  for all to authenticated
  using (bucket_id = 'casa-tickets' and public.casa_hogar() is not null)
  with check (bucket_id = 'casa-tickets' and public.casa_hogar() is not null);
