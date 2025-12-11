import productPolo from "@/assets/product-polo.jpg";
import productTshirt from "@/assets/product-tshirt.jpg";
import productHoodie from "@/assets/product-hoodie.jpg";

export interface PlacementZone {
  id: string;
  name: string;
  x: number;      // 0-1 (percentage of canvas width)
  y: number;      // 0-1 (percentage of canvas height)
  width: number;  // 0-1 (percentage of canvas width)
  height: number; // 0-1 (percentage of canvas height)
  minSize?: number; // Optional: minimum element size in pixels
  maxSize?: number; // Optional: maximum element size in pixels
}

export interface Product {
  id: number;
  name: string;
  price: number;
  priceFormatted: string;
  image: string;
  images: string[];
  colors: string[];
  sizes: string[];
  category: string;
  description: string;
  features: string[];
  tags?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  placementZones?: {
    front?: PlacementZone[];
    back?: PlacementZone[];
    left?: PlacementZone[];
    right?: PlacementZone[];
  };
  geschlecht?: string;
  verfuegbareGroessen?: string[]; // Comma-separated sizes from custom field "verfügbare größen"
}

export const products: Product[] = [
  {
    id: 1,
    name: "Oxford Hemd KA",
    price: 19.90,
    priceFormatted: "19,90 €",
    image: productPolo,
    images: [productPolo],
    colors: ["Weiß", "Schwarz", "Blau", "Grau"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    category: "Polohemden",
    description: "Klassisches Oxford-Hemd mit kurzen Ärmeln. Perfekt für Business und Freizeit.",
    features: ["100% Baumwolle", "Waschbar bis 40°C", "Bügelleicht", "Button-Down Kragen"],
  },
  {
    id: 2,
    name: "B&C Exact 190",
    price: 8.95,
    priceFormatted: "8,95 €",
    image: productTshirt,
    images: [productTshirt],
    colors: ["Weiß", "Schwarz", "Rot", "Blau", "Grün", "Gelb"],
    sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
    category: "T-Shirts",
    description: "Hochwertiges T-Shirt mit 190g/m² Stoffgewicht. Ideal für Druck und Stickerei.",
    features: ["100% ringgesponnene Baumwolle", "190g/m²", "Verstärkte Schulternähte", "Doppelt gesäumter Hals"],
  },
  {
    id: 3,
    name: "Ladies Running-T",
    price: 15.95,
    priceFormatted: "15,95 €",
    image: productTshirt,
    images: [productTshirt],
    colors: ["Weiß", "Pink", "Rot", "Blau"],
    sizes: ["XS", "S", "M", "L", "XL"],
    category: "T-Shirts",
    description: "Leichtes Sport-T-Shirt für Damen. Atmungsaktiv und schnelltrocknend.",
    features: ["100% Polyester", "Feuchtigkeitsableitend", "UV-Schutz", "Figurbetonter Schnitt"],
  },
  {
    id: 4,
    name: "B&C Piqué Polo Heavymill",
    price: 18.95,
    priceFormatted: "18,95 €",
    image: productPolo,
    images: [productPolo],
    colors: ["Weiß", "Schwarz", "Navy", "Rot", "Grün"],
    sizes: ["S", "M", "L", "XL", "XXL", "3XL"],
    category: "Polohemden",
    description: "Premium Piqué-Polo mit 230g/m². Robust und langlebig.",
    features: ["100% Baumwolle Piqué", "230g/m²", "3-Knopf-Leiste", "Verstärkter Kragen"],
  },
  {
    id: 5,
    name: "Kapuzen Sweatshirt Unisex",
    price: 26.95,
    priceFormatted: "26,95 €",
    image: productHoodie,
    images: [productHoodie],
    colors: ["Schwarz", "Grau", "Navy", "Pink", "Rot"],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    category: "Hoodies",
    description: "Kuscheliger Hoodie mit Kängurutasche. Perfekt für kühle Tage.",
    features: ["80% Baumwolle, 20% Polyester", "280g/m²", "Kängurutasche", "Kordelzug an der Kapuze"],
  },
  {
    id: 6,
    name: "Set In Sweatshirt",
    price: 22.95,
    priceFormatted: "22,95 €",
    image: productHoodie,
    images: [productHoodie],
    colors: ["Schwarz", "Grau", "Navy", "Rot", "Grün"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    category: "Sweatshirts",
    description: "Klassisches Rundhals-Sweatshirt. Bequem und vielseitig.",
    features: ["80% Baumwolle, 20% Polyester", "280g/m²", "Gerippte Bündchen", "Verstärkte Nähte"],
  },
  {
    id: 7,
    name: "Premium T-Shirt",
    price: 12.95,
    priceFormatted: "12,95 €",
    image: productTshirt,
    images: [productTshirt],
    colors: ["Weiß", "Schwarz", "Grau", "Navy", "Rot", "Blau"],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    category: "T-Shirts",
    description: "Unser meistverkauftes Premium-T-Shirt. Weich und langlebig.",
    features: ["100% gekämmte Baumwolle", "200g/m²", "Seitennähte", "Nackenband"],
  },
  {
    id: 8,
    name: "Classic Polo",
    price: 16.95,
    priceFormatted: "16,95 €",
    image: productPolo,
    images: [productPolo],
    colors: ["Weiß", "Schwarz", "Navy", "Rot", "Grün", "Gelb"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    category: "Polohemden",
    description: "Zeitloses Polo-Shirt für jeden Anlass.",
    features: ["100% Baumwolle Piqué", "200g/m²", "2-Knopf-Leiste", "Seitenschlitze"],
  },
];

export const getProductById = (id: number): Product | undefined => {
  return products.find((p) => p.id === id);
};
