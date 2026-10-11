import { designs as fallbackDesigns, products as fallbackProducts } from '../data/data';
import { supabase } from './supabaseClient';

const fallbackDesignsByTitle = new Map(
  fallbackDesigns.map((design) => [design.name.toLowerCase(), design]),
);
const fallbackProductsByName = new Map(
  fallbackProducts.map((product) => [product.name.toLowerCase(), product]),
);

let activeServicesRequest;

export async function fetchActiveServices() {
  if (!activeServicesRequest) {
    activeServicesRequest = supabase
      .from('services')
      .select('id, name, description, price, duration_minutes, image_url')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) throw error;
        return data.map((service) => ({
          ...service,
          price: Number(service.price),
        }));
      })
      .catch((error) => {
        activeServicesRequest = undefined;
        throw error;
      });
  }

  return activeServicesRequest;
}

export async function fetchActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, price, discount_percent, image_url, stock, is_active')
    .eq('is_active', true)
    .order('id');

  if (error) throw error;

  return data.map((product) => {
    const fallback = fallbackProductsByName.get(product.name.toLowerCase());
    const price = Number(product.price);
    const discountPercent = Number(product.discount_percent) || 0;
    const derivedOldPrice =
      discountPercent > 0 && discountPercent < 100
        ? Math.round(price / (1 - discountPercent / 100))
        : undefined;

    return {
      ...fallback,
      id: product.id,
      name: product.name,
      description: product.description,
      price,
      old: fallback?.old ?? derivedOldPrice,
      discount_percent: discountPercent,
      image_url: product.image_url || fallback?.image_url || null,
      fallback_image_url: fallback?.image_url,
      stock: product.stock,
      rating: fallback?.rating,
    };
  });
}

export async function fetchActiveDesigns() {
  const { data, error } = await supabase
    .from('designs')
    .select('id, title, category, image_url, is_active')
    .eq('is_active', true)
    .order('id');

  if (error) throw error;

  return data.map((design) => {
    const fallback = fallbackDesignsByTitle.get(design.title.toLowerCase());

    return {
      ...fallback,
      id: design.id,
      name: design.title,
      cat: design.category,
      image_url: design.image_url || fallback?.image_url || null,
      fallback_image_url: fallback?.image_url,
    };
  });
}
