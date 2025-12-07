import { WooCommerceProduct } from './woocommerce';
import { Product, PlacementZone } from '@/data/products';

/**
 * Maps WooCommerce product data to our application's Product interface
 */
export function mapWooCommerceToProduct(wcProduct: WooCommerceProduct): Product {
  // Get main image
  const mainImage = wcProduct.images && wcProduct.images.length > 0 
    ? wcProduct.images[0].src 
    : '/placeholder.svg';

  // Get all images
  const images = wcProduct.images && wcProduct.images.length > 0
    ? wcProduct.images.map(img => img.src)
    : [mainImage];

  // Extract colors from attributes (if available)
  const colorAttribute = wcProduct.attributes?.find(attr => 
    attr.name.toLowerCase().includes('color') || 
    attr.name.toLowerCase().includes('farbe') ||
    attr.slug.toLowerCase().includes('color') ||
    attr.slug.toLowerCase().includes('farbe')
  );
  const colors = colorAttribute?.options || [];

  // Extract sizes from attributes (if available)
  const sizeAttribute = wcProduct.attributes?.find(attr => 
    attr.name.toLowerCase().includes('size') || 
    attr.name.toLowerCase().includes('größe') ||
    attr.slug.toLowerCase().includes('size') ||
    attr.slug.toLowerCase().includes('groesse')
  );
  const sizes = sizeAttribute?.options || ['S', 'M', 'L', 'XL', 'XXL']; // Default sizes

  // Get category name (first category or default)
  const category = wcProduct.categories && wcProduct.categories.length > 0
    ? wcProduct.categories[0].name
    : 'Unbekannt';

  // Format price
  const price = parseFloat(wcProduct.price || wcProduct.regular_price || '0');
  const priceFormatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);

  // Extract features from description or meta data
  const features: string[] = [];
  if (wcProduct.short_description) {
    // Try to extract bullet points or features from short description
    const lines = wcProduct.short_description.split('\n').filter(line => line.trim());
    features.push(...lines.slice(0, 4)); // Limit to 4 features
  }

  // Extract placement zones from meta_data
  let placementZones: Product['placementZones'] | undefined;
  const zonesMeta = wcProduct.meta_data?.find(
    (meta: any) => meta.key === 'design_placement_zones' || meta.key === '_design_placement_zones'
  );
  
  if (zonesMeta && zonesMeta.value) {
    try {
      // Handle both string (JSON) and object formats
      const zonesData = typeof zonesMeta.value === 'string' 
        ? JSON.parse(zonesMeta.value) 
        : zonesMeta.value;
      
      // Validate and structure the zones
      if (zonesData && typeof zonesData === 'object') {
        placementZones = {
          front: zonesData.front || [],
          back: zonesData.back || [],
          left: zonesData.left || [],
          right: zonesData.right || [],
        };
      }
    } catch (error) {
      console.error('Error parsing placement zones:', error);
    }
  }

  return {
    id: wcProduct.id,
    name: wcProduct.name,
    price: price,
    priceFormatted: priceFormatted,
    image: mainImage,
    images: images,
    colors: colors.length > 0 ? colors : ['Standard'],
    sizes: sizes,
    category: category,
    description: wcProduct.description || wcProduct.short_description || '',
    features: features.length > 0 ? features : ['Hochwertige Qualität'],
    tags: wcProduct.tags || [],
    placementZones: placementZones,
  };
}

