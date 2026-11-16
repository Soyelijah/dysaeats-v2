-- Datos de desarrollo. Idempotente: se puede ejecutar varias veces.
-- Sin credenciales: `password_hash = '!locked'` no coincide con ningún hash real, así que
-- estas cuentas no pueden iniciar sesión hasta que la Fase 2 les asigne contraseñas generadas.
-- Dominio `.test` (reservado, nunca resuelve). Ubicaciones: Providencia, Santiago.

INSERT INTO app.users (id, email, password_hash, full_name, phone, rut, role) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'admin@dysaeats.test',        '!locked', 'Admin DysaEats',  '+56912345601', '11111111-1', 'admin'),
  ('00000000-0000-4000-8000-0000000000b1', 'cliente1@dysaeats.test',     '!locked', 'Cliente Uno',     '+56912345602', NULL,         'customer'),
  ('00000000-0000-4000-8000-0000000000b2', 'cliente2@dysaeats.test',     '!locked', 'Cliente Dos',     '+56912345603', NULL,         'customer'),
  ('00000000-0000-4000-8000-0000000000c1', 'repartidor1@dysaeats.test',  '!locked', 'Repartidor Uno',  '+56912345604', '12345678-5', 'courier'),
  ('00000000-0000-4000-8000-0000000000c2', 'repartidor2@dysaeats.test',  '!locked', 'Repartidor Dos',  '+56912345605', NULL,         'courier'),
  ('00000000-0000-4000-8000-0000000000c3', 'repartidor3@dysaeats.test',  '!locked', 'Repartidor Tres', '+56912345606', NULL,         'courier'),
  ('00000000-0000-4000-8000-0000000000c4', 'repartidor4@dysaeats.test',  '!locked', 'Repartidor Cuatro','+56912345607', NULL,        'courier')
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.restaurants
  (id, name, slug, description, phone, address, commune, location, delivery_fee_clp, min_order_clp, status, is_open)
VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'Burger Piloto', 'burger-piloto',
   'Restaurante de prueba para el piloto', '+56222345678', 'Av. Providencia 1234', 'Providencia',
   ST_SetSRID(ST_MakePoint(-70.6100, -33.4250), 4326)::geography, 2000, 5000, 'active', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.menu_categories (id, restaurant_id, name, sort_order) VALUES
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'Hamburguesas', 1),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1', 'Bebidas',      2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.menu_items (id, restaurant_id, category_id, name, description, price_clp) VALUES
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 'Burger Clásica',  'Carne, queso, lechuga y tomate', 6500),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 'Burger Doble',    'Doble carne y doble queso',      8500),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 'Burger Vegana',   'Medallón de legumbres',          7200),
  ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e2', 'Bebida 350 cc',   'Cola, naranja o limón',          2000),
  ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e2', 'Jugo natural',    'Frutilla o mango',               3000),
  ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e2', 'Agua mineral',    'Sin gas',                        1500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.user_addresses (id, user_id, label, street, commune, instructions, location, is_default) VALUES
  ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-0000000000b1', 'Casa',
   'Los Leones 1500, depto 305', 'Providencia', 'Tocar el citófono 305',
   ST_SetSRID(ST_MakePoint(-70.6020, -33.4200), 4326)::geography, true)
ON CONFLICT (id) DO NOTHING;

-- Repartidores a distintas distancias del restaurante (-70.6100, -33.4250):
--   c1 disponible ~300 m, c2 disponible ~1,5 km, c3 ocupado ~800 m, c4 desconectado.
INSERT INTO app.courier_profiles (user_id, vehicle_type, vehicle_plate, status, current_location, location_updated_at, is_verified) VALUES
  ('00000000-0000-4000-8000-0000000000c1', 'motorcycle', 'AB1234', 'available', ST_SetSRID(ST_MakePoint(-70.6100, -33.4223), 4326)::geography, now(), true),
  ('00000000-0000-4000-8000-0000000000c2', 'bicycle',    NULL,     'available', ST_SetSRID(ST_MakePoint(-70.6100, -33.4115), 4326)::geography, now(), true),
  ('00000000-0000-4000-8000-0000000000c3', 'motorcycle', 'CD5678', 'busy',      ST_SetSRID(ST_MakePoint(-70.6014, -33.4250), 4326)::geography, now(), true),
  ('00000000-0000-4000-8000-0000000000c4', 'car',        'EFGH12', 'offline',   NULL,                                                          NULL,  false)
ON CONFLICT (user_id) DO NOTHING;

-- Pedido de ejemplo: 2 × Burger Clásica (13.000) + 1 × Bebida (2.000) + envío 2.000 = 17.000
INSERT INTO app.orders
  (id, customer_id, restaurant_id, status, subtotal_clp, delivery_fee_clp, tip_clp, total_clp,
   delivery_address, delivery_commune, delivery_instructions, delivery_location)
VALUES
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000d1',
   'received', 15000, 2000, 0, 17000,
   'Los Leones 1500, depto 305', 'Providencia', 'Tocar el citófono 305',
   ST_SetSRID(ST_MakePoint(-70.6020, -33.4200), 4326)::geography)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.order_items (id, order_id, menu_item_id, name, unit_price_clp, quantity) VALUES
  ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000f1', 'Burger Clásica', 6500, 2),
  ('00000000-0000-4000-8000-00000000ab02', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000f4', 'Bebida 350 cc',  2000, 1)
ON CONFLICT (id) DO NOTHING;
