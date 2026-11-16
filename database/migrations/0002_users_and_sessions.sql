-- 0002 — Usuarios y sesiones. Autenticación propia: no hay dependencia de Supabase.
-- Los roles coinciden con `ROLES` de @dysaeats/shared.

CREATE TYPE app.user_role AS ENUM ('customer', 'courier', 'admin');

CREATE TABLE app.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE
                CONSTRAINT users_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  password_hash text NOT NULL
                CONSTRAINT users_password_hash_not_empty CHECK (length(password_hash) > 0),
  full_name     text NOT NULL
                CONSTRAINT users_full_name_not_blank CHECK (length(btrim(full_name)) > 0),
  -- Formato E.164 chileno: +56 seguido de 9 dígitos.
  phone         text
                CONSTRAINT users_phone_format CHECK (phone ~ '^\+56[0-9]{9}$'),
  -- RUT normalizado (sin puntos, con guion, K en mayúscula) y con dígito verificador válido.
  rut           text UNIQUE
                CONSTRAINT users_rut_valid CHECK (rut ~ '^[0-9]{7,8}-[0-9K]$' AND app.is_valid_rut(rut)),
  role          app.user_role NOT NULL DEFAULT 'customer',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON app.users
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Refresh tokens: solo se guarda el hash, nunca el token en claro.
CREATE TABLE app.refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_id_idx ON app.refresh_tokens (user_id);
