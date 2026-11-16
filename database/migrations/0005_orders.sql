-- 0005 — Pedidos y sus líneas.
-- Los estados coinciden con `ORDER_STATUSES` de @dysaeats/shared. Las transiciones
-- entre estados las implementa la Fase 4; aquí solo se garantiza que los datos sean coherentes.
-- Los pagos se agregan en la Fase 5 con una migración propia.

CREATE TYPE app.order_status AS ENUM (
  'received', 'preparing', 'on_the_way', 'delivered', 'cancelled'
);

CREATE SEQUENCE app.order_number_seq;

CREATE TABLE app.orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          text NOT NULL UNIQUE
                        DEFAULT ('DE-' || lpad(nextval('app.order_number_seq')::text, 6, '0')),
  customer_id           uuid NOT NULL REFERENCES app.users (id) ON DELETE RESTRICT,
  restaurant_id         uuid NOT NULL REFERENCES app.restaurants (id) ON DELETE RESTRICT,
  courier_id            uuid REFERENCES app.courier_profiles (user_id) ON DELETE SET NULL,
  status                app.order_status NOT NULL DEFAULT 'received',
  subtotal_clp          integer NOT NULL CHECK (subtotal_clp >= 0),
  delivery_fee_clp      integer NOT NULL CHECK (delivery_fee_clp >= 0),
  tip_clp               integer NOT NULL DEFAULT 0 CHECK (tip_clp >= 0),
  total_clp             integer NOT NULL,
  -- Copia de la dirección al momento del pedido: no cambia si el cliente edita su libreta.
  delivery_address      text NOT NULL,
  delivery_commune      text NOT NULL,
  delivery_instructions text,
  delivery_location     geography(Point, 4326) NOT NULL,
  cancellation_reason   text,
  delivered_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_matches CHECK (total_clp = subtotal_clp + delivery_fee_clp + tip_clp),
  CONSTRAINT orders_cancelled_consistent CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT orders_delivered_consistent CHECK ((status = 'delivered') = (delivered_at IS NOT NULL)),
  CONSTRAINT orders_courier_required CHECK (
    status NOT IN ('on_the_way', 'delivered') OR courier_id IS NOT NULL
  )
);

CREATE INDEX orders_customer_idx ON app.orders (customer_id, created_at DESC);
CREATE INDEX orders_restaurant_status_idx ON app.orders (restaurant_id, status);
CREATE INDEX orders_courier_active_idx ON app.orders (courier_id)
  WHERE status IN ('preparing', 'on_the_way');

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON app.orders
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE app.order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES app.orders (id) ON DELETE CASCADE,
  -- El producto puede desaparecer del menú; la línea conserva nombre y precio del momento.
  menu_item_id   uuid REFERENCES app.menu_items (id) ON DELETE SET NULL,
  name           text NOT NULL CHECK (length(btrim(name)) > 0),
  unit_price_clp integer NOT NULL CHECK (unit_price_clp >= 0),
  quantity       integer NOT NULL CHECK (quantity > 0),
  line_total_clp integer GENERATED ALWAYS AS (unit_price_clp * quantity) STORED,
  notes          text
);

CREATE INDEX order_items_order_id_idx ON app.order_items (order_id);
