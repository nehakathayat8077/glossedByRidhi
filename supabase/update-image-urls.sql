-- Updates only image_url for seeded designs and products whose names match.
-- Object paths are taken from scripts/generate-images.mjs and matched to
-- the design/product names in schema.sql. This script is safe to rerun.

begin;

update public.designs as d
set image_url =
  'https://uqanejmosujpldxepmnl.supabase.co/storage/v1/object/public/images/'
  || image_map.object_path
from (
  values
    ('Blush Milk Bath', 'designs/pink-gel-nails.jpg'),
    ('Champagne French', 'designs/french-tip-nails.jpg'),
    ('Rose Chrome', 'designs/chrome-nails.jpg'),
    ('Wild Peony', 'designs/floral-nail-art.jpg'),
    ('Veil & Pearl', 'designs/bridal-nails.jpg'),
    ('Midnight Sparkle', 'designs/glitter-nails.jpg')
) as image_map(title, object_path)
where d.title = image_map.title
  and d.image_url is distinct from
    'https://uqanejmosujpldxepmnl.supabase.co/storage/v1/object/public/images/'
    || image_map.object_path;

update public.products as p
set image_url =
  'https://uqanejmosujpldxepmnl.supabase.co/storage/v1/object/public/images/'
  || image_map.object_path
from (
  values
    ('Press-On Nails', 'products/product-press-on-nails.jpg'),
    ('Nail Art Stickers', 'products/product-nail-stickers.jpg'),
    ('Nail Care Kit', 'products/product-nail-kit.jpg'),
    ('Cuticle Oil', 'products/product-cuticle-oil.jpg'),
    ('Nail File Kit', 'products/product-nail-file.jpg')
) as image_map(name, object_path)
where p.name = image_map.name
  and p.image_url is distinct from
    'https://uqanejmosujpldxepmnl.supabase.co/storage/v1/object/public/images/'
    || image_map.object_path;

-- Review which mapped seed records exist and the URL assigned to each.
with image_map(table_name, record_name, object_path) as (
  values
    ('designs', 'Blush Milk Bath', 'designs/pink-gel-nails.jpg'),
    ('designs', 'Champagne French', 'designs/french-tip-nails.jpg'),
    ('designs', 'Rose Chrome', 'designs/chrome-nails.jpg'),
    ('designs', 'Wild Peony', 'designs/floral-nail-art.jpg'),
    ('designs', 'Veil & Pearl', 'designs/bridal-nails.jpg'),
    ('designs', 'Midnight Sparkle', 'designs/glitter-nails.jpg'),
    ('products', 'Press-On Nails', 'products/product-press-on-nails.jpg'),
    ('products', 'Nail Art Stickers', 'products/product-nail-stickers.jpg'),
    ('products', 'Nail Care Kit', 'products/product-nail-kit.jpg'),
    ('products', 'Cuticle Oil', 'products/product-cuticle-oil.jpg'),
    ('products', 'Nail File Kit', 'products/product-nail-file.jpg'),
    ('products', 'Gift Box', null::text)
)
select
  image_map.table_name,
  image_map.record_name,
  image_map.object_path is not null as image_path_verified,
  case
    when image_map.table_name = 'designs' and d.title is not null then true
    when image_map.table_name = 'products' and p.name is not null then true
    else false
  end as record_found,
  case
    when image_map.table_name = 'designs' then d.image_url
    when image_map.table_name = 'products' then p.image_url
  end as image_url
from image_map
left join public.designs as d
  on image_map.table_name = 'designs'
  and d.title = image_map.record_name
left join public.products as p
  on image_map.table_name = 'products'
  and p.name = image_map.record_name
order by image_map.table_name, image_map.record_name;

commit;
