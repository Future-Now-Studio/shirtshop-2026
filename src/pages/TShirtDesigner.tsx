import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas as FabricCanvas, FabricImage, FabricText, Path, Rect } from "fabric";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import {
  Upload,
  Type,
  Trash2,
  RotateCcw,
  Download,
  ShoppingBag,
  Move,
  FlipHorizontal,
  FlipVertical,
  Bold,
  Italic,
  Strikethrough,
  Palette,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  Layers,
  Eye,
  EyeOff,
  Info,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { useProduct, useProductVariations, useWooCommerceProduct } from "@/hooks/useProducts";
import { PlacementZone } from "@/data/products";
import {
  PLACEMENT_ZONE_CANVAS_SIZE,
  getPlacementCanvasSize,
} from "@/constants/placementCanvas";
import tshirtWhite from "@/assets/tshirt-mockup-white.png";
import tshirtBlack from "@/assets/tshirt-mockup-black.png";
import { Check } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { SizeChart } from "@/components/SizeChart";

/** Erzeugt einen SVG-Pfad für einen Bogen (quadratische Kurve). bend: -100 … 100, 0 = gerade. */
function createArcPathD(width: number, bend: number): string {
  if (bend === 0 || width <= 0) return `M 0,0 L ${width},0`;
  const cy = (-bend / 100) * Math.max(40, width * 0.4);
  return `M 0,0 Q ${width / 2} ${cy} ${width} 0`;
}

// Helper function to extract hex color from variation description
function extractHexFromDescription(description?: string): string | null {
  if (!description) return null;
  // Look for hex color patterns: #RRGGBB or #RGB
  const hexMatch = description.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/);
  return hexMatch ? hexMatch[0] : null;
}

// Helper function to find color attribute (more robust matching)
function findColorAttribute(attributes: any[]) {
  if (!attributes) return null;
  return attributes.find(attr => {
    const nameLower = (attr.name || '').toLowerCase();
    const slugLower = (attr.slug || '').toLowerCase();
    return (
      nameLower === 'farbe' ||
      nameLower === 'color' ||
      nameLower === 'colour' ||
      nameLower.includes('farbe') ||
      nameLower.includes('color') ||
      nameLower.includes('colour') ||
      slugLower === 'farbe' ||
      slugLower === 'color' ||
      slugLower === 'colour' ||
      slugLower.includes('farbe') ||
      slugLower.includes('color') ||
      slugLower.includes('colour')
    );
  });
}

/** Zone-Höhe in mm aus Breite + Aspect, wenn kein eigenes Höhenmaß */
function effectiveZoneHeightMm(zone: PlacementZone): number | undefined {
  if (zone.widthMm == null || zone.width <= 0) return undefined;
  if (zone.customMmSize && zone.heightMm != null) return zone.heightMm;
  return Math.round(((zone.widthMm * zone.height) / zone.width) * 10) / 10;
}

/**
 * Pixel-Bounding-Box des Objekts (für mm-Berechnung und Zonen-Treffer).
 * Nutzt Fabric getBoundingRect(true) wenn vorhanden, sonst width/height * scale.
 */
function getObjectPixelBox(obj: any): { cx: number; cy: number; w: number; h: number } | null {
  if (!obj) return null;
  try {
    if (typeof obj.getBoundingRect === "function") {
      const r = obj.getBoundingRect(true);
      if (r && r.width > 0 && r.height > 0) {
        return {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          w: r.width,
          h: r.height,
        };
      }
    }
  } catch {
    /* ignore */
  }
  const w = Math.abs((obj.width || 0) * (obj.scaleX || 1));
  const h = Math.abs((obj.height || 0) * (obj.scaleY || 1));
  if (w <= 0 || h <= 0) return null;
  // Ohne getBoundingRect: bei origin left/top ist Ecke links-oben
  const left = obj.left ?? 0;
  const top = obj.top ?? 0;
  const angle = ((obj.angle || 0) * Math.PI) / 180;
  if (Math.abs(angle) < 0.001) {
    return { cx: left + w / 2, cy: top + h / 2, w, h };
  }
  // Gedreht: Mittelpunkt näherungsweise über left/top je nach origin – Fabric setzt bei Rotation origin oft center
  return { cx: left, cy: top, w, h };
}

/**
 * Motivgröße in mm relativ zur passendsten Placement Zone.
 * Statt "Mitte muss in Zone liegen" nehmen wir die Zone mit der größten Überlappung.
 * So bleibt die Größenanzeige auch beim Skalieren am Zonenrand sinnvoll und relativ.
 */
function computeObjectMmSize(
  obj: any,
  zones: PlacementZone[] | undefined,
  canvasWidth: number,
  canvasHeight: number
): { widthMm: number; heightMm: number } | null {
  if (!zones || zones.length === 0) return null;
  const box = getObjectPixelBox(obj);
  if (!box) return null;
  const { w: objWidth, h: objHeight } = box;
  const objLeft = box.cx - objWidth / 2;
  const objTop = box.cy - objHeight / 2;
  const objRight = objLeft + objWidth;
  const objBottom = objTop + objHeight;
  let bestZone: PlacementZone | null = null;
  let bestOverlapArea = -1;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    if (zone.widthMm == null || Number.isNaN(Number(zone.widthMm))) continue;
    const zoneLeft = zone.x * canvasWidth;
    const zoneTop = zone.y * canvasHeight;
    const zoneWidthPx = zone.width * canvasWidth;
    const zoneHeightPx = zone.height * canvasHeight;
    if (zoneWidthPx <= 0 || zoneHeightPx <= 0) continue;

    const zoneRight = zoneLeft + zoneWidthPx;
    const zoneBottom = zoneTop + zoneHeightPx;

    const overlapWidth = Math.max(0, Math.min(objRight, zoneRight) - Math.max(objLeft, zoneLeft));
    const overlapHeight = Math.max(0, Math.min(objBottom, zoneBottom) - Math.max(objTop, zoneTop));
    const overlapArea = overlapWidth * overlapHeight;

    const zoneCx = zoneLeft + zoneWidthPx / 2;
    const zoneCy = zoneTop + zoneHeightPx / 2;
    const distSq = (box.cx - zoneCx) ** 2 + (box.cy - zoneCy) ** 2;

    if (
      overlapArea > bestOverlapArea ||
      (overlapArea === bestOverlapArea && distSq < bestDistanceSq)
    ) {
      bestZone = zone;
      bestOverlapArea = overlapArea;
      bestDistanceSq = distSq;
    }
  }

  if (!bestZone) return null;

  const zoneWidthPx = bestZone.width * canvasWidth;
  const zoneHeightPx = bestZone.height * canvasHeight;
  if (zoneWidthPx <= 0 || zoneHeightPx <= 0) return null;

  const heightMm = effectiveZoneHeightMm(bestZone);
  const zoneWidthMm = Number(bestZone.widthMm);
  if (!Number.isFinite(zoneWidthMm) || zoneWidthMm <= 0) return null;
  const mmPerPxX = zoneWidthMm / zoneWidthPx;
  const mmPerPxY = heightMm != null ? heightMm / zoneHeightPx : mmPerPxX;
  const widthMm = Math.round(objWidth * mmPerPxX * 10) / 10;
  const heightMmObj = Math.round(objHeight * mmPerPxY * 10) / 10;
  return { widthMm, heightMm: heightMmObj };
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePlacementZone(zone: any, index: number): PlacementZone {
  return {
    id: String(zone?.id ?? `zone-${index}`),
    name: String(zone?.name ?? `Zone ${index + 1}`),
    x: toFiniteNumber(zone?.x) ?? 0,
    y: toFiniteNumber(zone?.y) ?? 0,
    width: toFiniteNumber(zone?.width) ?? 0,
    height: toFiniteNumber(zone?.height) ?? 0,
    minSize: toFiniteNumber(zone?.minSize),
    maxSize: toFiniteNumber(zone?.maxSize),
    widthMm: toFiniteNumber(zone?.widthMm),
    heightMm: toFiniteNumber(zone?.heightMm),
    customMmSize: Boolean(zone?.customMmSize),
  };
}

function normalizePlacementZoneList(zones: any): PlacementZone[] {
  if (!Array.isArray(zones)) return [];
  return zones.map((zone, index) => normalizePlacementZone(zone, index));
}

function formatMmSizeLabel(size: { widthMm: number; heightMm: number }): string {
  return `B: ${(size.widthMm / 10).toFixed(1).replace(".", ",")} cm × H: ${(size.heightMm / 10)
    .toFixed(1)
    .replace(".", ",")} cm`;
}

const shirtColors = [
  { name: "Weiß", value: "#FFFFFF", image: tshirtWhite },
  { name: "Schwarz", value: "#1a1a1a", image: tshirtBlack },
];

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

const presetColors = [
  { name: "Schwarz", value: "#000000" },
  { name: "Weiß", value: "#FFFFFF" },
  { name: "Rot", value: "#FF0000" },
  { name: "Blau", value: "#0000FF" },
  { name: "Grün", value: "#00FF00" },
  { name: "Gelb", value: "#FFFF00" },
  { name: "Orange", value: "#FFA500" },
  { name: "Lila", value: "#800080" },
  { name: "Rosa", value: "#FFC0CB" },
  { name: "Grau", value: "#808080" },
  { name: "Braun", value: "#A52A2A" },
  { name: "Türkis", value: "#40E0D0" },
];

const fonts = [
  { name: "Outfit", value: "Outfit" },
  { name: "Arial", value: "Arial" },
  { name: "Helvetica", value: "Helvetica" },
  { name: "Times New Roman", value: "Times New Roman" },
  { name: "Georgia", value: "Georgia" },
  { name: "Verdana", value: "Verdana" },
  { name: "Courier New", value: "Courier New" },
  { name: "Comic Sans MS", value: "Comic Sans MS" },
  { name: "Impact", value: "Impact" },
  { name: "Trebuchet MS", value: "Trebuchet MS" },
  { name: "Palatino", value: "Palatino" },
  { name: "Garamond", value: "Garamond" },
];

type ViewType = "front" | "back" | "left" | "right";

const viewLabels: Record<ViewType, string> = {
  front: "Vorderseite",
  back: "Rückseite",
  left: "Linke Seite",
  right: "Rechte Seite",
};

/** Feste Reihenfolge: 1. Bild = Vorderseite, 2. = Rückseite, 3. = Links, 4. = Rechts */
const VIEW_ORDER: ViewType[] = ["front", "back", "left", "right"];

// Image Quality Control Configuration
const IMAGE_QUALITY_CONFIG = {
  minWidth: 100,              // Minimum width in pixels
  minHeight: 100,             // Minimum height in pixels
  maxWidth: 5000,             // Maximum width in pixels
  maxHeight: 5000,            // Maximum height in pixels
  minFileSize: 1024,          // Minimum file size in bytes (1KB)
  maxFileSize: 10 * 1024 * 1024, // Maximum file size (10MB) - already checked but kept for consistency
  allowedFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'],
  recommendedMinWidth: 300,    // Recommended minimum for print quality
  recommendedMinHeight: 300,
  recommendedDPI: 300,        // Recommended DPI for print quality
};

const TShirtDesigner = () => {
  const [searchParams] = useSearchParams();
  const productImage = searchParams.get("productImage");
  const productId = searchParams.get("productId");
  
  // Fetch product data to get placement zones
  const { data: product, isLoading: productLoading } = useProduct(productId ? Number(productId) : 0);
  const { data: wcProduct, isLoading: wcProductLoading } = useWooCommerceProduct(productId ? Number(productId) : 0);
  const { data: variations = [], isLoading: variationsLoading } = useProductVariations(productId ? Number(productId) : 0);
  const isProductLoading = productLoading || wcProductLoading || variationsLoading;
  const placementZones = useMemo(() => {
    const rawZonesMeta = wcProduct?.meta_data?.find(
      (meta: any) => meta.key === "design_placement_zones" || meta.key === "_design_placement_zones"
    );
    if (rawZonesMeta?.value) {
      try {
        const rawZones =
          typeof rawZonesMeta.value === "string"
            ? JSON.parse(rawZonesMeta.value)
            : rawZonesMeta.value;
        if (rawZones && typeof rawZones === "object") {
          return {
            front: normalizePlacementZoneList(rawZones.front),
            back: normalizePlacementZoneList(rawZones.back),
            left: normalizePlacementZoneList(rawZones.left),
            right: normalizePlacementZoneList(rawZones.right),
          };
        }
      } catch {
        /* ignore and fall back to mapped product */
      }
    }
    return product?.placementZones;
  }, [wcProduct, product]);
  
  // State for selected variation
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVariationImageIndex, setSelectedVariationImageIndex] = useState(0);
  
  /** Canvas-Element nur imperativ erzeugen – Fabric verschiebt den Knoten; React darf kein <canvas> als Kind reconcilen */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricHostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Gleicher Rahmen wie Admin Placement Zones – Canvas-Größe daraus, sonst Zonen verschoben */
  const designerCanvasWrapRef = useRef<HTMLDivElement>(null);
  const scalingTooltipRef = useRef<HTMLDivElement>(null);
  const scalingTooltipTextRef = useRef<HTMLParagraphElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedShirt, setSelectedShirt] = useState(
    productImage 
      ? { name: "Produkt", value: "#FFFFFF", image: productImage }
      : shirtColors[0]
  );
  const [selectedSize, setSelectedSize] = useState("M");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [canvasObjects, setCanvasObjects] = useState<any[]>([]);
  const [showCopyrightDialog, setShowCopyrightDialog] = useState(false);
  const [copyrightAccepted, setCopyrightAccepted] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [importantPointsAccepted, setImportantPointsAccepted] = useState(false);
  const [showImportantPointsDialog, setShowImportantPointsDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showProductDetailsDialog, setShowProductDetailsDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [basePrice, setBasePrice] = useState(0);
  const [hasSelectedObject, setHasSelectedObject] = useState(false);
  /** Welcher Editor-Kontext aktiv ist (für Label + Trennung im Panel) */
  const [selectedEditorType, setSelectedEditorType] = useState<"text" | "image" | "other" | null>(null);
  /** Anzeige Motivgröße in mm (wenn Zone widthMm gesetzt) */
  const [objectMmSize, setObjectMmSize] = useState<{ widthMm: number; heightMm: number } | null>(null);
  /** true solange ein Objekt aktiv skaliert wird (Eckpunkte ziehen) – für Live-mm-Overlay */
  const [isScalingMm, setIsScalingMm] = useState(false);
  /** Position der Sprechblase über dem Motiv (% relativ zum Canvas-Wrap), nur beim Skalieren */
  const [scalingTooltipPos, setScalingTooltipPos] = useState<{
    leftPct: number;
    topPct: number;
  } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [selectedFont, setSelectedFont] = useState("Outfit");
  const [textBold, setTextBold] = useState(false);
  const [outOfBoundsWarning, setOutOfBoundsWarning] = useState<string | null>(null);
  const [textItalic, setTextItalic] = useState(false);
  const [textStrikethrough, setTextStrikethrough] = useState(false);
  const [textColor, setTextColor] = useState(
    selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF"
  );
  const [textBend, setTextBend] = useState(0);
  const [currentView, setCurrentView] = useState<ViewType>("front");
  // Keep a ref in sync so canvas listeners always know the latest view
  const currentViewRef = useRef<ViewType>("front");
  // Store canvas JSON data for each view
  const [viewData, setViewData] = useState<Record<ViewType, string | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  });
  const addItem = useCartStore((state) => state.addItem);

  const setSelectedShirtIfChanged = useCallback(
    (next: { name: string; value: string; image: string }) => {
      setSelectedShirt((prev) => {
        if (
          prev.name === next.name &&
          prev.value === next.value &&
          prev.image === next.image
        ) {
          return prev;
        }
        return next;
      });
    },
    []
  );

  const hideScalingTooltip = useCallback(() => {
    const tooltip = scalingTooltipRef.current;
    if (!tooltip) return;
    tooltip.style.opacity = "0";
    tooltip.style.visibility = "hidden";
  }, []);

  const showScalingTooltip = useCallback(
    (size: { widthMm: number; heightMm: number }, pos: { leftPct: number; topPct: number }) => {
      const tooltip = scalingTooltipRef.current;
      const text = scalingTooltipTextRef.current;
      if (!tooltip || !text) return;
      text.textContent = formatMmSizeLabel(size);
      tooltip.style.left = `${pos.leftPct}%`;
      tooltip.style.top = `${pos.topPct}%`;
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    },
    []
  );

  const showScalingTooltipText = useCallback(
    (label: string, pos: { leftPct: number; topPct: number }) => {
      const tooltip = scalingTooltipRef.current;
      const text = scalingTooltipTextRef.current;
      if (!tooltip || !text) return;
      text.textContent = label;
      tooltip.style.left = `${pos.leftPct}%`;
      tooltip.style.top = `${pos.topPct}%`;
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    },
    []
  );

  // Keep ref updated with the latest currentView for use inside stable callbacks
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Save current view data before switching
  const saveCurrentView = useCallback(() => {
  if (!fabricCanvas) return;
  try {
    // Get the JSON representation
    const json = fabricCanvas.toJSON();
    
    // Filter out placement zones from the objects array
    if (json.objects) {
      json.objects = json.objects.filter((obj: any) => 
        !obj.name?.startsWith("placement-zone-")
      );
    }

    const jsonString = JSON.stringify(json);
    
    setViewData(prev => ({
      ...prev,
      [currentView]: jsonString,
    }));
  } catch (error) {
    console.error('Error saving view data:', error);
  }
}, [fabricCanvas, currentView]);

  // Load view function will be defined after viewImages

  /**
   * Placement-Zonen immer neu aus placementZones aufbauen (nach loadFromJSON/Resize sonst weg oder falsch skaliert).
   * Vorher alle placement-zone-* Objekte entfernen, damit keine veralteten Rechtecke übrig bleiben.
   */
  const ensureZonesExist = useCallback((targetView?: ViewType) => {
    if (!fabricCanvas || !placementZones) return;

    const viewToShow = targetView ?? currentViewRef.current;
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    if (canvasWidth < 50 || canvasHeight < 50) return;

    const allViews: ViewType[] = ["front", "back", "left", "right"];

    // Alle bestehenden Zonen-Objekte entfernen (inkl. aus JSON geladene Duplikate)
    const toRemove = fabricCanvas
      .getObjects()
      .filter((obj: any) => obj.name && String(obj.name).startsWith("placement-zone-"));
    toRemove.forEach((obj) => fabricCanvas.remove(obj));

    // Frisch erzeugen – Pixelmaße immer aus aktueller Canvas-Größe
    allViews.forEach((view) => {
      const zonesForView = placementZones[view];
      if (!zonesForView || zonesForView.length === 0) return;

      zonesForView.forEach((zone, index) => {
        const rect = new Rect({
          left: zone.x * canvasWidth,
          top: zone.y * canvasHeight,
          width: zone.width * canvasWidth,
          height: zone.height * canvasHeight,
          fill: "rgba(59, 130, 246, 0.18)",
          stroke: "rgba(59, 130, 246, 0.75)",
          strokeWidth: 2,
          strokeDashArray: [8, 4],
          selectable: false,
          evented: false,
          hoverCursor: "default",
          name: `placement-zone-${view}-${index}`,
          excludeFromExport: true,
          visible: view === viewToShow,
        });

        const label = new FabricText(zone.name, {
          left: zone.x * canvasWidth + 5,
          top: zone.y * canvasHeight + 5,
          fontSize: 12,
          fill: "rgba(59, 130, 246, 0.95)",
          fontFamily: "Outfit",
          fontWeight: "bold",
          selectable: false,
          evented: false,
          hoverCursor: "default",
          name: `placement-zone-label-${view}-${index}`,
          excludeFromExport: true,
          visible: view === viewToShow,
        });

        fabricCanvas.add(rect);
        fabricCanvas.add(label);
      });
    });

    fabricCanvas
      .getObjects()
      .filter((obj: any) => obj.name?.startsWith("placement-zone-"))
      .forEach((zoneObj) => fabricCanvas.sendObjectToBack(zoneObj));

    fabricCanvas.requestRenderAll?.();
    fabricCanvas.renderAll();
  }, [fabricCanvas, placementZones]);

  // Render placement zones as visual guides (non-interactive, always in background)
  useEffect(() => {
    if (!fabricCanvas || !placementZones) {
      console.log('[ZONES] No fabricCanvas or placementZones', { fabricCanvas: !!fabricCanvas, placementZones: !!placementZones });
      return;
    }

    console.log("[ZONES] Rebuilding zones for view:", currentView);
    ensureZonesExist(currentView);
  }, [fabricCanvas, placementZones, currentView, ensureZonesExist]);

  // Ensure zones stay at the back whenever objects are added or modified
  useEffect(() => {
    if (!fabricCanvas) return;

    const ensureZonesAtBack = () => {
      const zoneObjects = fabricCanvas.getObjects().filter(
        (obj: any) => obj.name?.startsWith("placement-zone-")
      );
      if (zoneObjects.length > 0) {
        zoneObjects.forEach((zoneObj) => {
          fabricCanvas.sendObjectToBack(zoneObj);
        });
        fabricCanvas.renderAll();
      }
    };

    // Listen for object additions and modifications
    // But NOT for object:added - that would interfere with zone rendering
    fabricCanvas.on("object:modified", ensureZonesAtBack);
    fabricCanvas.on("object:moving", ensureZonesAtBack);

    return () => {
      fabricCanvas.off("object:modified", ensureZonesAtBack);
      fabricCanvas.off("object:moving", ensureZonesAtBack);
    };
  }, [fabricCanvas]);

  // Check if point is within any zone
  const isPointInZone = useCallback((x: number, y: number, zones: PlacementZone[] | undefined): boolean => {
    if (!zones || zones.length === 0) return true; // No zones = allow anywhere

    return zones.some(zone => {
      // Assuming zones are relative to canvas (0-1), we need canvas dimensions
      if (!fabricCanvas) return false;
      const canvasWidth = fabricCanvas.getWidth();
      const canvasHeight = fabricCanvas.getHeight();
      
      const zoneLeft = zone.x * canvasWidth;
      const zoneTop = zone.y * canvasHeight;
      const zoneRight = zoneLeft + (zone.width * canvasWidth);
      const zoneBottom = zoneTop + (zone.height * canvasHeight);

      return x >= zoneLeft && x <= zoneRight && y >= zoneTop && y <= zoneBottom;
    });
  }, [fabricCanvas]);

  // Check if object is completely within zones
  const isObjectInZones = useCallback((obj: any, zones: PlacementZone[] | undefined): boolean => {
    if (!zones || zones.length === 0) return true; // No zones = allow anywhere
    if (!fabricCanvas) return false;

    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Get object bounds
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);
    const objLeft = (obj.left || 0) - objWidth / 2;
    const objTop = (obj.top || 0) - objHeight / 2;
    const objRight = objLeft + objWidth;
    const objBottom = objTop + objHeight;

    // Check if object is completely within any zone
    return zones.some(zone => {
      const zoneLeft = zone.x * canvasWidth;
      const zoneTop = zone.y * canvasHeight;
      const zoneRight = zoneLeft + (zone.width * canvasWidth);
      const zoneBottom = zoneTop + (zone.height * canvasHeight);

      return objLeft >= zoneLeft && objRight <= zoneRight && 
             objTop >= zoneTop && objBottom <= zoneBottom;
    });
  }, [fabricCanvas]);

  // Constrain object movement to zones
  const constrainToZones = useCallback((obj: any, zones: PlacementZone[] | undefined, shouldRender: boolean = true) => {
    if (!fabricCanvas) return;

    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Get object bounds
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);
    
    // Check if object is too big (larger than 80% of canvas)
    const maxWidth = canvasWidth * 0.8;
    const maxHeight = canvasHeight * 0.8;
    const isTooBig = objWidth > maxWidth || objHeight > maxHeight;

    // Save original stroke if not already saved (only save if it's not already red)
    if (obj._originalStroke === undefined) {
      // Only save if current stroke is not the red warning stroke
      if (obj.stroke !== "#dc2626" && obj.stroke !== "#ef4444") {
        obj._originalStroke = obj.stroke || undefined;
        obj._originalStrokeWidth = obj.strokeWidth || 0;
      } else {
        // If it's already red, save undefined so we remove it when in zone
        obj._originalStroke = undefined;
        obj._originalStrokeWidth = 0;
      }
    }

    if (!zones || zones.length === 0) {
      // No zones - only check size
      if (isTooBig) {
        if (obj.stroke !== "#dc2626" || obj.strokeWidth !== 4) {
          obj.set({
            stroke: "#dc2626", // Brighter red
            strokeWidth: 4, // Thicker border
          });
          if (shouldRender) {
            fabricCanvas.renderAll();
            setOutOfBoundsWarning("Element ist zu groß. Bitte verkleinern Sie das Element.");
          }
        }
      } else {
        // Remove red border if size is OK
        if (obj.stroke === "#dc2626" || obj.stroke === "#ef4444") {
          obj.set({
            stroke: obj._originalStroke || undefined,
            strokeWidth: obj._originalStrokeWidth || 0,
          });
          if (shouldRender) {
            fabricCanvas?.renderAll();
            setOutOfBoundsWarning(null);
          }
        }
      }
      return;
    }

    // Get object center
    const centerX = obj.left || 0;
    const centerY = obj.top || 0;

    const objLeft = centerX - objWidth / 2;
    const objTop = centerY - objHeight / 2;
    const objRight = objLeft + objWidth;
    const objBottom = objTop + objHeight;

    // Check if object is completely within any zone
    const inZone = zones.some(zone => {
        const zoneLeft = zone.x * canvasWidth;
        const zoneTop = zone.y * canvasHeight;
        const zoneRight = zoneLeft + (zone.width * canvasWidth);
        const zoneBottom = zoneTop + (zone.height * canvasHeight);

      return objLeft >= zoneLeft && objRight <= zoneRight && 
             objTop >= zoneTop && objBottom <= zoneBottom;
    });

    // Check if object is too big for any zone
    const fitsInAnyZone = zones.some(zone => {
      const zoneWidth = zone.width * canvasWidth;
      const zoneHeight = zone.height * canvasHeight;
      return objWidth <= zoneWidth && objHeight <= zoneHeight;
    });

    // Only show red border if object is OUTSIDE zone OR too big
    const shouldShowRedBorder = !inZone || isTooBig || !fitsInAnyZone;
    const currentStroke = obj.stroke;
    const currentStrokeWidth = obj.strokeWidth || 0;
    const hasRedBorder = currentStroke === "#dc2626" || currentStroke === "#ef4444";
    
    if (shouldShowRedBorder) {
      // Add red border to indicate out of bounds or too big
      // Only apply if not already red
      if (!hasRedBorder || currentStrokeWidth !== 4) {
        obj.set({
          stroke: "#dc2626", // Brighter red for better visibility
          strokeWidth: 4, // Thicker border
        });
        if (shouldRender) {
          fabricCanvas.renderAll();
        }
      }
      
      // Show warning in creator area when element goes outside
      if (shouldRender && !obj._hasShownWarning) {
        if (!inZone) {
          setOutOfBoundsWarning("Element befindet sich außerhalb der Druckbereiche. Bitte innerhalb der blauen Zonen platzieren.");
        } else if (isTooBig || !fitsInAnyZone) {
          setOutOfBoundsWarning("Element ist zu groß. Bitte verkleinern Sie das Element.");
        }
        obj._hasShownWarning = true;
      }
      // DO NOT automatically move objects - allow free movement anywhere
    } else {
      // Object is in zone and size is OK - remove red border
      if (hasRedBorder) {
        obj.set({
          stroke: obj._originalStroke !== undefined ? obj._originalStroke : undefined,
          strokeWidth: obj._originalStrokeWidth !== undefined ? obj._originalStrokeWidth : 0,
        });
        if (shouldRender) {
        fabricCanvas.renderAll();
      }
      }
      // Reset warning flag and clear warning message when object is back in valid position
      obj._hasShownWarning = false;
      setOutOfBoundsWarning(null);
    }
  }, [fabricCanvas]);

  // Initialize canvas – Host-Div bleibt React-Kind, Canvas wird per DOM angehängt (vermeidet insertBefore nach Fabric-Wrap)
  useEffect(() => {
    let cancelled = false;
    let canvasEl: HTMLCanvasElement | null = null;
    let canvas: FabricCanvas | null = null;
    let updateTimeout: NodeJS.Timeout | null = null;

    const mount = () => {
      if (cancelled) return;
      const host = fabricHostRef.current;
      if (!host) {
        requestAnimationFrame(mount);
        return;
      }

    canvasEl = document.createElement("canvas");
    canvasEl.className = "absolute inset-0 cursor-move block w-full h-full";
    canvasEl.style.touchAction = "none";
    canvasEl.style.backgroundColor = "transparent";
    host.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    const wrap = designerCanvasWrapRef.current || host.parentElement;
    const containerWidth = wrap?.clientWidth || containerRef.current?.clientWidth || PLACEMENT_ZONE_CANVAS_SIZE;
    const canvasSize = getPlacementCanvasSize(containerWidth);

    canvas = new FabricCanvas(canvasEl, {
      width: canvasSize,
      height: canvasSize,
      backgroundColor: "transparent",
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      includeDefaultValues: false,
    });
    
    // Ensure canvas is visible and interactive
    canvas.backgroundColor = 'transparent';
    canvas.renderAll();

    setFabricCanvas(canvas);

    // Track changes and save to current view with debouncing to prevent flickering
    const updateViewData = () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      updateTimeout = setTimeout(() => {
      try {
        const json = JSON.stringify(canvas.toJSON());
        setViewData(prev => ({
          ...prev,
          // Use ref so we always write to the correct view,
          // even though this effect only runs once
          [currentViewRef.current]: json,
        }));
      } catch (error) {
        console.error('Error updating view data:', error);
      }
      }, 100); // Debounce by 100ms
    };

    const updateObjectsList = () => {
      // Use setTimeout to ensure we get the latest objects after canvas updates
      setTimeout(() => {
        const objects = canvas.getObjects().filter((obj: any) => {
          // Exclude zone objects (both placement-zone- and zone- patterns)
          return !obj.name || (!obj.name.startsWith('zone-') && !obj.name.startsWith('placement-zone-'));
        });
        console.log('updateObjectsList - Filtered objects:', objects.length, objects);
        // Force update by creating new array reference
        setCanvasObjects(objects.map((o: any) => o));
      }, 10);
    };

    canvas.on("object:added", () => {
      console.log('Canvas event: object:added');
      updateViewData();
      updateObjectsList();
    });
    canvas.on("object:removed", () => {
      console.log('Canvas event: object:removed');
      updateViewData();
      updateObjectsList();
    });
    canvas.on("object:modified", updateViewData);
    canvas.on("path:created", () => {
      updateViewData();
      updateObjectsList();
    });
    
    // Initial update
    updateObjectsList();
    };

    mount();

    return () => {
      cancelled = true;
      if (updateTimeout) clearTimeout(updateTimeout);
      if (canvas) {
        try {
          canvas.dispose();
        } catch {
          /* ignore */
        }
      }
      canvasRef.current = null;
      if (canvasEl?.parentNode) {
        canvasEl.parentNode.removeChild(canvasEl);
      }
    };
  }, []);

  // Add zone validation handlers (visual feedback only, no auto-constraining)
  useEffect(() => {
    if (!fabricCanvas || !placementZones) return;

    const handleObjectMoving = (e: any) => {
      const obj = e.target;
      if (!obj) return;
      const currentZones = placementZones[currentView];
      // Show visual feedback (red border) during movement, don't constrain
      if (currentZones && currentZones.length > 0) {
        // Use a flag to track if this is the first move
        if (!obj._isBeingMoved) {
          obj._isBeingMoved = true;
          return; // Skip first move to allow initial placement
        }
        // Validate and show red border during movement (but don't show toast warnings during move)
        // We'll use a modified version that applies border but skips toast
        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        const objWidth = (obj.width || 0) * (obj.scaleX || 1);
        const objHeight = (obj.height || 0) * (obj.scaleY || 1);
        const objLeft = (obj.left || 0) - objWidth / 2;
        const objTop = (obj.top || 0) - objHeight / 2;
        const objRight = objLeft + objWidth;
        const objBottom = objTop + objHeight;
        
        const inZone = currentZones.some(zone => {
          const zoneLeft = zone.x * canvasWidth;
          const zoneTop = zone.y * canvasHeight;
          const zoneRight = zoneLeft + (zone.width * canvasWidth);
          const zoneBottom = zoneTop + (zone.height * canvasHeight);
          return objLeft >= zoneLeft && objRight <= zoneRight && 
                 objTop >= zoneTop && objBottom <= zoneBottom;
        });
        
        // Save original stroke if not already saved (only save if it's not already red)
        if (obj._originalStroke === undefined) {
          // Only save if current stroke is not the red warning stroke
          if (obj.stroke !== "#dc2626" && obj.stroke !== "#ef4444") {
            obj._originalStroke = obj.stroke || undefined;
            obj._originalStrokeWidth = obj.strokeWidth || 0;
          } else {
            // If it's already red, save undefined so we remove it when in zone
            obj._originalStroke = undefined;
            obj._originalStrokeWidth = 0;
          }
        }
        
        // Apply or remove red border during movement
        // Red border when OUTSIDE zone (!inZone), remove when INSIDE (inZone)
        if (!inZone) {
          // Object is OUTSIDE zone - show red border (thicker and more visible)
          const currentStroke = obj.stroke;
          const currentStrokeWidth = obj.strokeWidth || 0;
          if (currentStroke !== "#dc2626" || currentStrokeWidth !== 4) {
            obj.set({
              stroke: "#dc2626", // Brighter red
              strokeWidth: 4, // Thicker border
            });
            fabricCanvas.renderAll();
            setOutOfBoundsWarning("Element befindet sich außerhalb der Druckbereiche");
          }
        } else {
          // Object is INSIDE zone - remove red border and restore original
          const currentStroke = obj.stroke;
          if (currentStroke === "#dc2626" || currentStroke === "#ef4444") {
            obj.set({
              stroke: obj._originalStroke !== undefined ? obj._originalStroke : undefined,
              strokeWidth: obj._originalStrokeWidth !== undefined ? obj._originalStrokeWidth : 0,
            });
            fabricCanvas.renderAll();
            setOutOfBoundsWarning(null);
          }
        }
      }
    };

    const handleObjectModified = (e: any) => {
      setIsScalingMm(false);
      setScalingTooltipPos(null);
      hideScalingTooltip();
      const obj = e.target;
      if (!obj) return;
      const currentZones = placementZones[currentView];
      // Reset the movement flag
      if (obj._isBeingMoved) {
        obj._isBeingMoved = false;
      }
      // Only validate (show visual feedback) after modification, don't constrain
      if (currentZones && currentZones.length > 0) {
        constrainToZones(obj, currentZones);
      }
      const name = obj.name || "";
      if (!name.startsWith("placement-zone-") && !name.startsWith("zone-")) {
        const mm = computeObjectMmSize(
          obj,
          currentZones,
          fabricCanvas.getWidth(),
          fabricCanvas.getHeight()
        );
        setObjectMmSize(mm);
      }
    };

    let scalingRaf = 0;
    /**
     * Skalieren (Ecken) feuert object:scaling – Textbreite ziehen feuert object:resizing.
     * Beide müssen dieselbe Anzeige triggern, sonst erscheint beim Größenändern nichts.
     */
    const handleObjectScalingOrResizing = (e: any) => {
      setIsScalingMm(true);
      const obj = e.target;
      if (!obj) return;
      const name = obj.name || "";
      if (name.startsWith("placement-zone-") || name.startsWith("zone-")) return;
      const currentZones = placementZones[currentView];
      const cw = fabricCanvas.getWidth();
      const ch = fabricCanvas.getHeight();
      const run = () => {
        scalingRaf = 0;
        const mm = computeObjectMmSize(obj, currentZones, cw, ch);
        setObjectMmSize(mm);
        try {
          if (cw > 0 && ch > 0) {
            const box = getObjectPixelBox(obj);
            if (box && box.w > 0) {
              const pos = {
                leftPct: Math.max(0, Math.min(100, (box.cx / cw) * 100)),
                topPct: Math.max(0, Math.min(100, ((box.cy - box.h / 2) / ch) * 100)),
              };
              setScalingTooltipPos(pos);
              if (mm) showScalingTooltip(mm, pos);
              else hideScalingTooltip();
            } else {
              setScalingTooltipPos(null);
              hideScalingTooltip();
            }
          } else {
            setScalingTooltipPos(null);
            hideScalingTooltip();
          }
        } catch {
          setScalingTooltipPos(null);
          hideScalingTooltip();
        }
      };
      if (scalingRaf) cancelAnimationFrame(scalingRaf);
      scalingRaf = requestAnimationFrame(run);
    };

    fabricCanvas.on("object:moving", handleObjectMoving);
    fabricCanvas.on("object:modified", handleObjectModified);
    fabricCanvas.on("object:scaling", handleObjectScalingOrResizing);
    fabricCanvas.on("object:resizing", handleObjectScalingOrResizing);

    return () => {
      if (scalingRaf) cancelAnimationFrame(scalingRaf);
      fabricCanvas.off("object:moving", handleObjectMoving);
      fabricCanvas.off("object:modified", handleObjectModified);
      fabricCanvas.off("object:scaling", handleObjectScalingOrResizing);
      fabricCanvas.off("object:resizing", handleObjectScalingOrResizing);
    };
  }, [fabricCanvas, placementZones, currentView, constrainToZones, hideScalingTooltip, showScalingTooltip]);

  // Fallback for uploaded images/text: read the active Fabric transform every render frame.
  // This catches cases where object:scaling/object:resizing isn't emitted as expected.
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleAfterRender = () => {
      const transform = (fabricCanvas as any)._currentTransform || (fabricCanvas as any).currentTransform;
      const action = String(transform?.action || "");
      const target = transform?.target;

      if (!target || (!action.includes("scale") && !action.includes("resiz"))) {
        if (!isScalingMm) hideScalingTooltip();
        return;
      }

      const name = target.name || "";
      if (name.startsWith("placement-zone-") || name.startsWith("zone-")) {
        hideScalingTooltip();
        return;
      }

      const cw = fabricCanvas.getWidth();
      const ch = fabricCanvas.getHeight();
      const zonesForView = placementZones?.[currentViewRef.current];
      const box = getObjectPixelBox(target);
      if (!box || cw <= 0 || ch <= 0) {
        hideScalingTooltip();
        return;
      }

      const pos = {
        leftPct: Math.max(0, Math.min(100, (box.cx / cw) * 100)),
        topPct: Math.max(0, Math.min(100, ((box.cy - box.h / 2) / ch) * 100)),
      };

      const mm = computeObjectMmSize(target, zonesForView, cw, ch);
      if (mm) {
        showScalingTooltip(mm, pos);
      } else {
        showScalingTooltipText("Kein Zonenmaß", pos);
      }
    };

    fabricCanvas.on("after:render", handleAfterRender);
    return () => {
      fabricCanvas.off("after:render", handleAfterRender);
    };
  }, [fabricCanvas, placementZones, isScalingMm, hideScalingTooltip, showScalingTooltip, showScalingTooltipText]);

  // Helper to check if any design element is currently out of all placement zones
  const hasOutOfBoundsElements = useCallback(() => {
    if (!fabricCanvas || !placementZones) return false;
    const zonesForCurrentView = placementZones[currentView];
    if (!zonesForCurrentView || zonesForCurrentView.length === 0) return false;

    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    const designObjects = fabricCanvas.getObjects().filter((obj: any) => {
      const name = obj.name || "";
      return !name.startsWith("placement-zone-") && !name.startsWith("zone-");
    });

    // Only check design elements on the current view; other views are stored in viewData
    return designObjects.some((obj: any) => {
      const objWidth = (obj.width || 0) * (obj.scaleX || 1);
      const objHeight = (obj.height || 0) * (obj.scaleY || 1);
      const objLeft = (obj.left || 0) - objWidth / 2;
      const objTop = (obj.top || 0) - objHeight / 2;
      const objRight = objLeft + objWidth;
      const objBottom = objTop + objHeight;

      const inAnyZone = zonesForCurrentView.some(zone => {
        const zoneLeft = zone.x * canvasWidth;
        const zoneTop = zone.y * canvasHeight;
        const zoneRight = zoneLeft + (zone.width * canvasWidth);
        const zoneBottom = zoneTop + (zone.height * canvasHeight);
        return objLeft >= zoneLeft && objRight <= zoneRight && 
               objTop >= zoneTop && objBottom <= zoneBottom;
      });

      return !inAnyZone;
    });
  }, [fabricCanvas, placementZones, currentView]);

  // Get available colors from variations with hex codes and names
  const availableColors = useMemo(() => {
    if (!variations || variations.length === 0) return [];
    
    const colorMap = new Map<string, { name: string; hex: string | null }>();
    variations.forEach(variation => {
      const colorAttr = findColorAttribute(variation.attributes || []);
      if (colorAttr?.option) {
        const cleanColor = String(colorAttr.option).trim();
        if (cleanColor && !colorMap.has(cleanColor)) {
          const hex = extractHexFromDescription(variation.description);
          colorMap.set(cleanColor, { name: cleanColor, hex });
        }
      }
    });
    return Array.from(colorMap.values());
  }, [variations]);

  // Get available sizes from custom field "verfügbare größen" or from variations
  const availableSizes = useMemo(() => {
    // First, check if product has "verfügbare größen" custom field
    if (product?.verfuegbareGroessen && product.verfuegbareGroessen.length > 0) {
      return product.verfuegbareGroessen;
    }
    
    // Fallback to variations-based logic
    if (!variations || variations.length === 0) return sizes;
    
    const sizeSet = new Set<string>();
    variations.forEach(variation => {
      const colorAttr = variation.attributes?.find(attr => 
        attr.name.toLowerCase().includes('color') || 
        attr.name.toLowerCase().includes('farbe') ||
        attr.name.toLowerCase().includes('colour')
      );
      const sizeAttr = variation.attributes?.find(attr => 
        attr.name.toLowerCase().includes('size') || 
        attr.name.toLowerCase().includes('größe') || 
        attr.name.toLowerCase().includes('groesse')
      );
      
      // If color is selected, only include sizes for that color
      if (selectedColor) {
        const colorMatch = colorAttr && colorAttr.option.trim().toLowerCase() === selectedColor.trim().toLowerCase();
        if (colorMatch && sizeAttr?.option) {
          sizeSet.add(sizeAttr.option.trim());
        }
      } else if (sizeAttr?.option) {
        sizeSet.add(sizeAttr.option.trim());
      }
    });
    
    const available = Array.from(sizeSet);
    return available.length > 0 ? available : sizes;
  }, [product, variations, selectedColor]);

  // Galerie aus meta_data nachziehen, wenn die API keine images/svi_gallery liefert (WooCommerce: _product_image_gallery, SVI/Plugins: ggf. andere Keys)
  const variationsWithGallery = useMemo(() => {
    const productImages = wcProduct?.images ?? [];
    const idToImg = new Map(productImages.map((img: any) => [String(img.id), img]));
    return (variations || []).map((v: any) => {
      const hasImages = (v.images && v.images.length > 0) || (v.svi_gallery && v.svi_gallery.length > 0) || v.image?.src;
      if (hasImages) return v;
      const meta = Array.isArray(v.meta_data) ? v.meta_data : [];
      // 1) Array von Objekten mit src (manche APIs/Plugins liefern so)
      for (const m of meta) {
        const val = m.value;
        if (Array.isArray(val) && val.length > 0 && val.some((x: any) => x && (x.src || x.url))) {
          const images = val.map((x: any) => ({ id: x.id, src: x.src || x.url, name: x.name || '', alt: x.alt || '' })).filter((x: any) => x.src);
          if (images.length > 0) return { ...v, images };
        }
      }
      // 2) WooCommerce: _product_image_gallery = kommagetrennte Attachment-IDs
      const galleryMeta = meta.find((m: any) => m.key === '_product_image_gallery' || m.key === 'product_image_gallery');
      const galleryIds = galleryMeta?.value;
      if (galleryIds) {
        const ids = typeof galleryIds === 'string' ? galleryIds.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(galleryIds) ? galleryIds.map(String) : [];
        const images = ids.map((id: string) => idToImg.get(id)).filter(Boolean).map((img: any) => ({ id: img.id, src: img.src, name: img.name, alt: img.alt }));
        if (images.length > 0) return { ...v, images };
      }
      return v;
    });
  }, [variations, wcProduct?.images]);

  // Get images for selected variation (based on color and size)
  // 1) Product-level SVI (woosvi_slug) mit View-Hinweisen (_F, _B, _SL, _SR)
  // 2) Fallback: Bilder der passenden Variante (svi_gallery, image, images) – mit View-Hint oder nach Index
  const viewImages = useMemo(() => {
    const views: Record<ViewType, string[]> = {
      front: [],
      back: [],
      left: [],
      right: [],
    };

    // Titel-Präfix: PF = Vorderseite, PB = Rückseite (am Anfang des Bildtitels/Dateinamens)
    const assignByPFPrefix = (src: string, nameOrSrc: string): boolean => {
      const raw = String(nameOrSrc || "").trim();
      if (!raw) return false;
      const upper = raw.toUpperCase();
      if (upper.startsWith("PF")) {
        views.front.push(src);
        return true;
      }
      if (upper.startsWith("PB")) {
        views.back.push(src);
        return true;
      }
      return false;
    };

    const assignByFilename = (src: string, nameOrSrc: string) => {
      if (assignByPFPrefix(src, nameOrSrc)) return;
      const name = (nameOrSrc || src || "").toLowerCase();
      if (name.includes("_f") || name.includes("-f")) views.front.push(src);
      else if (name.includes("_b") || name.includes("-b")) views.back.push(src);
      else if (name.includes("_sl") || name.includes("-sl")) views.left.push(src);
      else if (name.includes("_sr") || name.includes("-sr")) views.right.push(src);
      else views.front.push(src);
    };

    const viewOrder: ViewType[] = ['front', 'back', 'left', 'right'];

    if (selectedColor && wcProduct) {
      const sviMeta = wcProduct.meta_data?.find((meta: any) => meta.key === 'woosvi_slug');
      
      if (sviMeta && sviMeta.value && Array.isArray(sviMeta.value)) {
        const normalizeString = (str: string): string => {
          return str
            .toLowerCase()
            .trim()
            .replace(/[()]/g, '')
            .replace(/[-\s]+/g, ' ')
            .trim();
        };
        
        const matchingSviEntry = sviMeta.value.find((entry: any) => {
          if (!entry.slugs || !Array.isArray(entry.slugs)) return false;
          return entry.slugs.some((slug: string) => {
            const slugStr = normalizeString(String(slug));
            const colorStr = normalizeString(String(selectedColor));
            let matches = slugStr === colorStr;
            if (!matches) matches = slugStr.includes(colorStr) || colorStr.includes(slugStr);
            return matches;
          });
        });
        
        if (matchingSviEntry && matchingSviEntry.imgs && Array.isArray(matchingSviEntry.imgs)) {
          const imageIds = matchingSviEntry.imgs.map((id: any) => String(id));
          const matchingImages = wcProduct.images?.filter(img => 
            imageIds.includes(String(img.id))
          ) || [];
          matchingImages.forEach((img) => {
            const name = img.name || img.src || "";
            if (assignByPFPrefix(img.src, name)) return;
            if (name.includes("_F") || name.includes("-F")) views.front.push(img.src);
            else if (name.includes("_B") || name.includes("-B")) views.back.push(img.src);
            else if (name.includes("_SL") || name.includes("-SL")) views.left.push(img.src);
            else if (name.includes("_SR") || name.includes("-SR")) views.right.push(img.src);
            else views.front.push(img.src);
          });
        }
      }
    }

    // Fallback: Bilder aus der gewählten Variante (svi_gallery, image, images) – nutzt variationsWithGallery (inkl. aus meta_data angereicherte Galerie)
    const hasAnyFromSvi = viewOrder.some((v) => (views[v] || []).length > 0);
    if (!hasAnyFromSvi && selectedColor && variationsWithGallery && variationsWithGallery.length > 0) {
      const findColorAttribute = (attributes: any[]) => {
        if (!attributes) return null;
        return attributes.find(attr => {
          const n = (attr.name || '').toLowerCase();
          const s = (attr.slug || '').toLowerCase();
          return n === 'farbe' || n === 'color' || n.includes('farbe') || n.includes('color') || s === 'farbe' || s === 'color' || s.includes('farbe') || s.includes('color');
        });
      };
      const matchingVariation = variationsWithGallery.find((v: any) => {
        const colorAttr = findColorAttribute(v.attributes || []);
        if (!colorAttr?.option) return false;
        return String(colorAttr.option).trim() === String(selectedColor).trim();
      });

      if (matchingVariation) {
        const collected: { src: string; name: string }[] = [];
        const seen = new Set<string>();

        const add = (src: string, name?: string) => {
          if (!src || seen.has(src)) return;
          seen.add(src);
          collected.push({ src, name: name || src || '' });
        };

        const sviGallery = (matchingVariation as any).svi_gallery;
        if (sviGallery && Array.isArray(sviGallery)) {
          sviGallery.forEach((img: any) => img?.src && add(img.src, img.name || img.src));
        }
        if ((matchingVariation as any).image?.src) {
          add((matchingVariation as any).image.src, (matchingVariation as any).image.name || (matchingVariation as any).image.src);
        }
        const gallery = (matchingVariation as any).images;
        if (gallery && Array.isArray(gallery)) {
          gallery.forEach((img: any) => img?.src && add(img.src, img.name || img.src));
        }

        const hasAnyHint = collected.some(({ name }) => {
          const trimmed = String(name || "").trim();
          const upper = trimmed.toUpperCase();
          if (upper.startsWith("PF") || upper.startsWith("PB")) return true;
          const n = name.toLowerCase();
          return (
            n.includes("_f") ||
            n.includes("-f") ||
            n.includes("_b") ||
            n.includes("-b") ||
            n.includes("_sl") ||
            n.includes("-sl") ||
            n.includes("_sr") ||
            n.includes("-sr")
          );
        });
        if (hasAnyHint) {
          collected.forEach(({ src, name }) => assignByFilename(src, name));
        } else {
          // Kein Filename-Hint: nach Index auf front, back, left, right verteilen (1. Bild = Vorderseite, 2. = Rückseite, …)
          collected.forEach(({ src }, i) => {
            const view = viewOrder[Math.min(i, viewOrder.length - 1)];
            views[view].push(src);
          });
        }
      }
    }

    // Wenn alles in front gelandet ist (z. B. ohne Filename-Hint), nach Index aufteilen: 1. = Vorderseite, 2. = Rückseite, …
    const onlyFront =
      views.front.length > 1 &&
      views.back.length === 0 &&
      views.left.length === 0 &&
      views.right.length === 0;
    if (onlyFront) {
      const next: Record<ViewType, string[]> = { front: [], back: [], left: [], right: [] };
      views.front.forEach((src, i) => {
        const v = viewOrder[Math.min(i, viewOrder.length - 1)];
        next[v].push(src);
      });
      return next;
    }

    return views;
  }, [selectedColor, wcProduct, variationsWithGallery]);

  const availableImageViews = useMemo(() => {
    const views: ViewType[] = ['front', 'back', 'left', 'right'];
    return views.filter((view) => (viewImages[view] || []).length > 0);
  }, [viewImages]);

  // Galerie der gewählten Variation in fester Reihenfolge (1. = Vorderseite, 2. = Rückseite, …) – unabhängig von viewImages-Buckets
  const variationGalleryOrdered = useMemo(() => {
    if (!selectedColor || !variationsWithGallery?.length) return [] as string[];
    const findColorAttribute = (attributes: any[]) => {
      if (!attributes) return null;
      return attributes.find((attr) => {
        const n = (attr.name || "").toLowerCase();
        const s = (attr.slug || "").toLowerCase();
        return (
          n === "farbe" ||
          n === "color" ||
          n.includes("farbe") ||
          n.includes("color") ||
          s === "farbe" ||
          s === "color" ||
          s.includes("farbe") ||
          s.includes("color")
        );
      });
    };
    const matching = variationsWithGallery.find((v: any) => {
      const colorAttr = findColorAttribute(v.attributes || []);
      if (!colorAttr?.option) return false;
      return String(colorAttr.option).trim() === String(selectedColor).trim();
    });
    if (!matching) return [] as string[];
    const ordered: string[] = [];
    const seen = new Set<string>();
    const push = (src: string) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      ordered.push(src);
    };
    const sviGallery = (matching as any).svi_gallery;
    if (sviGallery && Array.isArray(sviGallery)) {
      sviGallery.forEach((img: any) => img?.src && push(img.src));
    }
    if ((matching as any).image?.src) push((matching as any).image.src);
    const gallery = (matching as any).images;
    if (gallery && Array.isArray(gallery)) {
      gallery.forEach((img: any) => img?.src && push(img.src));
    }
    return ordered;
  }, [selectedColor, variationsWithGallery]);

  // Wenn sich die verfügbaren Ansichten ändern und die aktuelle nicht mehr dabei ist, auf erste verfügbare wechseln
  useEffect(() => {
    if (availableImageViews.length > 0 && !availableImageViews.includes(currentView)) {
      setCurrentView(availableImageViews[0]);
    }
  }, [availableImageViews, currentView]);

  // Check if there are actual design elements (not just empty canvas states)
  const hasAnyDesign = useMemo(() => {
    return Object.values(viewData).some(v => {
      if (!v) return false;
      try {
        const parsed = JSON.parse(v);
        const objects = parsed.objects || [];
        // Check if there are actual objects (excluding placement zones)
        return objects.some((obj: any) => {
          const objName = obj.name || '';
          return !objName.startsWith('placement-zone-') && !objName.startsWith('zone-');
        });
      } catch (error) {
        return false;
      }
    });
  }, [viewData]);

  const variationImages = useMemo(() => {
    // Return all images for current view
    return viewImages[currentView] || [];
  }, [viewImages, currentView]);

  // Update selected shirt image when variation or view changes
  useEffect(() => {
    // Use view-specific image from viewImages
    const currentViewImages = viewImages[currentView];
    if (currentViewImages && currentViewImages.length > 0) {
      const imageToUse = currentViewImages[selectedVariationImageIndex] || currentViewImages[0];
      if (imageToUse) {
        setSelectedShirtIfChanged({
          name: selectedColor || "Produkt", 
          value: "#FFFFFF", 
          image: imageToUse 
        });
        // Ensure zones are still present when cycling through images
        if (fabricCanvas && placementZones) {
          setTimeout(() => ensureZonesExist(currentView), 0);
        }
        return;
      }
    }
    
    // Fallback: If color is selected, find the exact matching variation and use its image (variationsWithGallery = mit aus meta_data angereicherter Galerie)
    if (selectedColor && variationsWithGallery && variationsWithGallery.length > 0) {
      const matchingVariation = variationsWithGallery.find((variation: any) => {
        const colorAttr = findColorAttribute(variation.attributes || []);
        if (!colorAttr || !colorAttr.option) return false;
        
        // Convert both to strings and compare (handles numbers like "741")
        const attrOption = String(colorAttr.option).trim();
        const selectedColorValue = String(selectedColor).trim();
        
        return attrOption === selectedColorValue;
      });
      
      if (matchingVariation) {
        // First check for svi_gallery (from PHP script)
        const sviGallery = (matchingVariation as any).svi_gallery;
        if (sviGallery && Array.isArray(sviGallery) && sviGallery.length > 0) {
          const sviImage = sviGallery[selectedVariationImageIndex]?.src || sviGallery[0]?.src;
          if (sviImage) {
            setSelectedShirtIfChanged({
              name: selectedColor, 
              value: "#FFFFFF", 
              image: sviImage 
            });
            // Ensure zones are still present when cycling through images
            if (fabricCanvas && placementZones) {
              setTimeout(() => ensureZonesExist(currentView), 0);
            }
            return;
          }
        }
        
        // Prioritize the variation's main image.src (from the JSON structure)
        // This is the image property directly on the variation object
        const variationImage = matchingVariation.image?.src;
        if (variationImage) {
          setSelectedShirtIfChanged({
            name: selectedColor, 
            value: "#FFFFFF", 
            image: variationImage 
          });
          // Ensure zones are still present when cycling through images
          if (fabricCanvas && placementZones) {
            setTimeout(() => ensureZonesExist(currentView), 0);
          }
          return;
        }
        // Fallback to gallery images if main image is not available
        const galleryImage = matchingVariation.images?.[selectedVariationImageIndex]?.src || matchingVariation.images?.[0]?.src;
        if (galleryImage) {
          setSelectedShirtIfChanged({
            name: selectedColor, 
            value: "#FFFFFF", 
            image: galleryImage 
          });
          // Ensure zones are still present when cycling through images
          if (fabricCanvas && placementZones) {
            setTimeout(() => ensureZonesExist(currentView), 0);
          }
          return;
        }
      }
    }
    
    // Fallback to product image only if no color is selected
    if (!selectedColor) {
      if (productImage) {
        setSelectedShirtIfChanged({ name: "Produkt", value: "#FFFFFF", image: productImage });
      } else if (product?.image) {
        setSelectedShirtIfChanged({ name: "Produkt", value: "#FFFFFF", image: product.image });
      }
    }
  }, [viewImages, currentView, selectedVariationImageIndex, selectedColor, productImage, product, variationsWithGallery, fabricCanvas, placementZones, ensureZonesExist, setSelectedShirtIfChanged]);

  // Load view function – optional imageSrcOverride setzt Hintergrund direkt (wichtig bei Galerie-Reihenfolge 1=front, 2=back, …)
  const loadView = useCallback((view: ViewType, imageIndex?: number, imageSrcOverride?: string) => {
    if (!fabricCanvas) return;

    const idx = imageIndex !== undefined ? imageIndex : selectedVariationImageIndex;
    const currentViewImages = viewImages[view];

    // Gleiche Ansicht, nur anderes Bild / Override: nur Hintergrund wechseln
    if (view === currentView && (imageSrcOverride || (imageIndex !== undefined && currentViewImages && currentViewImages[idx]))) {
      if (imageIndex !== undefined) setSelectedVariationImageIndex(imageIndex);
      const src = imageSrcOverride || currentViewImages![idx];
      if (src) {
        setSelectedShirt((prev) => (prev.image === src ? prev : { ...prev, image: src }));
      }
      // Nur Bild gewechselt – Zonen können fehlen (z. B. nach Resize); einmal sicher nachziehen
      if (placementZones) {
        setTimeout(() => ensureZonesExist(view), 0);
      }
      return;
    }

    if (imageIndex !== undefined) {
      setSelectedVariationImageIndex(imageIndex);
    }
    
    // Save current view before switching
    saveCurrentView();
    
    // Clear canvas design elements (keep zones for a split second, though they will be wiped by loadFromJSON)
    if (fabricCanvas.getContext && fabricCanvas.getWidth && fabricCanvas.getHeight) {
      try {
        const designObjects = fabricCanvas.getObjects().filter((obj: any) => {
          const name = obj.name || '';
          return !name.startsWith('placement-zone-') && !name.startsWith('zone-');
        });
        designObjects.forEach((obj) => fabricCanvas.remove(obj));
        fabricCanvas.backgroundColor = "transparent";
      } catch (error) {
        console.warn('Error clearing design elements:', error);
      }
    }
    
    // Load view data if it exists
    const viewJson = viewData[view];
    if (viewJson) {
      try {
        fabricCanvas.loadFromJSON(viewJson, () => {
          fabricCanvas.renderAll();
          // Force zone render after JSON load - use setTimeout to ensure it happens after loadFromJSON completes
          // Pass the target view explicitly to ensure correct visibility
          setTimeout(() => {
            ensureZonesExist(view);
          }, 0);
        });
      } catch (error) {
        console.error('Error loading view data:', error);
        // If error, still switch view and render zones
        setTimeout(() => {
          ensureZonesExist(view);
        }, 0);
      }
    } else {
        // New view with no data? Just render zones
        setTimeout(() => {
          ensureZonesExist(view);
        }, 0);
    }
    
    setCurrentView(view);
    
    // Hintergrund: Override hat Vorrang, sonst Bild aus viewImages[view]
    if (imageSrcOverride) {
      setSelectedShirt((prev) =>
        prev.image === imageSrcOverride ? prev : { ...prev, image: imageSrcOverride }
      );
    } else if (currentViewImages && currentViewImages.length > 0) {
      const imageToUse = currentViewImages[idx] ?? currentViewImages[0];
      if (imageToUse) {
        setSelectedShirt((prev) => (prev.image === imageToUse ? prev : { ...prev, image: imageToUse }));
      }
    }
  }, [fabricCanvas, viewData, saveCurrentView, viewImages, selectedVariationImageIndex, currentView, ensureZonesExist, placementZones]);

  // Reset image index when variation changes
  useEffect(() => {
    setSelectedVariationImageIndex(0);
  }, [selectedColor, selectedSize]);

  // Initialize with first variation if available (optional - user can also start without selection)
  useEffect(() => {
    if (availableColors.length > 0 && !selectedColor && productId) {
      // Auto-select first color if product has variations
      setSelectedColor(availableColors[0].name);
    }
  }, [availableColors, selectedColor, productId]);

  // Set base price from product
  useEffect(() => {
    if (product) {
      setBasePrice((prev) => (prev === product.price ? prev : product.price));
    }
  }, [product]);

  // Calculate total price per item
  const designElementPrice = canvasObjects.length * 10;
  const pricePerItem = basePrice + designElementPrice;
  
  // Calculate total quantity
  const totalQuantity = Object.values(sizeQuantities).reduce(
    (sum, qty) => sum + qty,
    0
  );
  
  // Calculate total price (price per item * quantity)
  const totalPrice = pricePerItem * (totalQuantity > 0 ? totalQuantity : 1);

  // Update selected product when URL parameter changes
  useEffect(() => {
    if (productImage && !selectedColor) {
      setSelectedShirtIfChanged({ name: "Produkt", value: "#FFFFFF", image: productImage });
    }
  }, [productImage, selectedColor, setSelectedShirtIfChanged]);

  // Update text color when shirt color changes (only if no text is selected)
  useEffect(() => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    // Only update default color if no text is selected
    if (!activeObject || activeObject.type !== "text") {
      const defaultColor = selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF";
      setTextColor((prev) => (prev === defaultColor ? prev : defaultColor));
    }
  }, [selectedShirt.value, fabricCanvas]);

  // Handle window resize – gleiche Größenlogik wie Admin; Zonen danach neu aufbauen (sonst falsche Pixelmaße)
  useEffect(() => {
    const handleResize = () => {
      if (!fabricCanvas) return;
      const wrap = designerCanvasWrapRef.current;
      const containerWidth = wrap?.clientWidth || containerRef.current?.clientWidth || PLACEMENT_ZONE_CANVAS_SIZE;
      const canvasSize = getPlacementCanvasSize(containerWidth);
      try {
        fabricCanvas.setDimensions({ width: canvasSize, height: canvasSize });
        fabricCanvas.calcOffset?.();
        fabricCanvas.requestRenderAll?.();
      } catch {
        fabricCanvas.renderAll();
      }
      if (placementZones) {
        ensureZonesExist(currentViewRef.current);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fabricCanvas, placementZones, ensureZonesExist]);


  // Process image upload after copyright acceptance
  const processImageUpload = useCallback(
    (file: File) => {
      if (!file || !fabricCanvas) return;

      // Validate file format
      if (!IMAGE_QUALITY_CONFIG.allowedFormats.includes(file.type)) {
        toast.error(`Nicht unterstütztes Format. Erlaubt: PNG, JPG, WEBP, SVG`);
        return;
      }

      // Validate minimum file size
      if (file.size < IMAGE_QUALITY_CONFIG.minFileSize) {
        toast.error("Datei ist zu klein. Bitte wähle ein größeres Bild.");
        return;
      }

      const reader = new FileReader();
      
      reader.onerror = () => {
        toast.error("Fehler beim Lesen der Datei");
      };

      reader.onload = async (event) => {
        const imgUrl = event.target?.result as string;
        if (!imgUrl) {
          toast.error("Fehler beim Laden des Bildes");
          return;
        }

        try {
          const img = await FabricImage.fromURL(imgUrl);
          
          if (!img || !img.width || !img.height) {
            toast.error("Bild konnte nicht geladen werden");
            return;
          }

          // Quality control checks
          const width = img.width || 0;
          const height = img.height || 0;

          // Check minimum dimensions
          if (width < IMAGE_QUALITY_CONFIG.minWidth || height < IMAGE_QUALITY_CONFIG.minHeight) {
            toast.error(
              `Bild ist zu klein. Minimum: ${IMAGE_QUALITY_CONFIG.minWidth}x${IMAGE_QUALITY_CONFIG.minHeight}px. ` +
              `Dein Bild: ${Math.round(width)}x${Math.round(height)}px`
            );
            return;
          }

          // Check maximum dimensions (warning only, will be scaled)
          if (width > IMAGE_QUALITY_CONFIG.maxWidth || height > IMAGE_QUALITY_CONFIG.maxHeight) {
            toast.warning(
              `Bild ist sehr groß (${Math.round(width)}x${Math.round(height)}px). ` +
              `Es wird automatisch skaliert. Empfohlen: max. ${IMAGE_QUALITY_CONFIG.maxWidth}x${IMAGE_QUALITY_CONFIG.maxHeight}px`
            );
          }

          // Check recommended dimensions for print quality (warning only)
          if (width < IMAGE_QUALITY_CONFIG.recommendedMinWidth || 
              height < IMAGE_QUALITY_CONFIG.recommendedMinHeight) {
            toast.warning(
              `Für beste Druckqualität empfehlen wir mindestens ` +
              `${IMAGE_QUALITY_CONFIG.recommendedMinWidth}x${IMAGE_QUALITY_CONFIG.recommendedMinHeight}px. ` +
              `Dein Bild: ${Math.round(width)}x${Math.round(height)}px`
            );
          }

          const canvasWidth = fabricCanvas.getWidth();
          const canvasHeight = fabricCanvas.getHeight();

          // Scale image to fit design area (center 60% of canvas)
          const maxWidth = canvasWidth * 0.5;
          const maxHeight = canvasHeight * 0.4;
          const scale = Math.min(
            maxWidth / (img.width || 1),
            maxHeight / (img.height || 1),
            1
          );

          img.scale(scale);
          img.set({
            left: canvasWidth / 2,
            top: canvasHeight / 2,
            originX: "center",
            originY: "center",
            name: `image-${Date.now()}`,
          });

          // Add image to canvas - simple and direct
          fabricCanvas.add(img);
          fabricCanvas.bringObjectToFront(img);
          fabricCanvas.setActiveObject(img);
          
          // Ensure zones stay in background
          const zoneObjects = fabricCanvas.getObjects().filter(
            (obj: any) => obj.name?.startsWith("placement-zone-")
          );
          zoneObjects.forEach((zoneObj) => {
            fabricCanvas.sendObjectToBack(zoneObj);
          });
          
          // Force render
          fabricCanvas.renderAll();
          
          // Debug: Log to console
          console.log('Image added to canvas:', img);
          console.log('Canvas objects:', fabricCanvas.getObjects().length);
          
          // Update objects list - force immediate update
          const objects = fabricCanvas.getObjects().filter((obj: any) => {
            return !obj.name || (!obj.name.startsWith('zone-') && !obj.name.startsWith('placement-zone-'));
          });
          console.log('Filtered objects:', objects.length);
          console.log('Setting canvasObjects to:', objects);
          setCanvasObjects([...objects]);
          
          // Also trigger the event handler update
          setTimeout(() => {
            const updatedObjects = fabricCanvas.getObjects().filter((obj: any) => {
              return !obj.name || (!obj.name.startsWith('zone-') && !obj.name.startsWith('placement-zone-'));
            });
            if (updatedObjects.length !== objects.length) {
              console.log('Objects changed, updating again:', updatedObjects.length);
              setCanvasObjects([...updatedObjects]);
            }
          }, 50);
          
          toast.success("Bild hinzugefügt!");
        } catch (error) {
          console.error("Image upload error:", error);
          toast.error(`Fehler beim Laden des Bildes: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
        }
      };
      
      reader.readAsDataURL(file);
    },
    [fabricCanvas]
  );

  // Handle image upload
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !fabricCanvas) {
        e.target.value = "";
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Bitte wähle eine Bilddatei");
        e.target.value = "";
        return;
      }

      // Validate file size (max from config)
      if (file.size > IMAGE_QUALITY_CONFIG.maxFileSize) {
        const maxSizeMB = IMAGE_QUALITY_CONFIG.maxFileSize / (1024 * 1024);
        toast.error(`Bild ist zu groß (max. ${maxSizeMB}MB)`);
        e.target.value = "";
        return;
      }

      // Check if copyright has been accepted
      if (!copyrightAccepted) {
        // Store file and show copyright dialog
        setPendingImageFile(file);
        setShowCopyrightDialog(true);
        e.target.value = "";
        return;
      }

      // Process upload directly if already accepted
      processImageUpload(file);
      e.target.value = "";
    },
    [fabricCanvas, copyrightAccepted, processImageUpload]
  );

  // Handle copyright acceptance
  const handleCopyrightAccept = () => {
    if (copyrightAccepted && pendingImageFile) {
      processImageUpload(pendingImageFile);
      setPendingImageFile(null);
      setShowCopyrightDialog(false);
    }
  };

  // Add text
  const handleAddText = () => {
    if (!fabricCanvas || !textInput.trim()) {
      toast.error("Bitte Text eingeben");
      return;
    }

    const text = new FabricText(textInput, {
      left: fabricCanvas.getWidth() / 2,
      top: fabricCanvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      fontSize: 32,
      fontFamily: selectedFont,
      fill: textColor,
      fontWeight: textBold ? "bold" : "normal",
      fontStyle: textItalic ? "italic" : "normal",
      linethrough: textStrikethrough,
      name: `text-${Date.now()}`,
    });

    fabricCanvas.add(text);
    fabricCanvas.bringObjectToFront(text);
    fabricCanvas.setActiveObject(text);
    
    // Ensure zones stay in background
    const zoneObjects = fabricCanvas.getObjects().filter(
      (obj: any) => obj.name?.startsWith("placement-zone-")
    );
    zoneObjects.forEach((zoneObj) => {
      fabricCanvas.sendObjectToBack(zoneObj);
    });
    
    // Force render
    fabricCanvas.renderAll();
    
    // Debug: Log to console
    console.log('Text added to canvas:', text);
    console.log('Canvas objects:', fabricCanvas.getObjects().length);
    
    // Update objects list - force immediate update
    const objects = fabricCanvas.getObjects().filter((obj: any) => {
      return !obj.name || (!obj.name.startsWith('zone-') && !obj.name.startsWith('placement-zone-'));
    });
    console.log('Filtered objects:', objects.length);
    console.log('Setting canvasObjects to:', objects);
    setCanvasObjects([...objects]);
    
    // Also trigger the event handler update
    setTimeout(() => {
      const updatedObjects = fabricCanvas.getObjects().filter((obj: any) => {
        return !obj.name || (!obj.name.startsWith('zone-') && !obj.name.startsWith('placement-zone-'));
      });
      if (updatedObjects.length !== objects.length) {
        console.log('Objects changed, updating again:', updatedObjects.length);
        setCanvasObjects([...updatedObjects]);
      }
    }, 50);
    
    setTextInput("");
    toast.success("Text hinzugefügt!");
  };

  // Apply formatting to selected text or update state for new text
  const handleApplyFormatting = (format: "bold" | "italic" | "strikethrough") => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    
    if (activeObject && activeObject.type === "text") {
      // Apply to selected text
      const text = activeObject as FabricText;
      if (format === "bold") {
        const newBold = text.fontWeight !== "bold";
        text.set("fontWeight", newBold ? "bold" : "normal");
        setTextBold(newBold);
      } else if (format === "italic") {
        const newItalic = text.fontStyle !== "italic";
        text.set("fontStyle", newItalic ? "italic" : "normal");
        setTextItalic(newItalic);
      } else if (format === "strikethrough") {
        const newStrikethrough = !text.linethrough;
        text.set("linethrough", newStrikethrough);
        setTextStrikethrough(newStrikethrough);
      }
      fabricCanvas.renderAll();
    } else {
      // Update state for new text
      if (format === "bold") {
        setTextBold(!textBold);
      } else if (format === "italic") {
        setTextItalic(!textItalic);
      } else if (format === "strikethrough") {
        setTextStrikethrough(!textStrikethrough);
      }
    }
  };

  // Update formatting buttons and font when selection changes
  useEffect(() => {
    if (!fabricCanvas) return;

    const updateFormattingButtons = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === "text") {
        const text = activeObject as FabricText;
        setTextBold(text.fontWeight === "bold");
        setTextItalic(text.fontStyle === "italic");
        setTextStrikethrough(text.linethrough || false);
        setSelectedFont(text.fontFamily || "Outfit");
        setTextColor(text.fill as string || (selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF"));
        const bend = (text as any).textBend;
        setTextBend(typeof bend === "number" ? bend : (text.path ? 50 : 0));
      } else {
        setTextBold(false);
        setTextItalic(false);
        setTextStrikethrough(false);
        setTextColor(selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF");
        setTextBend(0);
      }
    };

    const handleSelectionChange = () => {
      const activeObject = fabricCanvas.getActiveObject();
      setHasSelectedObject(!!activeObject);
      if (!activeObject) {
        setSelectedEditorType(null);
      } else if (activeObject.type === "text") {
        setSelectedEditorType("text");
      } else if (activeObject.type === "image" || activeObject.type === "fabric-image") {
        setSelectedEditorType("image");
      } else {
        setSelectedEditorType("other");
      }
      if (!activeObject) {
        setObjectMmSize(null);
        setIsScalingMm(false);
        setScalingTooltipPos(null);
        hideScalingTooltip();
      }
      else {
        const name = (activeObject as any).name || "";
        if (!name.startsWith("placement-zone-") && !name.startsWith("zone-") && fabricCanvas && placementZones) {
          const mm = computeObjectMmSize(
            activeObject,
            placementZones[currentViewRef.current],
            fabricCanvas.getWidth(),
            fabricCanvas.getHeight()
          );
          setObjectMmSize(mm);
        } else setObjectMmSize(null);
      }
      updateFormattingButtons();
    };

    fabricCanvas.on("selection:created", handleSelectionChange);
    fabricCanvas.on("selection:updated", handleSelectionChange);
    fabricCanvas.on("selection:cleared", handleSelectionChange);

    return () => {
      fabricCanvas.off("selection:created", handleSelectionChange);
      fabricCanvas.off("selection:updated", handleSelectionChange);
      fabricCanvas.off("selection:cleared", handleSelectionChange);
    };
  }, [fabricCanvas, hideScalingTooltip]);

  // Update selected text font when font selector changes
  const handleFontChange = (font: string) => {
    setSelectedFont(font);
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === "text") {
      const text = activeObject as FabricText;
      text.set("fontFamily", font);
      fabricCanvas.renderAll();
    }
  };

  // Update selected text color when color changes
  const handleColorChange = (color: string) => {
    setTextColor(color);
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === "text") {
      const text = activeObject as FabricText;
      text.set("fill", color);
      fabricCanvas.renderAll();
    }
  };

  // Text entlang eines Bogens biegen (Fabric Text-on-Path)
  const handleTextBendChange = (bend: number) => {
    setTextBend(bend);
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type !== "text") return;
    const text = activeObject as FabricText;
    (text as any).textBend = bend;
    if (bend === 0) {
      text.set("path", undefined);
    } else {
      const w = Math.max(50, (text.width as number) || 200);
      const path = new Path(createArcPathD(w, bend), {
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        visible: false,
        selectable: false,
        evented: false,
      });
      text.set("path", path);
    }
    fabricCanvas.renderAll();
  };

  // Delete selected
  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      fabricCanvas.remove(activeObject);
      fabricCanvas.renderAll();
      // Update objects list
      const objects = fabricCanvas.getObjects().filter((obj: any) => {
        return !obj.name || (!obj.name.startsWith('zone-') && !obj.name.startsWith('placement-zone-'));
      });
      setCanvasObjects([...objects]);
      toast.success("Element gelöscht");
    }
  };

  // Duplicate selected object
  const handleDuplicateSelected = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      try {
        const cloned = (activeObject as any).clone?.();
        if (cloned) {
          cloned.set({ left: (activeObject.left || 0) + 20, top: (activeObject.top || 0) + 20 });
          cloned.setCoords();
          fabricCanvas.add(cloned);
          fabricCanvas.setActiveObject(cloned);
          fabricCanvas.renderAll();
          const objects = fabricCanvas.getObjects().filter((o: any) => !o.name || (!o.name.startsWith('zone-') && !o.name.startsWith('placement-zone-')));
          setCanvasObjects([...objects]);
          toast.success("Element dupliziert");
        }
      } catch {
        toast.error("Duplizieren fehlgeschlagen");
      }
    }
  };

  // Move object to front
  const handleMoveToFront = (obj: any) => {
    if (!fabricCanvas) return;
    fabricCanvas.bringObjectToFront(obj);
    fabricCanvas.renderAll();
    const objects = fabricCanvas.getObjects().filter((o: any) => {
      return !o.name || (!o.name.startsWith('zone-') && !o.name.startsWith('placement-zone-'));
    });
    setCanvasObjects([...objects]);
  };

  // Move object to back
  const handleMoveToBack = (obj: any) => {
    if (!fabricCanvas) return;
    fabricCanvas.sendObjectToBack(obj);
    fabricCanvas.renderAll();
    const objects = fabricCanvas.getObjects().filter((o: any) => {
      return !o.name || (!o.name.startsWith('zone-') && !o.name.startsWith('placement-zone-'));
    });
    setCanvasObjects([...objects]);
  };

  // Move object forward one layer
  const handleMoveForward = (obj: any) => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    const currentIndex = objects.indexOf(obj);
    if (currentIndex < objects.length - 1) {
      // Remove and re-add at new position
      fabricCanvas.remove(obj);
      const newIndex = currentIndex + 1;
      // Re-add all objects in order, inserting obj at new position
      // Keep zones, only reorder design elements
      const allObjects = fabricCanvas.getObjects();
      const zones = allObjects.filter((o: any) => {
        const name = o.name || '';
        return name.startsWith('placement-zone-') || name.startsWith('zone-');
      });
      const designObjects = allObjects.filter((o: any) => {
        const name = o.name || '';
        return !name.startsWith('placement-zone-') && !name.startsWith('zone-');
      });
      
      designObjects.splice(newIndex, 0, obj);
      
      // Remove all design objects (not zones)
      designObjects.forEach(o => fabricCanvas.remove(o));
      // Re-add design objects in new order
      designObjects.forEach(o => fabricCanvas.add(o));
      // Ensure zones stay at back
      zones.forEach(z => fabricCanvas.sendObjectToBack(z));
      
      fabricCanvas.renderAll();
      const filteredObjects = fabricCanvas.getObjects().filter((o: any) => {
        return !o.name || (!o.name.startsWith('zone-') && !o.name.startsWith('placement-zone-'));
      });
      setCanvasObjects([...filteredObjects]);
    }
  };

  // Move object backward one layer
  const handleMoveBackward = (obj: any) => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    const currentIndex = objects.indexOf(obj);
    if (currentIndex > 0) {
      // Remove and re-add at new position
      fabricCanvas.remove(obj);
      const newIndex = currentIndex - 1;
      // Re-add all objects in order, inserting obj at new position
      // Keep zones, only reorder design elements
      const allObjects = fabricCanvas.getObjects();
      const zones = allObjects.filter((o: any) => {
        const name = o.name || '';
        return name.startsWith('placement-zone-') || name.startsWith('zone-');
      });
      const designObjects = allObjects.filter((o: any) => {
        const name = o.name || '';
        return !name.startsWith('placement-zone-') && !name.startsWith('zone-');
      });
      
      designObjects.splice(newIndex, 0, obj);
      
      // Remove all design objects (not zones)
      designObjects.forEach(o => fabricCanvas.remove(o));
      // Re-add design objects in new order
      designObjects.forEach(o => fabricCanvas.add(o));
      // Ensure zones stay at back
      zones.forEach(z => fabricCanvas.sendObjectToBack(z));
      
      fabricCanvas.renderAll();
      const filteredObjects = fabricCanvas.getObjects().filter((o: any) => {
        return !o.name || (!o.name.startsWith('zone-') && !o.name.startsWith('placement-zone-'));
      });
      setCanvasObjects([...filteredObjects]);
    }
  };

  // Select object from list
  const handleSelectObject = (obj: any) => {
    if (!fabricCanvas) return;
    fabricCanvas.setActiveObject(obj);
    fabricCanvas.renderAll();
  };

  // Delete object from list
  const handleDeleteObject = (obj: any) => {
    if (!fabricCanvas) return;
    fabricCanvas.remove(obj);
    fabricCanvas.renderAll();
    const objects = fabricCanvas.getObjects().filter((o: any) => {
      return !o.name || (!o.name.startsWith('zone-') && !o.name.startsWith('placement-zone-'));
    });
    setCanvasObjects([...objects]);
    toast.success("Element gelöscht");
  };

  // Clear all design elements (but keep zones)
  const handleClearAll = () => {
    if (!fabricCanvas) return;
    // Remove only design elements, NOT zones
    const designObjects = fabricCanvas.getObjects().filter((obj: any) => {
      const name = obj.name || '';
      return !name.startsWith('placement-zone-') && !name.startsWith('zone-');
    });
    designObjects.forEach((obj) => fabricCanvas.remove(obj));
    fabricCanvas.backgroundColor = "transparent";
    fabricCanvas.renderAll();
    // Clear current view data
    setViewData(prev => ({
      ...prev,
      [currentView]: null,
    }));
    // Update objects list
    setCanvasObjects([]);
    toast.success("Design zurückgesetzt");
  };

  // Flip horizontal
  const handleFlipHorizontal = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.set("flipX", !activeObject.flipX);
      fabricCanvas.renderAll();
    }
  };

  // Flip vertical
  const handleFlipVertical = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.set("flipY", !activeObject.flipY);
      fabricCanvas.renderAll();
    }
  };

  // Download design - export each customized side separately
  const handleDownload = async () => {
    if (!fabricCanvas) return;

    // Capture current view's canvas state synchronously (state update is async, can't rely on it)
    const currentViewJson = JSON.stringify(fabricCanvas.toJSON());
    const latestViewData: Record<string, string | null> = { ...viewData, [currentView]: currentViewJson };

    // Export each view that has design elements
    const views: ViewType[] = ["front", "back", "left", "right"];
    let exportedCount = 0;

    for (const view of views) {
      const viewJson = latestViewData[view];
      if (!viewJson) continue; // Skip views without design

      try {
        // Get the shirt image for this view
        const viewImgs = viewImages[view];
        const shirtImageUrl = viewImgs && viewImgs.length > 0 
          ? viewImgs[0] 
          : selectedShirt.image;

    // Create a temporary canvas with shirt + design
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 800;
    tempCanvas.height = 800;
    const ctx = tempCanvas.getContext("2d");
        if (!ctx) continue;

        await new Promise<void>((resolve) => {
    const shirtImg = new Image();
    shirtImg.crossOrigin = "anonymous";
    
    shirtImg.onerror = () => {
            console.error(`Error loading shirt image for ${view}`);
            resolve();
    };

    shirtImg.onload = () => {
            // Draw shirt image with preserved aspect ratio (similar to CSS background-size: contain)
      const imgWidth = shirtImg.width;
      const imgHeight = shirtImg.height;
      const canvasSize = 800;
      const scale = Math.min(canvasSize / imgWidth, canvasSize / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const offsetX = (canvasSize - drawWidth) / 2;
      const offsetY = (canvasSize - drawHeight) / 2;

      ctx.clearRect(0, 0, canvasSize, canvasSize);
      ctx.drawImage(shirtImg, offsetX, offsetY, drawWidth, drawHeight);

            // Create a temporary fabric canvas for this view with the same dimensions as the main canvas
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            const designCanvas = document.createElement("canvas");
            designCanvas.width = canvasWidth;
            designCanvas.height = canvasHeight;
            const tempFabricCanvas = new FabricCanvas(designCanvas, {
              width: canvasWidth,
              height: canvasHeight,
              backgroundColor: "transparent",
            });

            // Load view data and filter out placement zones
            // Same approach as handleAddToCart
            tempFabricCanvas.loadFromJSON(viewJson, () => {
              console.log(`Loading design for ${view}...`);
              
              // Filter out placement zones
              const allObjects = tempFabricCanvas.getObjects();
              console.log(`Total objects in ${view}:`, allObjects.length);
              
              const objectsToRemove: any[] = [];
              allObjects.forEach(obj => {
                const objName = (obj as any).name || '';
                if (objName.startsWith('placement-zone-') || objName.startsWith('zone-')) {
                  objectsToRemove.push(obj);
                }
              });
              
              objectsToRemove.forEach(obj => tempFabricCanvas.remove(obj));
              
              const remainingObjects = tempFabricCanvas.getObjects();
              console.log(`Objects after filtering (${view}):`, remainingObjects.length, remainingObjects.map((o: any) => ({ type: o.type, name: o.name })));
              
              // Wait for all images to load before rendering
              const imageObjects = remainingObjects.filter((obj: any) => {
                return obj.type === 'image' || obj.type === 'fabric-image';
              });
              
              console.log(`Image objects in ${view}:`, imageObjects.length);
              
              const imageLoadPromises = imageObjects.map((obj: any) => {
                return new Promise<void>((imgResolve) => {
                  // Try to get the image element
                  const imgElement = (obj as any)._element;
                  if (!imgElement) {
                    console.log(`No image element found for object in ${view}`);
                    imgResolve();
                    return;
                  }
                  
                  if (imgElement.complete && imgElement.naturalWidth > 0) {
                    console.log(`Image already loaded for ${view}`);
                    imgResolve();
                  } else {
                    imgElement.onload = () => {
                      console.log(`Image loaded for ${view}`);
                      imgResolve();
                    };
                    imgElement.onerror = () => {
                      console.error(`Image failed to load for ${view}`);
                      imgResolve(); // Continue even if image fails
                    };
                    // Timeout after 2 seconds
                    setTimeout(() => {
                      console.log(`Image load timeout for ${view}`);
                      imgResolve();
                    }, 2000);
                  }
                });
              });
              
              // Wait for all images to load, then render
              Promise.all(imageLoadPromises).then(() => {
                console.log(`All images loaded for ${view}, rendering...`);
                // Render all objects after images are loaded
                tempFabricCanvas.renderAll();
                
                // Small delay to ensure rendering is complete
                setTimeout(() => {
                  // Export design at the correct scale to match the 800x800 output
                  // Same multiplier as handleAddToCart: 800 / canvasWidth
                  const designDataUrl = tempFabricCanvas.toDataURL({
        format: "png",
                    multiplier: 800 / canvasWidth,
      });

                  console.log(`Design exported for ${view}, data URL length:`, designDataUrl.length);

      const designImg = new Image();
      designImg.onerror = () => {
                    console.error(`Error loading design image for ${view}`);
                    tempFabricCanvas.dispose();
                    resolve();
      };
      
      designImg.onload = () => {
                    console.log(`Design image loaded for ${view}, drawing on shirt...`);
                    // Draw design on top of shirt at the same size (800x800)
                    // This ensures design elements are positioned correctly on the product
        ctx.drawImage(designImg, 0, 0, 800, 800);

                    // Download this view
        const link = document.createElement("a");
                    link.download = `mein-design-${viewLabels[view].toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = tempCanvas.toDataURL("image/png");
        link.click();
                    
                    console.log(`Downloaded design for ${view}`);
                    exportedCount++;
                    tempFabricCanvas.dispose();
                    resolve();
      };
      designImg.src = designDataUrl;
                }, 50);
              });
            });
          };
          
          shirtImg.src = shirtImageUrl;
        });
      } catch (error) {
        console.error(`Error exporting ${view}:`, error);
      }
    }

    if (exportedCount > 0) {
      toast.success(`${exportedCount} Design${exportedCount !== 1 ? 's' : ''} heruntergeladen!`);
    } else {
      toast.info("Keine Designs zum Herunterladen gefunden");
    }
  };

  // Add to cart
  const handleAddToCart = () => {
    try {
      console.log('handleAddToCart called');
      
      const totalQuantity = Object.values(sizeQuantities).reduce(
        (sum, qty) => sum + qty,
        0
      );
      console.log('Total quantity:', totalQuantity);
      console.log('sizeQuantities:', sizeQuantities);
      console.log('hasAnyDesign:', hasAnyDesign);
      console.log('importantPointsAccepted:', importantPointsAccepted);
      
      if (totalQuantity === 0) {
        toast.error("Bitte wähle mindestens eine Größe mit Menge");
      return;
    }

    // Capture current view synchronously (setViewData is async — don't rely on updated state here)
    let latestViewData = viewData;
    if (fabricCanvas) {
      try {
        const json = JSON.stringify(fabricCanvas.toJSON());
        latestViewData = { ...viewData, [currentView]: json };
        setViewData(latestViewData);
      } catch (error) {
        console.error('Error saving current view:', error);
      }
    }

    // Get all views data for processing
    const allViewsData = Object.values(latestViewData).filter(v => v !== null);
    
    // Only require checkbox acceptance if there are custom designs
    if (hasAnyDesign && !importantPointsAccepted) {
      console.log('Blocked: hasAnyDesign && !importantPointsAccepted');
      toast.error("Bitte bestätige, dass du die wichtigen Punkte beachtet hast");
      return;
    }

    // Generate preview image and save raw design data
    let previewImage = selectedShirt.image;
    let rawDesignData = null;
    let totalDesignElementCount = 0;

    if (hasAnyDesign) {
      // Count design elements across all views (exclude placement zones)
      allViewsData.forEach(viewJson => {
        if (viewJson) {
          try {
            const parsed = JSON.parse(viewJson);
            if (parsed.objects && Array.isArray(parsed.objects)) {
              const designObjs = parsed.objects.filter((obj: any) => {
                const n = obj.name || '';
                return !n.startsWith('placement-zone-') && !n.startsWith('zone-');
              });
              totalDesignElementCount += designObjs.length;
            }
          } catch (error) {
            console.error('Error parsing view data:', error);
          }
        }
      });

      // Save all views data as JSON
      rawDesignData = JSON.stringify({
        views: latestViewData,
        version: "1.0",
      });

      // Generate images for each customized view
      if (!fabricCanvas) {
        toast.error("Canvas nicht verfügbar. Bitte lade die Seite neu.");
        return;
      }

      const generateDesignImages = async () => {
        console.log('generateDesignImages: Starting...');
        const customDesigns: Record<string, string> = {};
          const views: ViewType[] = ["front", "back", "left", "right"];
        
        // Generate individual images for each view
          for (const view of views) {
            const viewJson = latestViewData[view];
          console.log(`Checking view ${view}:`, viewJson ? 'has data' : 'no data');
          if (!viewJson) continue; // Skip views without design
          
          // Check if view actually has design elements (not just empty canvas)
          try {
            const parsed = JSON.parse(viewJson);
            const objects = parsed.objects || [];
            const hasElements = objects.some((obj: any) => {
              const objName = obj.name || '';
              return !objName.startsWith('placement-zone-') && !objName.startsWith('zone-');
            });
            if (!hasElements) {
              console.log(`View ${view} has no design elements, skipping`);
              continue;
            }
            console.log(`View ${view} has ${objects.length} objects, processing...`);
          } catch (e) {
            console.log(`View ${view} parse error, skipping:`, e);
            continue;
          }

          try {
            // Get the shirt image for this view
            const viewImgs = viewImages[view];
            const shirtImageUrl = viewImgs && viewImgs.length > 0 
              ? viewImgs[0] 
              : selectedShirt.image;

            // Create canvas for this view
                const viewCanvas = document.createElement("canvas");
            viewCanvas.width = 800;
            viewCanvas.height = 800;
                const viewCtx = viewCanvas.getContext("2d");
            if (!viewCtx) continue;

            await new Promise<void>((resolve) => {
              const viewShirtImg = new Image();
              viewShirtImg.crossOrigin = "anonymous";
              
              viewShirtImg.onerror = () => {
                console.error(`Error loading shirt image for ${view}`);
                // Continue even if image fails - just use empty design
                resolve();
              };
              
              viewShirtImg.onload = () => {
                viewCtx.drawImage(viewShirtImg, 0, 0, 800, 800);

                // Create fabric canvas for design
                const designCanvas = document.createElement("canvas");
                designCanvas.width = fabricCanvas.getWidth();
                designCanvas.height = fabricCanvas.getHeight();
                const tempFabricCanvas = new FabricCanvas(designCanvas, {
                  width: fabricCanvas.getWidth(),
                  height: fabricCanvas.getHeight(),
                    backgroundColor: "transparent",
                  });
                  
                    tempFabricCanvas.loadFromJSON(viewJson, () => {
                  // Filter out placement zones
                  const objects = tempFabricCanvas.getObjects();
                  objects.forEach(obj => {
                    const objName = (obj as any).name || '';
                    if (objName.startsWith('placement-zone-') || objName.startsWith('zone-')) {
                      tempFabricCanvas.remove(obj);
                    }
                  });
                  
                  tempFabricCanvas.renderAll();
                  
                      const designDataUrl = tempFabricCanvas.toDataURL({
                        format: "png",
                    multiplier: 800 / fabricCanvas.getWidth(),
                      });

                      const designImg = new Image();
                  designImg.onerror = () => {
                    console.error(`Error loading design image for ${view}`);
                    tempFabricCanvas.dispose();
                    // Continue even if design image fails
                    resolve();
                  };
                  
                      designImg.onload = () => {
                    viewCtx.drawImage(designImg, 0, 0, 800, 800);
                    customDesigns[view] = viewCanvas.toDataURL("image/png");
                        tempFabricCanvas.dispose();
                        resolve();
                      };
                      designImg.src = designDataUrl;
                    });
              };
              viewShirtImg.src = shirtImageUrl;
                  });
              } catch (error) {
            console.error(`Error generating image for ${view}:`, error);
            // Continue with other views even if one fails
          }
        }

        return customDesigns;
      };

      // Generate images and add to cart
      console.log('Starting generateDesignImages...');
      console.log('totalDesignElementCount:', totalDesignElementCount);
      
      // If no actual design elements, skip image generation and add directly
      if (totalDesignElementCount === 0) {
        console.log('No design elements found, adding items directly (no image generation)');
        let addedCount = 0;
        Object.entries(sizeQuantities).forEach(([size, quantity]) => {
          if (quantity > 0) {
            console.log(`Adding item (no design): size=${size}, quantity=${quantity}`);
            addItem({
              productId: wcProduct?.id || (productId ? Number(productId) : 999),
              name: wcProduct?.name || product?.name || selectedShirt?.name || "Custom T-Shirt",
              price: wcProduct?.price ? parseFloat(wcProduct.price) : (product?.price || 24.95),
              image: selectedShirt.image,
              color: selectedShirt.name,
              size: size,
              quantity: quantity,
            });
            addedCount += quantity;
          }
        });
        console.log(`Successfully added ${addedCount} items (no design)`);
        toast.success(`${addedCount} Artikel${addedCount !== 1 ? '' : ''} zum Warenkorb hinzugefügt!`);
        return;
      }
      
      generateDesignImages()
        .then((customDesigns) => {
          console.log('generateDesignImages completed, customDesigns:', Object.keys(customDesigns));
          // Create preview image (use front view or first available)
          previewImage = customDesigns.front || customDesigns.back || customDesigns.left || customDesigns.right || selectedShirt.image;

          // Add items for each size with quantity > 0
          let addedCount = 0;
          Object.entries(sizeQuantities).forEach(([size, quantity]) => {
            if (quantity > 0) {
              console.log(`Adding item with design: size=${size}, quantity=${quantity}`);
          addItem({
            productId: 999,
            name: "Custom T-Shirt",
            price: 24.95,
            image: selectedShirt.image,
            color: selectedShirt.name,
                size: size,
                quantity: quantity,
                customDesign: previewImage, // Keep for backward compatibility
                customDesigns: customDesigns, // New: multiple images per view
            customDesignRaw: rawDesignData,
            designElementCount: totalDesignElementCount,
          });
              addedCount += quantity;
            }
          });

          console.log(`Successfully added ${addedCount} items with designs`);
          toast.success(`${addedCount} Artikel${addedCount !== 1 ? '' : ''} zum Warenkorb hinzugefügt! (${totalDesignElementCount} Design-Element${totalDesignElementCount !== 1 ? 'e' : ''})`);
        })
        .catch((error) => {
          console.error('Error generating design images:', error);
          // Even if image generation fails, add items with basic design data
          let addedCount = 0;
          Object.entries(sizeQuantities).forEach(([size, quantity]) => {
            if (quantity > 0) {
              console.log(`Adding item after error: size=${size}, quantity=${quantity}`);
      addItem({
        productId: 999,
        name: "Custom T-Shirt",
        price: 24.95,
        image: selectedShirt.image,
        color: selectedShirt.name,
                size: size,
                quantity: quantity,
                customDesign: selectedShirt.image, // Fallback to shirt image
                customDesigns: {}, // Empty designs object
                customDesignRaw: rawDesignData,
                designElementCount: totalDesignElementCount,
              });
              addedCount += quantity;
            }
          });
          console.log(`Added ${addedCount} items after error`);
          toast.warning(`${addedCount} Artikel${addedCount !== 1 ? '' : ''} zum Warenkorb hinzugefügt, aber Design-Bilder konnten nicht generiert werden.`);
        });
    }
    
    if (!hasAnyDesign) {
      // Add items for each size with quantity > 0 (no design)
      console.log('No design path - adding items directly');
      console.log('selectedShirt:', selectedShirt);
      console.log('sizeQuantities:', sizeQuantities);
      let addedCount = 0;
      Object.entries(sizeQuantities).forEach(([size, quantity]) => {
        if (quantity > 0) {
          console.log(`Adding item: size=${size}, quantity=${quantity}`);
          try {
            const itemToAdd = {
              productId: wcProduct?.id || (productId ? Number(productId) : 999),
              name: wcProduct?.name || product?.name || selectedShirt?.name || "Custom T-Shirt",
              price: wcProduct?.price ? parseFloat(wcProduct.price) : (product?.price || 24.95),
              image: selectedShirt.image,
              color: selectedShirt.name,
              size: size,
              quantity: quantity,
            };
            console.log('Item to add:', itemToAdd);
            addItem(itemToAdd);
            addedCount += quantity;
            console.log(`Successfully added item. Total added: ${addedCount}`);
          } catch (error) {
            console.error('Error adding item to cart:', error);
            toast.error(`Fehler beim Hinzufügen: ${error}`);
          }
        }
      });
      console.log(`Added ${addedCount} items to cart`);
      if (addedCount > 0) {
        toast.success(`${addedCount} Artikel${addedCount !== 1 ? '' : ''} zum Warenkorb hinzugefügt!`);
      }
    }
    } catch (error) {
      console.error('Error in handleAddToCart:', error);
      toast.error(`Fehler beim Hinzufügen zum Warenkorb: ${error}`);
    }
  };

  return (
    <Layout>
      <div className="container-wide py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="mb-8">
            <div className="mb-4">
              <h1 className="text-3xl lg:text-5xl font-bold text-primary">
                <span className="text-secondary">Creator</span>
              </h1>
            </div>
          <p className="text-muted-foreground">
            Lade dein eigenes Design hoch und platziere es auf deinem Produkt
          </p>
          </div>
        </motion.div>

        {isProductLoading && (
          <div className="grid lg:grid-cols-12 gap-4 lg:gap-6 animate-pulse">
            <div className="lg:col-span-2">
              <div className="flex flex-row lg:flex-col gap-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-muted flex-shrink-0 w-20 lg:w-full" />
                ))}
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="glass-card rounded-2xl overflow-hidden" style={{ minHeight: 'min(500px, 70vw)', maxHeight: '600px' }}>
                <div className="w-full h-full bg-muted flex items-center justify-center" style={{ minHeight: 'min(500px, 70vw)', maxHeight: '600px' }}>
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm">Produkt wird geladen…</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="h-48 rounded-2xl bg-muted" />
              <div className="h-32 rounded-2xl bg-muted" />
              <div className="h-16 rounded-2xl bg-muted" />
            </div>
          </div>
        )}

        <div className={`grid lg:grid-cols-12 gap-4 lg:gap-6${isProductLoading ? ' hidden' : ''}`}>
          {/* Toolbar – horizontal on mobile, vertical sidebar on desktop */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="flex flex-row lg:flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm overflow-x-auto">
              <input
                id="designer-file-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="default"
                size="sm"
                className="flex-shrink-0 lg:w-full justify-start gap-2.5 h-11 rounded-xl font-medium px-4"
                onClick={() => document.getElementById('designer-file-upload')?.click()}
              >
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Hochladen</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-shrink-0 lg:w-full justify-start gap-2.5 h-11 rounded-xl font-medium px-4"
                onClick={() => setShowTextDialog(true)}
              >
                <Type className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Text</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 lg:w-full justify-start gap-2.5 h-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-4"
                onClick={handleClearAll}
              >
                <RotateCcw className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Zurücksetzen</span>
              </Button>
            </div>
          </motion.div>

          {/* Canvas Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-6"
          >

            <div
              ref={containerRef}
              className="relative bg-muted/30 rounded-2xl p-3 sm:p-6 flex items-center justify-center"
              style={{ minHeight: 'min(500px, 70vw)', maxHeight: '600px' }}
            >
              {/* Warning Message - shown inside creator area */}
              {outOfBoundsWarning && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-medium">{outOfBoundsWarning}</span>
                </div>
              )}
              
              {/* Product Background – maxWidth/size wie Admin, damit Zonen 1:1 passen */}
              <div 
                ref={designerCanvasWrapRef}
                className="relative w-full aspect-square flex-shrink-0 mx-auto"
                style={{
                  maxWidth: PLACEMENT_ZONE_CANVAS_SIZE,
                  backgroundImage: `url(${selectedShirt.image})`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundColor: 'transparent',
                }}
              >
                {/* Persistenter Tooltip-Host: Sichtbarkeit/Position wird direkt von Fabric-Events gesetzt */}
                <div
                  ref={scalingTooltipRef}
                  className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full flex flex-col items-center"
                  style={{
                    marginTop: "-6px",
                    opacity: 0,
                    visibility: "hidden",
                  }}
                  aria-live="polite"
                >
                  <div
                    className="relative rounded-md border border-gray-300 bg-white px-3 py-2 shadow-md"
                    style={{
                      filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.08))",
                    }}
                  >
                    <p
                      ref={scalingTooltipTextRef}
                      className="text-sm font-medium text-gray-900 whitespace-nowrap tabular-nums"
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                      style={{
                        borderLeft: "7px solid transparent",
                        borderRight: "7px solid transparent",
                        borderTop: "8px solid #d1d5db",
                      }}
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full -mt-px w-0 h-0"
                      style={{
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "7px solid white",
                      }}
                    />
                  </div>
                </div>
                {/* Fabric hängt eigenen Container ein – nur leerer Host, kein React-<canvas> (sonst insertBefore-Crash) */}
                <div
                  ref={fabricHostRef}
                  className="designer-fabric-host absolute inset-0 z-10"
                  style={{ touchAction: "none" }}
                  aria-hidden
                />
                </div>
              </div>

              {/* Ansichten – nur unter dem Canvas (Shirtfarbe ist im rechten Panel) */}
              {(selectedShirt || selectedColor || productImage || availableImageViews.length > 0 || variationGalleryOrdered.length > 0) && (
                <div className="mt-5 rounded-2xl border bg-card p-3 shadow-sm space-y-4">
                  {/* Ansichten: Reihenfolge der Variation = 1. Vorderseite, 2. Rückseite, 3. Links, 4. Rechts (nur angezeigte Bilder) */}
                  {(variationGalleryOrdered.length > 0 || availableImageViews.length > 0) && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ansichten</p>
                      <div className="flex flex-wrap gap-2">
                        {variationGalleryOrdered.length > 0
                          ? variationGalleryOrdered.map((imgSrc, i) => {
                              const view = VIEW_ORDER[Math.min(i, VIEW_ORDER.length - 1)];
                              const label = viewLabels[view];
                              const isActive = selectedShirt.image === imgSrc;
                              return (
                                <button
                                  key={`ordered-${i}-${imgSrc}`}
                                  type="button"
                                  onClick={() => loadView(view, 0, imgSrc)}
                                  className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 transition-all duration-200 shrink-0 ${
                                    isActive
                                      ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
                                      : "border-border hover:border-primary/40 hover:shadow-sm"
                                  }`}
                                  title={label}
                                >
                                  <img src={imgSrc} alt={label} className="w-full h-full object-cover" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-medium py-1 px-1 text-center truncate">
                                    {label}
                                  </div>
                                </button>
                              );
                            })
                          : availableImageViews.flatMap((view) => {
                              const viewImgs = viewImages[view] || [];
                              if (viewImgs.length === 0) return [];
                              return viewImgs.map((imgSrc, index) => {
                                const isActive =
                                  currentView === view && selectedVariationImageIndex === index;
                                return (
                                  <button
                                    key={`${view}-${index}-${imgSrc}`}
                                    type="button"
                                    onClick={() => loadView(view, index)}
                                    className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 transition-all duration-200 shrink-0 ${
                                      isActive
                                        ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
                                        : "border-border hover:border-primary/40 hover:shadow-sm"
                                    }`}
                                    title={viewLabels[view]}
                                  >
                                    <img
                                      src={imgSrc}
                                      alt={viewLabels[view]}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-medium py-1 px-1 text-center truncate">
                                      {viewLabels[view]}
                                    </div>
                                  </button>
                                );
                              });
                            })}
                      </div>
                    </div>
                  )}
                  {availableImageViews.length === 0 && availableColors.length > 0 && selectedColor && (
                    <p className="text-xs text-muted-foreground">Keine Bilder für diese Farbe.</p>
                  )}
                  {availableImageViews.length === 0 && availableColors.length > 0 && !selectedColor && (
                    <p className="text-xs text-muted-foreground">Farbe wählen.</p>
                  )}
                </div>
              )}

          </motion.div>

          {/* Right Sidebar – Shirtfarbe hier + Optionen & Größe/Menge */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4"
          >
            <div className="lg:pr-2">
              <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
                {product?.name && (
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold truncate">{product.name}</h2>
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setShowProductDetailsDialog(true)} title="Details">
                      <Info className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Schritte – dezent als Punkte, kein großer Titel */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className={`h-2 rounded-full transition-all ${
                      currentStep === 1 ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60'
                    }`}
                    title="Design"
                  />
                  <button
                    onClick={() => setCurrentStep(2)}
                    className={`h-2 rounded-full transition-all ${
                      currentStep === 2 ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60'
                    }`}
                    title="Größe & Menge"
                  />
                </div>

                {/* Shirtfarbe – rechts im Panel, aktuell gewählte Farbe namentlich */}
                {productId && availableColors.length > 0 && currentStep === 1 && (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shirtfarbe</p>
                      {selectedColor ? (
                        <span className="text-sm font-semibold text-foreground truncate" title={selectedColor}>
                          {selectedColor}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Bitte wählen</span>
                      )}
                    </div>
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-2">
                        {availableColors.map((color) => (
                          <Tooltip key={color.name}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedColor(color.name);
                                  setSelectedVariationImageIndex(0);
                                }}
                                className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center shrink-0 ${
                                  selectedColor === color.name
                                    ? "border-primary ring-2 ring-primary/20 scale-110"
                                    : "border-border hover:border-primary/50 hover:scale-105"
                                }`}
                                style={{ backgroundColor: color.hex || "#ccc" }}
                                aria-label={color.name}
                              >
                                {selectedColor === color.name && (
                                  <Check className="w-4 h-4 text-white drop-shadow-md" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>{color.name}</p></TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </div>
                )}

                {currentStep === 1 ? (
                  <>
                {/* Separator + Label: aktueller Editor-Kontext (Text / Bild / Element) */}
                {hasSelectedObject && selectedEditorType && (
                  <div className="space-y-3 pt-2">
                    <div className="border-t border-border" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {selectedEditorType === "text" && "Text bearbeiten"}
                        {selectedEditorType === "image" && "Bild bearbeiten"}
                        {selectedEditorType === "other" && "Element bearbeiten"}
                      </span>
                    </div>
                    {objectMmSize && (
                      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Größe (ca.)
                        </p>
                        <p className="font-semibold tabular-nums">
                          {objectMmSize.widthMm} × {objectMmSize.heightMm} mm
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Basierend auf Zonenmaß in mm. Beim Skalieren live aktualisiert.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Element: eine Zeile Icons (wie Referenz) */}
                {hasSelectedObject && (
                  <div className="flex flex-wrap gap-1.5">
                    <TooltipProvider>
                      <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={handleFlipHorizontal}><FlipHorizontal className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Horizontal spiegeln</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={handleFlipVertical}><FlipVertical className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Vertikal spiegeln</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={handleDuplicateSelected}><Copy className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Duplizieren</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDeleteSelected}><Trash2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Löschen</TooltipContent></Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {/* Text – kompakt wie Referenz: Eingabe, Farbe, Format, Schrift, Größe, Ebene */}
                    {hasSelectedObject && fabricCanvas?.getActiveObject()?.type === "text" && (
                      <div className="space-y-4">
                        <Input
                          value={(fabricCanvas.getActiveObject() as FabricText)?.text || ""}
                          onChange={(e) => {
                            const activeObject = fabricCanvas.getActiveObject();
                            if (activeObject && activeObject.type === "text") {
                              (activeObject as FabricText).set("text", e.target.value);
                              fabricCanvas.renderAll();
                            }
                          }}
                          placeholder="Text eingeben..."
                          className="rounded-xl"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          {presetColors.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => handleColorChange(color.value)}
                              className={`h-8 w-8 rounded-lg border-2 transition-all shrink-0 ${
                                textColor === color.value ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="h-8 w-8 rounded-lg border-2 border-border cursor-pointer shrink-0"
                            title="Eigene Farbe"
                          />
                          <div className="flex gap-1 ml-1">
                            <Button type="button" variant={textBold ? "secondary" : "outline"} size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleApplyFormatting("bold")} title="Fett"><Bold className="w-4 h-4" /></Button>
                            <Button type="button" variant={textItalic ? "secondary" : "outline"} size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleApplyFormatting("italic")} title="Kursiv"><Italic className="w-4 h-4" /></Button>
                            <Button type="button" variant={textStrikethrough ? "secondary" : "outline"} size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleApplyFormatting("strikethrough")} title="Durchgestrichen"><Strikethrough className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={selectedFont} onValueChange={handleFontChange}>
                            <SelectTrigger className="rounded-xl flex-1 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {fonts.map((font) => (
                                <SelectItem key={font.value} value={font.value}><span style={{ fontFamily: font.value }}>{font.name}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1 rounded-xl border px-2 h-9">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { const o = fabricCanvas.getActiveObject(); if (o?.type === "text") { const t = o as FabricText; t.set("fontSize", Math.max(8, (t.fontSize || 20) - 2)); fabricCanvas.renderAll(); } }}><Minus className="w-3.5 h-3.5" /></Button>
                            <span className="w-10 text-center text-sm font-medium tabular-nums">
                              {fabricCanvas.getActiveObject()?.type === "text" ? (fabricCanvas.getActiveObject() as FabricText).fontSize || 20 : 20}
                            </span>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { const o = fabricCanvas.getActiveObject(); if (o?.type === "text") { const t = o as FabricText; t.set("fontSize", Math.min(200, (t.fontSize || 20) + 2)); fabricCanvas.renderAll(); } }}><Plus className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg gap-1" onClick={() => { const o = fabricCanvas.getActiveObject(); if (o) { fabricCanvas.bringObjectToFront(o); fabricCanvas.renderAll(); } }} title="Nach vorne"><ArrowUp className="w-4 h-4" /> Vorne</Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg gap-1" onClick={() => { const o = fabricCanvas.getActiveObject(); if (o) { fabricCanvas.sendObjectToBack(o); fabricCanvas.renderAll(); } }} title="Nach hinten"><ArrowDown className="w-4 h-4" /> Hinten</Button>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Text biegen</p>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[textBend]}
                              onValueChange={([v]) => handleTextBendChange(v)}
                              min={-100}
                              max={100}
                              step={5}
                              className="flex-1"
                            />
                            <span className="w-10 text-center text-sm tabular-nums text-muted-foreground">{textBend}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {!productImage && !productId && (
                      <div className="flex flex-wrap gap-2">
                            {shirtColors.map((color) => (
                              <button
                                key={color.name}
                                onClick={() => setSelectedShirt(color)}
                                className={`w-12 h-12 rounded-full border-4 transition-all ${
                                  selectedShirt.name === color.name
                                    ? "border-primary scale-110"
                                    : "border-border hover:border-primary/50"
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                    )}

                    {/* Preis & CTA Step 1 – ein grüner Button wie im Referenz-UI */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Preis pro Stück</span>
                      <span className="text-xl font-bold text-primary">{pricePerItem.toFixed(2).replace('.', ',')} €</span>
                    </div>
                    {totalQuantity > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-sm text-muted-foreground">{totalQuantity} × {pricePerItem.toFixed(2).replace('.', ',')} €</span>
                        <span className="font-semibold text-primary">Gesamt: {totalPrice.toFixed(2).replace('.', ',')} €</span>
                      </div>
                    )}
                    <Button
                      size="lg"
                      className="w-full rounded-xl h-12 font-semibold text-base shadow-md hover:shadow-lg"
                      onClick={() => {
                        if (hasOutOfBoundsElements()) {
                          setOutOfBoundsWarning("Bitte positioniere alle Elemente vollständig innerhalb der Druckbereiche, bevor du fortfährst.");
                          toast.error("Es befinden sich noch Elemente außerhalb der Druckbereiche.");
                          return;
                        }
                        setCurrentStep(2);
                      }}
                    >
                      Größe & Anzahl wählen
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    {selectedColor && (
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shirtfarbe</span>
                        <span className="text-sm font-semibold">{selectedColor}</span>
                      </div>
                    )}

                    {/* Größentabelle */}
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Größenangaben</p>
                      <SizeChart wcProductMetaData={wcProduct?.meta_data} />
                    </div>

                    <div className="space-y-2">
                      {availableSizes.map((size) => {
                        const quantity = sizeQuantities[size] || 0;
                        return (
                          <div
                    key={size}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <span className="font-semibold text-base">{size}</span>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSizeQuantities((prev) => ({
                                    ...prev,
                                    [size]: Math.max(0, (prev[size] || 0) - 1),
                                  }));
                                }}
                                disabled={quantity === 0}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="w-12 text-center font-semibold">
                                {quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSizeQuantities((prev) => ({
                                    ...prev,
                                    [size]: (prev[size] || 0) + 1,
                                  }));
                                }}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-muted-foreground">Preis pro Stück</span>
                      <span className="text-lg font-semibold text-primary">{pricePerItem.toFixed(2).replace('.', ',')} €</span>
              </div>
                    {totalQuantity > 0 && (
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-muted-foreground">
                          {totalQuantity} × {pricePerItem.toFixed(2).replace('.', ',')} €
                        </span>
                        <span className="text-2xl font-bold text-primary">
                          Gesamt: {totalPrice.toFixed(2).replace('.', ',')} €
                        </span>
                      </div>
                    )}
                    {totalQuantity === 0 && (
                      <p className="text-xs text-muted-foreground mb-3">
                        Bitte wähle mindestens eine Größe mit Menge
                      </p>
                    )}
              <div className="space-y-3">
                      {hasAnyDesign && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border bg-background/50">
                          <Checkbox
                            id="important-points"
                            checked={importantPointsAccepted}
                            onCheckedChange={(checked) => setImportantPointsAccepted(checked === true)}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor="important-points"
                            className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                          >
                            <span>Ich habe die folgenden, wichtigen Punkte beachtet</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowImportantPointsDialog(true);
                              }}
                              className="text-primary hover:text-primary/80 transition-colors"
                              title="Informationen anzeigen"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </label>
                        </div>
                      )}
                      <Button 
                        size="default" 
                        className="w-full" 
                        onClick={(e) => {
                          console.log('Button clicked!', {
                            hasAnyDesign,
                            importantPointsAccepted,
                            disabled: hasAnyDesign && !importantPointsAccepted,
                            totalQuantity: Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0),
                            sizeQuantities
                          });
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddToCart();
                        }}
                        type="button"
                        disabled={hasAnyDesign && !importantPointsAccepted}
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                  In den Warenkorb
                </Button>
                      {hasAnyDesign && (
                  <Button
                    variant="outline"
                          size="default"
                    className="w-full"
                    onClick={handleDownload}
                  >
                          <Download className="w-4 h-4 mr-2" />
                    Design herunterladen
                  </Button>
                )}
                    </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Zurück
                    </Button>
                  </div>
                )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

      {/* Product Details Dialog – kompakt, nur vorhandene Produktdaten */}
      <Dialog open={showProductDetailsDialog} onOpenChange={setShowProductDetailsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 shrink-0 text-left">
            <DialogTitle className="text-xl pr-8">
              {product?.name || "Produktdetails"}
            </DialogTitle>
            {/* Kein generischer Fließtext – Beschreibung folgt im Body */}
            <DialogDescription className="sr-only">
              Produktdetails und Beschreibung für {product?.name || "dieses Produkt"}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {product?.category && (
                <span className="text-xs font-medium rounded-full bg-background border px-2.5 py-0.5 text-muted-foreground">
                  {product.category}
                </span>
              )}
              {(basePrice > 0 || product?.priceFormatted) && (
                <span className="text-lg font-bold text-primary tabular-nums">
                  {basePrice > 0
                    ? `${basePrice.toFixed(2).replace(".", ",")} €`
                    : product?.priceFormatted}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {product?.description ? (
              <div className="rounded-xl border bg-card p-4">
                <div
                  className="text-sm text-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:font-semibold"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Für dieses Produkt liegt keine ausführliche Beschreibung vor.
              </p>
            )}

            {product?.features && product.features.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 text-foreground">Merkmale</h3>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                  {product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {product?.tags && product.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Größentabelle */}
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4 text-foreground">Größenangaben</h3>
              <SizeChart wcProductMetaData={wcProduct?.meta_data} />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 sm:justify-end">
            <Button variant="default" onClick={() => setShowProductDetailsDialog(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Options Dialog */}
      <Dialog open={showTextDialog} onOpenChange={setShowTextDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Text hinzufügen</DialogTitle>
            <DialogDescription>
              Erstelle einen Text und passe ihn nach deinen Wünschen an
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Text Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Text</label>
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Dein Text..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddText();
                    setShowTextDialog(false);
                  }
                }}
                autoFocus
              />
            </div>

            {/* Font Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Schriftart</label>
              <Select value={selectedFont} onValueChange={handleFontChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fonts.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Text Color */}
            <div>
              <label className="text-sm font-medium mb-2 block">Textfarbe</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 flex gap-1 flex-wrap">
                  {presetColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => handleColorChange(color.value)}
                      className={`w-8 h-8 rounded-md border-2 transition-all ${
                        textColor === color.value
                          ? "border-primary scale-110"
                          : "border-border hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-10 h-10 rounded-md border-2 border-border cursor-pointer"
                  title="Benutzerdefinierte Farbe"
                />
              </div>
            </div>

            {/* Formatting Buttons */}
            <div>
              <label className="text-sm font-medium mb-2 block">Formatierung</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={textBold ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => handleApplyFormatting("bold")}
                  title="Fett"
                >
                  <Bold className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant={textItalic ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => handleApplyFormatting("italic")}
                  title="Kursiv"
                >
                  <Italic className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant={textStrikethrough ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => handleApplyFormatting("strikethrough")}
                  title="Durchgestrichen"
                >
                  <Strikethrough className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTextDialog(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                handleAddText();
                setShowTextDialog(false);
              }}
              disabled={!textInput.trim()}
            >
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copyright Notice Dialog */}
      <Dialog 
        open={showCopyrightDialog} 
        onOpenChange={(open) => {
          setShowCopyrightDialog(open);
          if (!open) {
            // Reset when dialog is closed without accepting
            setPendingImageFile(null);
            if (!copyrightAccepted) {
              // Only reset acceptance if they haven't accepted yet
              // (keep it true if they accepted in this session)
            }
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bild hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <h3 className="font-semibold text-lg mb-3">Hinweis zu Rechten Dritter</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Um ein Motiv (Foto, Logo, Markenzeichen, Spruch etc.) verwenden zu dürfen, müssen die vollen Rechte an diesem Motiv vorliegen. Mit dem Speichern des Motivs auf unserem Server wird folgendes bestätigt.
              </p>
              <ul className="space-y-2 text-sm mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Ich habe das Recht, das Motiv für kommerzielle Zwecke zu verwenden.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Im Falle einer Rechtsverletzung (unerlaubte Verwendung eines durch Dritte geschützten Motivs) wird der Rechteinhaber mit sämtlichen Forderungen an mich verwiesen.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Mir ist bekannt, dass die unrechtmäßige Verwendung von durch Dritte geschützten Motiven kein Kavaliersdelikt ist und mit hohen Geldstrafen geahndet werden kann.</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <label htmlFor="copyright-accept" className="text-sm font-medium cursor-pointer">
                Copyright Hinweis akzeptieren
              </label>
              <Switch
                id="copyright-accept"
                checked={copyrightAccepted}
                onCheckedChange={setCopyrightAccepted}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Hiermit bestätige ich die obigen Bedingungen gelesen zu haben und im vollen Umfang damit einverstanden zu sein.
              </p>
            </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCopyrightDialog(false);
                setPendingImageFile(null);
                setCopyrightAccepted(false);
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCopyrightAccept}
              disabled={!copyrightAccepted}
            >
              Fortfahren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Important Points Info Dialog */}
      <Dialog open={showImportantPointsDialog} onOpenChange={setShowImportantPointsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wichtige Punkte zur Beachtung</DialogTitle>
            <DialogDescription>
              Bitte überprüfe sorgfältig die von Dir gestalteten Artikel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Konfektionsgrößen:</h3>
              <p className="text-muted-foreground">
                Diese sind leider nicht immer verbindlich. Unter jedem Artikel findest Du in der Artikelbeschreibung eine Maßtabelle zu den Konfektionsgrößen. Bitte prüfe, ob die Größen korrekt gewählt sind. Abweichungen von bis zu +/- 5% liegen in der Toleranz.
              </p>
        </div>

            <div>
              <h3 className="font-semibold mb-2">Artikelfarben:</h3>
              <p className="text-muted-foreground">
                Bitte beachte, dass es bei unterschiedlichen Herstellern zu Farbabweichungen kommen kann, obwohl die Textilfarbe die gleiche Bezeichnung hat. Beispiel: Hersteller B&C Farbe Fire Red ist ein anderes Fire Red als beim Hersteller Promodoro. Es kann auch vorkommen, das gleiche Farbangaben sich in der Artikelfarbe unterscheiden können. Beispiel: Farbe Fire Red innerhalb eines Artikels zwischen den unterschiedlichen Größen, oder auch zwischen den Modellen Männer, Frauen und Kinder. Darauf haben wir Hersteller bedingt keinen Einfluß.
              </p>
      </div>

            <div>
              <h3 className="font-semibold mb-2">Rechtschreibung:</h3>
              <p className="text-muted-foreground">
                Die Druckdaten werden automatisch aus Deinem Design generiert und nicht manuell nachgesetzt bzw. korrigiert. Bitte achte daher auf die richtige Rechtschreibung.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Druckfarben:</h3>
              <p className="text-muted-foreground">
                Bitte beachte, dass dunkle Druckfarben auf dunklen Produkten oder auch helle Druckfarben auf hellen Produkten in Realität schwer erkennbar sind. Daher solltest Du eine andere Farbe mit mehr Kontrast wählen, damit diese auch gut erkennbar ist. Wir können keine Farbverbindlichkeit der hochgeladenen Druckmotive garantieren. Bildschirmdarstellungen können abweichen.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Motivhintergrund:</h3>
              <p className="text-muted-foreground">
                Bei eigenen Motiven wird der Hintergrund mit gedruckt, falls dieser auf dem Vorschaubild vorhanden ist, und nicht unser kostenloser Service "Hintergrund entfernen" (Unter Vorbehalt der technischen Möglichkeiten, da nicht bei allen Motiven der Hintergrund immer entfernt werden kann) ausgewählt worden ist.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Gestaltung: Positionierung & Anordnung</h3>
              <p className="text-muted-foreground">
                Bitte beachte, dass wenn ein Textildruck über Nähte gestaltet wird, z. B. auf der Rückseite von Jogginghosen oder Unterhosen oder über Nähte im Allgemeinen, kann dieser mit der Zeit brechen, da die Nähte beim An- oder Ausziehen gedehnt werden. Dies gilt auch bei anderen Artikeln wie z. B. bei Caps.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Motiv- und Textgrößen:</h3>
              <p className="text-muted-foreground">
                Die Ansichten im Internet können vom Endergebnis abweichen. Bitte beachte, dass die Proportionen je nach Größe und Schnitt des Textils unterschiedlich sein können. Wir geben die Größen der einzelnen Motive und / oder Texte im Konfigurator in Zentimeter (cm) an. Bitte überprüfe sorgfältig, bevor die Bestellung aufgegeben wird, ob die Duckgrößen der einzelnen Motive und / oder Texte auch richtig gewählt wurden, um eine Reklamation vorzubeugen. Beachte bitte auch, dass große/vollflächige Motive die Tragfähigkeit einschränken.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Druckarten:</h3>
              <p className="text-muted-foreground">
                Die Druckarten werden pro Motiv/Text im Kundenkonto Deiner Bestellung angezeigt.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Hinweis zum Digital-Direktdruck:</h3>
              <p className="text-muted-foreground">
                Wenn die erhaltenen Artikel einen Rand bzw. eine Verfärbung um das Motiv aufweisen, handelt es sich dabei um eine Flüssigkeit für die Vorbehandlung des Textils. Diese Vorbehandlung wird benötigt, um ein optimales Druckergebnis zu erzielen und verschwindet nach dem ersten Waschen. Die verwendete Fixierflüssigkeit ist unbedenklich und nach OEKO-TEX Standard 100 zertifiziert.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Hinweis zum Digital-Transferdruck:</h3>
              <p className="text-muted-foreground">
                Bitte beachte, dass wir Dir vor der Produktion eventuell eine Druckfreigabe Deiner Designs per E-Mail (Ticket) zu kommen lassen. Durch die Qualität der hoch geladenen Designs kann es nämlich dazu kommen, dass eine Outline um das Design erfolgen muss, um dies hochwertig umsetzen zu können. Outlines werden in Schwarz, Weiß oder in den Textilfarben (ähnlich) umgesetzt. Wenn die zugeschickte Druckfreigabe Deinen Vorstellungen entspricht, bitte mit "Freigabe erteilt" bestätigen und somit einen Produktionsstart für Deine Bestellung erteilen.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Copyright-Hinweise:</h3>
              <p className="text-muted-foreground">
                Hochgeladene Designs dürfen nicht gegen bestehende Rechte Dritter oder gesetzliche Bestimmungen verstoßen. Dazu zählen Urheber-, Persönlichkeits- und Markenrechte, aber auch radikale, diffamierende oder verfassungsrechtlich bedenkliche Motive, Logos oder Texte.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Bestellung ändern oder stornieren:</h3>
              <p className="text-muted-foreground">
                Änderungen in bestehenden Bestellungen sind nicht möglich. Wenn etwas in einer Bestellung geändert werden soll, bitte diese stornieren und neu aufgeben. Eine Stornierung ist nur möglich, solange die Bestellung von uns noch nicht per E-Mail, samt Versanddatum, bestätigt wurde.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">So kannst Du eine Reklamation vorbeugen:</h3>
              <p className="text-muted-foreground">
                Teste unsere Artikel bei größeren Bestellungen immer vorher: Eine Testbestellung kann viele Fehlerquellen beheben. Dadurch siehst Du genau, wie Dein bestellter Artikel tatsächlich aussieht. Vielleicht bist Du Dir ja noch unsicher bezüglich Größe, Farbe, Schnitt oder Druckverfahren. Gerade bei geplanten Großbestellungen macht eine Testbestellung natürlich Sinn, denn dadurch kannst Du sofort erkennen, ob das Produkt Deinen Vorstellungen entspricht und in großem Umfang produziert werden kann.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Hinweis zu eventuellen Druckplatten Abdrücken:</h3>
              <p className="text-muted-foreground">
                Bitte beachte, dass beim Übertragen von Transfers (Flexdruck, Flockdruck, Spezial-Flexdruck, Digital-Transferdruck oder auch beim Sublimationsdruck) auf Textilien aus Polyester und Baumwoll/Polyestermischungen es zu dauerhaften Abdrücken auf der Ware kommen kann.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowImportantPointsDialog(false)}>
              Verstanden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
};

export default TShirtDesigner;
