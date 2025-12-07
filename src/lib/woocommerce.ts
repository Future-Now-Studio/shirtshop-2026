// WooCommerce API Configuration
export const WOOCOMMERCE_CONFIG = {
  baseUrl: 'https://timob10.sg-host.com/wp-json/wc/v3',
  consumerKey: 'ck_17e70b1dcd1b0d0aab92da0c8ac7bda10a280827',
  consumerSecret: 'cs_e7d6fe86192848c4d06c5b0eb4692d32d2b42a50',
};

// WooCommerce Product Interface (from API)
export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: any[];
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images: Array<{
    id: number;
    src: string;
    name: string;
    alt: string;
  }>;
  attributes: Array<{
    id: number;
    name: string;
    slug: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }>;
  default_attributes: any[];
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: any[];
}

// Create Basic Auth header
function getAuthHeader(): string {
  const credentials = `${WOOCOMMERCE_CONFIG.consumerKey}:${WOOCOMMERCE_CONFIG.consumerSecret}`;
  return `Basic ${btoa(credentials)}`;
}

// Fetch products from WooCommerce
export async function fetchWooCommerceProducts(params?: {
  per_page?: number;
  page?: number;
  category?: number;
  search?: string;
  status?: string;
  tag?: string;
}): Promise<WooCommerceProduct[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.category) queryParams.append('category', params.category.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.tag) queryParams.append('tag', params.tag);
  
  // Default to published products
  if (!params?.status) queryParams.append('status', 'publish');

  const url = `${WOOCOMMERCE_CONFIG.baseUrl}/products?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Fetch single product by ID
export async function fetchWooCommerceProductById(id: number): Promise<WooCommerceProduct> {
  const url = `${WOOCOMMERCE_CONFIG.baseUrl}/products/${id}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// WooCommerce Variation Interface
export interface WooCommerceVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  downloads: any[];
  download_limit: number;
  download_expiry: number;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  image: {
    id: number;
    src: string;
    name: string;
    alt: string;
  } | null;
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  meta_data: any[];
}

// Fetch product variations
export async function fetchWooCommerceVariations(productId: number): Promise<WooCommerceVariation[]> {
  const url = `${WOOCOMMERCE_CONFIG.baseUrl}/products/${productId}/variations?per_page=100`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Fetch product categories
export async function fetchWooCommerceCategories(): Promise<Array<{
  id: number;
  name: string;
  slug: string;
  count: number;
}>> {
  const url = `${WOOCOMMERCE_CONFIG.baseUrl}/products/categories?per_page=100`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

