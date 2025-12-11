import { useQuery } from '@tanstack/react-query';
import { fetchWooCommerceProducts, fetchWooCommerceProductById, fetchWooCommerceVariations, WooCommerceVariation } from '@/lib/woocommerce';
import { mapWooCommerceToProduct } from '@/lib/productMapper';
import { Product } from '@/data/products';

// Fetch all products
export function useProducts(params?: {
  per_page?: number;
  page?: number;
  category?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const wcProducts = await fetchWooCommerceProducts({
        ...params,
        status: 'publish',
      });
      return wcProducts.map(mapWooCommerceToProduct);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch single product by ID
export function useProduct(id: number) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const wcProduct = await fetchWooCommerceProductById(id);
      return mapWooCommerceToProduct(wcProduct);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch products by category name or ID
export function useProductsByCategory(categoryNameOrId: string | number) {
  return useQuery({
    queryKey: ['products', 'category', categoryNameOrId],
    queryFn: async () => {
      // If "alle produkte" or empty, fetch all products
      if (categoryNameOrId === 'alle produkte' || !categoryNameOrId || categoryNameOrId === 'all') {
        const wcProducts = await fetchWooCommerceProducts({
          status: 'publish',
          per_page: 100,
        });
        return wcProducts.map(mapWooCommerceToProduct);
      }
      
      // If it's a number, use it as category ID
      if (typeof categoryNameOrId === 'number' || !isNaN(Number(categoryNameOrId))) {
        const wcProducts = await fetchWooCommerceProducts({
          status: 'publish',
          per_page: 100,
          category: Number(categoryNameOrId),
        });
        return wcProducts.map(mapWooCommerceToProduct);
      }
      
      // Otherwise, fetch all and filter by category name (fallback)
      const wcProducts = await fetchWooCommerceProducts({
        status: 'publish',
        per_page: 100,
      });
      const products = wcProducts.map(mapWooCommerceToProduct);
      
      return products.filter(p => 
        p.category.toLowerCase() === categoryNameOrId.toLowerCase()
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch WooCommerce categories
export function useWooCommerceCategories() {
  return useQuery({
    queryKey: ['woocommerce', 'categories'],
    queryFn: async () => {
      const { fetchWooCommerceCategories } = await import('@/lib/woocommerce');
      return fetchWooCommerceCategories();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - categories don't change often
  });
}

// Fetch highlighted products (products with "highlight" tag)
export function useHighlightedProducts() {
  return useQuery({
    queryKey: ['products', 'highlight'],
    queryFn: async () => {
      // Fetch all published products and filter by "highlight" tag client-side
      const wcProducts = await fetchWooCommerceProducts({
        status: 'publish',
        per_page: 100,
      });
      
      // Filter products that have the "highlight" tag (case-insensitive)
      const highlightedProducts = wcProducts.filter(product => 
        product.tags?.some(tag => 
          tag.slug.toLowerCase() === 'highlight' || 
          tag.name.toLowerCase() === 'highlight'
        )
      );
      
      return highlightedProducts.map(mapWooCommerceToProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch designer products (products with "designer" tag)
export function useDesignerProducts() {
  return useQuery({
    queryKey: ['products', 'designer'],
    queryFn: async () => {
      // Fetch all published products and filter by "designer" tag client-side
      const wcProducts = await fetchWooCommerceProducts({
        status: 'publish',
        per_page: 100,
      });
      
      // Filter products that have the "designer" tag (case-insensitive)
      const designerProducts = wcProducts.filter(product => 
        product.tags?.some(tag => 
          tag.slug.toLowerCase() === 'designer' || 
          tag.name.toLowerCase() === 'designer'
        )
      );
      
      return designerProducts.map(mapWooCommerceToProduct);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch product variations
export function useProductVariations(productId: number) {
  return useQuery({
    queryKey: ['product-variations', productId],
    queryFn: async () => {
      return fetchWooCommerceVariations(productId);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch raw WooCommerce product (unmapped) - useful for accessing meta_data
export function useWooCommerceProduct(id: number) {
  return useQuery({
    queryKey: ['woocommerce-product', id],
    queryFn: async () => {
      return fetchWooCommerceProductById(id);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

