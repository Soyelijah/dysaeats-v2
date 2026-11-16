-- 0004 — Direcciones de clientes y perfiles de repartidores.
-- Un solo campo de estado y una sola ubicación por repartidor (sin columnas duplicadas).

CREATE TABLE app.user_addresses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  label        text NOT NULL CHECK (length(btrim(label)) > 0),
  street       text NOT NULL CHECK (length(btrim(street)) > 0),
  commune      text NOT NULL CHECK (length(btrim(commune)) > 0),
  instructions text,
  location     geography(Point, 4326),
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_addresses_user_id_idx ON app.user_addresses (user_id);
-- Como máximo una dirección predeterminada por usuario.
CREATE UNIQUE INDEX user_addresses_one_default_per_user
  ON app.user_addresses (user_id) WHERE is_default;

CREATE TRIGGER user_addresses_set_updated_at
  BEFORE UPDATE ON app.user_addresses
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TYPE app.vehicle_type AS ENUM ('bicycle', 'motorcycle', 'car', 'on_foot');
CREATE TYPE app.courier_status AS ENUM ('offline', 'available', 'busy');

CREATE TABLE app.courier_profiles (
  user_id             uuid PRIMARY KEY REFERENCES app.users (id) ON DELETE CASCADE,
  vehicle_type        app.vehicle_type NOT NULL,
  vehicle_plate       text CONSTRAINT courier_plate_format CHECK (vehicle_plate ~ '^[A-Z0-9]{5,6}$'),
  status              app.courier_status NOT NULL DEFAULT 'offline',
  current_location    geography(Point, 4326),
  location_updated_at timestamptz,
  is_verified         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Un repartidor conectado (disponible u ocupado) siempre tiene ubicación conocida.
  CONSTRAINT courier_online_has_location CHECK (status = 'offline' OR current_location IS NOT NULL)
);

-- Índice espacial solo sobre los disponibles: es la consulta caliente de asignación.
CREATE INDEX courier_profiles_available_location_gist
  ON app.courier_profiles USING gist (current_location) WHERE status = 'available';

CREATE TRIGGER courier_profiles_set_updated_at
  BEFORE UPDATE ON app.courier_profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Solo un usuario con rol `courier` puede tener perfil de repartidor.
CREATE FUNCTION app.assert_courier_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.users WHERE id = NEW.user_id AND role = 'courier') THEN
    RAISE EXCEPTION 'El usuario % no tiene rol courier', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER courier_profiles_assert_role
  BEFORE INSERT OR UPDATE OF user_id ON app.courier_profiles
  FOR EACH ROW EXECUTE FUNCTION app.assert_courier_role();
