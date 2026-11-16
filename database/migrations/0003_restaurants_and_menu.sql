-- 0003 — Restaurantes, categorías y productos del menú.
-- Dinero siempre en pesos chilenos enteros (CLP no tiene decimales).
-- Decisión abierta: no hay `owner_id`. En el piloto el administrador opera el
-- restaurante; si más adelante hay un rol de dueño, se agrega en una migración nueva.

CREATE TYPE app.restaurant_status AS ENUM ('pending', 'active', 'suspended');

CREATE TABLE app.restaurants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL
                    CONSTRAINT restaurants_name_not_blank CHECK (length(btrim(name)) > 0),
  slug              text NOT NULL UNIQUE
                    CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description       text,
  phone             text
                    CONSTRAINT restaurants_phone_format CHECK (phone ~ '^\+56[0-9]{9}$'),
  address           text NOT NULL,
  commune           text NOT NULL,
  location          geography(Point, 4326) NOT NULL,
  delivery_fee_clp  integer NOT NULL DEFAULT 0 CHECK (delivery_fee_clp >= 0),
  min_order_clp     integer NOT NULL DEFAULT 0 CHECK (min_order_clp >= 0),
  delivery_radius_m integer NOT NULL DEFAULT 5000 CHECK (delivery_radius_m > 0),
  status            app.restaurant_status NOT NULL DEFAULT 'pending',
  is_open           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX restaurants_location_gist ON app.restaurants USING gist (location);

CREATE TRIGGER restaurants_set_updated_at
  BEFORE UPDATE ON app.restaurants
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE app.menu_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES app.restaurants (id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  sort_order    integer NOT NULL DEFAULT 0,
  UNIQUE (restaurant_id, name),
  -- Permite la clave foránea compuesta de menu_items (la categoría debe ser del mismo restaurante).
  UNIQUE (id, restaurant_id)
);

CREATE TABLE app.menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES app.restaurants (id) ON DELETE CASCADE,
  category_id   uuid,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  description   text,
  price_clp     integer NOT NULL CHECK (price_clp > 0),
  image_url     text,
  is_available  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Un producto solo puede pertenecer a una categoría de su propio restaurante.
  -- Si se borra la categoría, el producto queda sin categoría (no se borra).
  FOREIGN KEY (category_id, restaurant_id)
    REFERENCES app.menu_categories (id, restaurant_id)
    ON DELETE SET NULL (category_id)
);

CREATE INDEX menu_items_restaurant_id_idx ON app.menu_items (restaurant_id);
CREATE INDEX menu_items_category_id_idx ON app.menu_items (category_id);

CREATE TRIGGER menu_items_set_updated_at
  BEFORE UPDATE ON app.menu_items
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
