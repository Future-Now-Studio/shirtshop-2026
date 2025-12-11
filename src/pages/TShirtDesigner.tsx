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
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { useProduct, useProductVariations, useWooCommerceProduct } from "@/hooks/useProducts";
import { PlacementZone } from "@/data/products";
import tshirtWhite from "@/assets/tshirt-mockup-white.png";
import tshirtBlack from "@/assets/tshirt-mockup-black.png";

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
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [basePrice, setBasePrice] = useState(0);
  const [hasSelectedObject, setHasSelectedObject] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [selectedFont, setSelectedFont] = useState("Outfit");
  const [textBold, setTextBold] = useState(false);
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

    // Save original stroke if not already saved
    if (!obj._originalStroke) {
      obj._originalStroke = obj.stroke;
      obj._originalStrokeWidth = obj.strokeWidth;
    }

    if (!zones || zones.length === 0) {
      // No zones - only check size
      if (isTooBig) {
        if (obj.stroke !== "#ef4444") {
          obj.set({
            stroke: "#ef4444",
            strokeWidth: 3,
          });
          if (shouldRender) {
            fabricCanvas.renderAll();
            toast.error("Element ist zu groß. Bitte verkleinern Sie das Element.");
          }
        }
      } else {
        // Remove red border if size is OK
        if (obj.stroke === "#ef4444") {
          obj.set({
            stroke: obj._originalStroke || undefined,
            strokeWidth: obj._originalStrokeWidth || 0,
          });
          if (shouldRender) fabricCanvas?.renderAll();
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

    if (!inZone || isTooBig || !fitsInAnyZone) {
      // Add red border to indicate out of bounds or too big
      if (obj.stroke !== "#ef4444") {
        obj.set({
          stroke: "#ef4444",
          strokeWidth: 3,
        });
        if (shouldRender) {
          fabricCanvas.renderAll();
          if (!inZone) {
            toast.error("Element befindet sich außerhalb der erlaubten Bereiche. Bitte innerhalb der blauen Zonen platzieren.");
          } else if (isTooBig || !fitsInAnyZone) {
            toast.error("Element ist zu groß. Bitte verkleinern Sie das Element.");
          }
        }
      }

      // Find nearest zone and snap to it
      let nearestZone: PlacementZone | null = null;
      let minDistance = Infinity;

      zones.forEach(zone => {
        const zoneLeft = zone.x * canvasWidth;
        const zoneTop = zone.y * canvasHeight;
        const zoneRight = zoneLeft + (zone.width * canvasWidth);
        const zoneBottom = zoneTop + (zone.height * canvasHeight);
        const zoneCenterX = zoneLeft + (zone.width * canvasWidth) / 2;
        const zoneCenterY = zoneTop + (zone.height * canvasHeight) / 2;

        const distance = Math.sqrt(
          Math.pow(centerX - zoneCenterX, 2) + Math.pow(centerY - zoneCenterY, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestZone = zone;
        }
      });

      if (nearestZone) {
        const zoneLeft = nearestZone.x * canvasWidth;
        const zoneTop = nearestZone.y * canvasHeight;
        const zoneRight = zoneLeft + (nearestZone.width * canvasWidth);
        const zoneBottom = zoneTop + (nearestZone.height * canvasHeight);

        // Constrain to zone bounds
        const newX = Math.max(
          zoneLeft + objWidth / 2,
          Math.min(zoneRight - objWidth / 2, centerX)
        );
        const newY = Math.max(
          zoneTop + objHeight / 2,
          Math.min(zoneBottom - objHeight / 2, centerY)
        );

        obj.set({
          left: newX,
          top: newY,
        });
        
        // Check size after constraining
        const constrainedWidth = (obj.width || 0) * (obj.scaleX || 1);
        const constrainedHeight = (obj.height || 0) * (obj.scaleY || 1);
        const stillTooBig = constrainedWidth > maxWidth || constrainedHeight > maxHeight;
        
        if (!stillTooBig) {
          // Remove red border after constraining if size is OK
          obj.set({
            stroke: obj._originalStroke || undefined,
            strokeWidth: obj._originalStrokeWidth || 0,
          });
        }
        
        if (shouldRender) {
          fabricCanvas.renderAll();
        }
      }
    } else {
      // Object is in zone - check if size is OK
      if (!isTooBig && fitsInAnyZone) {
        // Remove red border if size and position are OK
        if (obj.stroke === "#ef4444") {
          obj.set({
            stroke: obj._originalStroke || undefined,
            strokeWidth: obj._originalStrokeWidth || 0,
          });
          if (shouldRender) fabricCanvas.renderAll();
        }
      }
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

  // Add zone constraint handlers after canvas and zones are available
  useEffect(() => {
    if (!fabricCanvas || !placementZones) return;

    const handleObjectMoving = (e: any) => {
      const obj = e.target;
      if (!obj) return;
      const currentZones = placementZones[currentView];
      // Only constrain during actual movement, not on initial placement
      if (currentZones && currentZones.length > 0) {
        // Use a flag to track if this is the first move
        if (!obj._isBeingMoved) {
          obj._isBeingMoved = true;
          return; // Skip first move to allow initial placement
        }
        constrainToZones(obj, currentZones, false); // Don't render during move for performance
      }
    };

    const handleObjectModified = (e: any) => {
      const obj = e.target;
      if (!obj) return;
      const currentZones = placementZones[currentView];
      // Only constrain after user has finished modifying (scaling, rotating, etc.)
      // Reset the movement flag
      if (obj._isBeingMoved) {
        obj._isBeingMoved = false;
      }
      // Constrain after modification is complete
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
          fabricCanvas.renderAll();
        });
      } catch (error) {
        console.error('Error loading view data:', error);
      }
    }
  }, [currentView, fabricCanvas]); // Removed viewData - it causes canvas to clear when elements are added!

  // Get available colors from variations
  const availableColors = useMemo(() => {
    if (!variations || variations.length === 0) return [];
    
    const colors = new Set<string>();
    variations.forEach(variation => {
      const colorAttr = variation.attributes?.find(attr => 
        attr.name.toLowerCase().includes('color') || 
        attr.name.toLowerCase().includes('farbe') ||
        attr.name.toLowerCase().includes('colour')
      );
      if (colorAttr?.option) {
        // Remove spaces from color names
        const cleanColor = colorAttr.option.trim();
        if (cleanColor) {
          colors.add(cleanColor);
        }
      }
    });
    return Array.from(colors);
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
        // Find the entry that matches the selected color
        const matchingSviEntry = sviMeta.value.find((entry: any) => {
          if (!entry.slugs || !Array.isArray(entry.slugs)) return false;
          return entry.slugs.some((slug: string) => String(slug).trim() === String(selectedColor).trim());
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
        const colorAttr = variation.attributes?.find(attr => 
          attr.name.toLowerCase().includes('color') || 
          attr.name.toLowerCase().includes('farbe') ||
          attr.name.toLowerCase().includes('colour')
        );
        if (!colorAttr || !colorAttr.option) return false;
        
        // Convert both to strings and compare (handles numbers like "741")
        const attrOption = String(colorAttr.option).trim();
        const selectedColorValue = String(selectedColor).trim();
        
        return attrOption === selectedColorValue;
      });
      
      if (matchingVariation) {
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
      setSelectedColor(availableColors[0]);
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
            ctx.drawImage(shirtImg, 0, 0, 800, 800);

            // Create a temporary fabric canvas for this view
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = fabricCanvas.getWidth();
            exportCanvas.height = fabricCanvas.getHeight();
            const tempFabricCanvas = new FabricCanvas(exportCanvas, {
              width: fabricCanvas.getWidth(),
              height: fabricCanvas.getHeight(),
              backgroundColor: "transparent",
            });

            // Load view data and filter out placement zones
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
              
              // Draw design on shirt
              const designDataUrl = tempFabricCanvas.toDataURL({
                format: "png",
                multiplier: 800 / fabricCanvas.getWidth(),
              });

              const designImg = new Image();
              designImg.onerror = () => {
                console.error(`Error loading design for ${view}`);
                tempFabricCanvas.dispose();
                resolve();
              };
              
              designImg.onload = () => {
                ctx.drawImage(designImg, 0, 0, 800, 800);

                // Download this view
                const link = document.createElement("a");
                link.download = `mein-design-${viewLabels[view].toLowerCase().replace(/\s+/g, '-')}.png`;
                link.href = tempCanvas.toDataURL("image/png");
                link.click();
                
                exportedCount++;
                tempFabricCanvas.dispose();
                resolve();
              };
              designImg.src = designDataUrl;
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
    if (!importantPointsAccepted) {
      toast.error("Bitte bestätige, dass du die wichtigen Punkte beachtet hast");
      return;
    }
    
    const totalQuantity = Object.values(sizeQuantities).reduce(
      (sum, qty) => sum + qty,
      0
    );
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

    // Check if any view has design elements
    const allViewsData = Object.values(viewData).filter(v => v !== null);
    const hasAnyDesign = allViewsData.length > 0;

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
      const customDesigns: Record<string, string> = {};
      const views: ViewType[] = ["front", "back", "left", "right"];
      
      // Create a combined preview image for thumbnail
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 800;
      tempCanvas.height = 800;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        const shirtImg = new Image();
        shirtImg.crossOrigin = "anonymous";
        shirtImg.onload = async () => {
          // Generate individual images for each view
          for (const view of views) {
            const viewJson = viewData[view];
            if (!viewJson) continue; // Skip views without design

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
            }
          }

          // Create preview image (use front view or first available)
          previewImage = customDesigns.front || customDesigns.back || customDesigns.left || customDesigns.right || selectedShirt.image;

          // Add items for each size with quantity > 0
          let addedCount = 0;
          Object.entries(sizeQuantities).forEach(([size, quantity]) => {
            if (quantity > 0) {
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

          toast.success(`${addedCount} Artikel${addedCount !== 1 ? '' : ''} zum Warenkorb hinzugefügt! (${totalDesignElementCount} Design-Element${totalDesignElementCount !== 1 ? 'e' : ''})`);
        };
        shirtImg.src = selectedShirt.image;
      }
    } else {
      // Add items for each size with quantity > 0 (no design)
      let addedCount = 0;
      Object.entries(sizeQuantities).forEach(([size, quantity]) => {
        if (quantity > 0) {
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
      toast.success(`${addedCount} Artikel${addedCount !== 1 ? '' : ''} zum Warenkorb hinzugefügt!`);
    }
  };

  return (
    <Layout>
      <div className="container-wide py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-2">
            <span className="text-secondary">Creator</span>
          </h1>
          <p className="text-muted-foreground">
            Lade dein eigenes Design hoch und platziere es auf deinem Produkt
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Canvas Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3"
          >

            <div
              ref={containerRef}
              className="relative bg-muted/30 rounded-2xl p-2 sm:p-4 flex items-center justify-center"
              style={{ minHeight: '500px' }}
            >
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
                <div className="mt-4 glass-card p-4">
                  <h3 className="font-semibold text-sm mb-3">Ansichten</h3>
                  <div className="grid grid-cols-4 gap-2">
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
                {/* Elements List - Always visible */}
                <div className="glass-card p-4 mt-3">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="elements" className="border-none">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <h3 className="font-bold flex items-center gap-2 text-sm">
                          <Layers className="w-4 h-4" />
                          Elemente ({canvasObjects.length})
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent>
                    {canvasObjects.length > 0 ? (
                      <div className="space-y-2">
                  {canvasObjects.map((obj, index) => {
                    const objType = obj.type === 'image' ? 'Bild' : obj.type === 'text' ? 'Text' : 'Element';
                    const objName = obj.type === 'text' ? (obj.text || 'Text') : (obj.name || `Element ${index + 1}`);
                    const isSelected = fabricCanvas?.getActiveObject() === obj;
                    // Get the actual index in the canvas (reverse order for display - top to bottom)
                    const canvasIndex = fabricCanvas ? fabricCanvas.getObjects().indexOf(obj) : index;
                    const totalObjects = canvasObjects.length;
                    
                    return (
                      <div
                        key={obj.name || `obj-${index}`}
                        className={`p-2 rounded-lg border transition-all ${
                          isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {obj.type === 'image' ? (
                              <Upload className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <Type className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="font-medium text-xs">{objType}</span>
                            <span className="text-xs text-muted-foreground truncate">({objName.length > 15 ? objName.substring(0, 15) + '...' : objName})</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0"
                            onClick={() => handleDeleteObject(obj)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs flex-1 px-2"
                            onClick={() => handleSelectObject(obj)}
                            title="Auswählen"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleMoveForward(obj)}
                            title="Eine Ebene nach oben"
                            disabled={canvasIndex === totalObjects - 1}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleMoveBackward(obj)}
                            title="Eine Ebene nach unten"
                            disabled={canvasIndex === 0}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                      })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Noch keine Elemente hinzugefügt. Füge ein Bild oder Text hinzu.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

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
                
                {/* Clear All Button - Always visible */}
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full" onClick={handleClearAll}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Alles zurücksetzen
                  </Button>
                </div>
              </>
            )}

          </motion.div>

          {/* Controls - Unified Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="glass-card p-4 space-y-4">
              {/* Step Visualization - Clickable */}
              <div className="flex items-center justify-center border-b border-border pb-4">
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
                  <Accordion type="multiple" defaultValue={["upload", "text"]} className="space-y-3">
              {/* Upload */}
              <AccordionItem value="upload" className="glass-card border-none rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <h3 className="font-bold flex items-center gap-2 text-sm">
                    <Upload className="w-4 h-4 text-primary" />
                    Design hochladen
                  </h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <label className="block">
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Klicke oder ziehe ein Bild hierher
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        PNG, JPG bis 10MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </AccordionContent>
              </AccordionItem>

              {/* Add Text */}
              <AccordionItem value="text" className="glass-card border-none rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <h3 className="font-bold flex items-center gap-2 text-sm">
                    <Type className="w-4 h-4 text-primary" />
                    Text hinzufügen
                  </h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
              
              {/* Font Selection */}
              <div className="mb-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">Schriftart</label>
                <Select value={selectedFont} onValueChange={handleFontChange}>
                  <SelectTrigger className="w-full">
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
              <div className="mb-3">
                <label className="text-sm text-muted-foreground mb-2 block">Textfarbe</label>
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
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-10 h-10 rounded-md border-2 border-border cursor-pointer"
                      title="Benutzerdefinierte Farbe"
                    />
                  </div>
                </div>
              </div>

              {/* Formatting Buttons */}
              <div className="mb-3">
                <label className="text-sm text-muted-foreground mb-2 block">Formatierung</label>
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

              {/* Text Input */}
              <div className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Dein Text..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddText()}
                />
                <Button onClick={handleAddText}>
                  <Type className="w-4 h-4" />
                </Button>
              </div>
                </AccordionContent>
              </AccordionItem>

              {/* Variation Selection - Show if product has variations */}
              {productId ? (
                <AccordionItem value="variations" className="glass-card border-none rounded-lg">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <h3 className="font-bold">
                  {selectedColor ? (
                    <>Farbe: <span className="text-primary">{selectedColor}</span></>
                  ) : (
                    "Variation auswählen"
                  )}
                  </h3>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {/* Color Selection */}
                    {availableColors.length > 0 && (
                      <div className="mb-4">
                    <label className="text-sm text-muted-foreground mb-2 block">Farbe</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedColor("");
                          setSelectedVariationImageIndex(0);
                        }}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                          !selectedColor
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        Alle
                      </button>
                      {availableColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setSelectedColor(color);
                            setSelectedVariationImageIndex(0);
                          }}
                          className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                            selectedColor === color
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Variation Image Gallery */}
                {variationImages.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      {variationImages.length > 1 ? "Variation Bilder" : "Variation Bild"}
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
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
                ) : availableColors.length === 0 && variations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Dieses Produkt hat keine Variationen.
                  </p>
                ) : selectedColor ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Variationen für diese Auswahl gefunden.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Wähle eine Farbe aus, um Variationen zu sehen.
                  </p>
                )}
                  </AccordionContent>
                </AccordionItem>
              ) : !productImage ? (
                /* Shirt Color - Only show if no product image is provided and no variations */
                <AccordionItem value="color" className="glass-card border-none rounded-lg">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <h3 className="font-bold">Produkt Farbe</h3>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
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
                  </AccordionContent>
                </AccordionItem>
              ) : null}

                  </Accordion>

                  {/* Price Display - Step 1 */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Preis pro Stück</span>
                      <span className="text-2xl font-bold text-primary">{pricePerItem.toFixed(2).replace('.', ',')} €</span>
                    </div>
                    {totalQuantity > 0 && (
                      <div className="flex justify-between items-center mt-2">
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
                  <div className="pt-4 border-t border-border">
                    <Button
                      size="default"
                      className="w-full"
                      onClick={() => setCurrentStep(2)}
                    >
                      Weiter
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
                      <Button 
                        size="default" 
                        className="w-full" 
                        onClick={handleAddToCart}
                        disabled={!importantPointsAccepted}
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        In den Warenkorb
                      </Button>
                      {Object.values(viewData).some(v => v !== null) && (
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

            {/* Instructions */}
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="flex items-center gap-2">
                <Move className="w-4 h-4" />
                Ziehe Elemente um sie zu verschieben
              </p>
              <p className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4" />
                Nutze die Ecken zum Skalieren & Drehen
              </p>
            </div>
          </motion.div>
        </div>
      </div>

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
