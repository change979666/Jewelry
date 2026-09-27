// Jewelry Commerce Core — domain types (mirror migrations/0001_jewelry_core.sql)

export type ProductStatus = "draft" | "active" | "archived";

export interface Product {
  id: string;
  slug: string;
  sku: string | null;
  title: string;
  short_description: string | null;
  description: string | null;
  status: ProductStatus;
  product_type: string | null;
  brand: string | null;
  // Facts
  material: string | null;
  base_material: string | null;
  plating: string | null;
  color: string | null;
  dimensions: string | null;
  weight: string | null;
  care_instructions: string | null;
  size_info: string | null;
  country_of_origin: string | null;
  // SEO
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
  option_values: string | null; // JSON array string
  price: number; // integer minor units
  compare_at_price: number | null;
  currency: string;
  inventory_quantity: number;
  inventory_policy: "deny" | "continue";
  status: "active" | "draft" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  type: string; // hero | gallery | detail | model | lifestyle | packaging
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
  status: "active" | "draft" | "archived";
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Market {
  id: string;
  code: string; // KSA | UAE
  currency: string;
  locale: string;
  tax_rate: number; // e.g. 0.15 — config-driven, never hardcoded
  is_active: number;
  flat_shipping_rate: number | null; // minor units
  free_shipping_threshold: number | null; // minor units
}

export interface Customer {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  locale: string | null;
  market: string | null;
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

export type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "NDR"
  | "CANCELLED"
  | "RTO"
  | "RETURNED"
  | "REFUNDED";

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  session_id: string | null;
  market: string | null;
  currency: string;
  subtotal: number;
  discount_amount: number;
  discount_code: string | null;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  order_status: OrderStatus | string;
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

export interface Shipment {
  id: string;
  order_id: string;
  provider: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

export interface Review {
  id: string;
  product_id: string;
  customer_id: string | null;
  order_id: string | null;
  rating: number;
  title: string | null;
  content: string;
  status: "pending" | "approved" | "rejected";
  verified_purchase: number;
  locale: string | null;
  created_at: string;
}
