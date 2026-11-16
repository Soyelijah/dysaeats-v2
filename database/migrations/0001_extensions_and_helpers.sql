-- 0001 — Extensiones, schema `app` y funciones auxiliares.
-- Las extensiones van explícitamente en `public` para que el search_path del runner
-- (app, public) no las instale dentro de `app`.

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

CREATE SCHEMA IF NOT EXISTS app;

-- Mantiene updated_at al día en cada UPDATE.
CREATE FUNCTION app.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Valida un RUT chileno normalizado: sin puntos, con guion y dígito verificador en
-- mayúscula (ej. 12345678-5, 6-K). Algoritmo módulo 11 con multiplicadores 2..7.
CREATE FUNCTION app.is_valid_rut(rut text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  body     text;
  dv       text;
  total    integer := 0;
  mult     integer := 2;
  i        integer;
  expected integer;
BEGIN
  IF rut !~ '^[0-9]{1,8}-[0-9K]$' THEN
    RETURN false;
  END IF;

  body := split_part(rut, '-', 1);
  dv   := split_part(rut, '-', 2);

  FOR i IN REVERSE length(body)..1 LOOP
    total := total + substr(body, i, 1)::integer * mult;
    mult  := CASE WHEN mult = 7 THEN 2 ELSE mult + 1 END;
  END LOOP;

  expected := 11 - (total % 11);

  RETURN dv = CASE expected WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE expected::text END;
END;
$$;
