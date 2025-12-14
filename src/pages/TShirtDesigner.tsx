import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas as FabricCanvas, FabricImage, FabricText, Rect } from "fabric";
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
  ZoomIn,
  ZoomOut,
  Move,
  FlipHorizontal,
  FlipVertical,
  Shirt,
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import tshirtWhite from "@/assets/tshirt-mockup-white.png";
import tshirtBlack from "@/assets/tshirt-mockup-black.png";
import { Check } from "lucide-react";

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
  const { data: product } = useProduct(productId ? Number(productId) : 0);
  const { data: wcProduct } = useWooCommerceProduct(productId ? Number(productId) : 0);
  const { data: variations = [] } = useProductVariations(productId ? Number(productId) : 0);
  const placementZones = product?.placementZones;
  
  // State for selected variation
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVariationImageIndex, setSelectedVariationImageIndex] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [basePrice, setBasePrice] = useState(0);
  const [hasSelectedObject, setHasSelectedObject] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [selectedFont, setSelectedFont] = useState("Outfit");
  const [textBold, setTextBold] = useState(false);
  const [outOfBoundsWarning, setOutOfBoundsWarning] = useState<string | null>(null);
  const [textItalic, setTextItalic] = useState(false);
  const [textStrikethrough, setTextStrikethrough] = useState(false);
  const [textColor, setTextColor] = useState(
    selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF"
  );
  const [currentView, setCurrentView] = useState<ViewType>("front");
  // Store canvas JSON data for each view
  const [viewData, setViewData] = useState<Record<ViewType, string | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  });
  const addItem = useCartStore((state) => state.addItem);

  // Save current view data before switching
  const saveCurrentView = useCallback(() => {
    if (!fabricCanvas) return;
    try {
      const json = JSON.stringify(fabricCanvas.toJSON());
      setViewData(prev => ({
        ...prev,
        [currentView]: json,
      }));
    } catch (error) {
      console.error('Error saving view data:', error);
    }
  }, [fabricCanvas, currentView]);

  // Load view function will be defined after viewImages

  // Render placement zones as visual guides (non-interactive, always in background)
  useEffect(() => {
    if (!fabricCanvas || !placementZones) return;

    const currentZones = placementZones[currentView];
    if (!currentZones || currentZones.length === 0) return;

    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Clear existing zone objects
    const existingZones = fabricCanvas.getObjects().filter(
      (obj: any) => obj.name?.startsWith("placement-zone-")
    );
    existingZones.forEach((obj) => fabricCanvas.remove(obj));

    // Add zones as background visual guides
    currentZones.forEach((zone, index) => {
      const rect = new Rect({
        left: zone.x * canvasWidth,
        top: zone.y * canvasHeight,
        width: zone.width * canvasWidth,
        height: zone.height * canvasHeight,
        fill: "rgba(59, 130, 246, 0.15)",
        stroke: "rgba(59, 130, 246, 0.6)",
        strokeWidth: 2,
        strokeDashArray: [8, 4],
        selectable: false,
        evented: false, // Not interactive - won't interfere with design elements
        hoverCursor: "default",
        name: `placement-zone-${currentView}-${index}`,
        excludeFromExport: true, // Don't export zones in final design
      });

      // Add label
      const label = new FabricText(zone.name, {
        left: zone.x * canvasWidth + 5,
        top: zone.y * canvasHeight + 5,
        fontSize: 12,
        fill: "rgba(59, 130, 246, 0.9)",
        fontFamily: "Outfit",
        fontWeight: "bold",
        selectable: false,
        evented: false,
        hoverCursor: "default",
        name: `placement-zone-label-${currentView}-${index}`,
        excludeFromExport: true,
      });

      fabricCanvas.add(rect);
      fabricCanvas.add(label);
      
      // Always send zones to back so they don't cover design elements
      fabricCanvas.sendObjectToBack(rect);
      fabricCanvas.sendObjectToBack(label);
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, placementZones, currentView]);

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

  // Initialize canvas with larger size for more space
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    // Increase canvas size for more working space
    const canvasSize = Math.min(containerWidth, 800);

    const canvas = new FabricCanvas(canvasRef.current, {
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
    let updateTimeout: NodeJS.Timeout | null = null;
    const updateViewData = () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      updateTimeout = setTimeout(() => {
      try {
        const json = JSON.stringify(canvas.toJSON());
        setViewData(prev => ({
          ...prev,
          [currentView]: json,
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

    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      canvas.dispose();
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
    };

    fabricCanvas.on("object:moving", handleObjectMoving);
    fabricCanvas.on("object:modified", handleObjectModified);

    return () => {
      fabricCanvas.off("object:moving", handleObjectMoving);
      fabricCanvas.off("object:modified", handleObjectModified);
    };
  }, [fabricCanvas, placementZones, currentView, constrainToZones]);

  // Load view data when currentView changes
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Save previous view
    const prevView = Object.keys(viewData).find(v => v !== currentView) as ViewType;
    if (prevView) {
      try {
        const json = JSON.stringify(fabricCanvas.toJSON());
        setViewData(prev => ({
          ...prev,
          [prevView]: json,
        }));
      } catch (error) {
        console.error('Error saving previous view:', error);
      }
    }
    
    // Load new view
    // Check if canvas is properly initialized before clearing
    // Only clear if we're actually switching views, not on initial load
    const viewJson = viewData[currentView];
    if (viewJson) {
      // Only clear if we have data to load (switching views)
      if (fabricCanvas.getContext && fabricCanvas.getWidth && fabricCanvas.getHeight) {
        try {
          console.log('Loading view data, clearing canvas');
          fabricCanvas.clear();
          fabricCanvas.backgroundColor = "transparent";
        } catch (error) {
          console.warn('Error clearing canvas:', error);
        }
      }
    
      try {
        fabricCanvas.loadFromJSON(viewJson, () => {
          // Re-render placement zones after loading view data
          if (placementZones && placementZones[currentView]) {
            const currentZones = placementZones[currentView];
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            
            currentZones.forEach((zone, index) => {
              const rect = new Rect({
                left: zone.x * canvasWidth,
                top: zone.y * canvasHeight,
                width: zone.width * canvasWidth,
                height: zone.height * canvasHeight,
                fill: "rgba(59, 130, 246, 0.15)",
                stroke: "rgba(59, 130, 246, 0.6)",
                strokeWidth: 2,
                strokeDashArray: [8, 4],
                selectable: false,
                evented: false,
                hoverCursor: "default",
                name: `placement-zone-${currentView}-${index}`,
                excludeFromExport: true,
              });

              const label = new FabricText(zone.name, {
                left: zone.x * canvasWidth + 5,
                top: zone.y * canvasHeight + 5,
                fontSize: 12,
                fill: "rgba(59, 130, 246, 0.9)",
                fontFamily: "Outfit",
                fontWeight: "bold",
                selectable: false,
                evented: false,
                hoverCursor: "default",
                name: `placement-zone-label-${currentView}-${index}`,
                excludeFromExport: true,
              });

              fabricCanvas.add(rect);
              fabricCanvas.add(label);
              fabricCanvas.sendObjectToBack(rect);
              fabricCanvas.sendObjectToBack(label);
            });
          }
          fabricCanvas.renderAll();
        });
      } catch (error) {
        console.error('Error loading view data:', error);
      }
    }
  }, [currentView, fabricCanvas, placementZones]); // Added placementZones to ensure zones are re-rendered

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

  // Get images for selected variation (based on color and size)
  // Organize SVI images by view type (F=front, B=back, SL=left, SR=right)
  const viewImages = useMemo(() => {
    const views: Record<ViewType, string[]> = {
      front: [],
      back: [],
      left: [],
      right: [],
    };

    if (selectedColor && wcProduct) {
      const sviMeta = wcProduct.meta_data?.find((meta: any) => meta.key === 'woosvi_slug');
      
      if (sviMeta && sviMeta.value && Array.isArray(sviMeta.value)) {
        // Find the entry that matches the selected color (case-insensitive, handles multi-word)
        const normalizeString = (str: string): string => {
          return str
            .toLowerCase()
            .trim()
            .replace(/[()]/g, '') // Remove parentheses
            .replace(/[-\s]+/g, ' ') // Normalize dashes and multiple spaces to single space
            .trim();
        };
        
        const matchingSviEntry = sviMeta.value.find((entry: any) => {
          if (!entry.slugs || !Array.isArray(entry.slugs)) return false;
          return entry.slugs.some((slug: string) => {
            const slugStr = normalizeString(String(slug));
            const colorStr = normalizeString(String(selectedColor));
            // Try exact match first
            let matches = slugStr === colorStr;
            // If no exact match, try partial match
            if (!matches) {
              matches = slugStr.includes(colorStr) || colorStr.includes(slugStr);
            }
            return matches;
          });
        });
        
        if (matchingSviEntry && matchingSviEntry.imgs && Array.isArray(matchingSviEntry.imgs)) {
          // Get image IDs from SVI data
          const imageIds = matchingSviEntry.imgs.map((id: any) => String(id));
          
          // Find images in product.images array that match these IDs
          const matchingImages = wcProduct.images?.filter(img => 
            imageIds.includes(String(img.id))
          ) || [];
          
          // Organize images by view type based on filename
          matchingImages.forEach(img => {
            const name = img.name || img.src || '';
            // Check filename for view indicators: _F (front), _B (back), _SL (left), _SR (right)
            if (name.includes('_F') || name.includes('-F')) {
              views.front.push(img.src);
            } else if (name.includes('_B') || name.includes('-B')) {
              views.back.push(img.src);
            } else if (name.includes('_SL') || name.includes('-SL')) {
              views.left.push(img.src);
            } else if (name.includes('_SR') || name.includes('-SR')) {
              views.right.push(img.src);
            } else {
              // Default to front if no indicator found
              views.front.push(img.src);
            }
          });
        }
      }
    }

    return views;
  }, [selectedColor, wcProduct]);

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
        setSelectedShirt({ 
          name: selectedColor || "Produkt", 
          value: "#FFFFFF", 
          image: imageToUse 
        });
        return;
      }
    }
    
    // Fallback: If color is selected, find the exact matching variation and use its image
    if (selectedColor && variations && variations.length > 0) {
      const matchingVariation = variations.find(variation => {
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
            setSelectedShirt({ 
              name: selectedColor, 
              value: "#FFFFFF", 
              image: sviImage 
            });
            return;
          }
        }
        
        // Prioritize the variation's main image.src (from the JSON structure)
        // This is the image property directly on the variation object
        const variationImage = matchingVariation.image?.src;
        if (variationImage) {
          setSelectedShirt({ 
            name: selectedColor, 
            value: "#FFFFFF", 
            image: variationImage 
          });
          return;
        }
        // Fallback to gallery images if main image is not available
        const galleryImage = matchingVariation.images?.[selectedVariationImageIndex]?.src || matchingVariation.images?.[0]?.src;
        if (galleryImage) {
          setSelectedShirt({ 
            name: selectedColor, 
            value: "#FFFFFF", 
            image: galleryImage 
          });
          return;
        }
      }
    }
    
    // Fallback to product image only if no color is selected
    if (!selectedColor) {
      if (productImage) {
        setSelectedShirt({ name: "Produkt", value: "#FFFFFF", image: productImage });
      } else if (product?.image) {
        setSelectedShirt({ name: "Produkt", value: "#FFFFFF", image: product.image });
      }
    }
  }, [viewImages, currentView, selectedVariationImageIndex, selectedColor, productImage, product, variations]);

  // Load view function - defined after viewImages
  const loadView = useCallback((view: ViewType) => {
    if (!fabricCanvas) return;
    
    // Save current view before switching
    saveCurrentView();
    
    // Clear canvas - check if properly initialized
    if (fabricCanvas.getContext && fabricCanvas.getWidth && fabricCanvas.getHeight) {
      try {
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "transparent";
      } catch (error) {
        console.warn('Error clearing canvas:', error);
      }
    }
    
    // Load view data if it exists
    const viewJson = viewData[view];
    if (viewJson) {
      try {
        fabricCanvas.loadFromJSON(viewJson, () => {
          fabricCanvas.renderAll();
        });
      } catch (error) {
        console.error('Error loading view data:', error);
      }
    }
    
    setCurrentView(view);
    
    // Update background image for the new view
    const currentViewImages = viewImages[view];
    if (currentViewImages && currentViewImages.length > 0) {
      const imageToUse = currentViewImages[selectedVariationImageIndex] || currentViewImages[0];
      if (imageToUse) {
        setSelectedShirt(prev => ({ 
          ...prev, 
          image: imageToUse 
        }));
      }
    }
  }, [fabricCanvas, viewData, saveCurrentView, viewImages, selectedVariationImageIndex]);

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
      setBasePrice(product.price);
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
      setSelectedShirt({ name: "Produkt", value: "#FFFFFF", image: productImage });
    }
  }, [productImage, selectedColor]);

  // Update text color when shirt color changes (only if no text is selected)
  useEffect(() => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    // Only update default color if no text is selected
    if (!activeObject || activeObject.type !== "text") {
      const defaultColor = selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF";
      setTextColor(defaultColor);
    }
  }, [selectedShirt.value, fabricCanvas]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!fabricCanvas || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      // Increase canvas size for more working space
      const canvasSize = Math.min(containerWidth, 800);
      fabricCanvas.setDimensions({ width: canvasSize, height: canvasSize });
      fabricCanvas.renderAll();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fabricCanvas]);


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
      } else {
        // Reset to defaults when no text is selected
        setTextBold(false);
        setTextItalic(false);
        setTextStrikethrough(false);
        setTextColor(selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF");
      }
    };

    const handleSelectionChange = () => {
      const activeObject = fabricCanvas.getActiveObject();
      setHasSelectedObject(!!activeObject);
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
  }, [fabricCanvas]);

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
      const allObjects = fabricCanvas.getObjects();
      allObjects.splice(newIndex, 0, obj);
      fabricCanvas.clear();
      allObjects.forEach(o => fabricCanvas.add(o));
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
      const allObjects = fabricCanvas.getObjects();
      allObjects.splice(newIndex, 0, obj);
      fabricCanvas.clear();
      allObjects.forEach(o => fabricCanvas.add(o));
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

  // Clear all
  const handleClearAll = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
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

  // Scale up
  const handleScaleUp = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.scale((activeObject.scaleX || 1) * 1.1);
      fabricCanvas.renderAll();
    }
  };

  // Scale down
  const handleScaleDown = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.scale((activeObject.scaleX || 1) * 0.9);
      fabricCanvas.renderAll();
    }
  };

  // Download design - export each customized side separately
  const handleDownload = async () => {
    if (!fabricCanvas) return;

    // Save current view before processing
    saveCurrentView();

    // Export each view that has design elements
    const views: ViewType[] = ["front", "back", "left", "right"];
    let exportedCount = 0;

    for (const view of views) {
      const viewJson = viewData[view];
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
            // Draw shirt image at full size (800x800) - same as handleAddToCart
            ctx.drawImage(shirtImg, 0, 0, 800, 800);

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

    // Save current view before processing
    if (fabricCanvas) {
      try {
        const json = JSON.stringify(fabricCanvas.toJSON());
        setViewData(prev => ({
          ...prev,
          [currentView]: json,
        }));
      } catch (error) {
        console.error('Error saving current view:', error);
      }
    }

    // Use the memoized hasAnyDesign value
    console.log('hasAnyDesign:', hasAnyDesign);
    
    // Get all views data for processing
    const allViewsData = Object.values(viewData).filter(v => v !== null);
    
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
      // Count design elements across all views
      allViewsData.forEach(viewJson => {
        if (viewJson) {
          try {
            const viewData = JSON.parse(viewJson);
            if (viewData.objects && Array.isArray(viewData.objects)) {
              totalDesignElementCount += viewData.objects.length;
            }
          } catch (error) {
            console.error('Error parsing view data:', error);
          }
        }
      });

      // Save all views data as JSON
      rawDesignData = JSON.stringify({
        views: viewData,
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
          const viewJson = viewData[view];
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
              productId: 999,
              name: "Custom T-Shirt",
              price: 24.95,
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
              productId: 999,
              name: "Custom T-Shirt",
              price: 24.95,
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h1 className="text-3xl lg:text-5xl font-bold text-primary">
                <span className="text-secondary">Creator</span>
              </h1>
              {product && (
                <h2 className="text-xl lg:text-2xl font-semibold text-muted-foreground">
                  {product.name}
                </h2>
              )}
            </div>
            <p className="text-muted-foreground">
              Lade dein eigenes Design hoch und platziere es auf deinem Produkt
            </p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Action Buttons */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="space-y-4">
              {/* Upload Image Button */}
              <label className="block">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full flex flex-row items-center justify-center gap-3 h-auto py-4 px-4 hover:bg-primary/90 transition-all shadow-md hover:shadow-lg rounded-lg whitespace-nowrap"
                  asChild
                >
                  <span className="cursor-pointer flex items-center gap-3">
                    <Upload className="w-5 h-5 flex-shrink-0" />
                    <span className="text-base font-medium">Hochladen</span>
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {/* Add Text Button */}
              <Button
                variant="default"
                size="lg"
                className="w-full flex flex-row items-center justify-center gap-3 h-auto py-4 px-4 hover:bg-primary/90 transition-all shadow-md hover:shadow-lg rounded-lg whitespace-nowrap"
                onClick={() => setShowTextDialog(true)}
              >
                <Type className="w-5 h-5 flex-shrink-0" />
                <span className="text-base font-medium">Text</span>
              </Button>

              {/* Reset Button */}
              <Button
                variant="outline"
                size="lg"
                className="w-full flex flex-row items-center justify-center gap-3 h-auto py-4 px-4 hover:bg-destructive hover:text-destructive-foreground transition-all rounded-lg whitespace-nowrap"
                onClick={handleClearAll}
              >
                <RotateCcw className="w-5 h-5 flex-shrink-0" />
                <span className="text-base font-medium">Zurücksetzen</span>
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
              className="relative bg-muted/30 rounded-2xl p-4 sm:p-6 flex items-center justify-center"
              style={{ minHeight: '500px', maxHeight: '600px' }}
            >
              {/* Warning Message - shown inside creator area */}
              {outOfBoundsWarning && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-medium">{outOfBoundsWarning}</span>
                </div>
              )}
              
              {/* Product Background - CSS background, not canvas element */}
              <div 
                className="relative w-full max-w-[800px] aspect-square flex-shrink-0"
                style={{
                  backgroundImage: `url(${selectedShirt.image})`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundColor: 'transparent',
                }}
              >
                {/* Canvas overlay - transparent canvas for placing elements */}
                  <canvas
                    ref={canvasRef}
                  className="absolute inset-0 cursor-move"
                  style={{ 
                    touchAction: "none",
                    backgroundColor: "transparent",
                    width: '100%',
                    height: '100%',
                  }}
                  />
                </div>
              </div>

              {/* View Thumbnail Gallery - Show all variation views */}
              {selectedColor && (viewImages.front.length > 0 || viewImages.back.length > 0 || viewImages.left.length > 0 || viewImages.right.length > 0) && (
                <div className="mt-6 glass-card p-4">
                  <h3 className="font-semibold text-sm mb-4">Ansichten</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {(['front', 'back', 'left', 'right'] as ViewType[]).map((view) => {
                      const viewImgs = viewImages[view];
                      const firstImg = viewImgs[0];
                      const isActive = currentView === view;
                      
                      return (
                        <button
                          key={view}
                          onClick={() => loadView(view)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isActive 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          title={viewLabels[view]}
                        >
                          {firstImg ? (
                            <img 
                              src={firstImg} 
                              alt={viewLabels[view]}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Shirt className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 px-2 text-center">
                            {viewLabels[view]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Step 1: Design Tools */}
            {currentStep === 1 && (
              <>
                {/* Quick Tools - Only show when object is selected */}
                {hasSelectedObject && (
                  <div className="glass-card p-4 mt-4">
                    <h3 className="font-bold mb-3 text-sm">Element bearbeiten</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleScaleUp}
                        title="Objekt vergrößern"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleScaleDown}
                        title="Objekt verkleinern"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFlipHorizontal}
                        title="Horizontal spiegeln"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFlipVertical}
                        title="Vertikal spiegeln"
                      >
                        <FlipVertical className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSelected}
                        title="Element löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

          </motion.div>

          {/* Right Sidebar - Product Info & Options */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4"
          >
            <div className="space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
              {/* Step Visualization - Clickable */}
              <div className="p-5">
                <div className="flex items-center justify-center">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className={`flex items-center gap-2 transition-all ${
                      currentStep === 1 
                        ? 'text-primary cursor-default' 
                        : 'text-muted-foreground hover:text-primary cursor-pointer'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      currentStep === 1 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}>
                      1
                    </div>
                    <span className="font-semibold text-sm">Design</span>
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <button
                    onClick={() => setCurrentStep(2)}
                    className={`flex items-center gap-2 transition-all ${
                      currentStep === 2 
                        ? 'text-primary cursor-default' 
                        : 'text-muted-foreground hover:text-primary cursor-pointer'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      currentStep === 2 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}>
                      2
                    </div>
                    <span className="font-semibold text-sm">Größe & Menge</span>
                  </button>
                </div>
              </div>

              {/* Step 1 Content */}
              {currentStep === 1 ? (
                <>
                  {/* Text Toolbox - Show when text is selected */}
                  {hasSelectedObject && fabricCanvas?.getActiveObject()?.type === "text" && (
                    <div className="glass-card p-6 space-y-6">
                      <h3 className="font-bold text-sm mb-5">Text bearbeiten</h3>
                      
                      {/* Text Input */}
                      <div>
                        <label className="text-sm font-medium mb-3 block">Text</label>
                        <Input
                          value={(fabricCanvas.getActiveObject() as FabricText)?.text || ""}
                          onChange={(e) => {
                            const activeObject = fabricCanvas.getActiveObject();
                            if (activeObject && activeObject.type === "text") {
                              const text = activeObject as FabricText;
                              text.set("text", e.target.value);
                              fabricCanvas.renderAll();
                            }
                          }}
                          placeholder="Dein Text..."
                        />
                      </div>

                      {/* Font Selection */}
                      <div>
                        <label className="text-sm font-medium mb-3 block">Schriftart</label>
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
                        <label className="text-sm font-medium mb-3 block">Textfarbe</label>
                        <div className="flex gap-3 items-center">
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
                        <label className="text-sm font-medium mb-3 block">Formatierung</label>
                        <div className="flex gap-3">
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

                      {/* Font Size */}
                      <div>
                        <label className="text-sm font-medium mb-3 block">Schriftgröße</label>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const activeObject = fabricCanvas.getActiveObject();
                              if (activeObject && activeObject.type === "text") {
                                const text = activeObject as FabricText;
                                const currentSize = text.fontSize || 20;
                                text.set("fontSize", Math.max(8, currentSize - 2));
                                fabricCanvas.renderAll();
                              }
                            }}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-16 text-center font-semibold">
                            {fabricCanvas.getActiveObject() && fabricCanvas.getActiveObject().type === "text"
                              ? (fabricCanvas.getActiveObject() as FabricText).fontSize || 20
                              : 20}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const activeObject = fabricCanvas.getActiveObject();
                              if (activeObject && activeObject.type === "text") {
                                const text = activeObject as FabricText;
                                const currentSize = text.fontSize || 20;
                                text.set("fontSize", Math.min(200, currentSize + 2));
                                fabricCanvas.renderAll();
                              }
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Layer Controls */}
                      <div>
                        <label className="text-sm font-medium mb-3 block">Ebene</label>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const activeObject = fabricCanvas.getActiveObject();
                              if (activeObject) {
                                fabricCanvas.bringObjectToFront(activeObject);
                                fabricCanvas.renderAll();
                              }
                            }}
                            title="Nach vorne"
                          >
                            <ArrowUp className="w-4 h-4 mr-1" />
                            Vorne
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const activeObject = fabricCanvas.getActiveObject();
                              if (activeObject) {
                                fabricCanvas.sendObjectToBack(activeObject);
                                fabricCanvas.renderAll();
                              }
                            }}
                            title="Nach hinten"
                          >
                            <ArrowDown className="w-4 h-4 mr-1" />
                            Hinten
                          </Button>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const activeObject = fabricCanvas.getActiveObject();
                          if (activeObject) {
                            fabricCanvas.remove(activeObject);
                            fabricCanvas.renderAll();
                            setHasSelectedObject(false);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                      </Button>
                    </div>
                  )}

                  {/* Variation Selection - Show if product has variations */}
                  {productId && (
                    <div className="glass-card p-6">
                      <h3 className="font-bold text-sm mb-5">
                        {selectedColor ? (
                          <>Farbe: <span className="text-primary">{selectedColor}</span></>
                        ) : (
                          "Variation auswählen"
                        )}
                      </h3>
                      {/* Color Selection */}
                      {availableColors.length > 0 && (
                        <div className="mb-6">
                          <label className="text-sm text-muted-foreground mb-4 block">Farbe</label>
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-5 items-center">
                        {availableColors.map((color) => (
                          <Tooltip key={color.name}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setSelectedColor(color.name);
                                  setSelectedVariationImageIndex(0);
                                }}
                                className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                                  selectedColor === color.name
                                    ? "border-primary ring-2 ring-primary/20 scale-110"
                                    : "border-border hover:border-primary/50 hover:scale-105"
                                }`}
                                style={{
                                  backgroundColor: color.hex || "#ccc",
                                }}
                                aria-label={color.name}
                              >
                                {selectedColor === color.name && (
                                  <Check className="w-5 h-5 text-white drop-shadow-md" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{color.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </div>
                )}
                
                {/* Variation Image Gallery */}
                {variationImages.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold mb-4">
                      {variationImages.length > 1 ? "Variation Bilder" : "Variation Bild"}
                    </h4>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {variationImages.map((img, index) => (
                        <button
                          key={img}
                          onClick={() => setSelectedVariationImageIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedVariationImageIndex === index
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Variation ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {variationImages.length === 0 && availableColors.length === 0 && variations.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Dieses Produkt hat keine Variationen.
                  </p>
                )}
                {variationImages.length === 0 && selectedColor && availableColors.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Keine Variationen für diese Auswahl gefunden.
                  </p>
                )}
                {variationImages.length === 0 && !selectedColor && availableColors.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Wähle eine Farbe aus, um Variationen zu sehen.
                  </p>
                )}
                    </div>
                  )}
              
              {!productImage && !productId && (
                <div>
                  <h3 className="font-bold text-sm mb-3">Produkt Farbe</h3>
                  <div className="flex gap-3">
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
                </div>
              )}
                  
                  {/* Price Display - Step 1 */}
                  <div className="glass-card p-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">Preis pro Stück</span>
                      <span className="text-2xl font-bold text-primary">{pricePerItem.toFixed(2).replace('.', ',')} €</span>
                    </div>
                    {totalQuantity > 0 && (
                      <div className="flex justify-between items-center pt-4 border-t border-border">
                        <span className="text-sm text-muted-foreground">
                          {totalQuantity} × {pricePerItem.toFixed(2).replace('.', ',')} €
                        </span>
                        <span className="text-lg font-semibold text-primary">
                          Gesamt: {totalPrice.toFixed(2).replace('.', ',')} €
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Navigation Button - Step 1 */}
                  <div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => setCurrentStep(2)}
                    >
                      Größe & Anzahl wählen
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Size and Quantity Selection - Step 2 (Direct, no dialog button) */}
                  <div>
                    <h3 className="font-bold mb-4 text-sm">Größe und Menge</h3>
                    <div className="space-y-3">
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
                  </div>

                  {/* Price & Actions - Step 2 */}
                  <div className="pt-4 border-t border-border">
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

                  {/* Navigation Button - Step 2 */}
                  <div className="pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="default"
                      className="w-full"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Zurück
                    </Button>
                  </div>
                </>
              )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

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
