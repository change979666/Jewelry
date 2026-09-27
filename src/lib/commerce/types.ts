export interface Product {
  id: string;
  slug: string;
  sku: string | null;
  title: string;
  short_description: string | null;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  product_type: string | null;
  brand: string | null;
  material: string | null;
  base_material: string | null;
  plating: string | null;
  color: string | null;
  dimensions: string | null;
  weight: string | null;
  care_instructions: string | null;
  size_info: string | null;
  country_of_origin: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  option_values: string | null; // JSON string
  price: number;
  compare_at_price: number | null;
  currency: string;
  inventory_quantity: number;
  inventory_policy: 'deny' | 'continue';
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  type: string;
  url: string;
  alt: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductWithRelations extends Product {
  variants: ProductVariant[];
  media: ProductMedia[];
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: 'active' | 'draft' | 'archived';
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  customer_id: string | null;
  session_id: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  session_id: string | null;
  market: string | null;
  currency: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  delivery_status: string;
  confirmation_status: string;
  gift_wrap: number;
  gift_message: string | null;
  gift_box: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  title: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  product_snapshot: string | null;
  personalization_type: string | null;
  personalization_value: string | null;
}

export interface OrderAddress {
  id: string;
  order_id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  additional_info: string | null;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  status: string;
  description: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  provider_reference: string | null;
  checkout_reference: string | null;
  status: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
}
