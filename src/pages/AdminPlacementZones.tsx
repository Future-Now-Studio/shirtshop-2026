import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas as FabricCanvas, Rect, FabricText } from "fabric";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts, useProduct, useProductVariations, useWooCommerceProduct } from "@/hooks/useProducts";
import { PlacementZone } from "@/data/products";
import { toast } from "sonner";
import { Save, Trash2, ArrowLeft, Shirt, Search, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { WOOCOMMERCE_CONFIG } from "@/lib/woocommerce";
import {
  PLACEMENT_ZONE_CANVAS_SIZE,
  getPlacementCanvasSize,
} from "@/constants/placementCanvas";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewType = "front" | "back" | "left" | "right";

/** Effektive Zonen-Höhe in mm: nur Breite angegeben → aus Aspect ratio der Zone */
function effectiveZoneHeightMm(zone: PlacementZone): number | undefined {
  if (zone.widthMm == null || zone.width <= 0) return undefined;
  if (zone.customMmSize && zone.heightMm != null) return zone.heightMm;
  return Math.round((zone.widthMm * zone.height) / zone.width * 10) / 10;
}

const viewLabels: Record<ViewType, string> = {
  front: "Vorderseite",
  back: "Rückseite",
  left: "Linke Seite",
  right: "Rechte Seite",
};

// Create Basic Auth header for WooCommerce
function getWooCommerceAuthHeader(): string {
  const credentials = `${WOOCOMMERCE_CONFIG.consumerKey}:${WOOCOMMERCE_CONFIG.consumerSecret}`;
  return `Basic ${btoa(credentials)}`;
}

// Password for Placement Zones access
const PLACEMENT_ZONES_PASSWORD = "$PS2025$-PZ";
const AUTH_STORAGE_KEY = "placement_zones_auth";

// Simple hash function for password verification (not cryptographically secure, but sufficient for this use case)
const createHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

// Check if user is authenticated
const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;
  const authData = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!authData) return false;
  
  try {
    const { timestamp, hash, sessionId } = JSON.parse(authData);
    
    // Session expires after 8 hours
    const eightHours = 8 * 60 * 60 * 1000;
    if (Date.now() - timestamp > eightHours) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return false;
    }
    
    // Verify hash (password + timestamp + sessionId)
    const expectedHash = createHash(PLACEMENT_ZONES_PASSWORD + timestamp + sessionId);
    return hash === expectedHash;
  } catch {
    return false;
  }
};

// Authenticate user
const authenticate = (password: string): boolean => {
  if (password === PLACEMENT_ZONES_PASSWORD) {
    const timestamp = Date.now();
    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const hash = createHash(PLACEMENT_ZONES_PASSWORD + timestamp + sessionId);
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ timestamp, hash, sessionId }));
    return true;
  }
  return false;
};

const AdminPlacementZones = () => {
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts({ per_page: 100 });
  const { data: product } = useProduct(productId ? Number(productId) : 0);
  const { data: wcProduct } = useWooCommerceProduct(productId ? Number(productId) : 0);
  const { data: variations = [] } = useProductVariations(productId ? Number(productId) : 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Wrapper mit aspect-square – Größe für Fabric muss hier gemessen werden */
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>(productId || "");
  const [currentView, setCurrentView] = useState<ViewType>("front");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [viewImages, setViewImages] = useState<Record<ViewType, string>>({
    front: product?.image || "",
    back: product?.image || "",
    left: product?.image || "",
    right: product?.image || "",
  });
  const [zones, setZones] = useState<Record<ViewType, PlacementZone[]>>({
    front: [],
    back: [],
    left: [],
    right: [],
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAuthenticatedState, setIsAuthenticatedState] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [initTrigger, setInitTrigger] = useState(0);

  // Check authentication on mount
  useEffect(() => {
    setIsAuthenticatedState(isAuthenticated());
  }, []);

  // Handle login
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError("");
    
    if (authenticate(password)) {
      setIsAuthenticatedState(true);
      setPassword("");
      toast.success("Erfolgreich angemeldet");
    } else {
      setLoginError("Falsches Passwort. Bitte versuche es erneut.");
      setPassword("");
    }
  };

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase().trim();
    return products.filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.id.toString().includes(query)
    );
  }, [products, searchQuery]);

  // Get available colors from product attributes
  const availableColors = useMemo(() => {
    if (!wcProduct?.attributes) return [];
    const colorAttribute = wcProduct.attributes.find(attr => 
      attr.name.toLowerCase().includes('color') || 
      attr.name.toLowerCase().includes('farbe') ||
      attr.slug.toLowerCase().includes('color') ||
      attr.slug.toLowerCase().includes('farbe')
    );
    return colorAttribute?.options || [];
  }, [wcProduct]);

  // Organize SVI images by view type for selected color
  const viewImagesForColor = useMemo(() => {
    const views: Record<ViewType, string> = {
      front: product?.image || "",
      back: product?.image || "",
      left: product?.image || "",
      right: product?.image || "",
    };

    // Always try to load SVI images, even if no color is selected (use first available)
    if (wcProduct) {
      const sviMeta = wcProduct.meta_data?.find((meta: any) => meta.key === 'woosvi_slug');
      
      if (sviMeta && sviMeta.value && Array.isArray(sviMeta.value)) {
        // Find the entry that matches the selected color (or use first entry if no color selected)
        const normalizeString = (str: string): string => {
          return str
            .toLowerCase()
            .trim()
            .replace(/[()]/g, '') // Remove parentheses
            .replace(/[-\s]+/g, ' ') // Normalize dashes and multiple spaces to single space
            .trim();
        };
        
        let matchingSviEntry = null;
        
        if (selectedColor) {
          // Try to find matching color
          matchingSviEntry = sviMeta.value.find((entry: any) => {
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
        }
        
        // If no color selected or no match found, use first entry
        if (!matchingSviEntry && sviMeta.value.length > 0) {
          matchingSviEntry = sviMeta.value[0];
        }
        
        if (matchingSviEntry && matchingSviEntry.imgs && Array.isArray(matchingSviEntry.imgs)) {
          // Get image IDs from SVI data
          const imageIds = matchingSviEntry.imgs.map((id: any) => String(id));
          
          // Find images in product.images array that match these IDs
          const matchingImages = wcProduct.images?.filter(img => 
            imageIds.includes(String(img.id))
          ) || [];
          
          // Organize images by view type: PF/PB prefix on title first, then _F/_B/_SL/_SR
          matchingImages.forEach((img) => {
            const name = img.name || img.src || "";
            const upper = String(name).trim().toUpperCase();
            if (upper.startsWith("PF")) {
              views.front = img.src;
              return;
            }
            if (upper.startsWith("PB")) {
              views.back = img.src;
              return;
            }
            // Filename view indicators: _F (front), _B (back), _SL (left), _SR (right)
            if (name.includes("_F") || name.includes("-F")) {
              views.front = img.src;
            } else if (name.includes("_B") || name.includes("-B")) {
              views.back = img.src;
            } else if (name.includes('_SL') || name.includes('-SL')) {
              views.left = img.src;
            } else if (name.includes('_SR') || name.includes('-SR')) {
              views.right = img.src;
            }
          });
        }
      }
    }
    return views;
  }, [selectedColor, wcProduct, product?.image]);

  // Update view images when color changes
  useEffect(() => {
    setViewImages(viewImagesForColor);
  }, [viewImagesForColor]);

  // Ensure viewImages is updated when currentView changes (for immediate background image update)
  useEffect(() => {
    // This effect ensures the background image updates when currentView changes
    // The viewImages state is already set correctly, this just triggers a re-render
  }, [currentView, viewImages]);

  // Load zones from product
  useEffect(() => {

    // Only overwrite zones when the product actually provides placementZones.
    // If placementZones is missing/undefined, keep the existing zones in state
    // so they don't briefly appear and then disappear when product updates.
    if (product?.placementZones) {
      const loadedZones = {
        front: product.placementZones.front || [],
        back: product.placementZones.back || [],
        left: product.placementZones.left || [],
        right: product.placementZones.right || [],
      };
      setZones(loadedZones);
    } else {
    }
  }, [product?.placementZones, product?.id]);

  // Initialize canvas once when refs are available
  useEffect(() => {
    if (fabricCanvas) {
      return;
    }
    
    // Function to initialize canvas
    const initializeCanvas = () => {
      if (!canvasRef.current) {
        return false;
      }
      // Größe vom direkten Wrapper (aspect-square), sonst ist Fabric-Offset/Hit-Test falsch → Klicks wirken „tot“
      const wrap = canvasWrapRef.current || canvasRef.current.parentElement;
      const containerWidth = wrap?.clientWidth || containerRef.current?.offsetWidth || PLACEMENT_ZONE_CANVAS_SIZE;
      // Gleiche Logik wie Creator – feste Obergrenze, damit Zonen 1:1 passen
      const canvasSize = getPlacementCanvasSize(containerWidth);

      const canvas = new FabricCanvas(canvasRef.current, {
        width: canvasSize,
        height: canvasSize,
        backgroundColor: "transparent",
        selection: true,
        preserveObjectStacking: true,
      });
      
      // Enable selection tracking for zones
      canvas.on('selection:created', (e) => {
        const activeObject = e.selected?.[0] as any;
        if (activeObject && activeObject.name?.startsWith('zone-')) {
          const index = activeObject.data?.index;
          if (index !== undefined) {
            setSelectedZoneIndex(index);
          }
        }
      });
      
      canvas.on('selection:updated', (e) => {
        const activeObject = e.selected?.[0] as any;
        if (activeObject && activeObject.name?.startsWith('zone-')) {
          const index = activeObject.data?.index;
          if (index !== undefined) {
            setSelectedZoneIndex(index);
          }
        }
      });
      
      canvas.on('selection:cleared', () => {
        setSelectedZoneIndex(null);
      });

      // Note: Background image is handled via CSS (same as TShirtDesigner)
      // This ensures consistent scaling between configurator and creator
      // The canvas is transparent and overlays the CSS background image

      setFabricCanvas(canvas);
      // Offset mehrfach nach Layout – sonst sind Klick-Koordinaten falsch (z. B. wenn Sidebar erst danach rendert)
      const bumpOffset = () => {
        try {
          canvas.calcOffset?.();
          canvas.requestRenderAll?.();
        } catch {
          /* ignore */
        }
      };
      requestAnimationFrame(bumpOffset);
      setTimeout(bumpOffset, 50);
      setTimeout(bumpOffset, 200);
      setTimeout(bumpOffset, 500);
      return true;
    };

    // Try to initialize immediately
    if (initializeCanvas()) {
      return;
    }

    // If refs not available, retry with increasing delays
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = 100;

    const retryTimer = setInterval(() => {
      retryCount++;
      
      if (initializeCanvas()) {
        clearInterval(retryTimer);
        return;
      }
      
      if (retryCount >= maxRetries) {
        clearInterval(retryTimer);
      }
    }, retryInterval);

    return () => {
      clearInterval(retryTimer);
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [fabricCanvas]); // Only depend on fabricCanvas

  // Reset selection when view changes
  useEffect(() => {
    setSelectedZoneIndex(null);
  }, [currentView]);

  // Render zones on canvas
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }
    
    // Don't render zones while drawing
    if (isDrawing) {
      return;
    }

    // Get zones for current view
    const currentZones = zones[currentView] || [];
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    
    // Debug: Log zones for current view

    // Check which zones already exist for current view
    const existingZonesForView = fabricCanvas.getObjects().filter(
      (obj: any) => {
        const name = obj.name;
        return (name?.startsWith(`zone-${currentView}-`) || name?.startsWith(`zone-label-${currentView}-`)) && 
               !name?.startsWith("drawing-rect-");
      }
    );

    // Only clear and re-render if zones don't exist or count doesn't match
    if (existingZonesForView.length !== currentZones.length * 2) {
      
      // Clear only zones for current view (not all zones)
      existingZonesForView.forEach((obj) => fabricCanvas.remove(obj));
      
      // Clear selection
      fabricCanvas.discardActiveObject();
      setSelectedZoneIndex(null);

      if (currentZones.length === 0) {
        fabricCanvas.renderAll();
        return;
      }

    currentZones.forEach((zone, index) => {
      const rectLeft = zone.x * canvasWidth;
      const rectTop = zone.y * canvasHeight;
      const rectWidth = zone.width * canvasWidth;
      const rectHeight = zone.height * canvasHeight;
      
      console.log(`Adding zone ${index} for ${currentView}:`, {
        zone,
        canvasSize: { width: canvasWidth, height: canvasHeight },
        rectCoords: { left: rectLeft, top: rectTop, width: rectWidth, height: rectHeight }
      });
      
      const rect = new Rect({
        left: rectLeft,
        top: rectTop,
        width: rectWidth,
        height: rectHeight,
        fill: "rgba(59, 130, 246, 0.4)", // Increased opacity for better visibility
        stroke: "#3b82f6", // Solid blue color
        strokeWidth: 4, // Thicker stroke
        strokeDashArray: [8, 4], // More visible dash pattern
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        name: `zone-${currentView}-${index}`,
        data: { view: currentView, index },
        opacity: 1, // Ensure full opacity
        visible: true, // Explicitly set visible
      });

      // Add label
      const label = new FabricText(zone.name, {
        left: rectLeft + 5,
        top: rectTop + 5,
        fontSize: 16,
        fill: "#3b82f6", // Solid blue color
        fontFamily: "Outfit",
        fontWeight: "bold",
        selectable: false,
        evented: false,
        name: `zone-label-${currentView}-${index}`,
        opacity: 1,
        visible: true,
        backgroundColor: "rgba(255, 255, 255, 0.9)", // White background for better visibility
        padding: 4,
      });

      fabricCanvas.add(rect);
      fabricCanvas.add(label);
      
      // Ensure zones are visible and on top (except when drawing)
      // Don't bring to front if we're currently drawing
      if (!isDrawing) {
        fabricCanvas.bringObjectToFront(rect);
        fabricCanvas.bringObjectToFront(label);
      }
      
      // Force coordinates update and ensure visibility
      rect.setCoords();
      label.setCoords();
      rect.set({ visible: true, opacity: 1 });
      label.set({ visible: true, opacity: 1 });
      
      console.log(`[RENDER ZONES] Zone ${index} added:`, {
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        label: { left: label.left, top: label.top },
        visible: rect.visible,
        opacity: rect.opacity,
      });

      // Make rect editable - update on move/resize
      rect.on("modified", () => {
        const updatedZones = [...zones[currentView]];
        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        
        const relW = (rect.width! * (rect.scaleX || 1)) / canvasWidth;
        const relH = (rect.height! * (rect.scaleY || 1)) / canvasHeight;
        const z = { ...updatedZones[index], x: rect.left! / canvasWidth, y: rect.top! / canvasHeight, width: relW, height: relH };
        if (!z.customMmSize && z.widthMm != null && relW > 0) {
          z.heightMm = Math.round(((z.widthMm * relH) / relW) * 10) / 10;
        }
        updatedZones[index] = z;
        
        // Reset scale after updating
        rect.set({ scaleX: 1, scaleY: 1 });
        rect.setCoords();
        
        setZones((prev) => ({
          ...prev,
          [currentView]: updatedZones,
        }));
        
        // Update label position
        const label = fabricCanvas.getObjects().find((obj: any) => obj.name === `zone-label-${currentView}-${index}`) as FabricText;
        if (label) {
          label.set({
            left: updatedZones[index].x * canvasWidth + 5,
            top: updatedZones[index].y * canvasHeight + 5,
          });
        }
        
        fabricCanvas.renderAll();
      });
      
      // Update on moving (without scaling)
      rect.on("moving", () => {
        const label = fabricCanvas.getObjects().find((obj: any) => obj.name === `zone-label-${currentView}-${index}`) as FabricText;
        if (label) {
          label.set({
            left: rect.left! + 5,
            top: rect.top! + 5,
          });
          fabricCanvas.renderAll();
        }
      });
      
      // Update selection state
      rect.on("selected", () => {
        setSelectedZoneIndex(index);
      });
      
      rect.on("deselected", () => {
        setSelectedZoneIndex(null);
      });
    });

      // Force render after adding all zones
      setTimeout(() => {
        fabricCanvas.renderAll();
        const zoneObjects = fabricCanvas.getObjects().filter((obj: any) => obj.name?.startsWith('zone-'));
        zoneObjects.forEach((obj: any, idx: number) => {
        });
      }, 0);
    } else {
      // Zones already exist for this view, just ensure they're visible and positioned correctly
      
      // Hide zones from other views first
      const allViews: ViewType[] = ['front', 'back', 'left', 'right'];
      allViews.forEach((view) => {
        if (view !== currentView) {
          const zonesForOtherView = fabricCanvas.getObjects().filter(
            (obj: any) => {
              const name = obj.name;
              return (name?.startsWith(`zone-${view}-`) || name?.startsWith(`zone-label-${view}-`)) && 
                     !name?.startsWith("drawing-rect-");
            }
          );
          zonesForOtherView.forEach((zoneObj) => {
            // Hide and disable events so they don't block drawing on the current view
            zoneObj.set({ visible: false, evented: false });
          });
        }
      });
      
      // Ensure zones for current view are visible and correctly positioned
      existingZonesForView.forEach((zoneObj) => {
        const name = (zoneObj as any).name || '';
        const isLabel = name.startsWith('zone-label-');
        
        // Extract index from name (e.g., "zone-back-0" -> 0)
        const match = name.match(/-(\d+)$/);
        if (match && currentZones.length > 0) {
          const index = parseInt(match[1]);
          if (index < currentZones.length) {
            const zone = currentZones[index];
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            
            if (isLabel) {
              // Update label position and keep it non-interactive
              zoneObj.set({
                left: zone.x * canvasWidth + 5,
                top: zone.y * canvasHeight + 5,
                visible: true,
                opacity: 1,
                evented: false,
              });
            } else {
              // Update rect position and size and re-enable events for current view
              zoneObj.set({
                left: zone.x * canvasWidth,
                top: zone.y * canvasHeight,
                width: zone.width * canvasWidth,
                height: zone.height * canvasHeight,
                scaleX: 1,
                scaleY: 1,
                visible: true,
                opacity: 1,
                evented: true,
              });
              (zoneObj as any).setCoords();
            }
          }
        } else {
          // Fallback: just make visible
          zoneObj.set({ visible: true, opacity: 1 });
        }
        fabricCanvas.bringObjectToFront(zoneObj);
      });
      
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas, zones, currentView, isDrawing]);

  // Handle canvas click to start drawing
  const handleCanvasMouseDown = useCallback(
    (e: any) => {
      
      if (!fabricCanvas || isDrawing) {
        return;
      }
      
      // Don't start drawing if clicking on an existing zone or label (only if it's visible)
      const target = e.target;
      if (
        target &&
        target.visible !== false &&
        (target.name?.startsWith('zone-') || target.name?.startsWith('zone-label-'))
      ) {
        return;
      }
      
      // Clear any active selection before starting to draw
      fabricCanvas.discardActiveObject();
      
      const pointer = fabricCanvas.getPointer(e.e);
      setStartPoint(pointer);
      setIsDrawing(true);

      const rect = new Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: "rgba(59, 130, 246, 0.2)",
        stroke: "rgba(59, 130, 246, 0.8)",
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: true, // Allow mouse events for drawing
        name: `drawing-rect-${Date.now()}`, // Unique name to identify drawing rectangle
      });

      fabricCanvas.add(rect);
      fabricCanvas.bringObjectToFront(rect);
      setCurrentRect(rect);
      fabricCanvas.renderAll();
    },
    [fabricCanvas, isDrawing]
  );

  // Handle mouse move to resize rectangle
  const handleCanvasMouseMove = useCallback(
    (e: any) => {
      if (!fabricCanvas || !isDrawing || !startPoint || !currentRect) return;
      const pointer = fabricCanvas.getPointer(e.e);

      const width = Math.abs(pointer.x - startPoint.x);
      const height = Math.abs(pointer.y - startPoint.y);
      const left = Math.min(pointer.x, startPoint.x);
      const top = Math.min(pointer.y, startPoint.y);

      currentRect.set({
        left,
        top,
        width,
        height,
      });
      fabricCanvas.renderAll();
    },
    [fabricCanvas, isDrawing, startPoint, currentRect]
  );

  // Handle mouse up to finish drawing
  const handleCanvasMouseUp = useCallback(() => {
    if (!fabricCanvas || !isDrawing || !currentRect) return;

    setIsDrawing(false);
    setStartPoint(null);

    // Check if rectangle has minimum size
    if (currentRect.width! < 10 || currentRect.height! < 10) {
      fabricCanvas.remove(currentRect);
      fabricCanvas.renderAll();
      setCurrentRect(null);
      return;
    }

    // Convert to relative coordinates
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Generate default name
    const zoneNumber = zones[currentView].length + 1;
    const defaultName = `Zone ${zoneNumber}`;

    // Raw relative values
    let relX = currentRect.left! / canvasWidth;
    let relY = currentRect.top! / canvasHeight;
    let relW = currentRect.width! / canvasWidth;
    let relH = currentRect.height! / canvasHeight;

    // Clamp to [0,1] to avoid zones going outside the image/canvas
    relX = Math.max(0, Math.min(1, relX));
    relY = Math.max(0, Math.min(1, relY));
    relW = Math.max(0, Math.min(1 - relX, relW));
    relH = Math.max(0, Math.min(1 - relY, relH));

    const newZone: PlacementZone = {
      id: `zone-${Date.now()}`,
      name: defaultName,
      x: relX,
      y: relY,
      width: relW,
      height: relH,
    };

    const zoneIndex = zones[currentView].length;

    // Make it selectable and editable
    currentRect.set({
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      name: `zone-${currentView}-${zoneIndex}`,
      data: { view: currentView, index: zoneIndex },
    });

    // Add label
    const label = new FabricText(newZone.name, {
      left: newZone.x * canvasWidth + 5,
      top: newZone.y * canvasHeight + 5,
      fontSize: 14,
      fill: "rgba(59, 130, 246, 1)",
      fontFamily: "Outfit",
      fontWeight: "bold",
      selectable: false,
      evented: false,
      name: `zone-label-${currentView}-${zoneIndex}`,
    });

    fabricCanvas.add(label);

    // Add event listeners for this new zone
    currentRect.on("modified", () => {
      const updatedZones = [...zones[currentView], newZone];
      const canvasWidth = fabricCanvas.getWidth();
      const canvasHeight = fabricCanvas.getHeight();
      
      // Raw relative values after edit
      let relX = currentRect.left! / canvasWidth;
      let relY = currentRect.top! / canvasHeight;
      let relW = (currentRect.width! * (currentRect.scaleX || 1)) / canvasWidth;
      let relH = (currentRect.height! * (currentRect.scaleY || 1)) / canvasHeight;

      // Clamp to [0,1] again to keep zone within the image
      relX = Math.max(0, Math.min(1, relX));
      relY = Math.max(0, Math.min(1, relY));
      relW = Math.max(0, Math.min(1 - relX, relW));
      relH = Math.max(0, Math.min(1 - relY, relH));

      updatedZones[zoneIndex] = {
        ...updatedZones[zoneIndex],
        x: relX,
        y: relY,
        width: relW,
        height: relH,
      };
      
      currentRect.set({ scaleX: 1, scaleY: 1 });
      currentRect.setCoords();
      
      setZones((prev) => ({
        ...prev,
        [currentView]: updatedZones,
      }));
      
      // Update label position
      label.set({
        left: updatedZones[zoneIndex].x * canvasWidth + 5,
        top: updatedZones[zoneIndex].y * canvasHeight + 5,
      });
      
      fabricCanvas.renderAll();
    });
    
    currentRect.on("moving", () => {
      label.set({
        left: currentRect.left! + 5,
        top: currentRect.top! + 5,
      });
      fabricCanvas.renderAll();
    });
    
    currentRect.on("selected", () => {
      setSelectedZoneIndex(zoneIndex);
    });
    
    currentRect.on("deselected", () => {
      setSelectedZoneIndex(null);
    });

    // Update zones state - this will trigger the render zones effect
    setZones((prev) => {
      const updated = {
        ...prev,
        [currentView]: [...prev[currentView], newZone],
      };
      return updated;
    });

    // Remove the drawing rectangle - the zone will be re-rendered by the effect
    fabricCanvas.remove(currentRect);
    setCurrentRect(null);
    
    // Force render to show the new zone
    setTimeout(() => {
      fabricCanvas.renderAll();
    }, 0);
    
    toast.success("Zone hinzugefügt! Du kannst sie jetzt verschieben und in der Größe anpassen.");
  }, [fabricCanvas, isDrawing, currentRect, currentView, zones]);

  // Setup canvas event listeners
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }
    fabricCanvas.on("mouse:down", handleCanvasMouseDown);
    fabricCanvas.on("mouse:move", handleCanvasMouseMove);
    fabricCanvas.on("mouse:up", handleCanvasMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleCanvasMouseDown);
      fabricCanvas.off("mouse:move", handleCanvasMouseMove);
      fabricCanvas.off("mouse:up", handleCanvasMouseUp);
    };
  }, [fabricCanvas, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp]);

  // Nach View-Wechsel / Resize: Fabric-Offset neu berechnen (sonst Klicks greifen ins Leere)
  useEffect(() => {
    if (!fabricCanvas || !canvasWrapRef.current) return;
    const wrap = canvasWrapRef.current;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 50 || h < 50) return;
    const size = getPlacementCanvasSize(Math.min(w, h));
    try {
      if (fabricCanvas.getWidth() !== size || fabricCanvas.getHeight() !== size) {
        fabricCanvas.setDimensions({ width: size, height: size });
      }
      fabricCanvas.calcOffset?.();
      fabricCanvas.requestRenderAll?.();
    } catch {
      /* ignore */
    }
  }, [fabricCanvas, currentView, viewImages, selectedProductId]);

  useEffect(() => {
    if (!fabricCanvas || !canvasWrapRef.current) return;
    const onResize = () => {
      const wrap = canvasWrapRef.current;
      if (!wrap) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 50 || h < 50) return;
      const size = getPlacementCanvasSize(Math.min(w, h));
      try {
        if (fabricCanvas.getWidth() !== size || fabricCanvas.getHeight() !== size) {
          fabricCanvas.setDimensions({ width: size, height: size });
        }
        fabricCanvas.calcOffset?.();
        fabricCanvas.requestRenderAll?.();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fabricCanvas]);

  // Delete selected zone
  const handleDeleteZone = (view: ViewType, index: number) => {
    const updatedZones = zones[view].filter((_, i) => i !== index);
    setZones((prev) => ({
      ...prev,
      [view]: updatedZones,
    }));
    toast.success("Zone gelöscht!");
  };

  // Save zones to WooCommerce
  const handleSave = async () => {
    if (!selectedProductId) {
      toast.error("Bitte wähle ein Produkt aus");
      return;
    }

    try {
      // Ensure all views are included, even if empty
      const zonesData = {
        front: zones.front || [],
        back: zones.back || [],
        left: zones.left || [],
        right: zones.right || [],
      };

      // Debug: Log zones being saved

      // Get current product meta_data
      const productResponse = await fetch(
        `${WOOCOMMERCE_CONFIG.baseUrl}/products/${selectedProductId}`,
        {
          method: "GET",
          headers: {
            Authorization: getWooCommerceAuthHeader(),
            "Content-Type": "application/json",
          },
        }
      );

      if (!productResponse.ok) {
        throw new Error("Failed to fetch product");
      }

      const productData = await productResponse.json();

      // Update or add placement zones meta_data
      const existingMeta = productData.meta_data || [];
      const zonesMetaIndex = existingMeta.findIndex(
        (meta: any) => meta.key === "design_placement_zones" || meta.key === "_design_placement_zones"
      );

      const zonesMeta = {
        key: "design_placement_zones",
        value: JSON.stringify(zonesData),
      };

      if (zonesMetaIndex >= 0) {
        existingMeta[zonesMetaIndex] = zonesMeta;
      } else {
        existingMeta.push(zonesMeta);
      }

      // Update product
      const updateResponse = await fetch(
        `${WOOCOMMERCE_CONFIG.baseUrl}/products/${selectedProductId}`,
        {
          method: "PUT",
          headers: {
            Authorization: getWooCommerceAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meta_data: existingMeta,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to save: ${errorText}`);
      }

      const savedData = await updateResponse.json();
      const savedZonesMeta = savedData.meta_data?.find((m: any) => m.key === "design_placement_zones");
      
      if (savedZonesMeta?.value) {
        try {
          const parsedSavedZones = typeof savedZonesMeta.value === 'string' 
            ? JSON.parse(savedZonesMeta.value) 
            : savedZonesMeta.value;
        } catch (e) {
        }
      }

      // Invalidate queries to force refetch of product data
      if (selectedProductId) {
        const productIdNum = Number(selectedProductId);
        queryClient.invalidateQueries({ queryKey: ['product', productIdNum] });
        queryClient.invalidateQueries({ queryKey: ['woocommerce-product', productIdNum] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }

      toast.success("Placement Zones gespeichert!");
    } catch (error: any) {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    }
  };

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    navigate(`/admin/placement-zones/${productId}`);
  };

  // Show login dialog if not authenticated
  if (!isAuthenticatedState) {
    return (
      <Layout>
        <div className="container-wide py-8">
          <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Placement Zones Zugriff
                </DialogTitle>
                <DialogDescription>
                  Bitte geben Sie das Passwort ein, um auf die Placement Zones Konfiguration zuzugreifen.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError("");
                    }}
                    placeholder="Passwort eingeben..."
                    className="mt-2"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleLogin();
                      }
                    }}
                  />
                  {loginError && (
                    <p className="text-sm text-destructive mt-2">{loginError}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg">
                  <Lock className="w-4 h-4 mr-2" />
                  Anmelden
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-wide py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/produkte")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zu Produkten
          </Button>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-2">
            Placement Zones Konfiguration
          </h1>
          <p className="text-muted-foreground">
            Zeichne Bereiche auf dem Produktbild, in denen Designs platziert werden können
          </p>
        </div>

        {/* Product Selection with Search */}
        <div className="glass-card p-6 mb-6">
          <Label htmlFor="product-search" className="mb-2 block">
            Produkt auswählen
          </Label>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              id="product-search"
              type="text"
              placeholder="Produkt suchen (Name oder ID)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto border rounded-lg">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>Keine Produkte gefunden</p>
                {searchQuery && (
                  <p className="text-sm mt-2">Versuche einen anderen Suchbegriff</p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductSelect(product.id.toString())}
                    className={`w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left ${
                      selectedProductId === product.id.toString() 
                        ? 'bg-primary/10 border-l-4 border-l-primary' 
                        : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Shirt className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {product.id}
                      </p>
                    </div>
                    {selectedProductId === product.id.toString() && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              {filteredProducts.length} Produkt{filteredProducts.length !== 1 ? 'e' : ''} gefunden
            </p>
          )}
        </div>

        {product && (
          <>
            {/* Variation/Color Selector */}
            {availableColors.length > 0 && (
              <div className="glass-card p-6 mb-6">
                <Label htmlFor="color-select" className="mb-2 block">
                  Variante auswählen (für alle Varianten gültig)
                </Label>
                <Select
                  value={selectedColor || "default"}
                  onValueChange={(value) => {
                    setSelectedColor(value === "default" ? "" : value);
                    // Reset to front view when color changes
                    setCurrentView("front");
                  }}
                >
                  <SelectTrigger id="color-select" className="w-full">
                    <SelectValue placeholder="Variante wählen (optional - für Bildreferenz)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Standard (Produktbild)</SelectItem>
                    {availableColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Wähle eine Variante, um deren Bilder als Referenz für die Zonen zu verwenden. Die Zonen gelten für alle Varianten.
                </p>
              </div>
            )}

            {/* View Selector */}
            <div className="mb-4 flex gap-2 flex-wrap">
              {(["front", "back", "left", "right"] as ViewType[]).map((view) => (
                <Button
                  key={view}
                  variant={currentView === view ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView(view)}
                  className="rounded-full"
                >
                  <Shirt className="w-4 h-4 mr-2" />
                  {viewLabels[view]}
                  {zones[view].length > 0 && (
                    <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                      {zones[view].length}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Canvas Area */}
              <div className="lg:col-span-2">
                <div className="glass-card p-6">
                  <h3 className="font-bold mb-4">
                    {viewLabels[currentView]} - Klicke und ziehe, um eine Zone zu erstellen
                  </h3>
                  <div
                    ref={containerRef}
                    className="relative bg-muted/30 rounded-3xl p-4 flex items-center justify-center"
                  >
                    {/* Kein key hier – sonst wird das Canvas bei View-Wechsel neu gemountet, Fabric hängt am alten DOM → Klicks tun nichts */}
                    <div 
                      ref={canvasWrapRef}
                      className="placement-zones-fabric-wrap relative w-full aspect-square mx-auto"
                      style={{
                        maxWidth: PLACEMENT_ZONE_CANVAS_SIZE,
                        backgroundImage: `url(${viewImages[currentView] || product?.image || ''})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 cursor-crosshair w-full h-full block"
                        style={{ touchAction: "none", pointerEvents: "auto" }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    💡 Tipp: Klicke und ziehe auf dem Bild, um eine Zone zu erstellen. Du kannst
                    bestehende Zonen verschieben und in der Größe anpassen.
                  </p>
                </div>
              </div>

              {/* Zones List */}
              <div className="space-y-4">
                <div className="glass-card p-6">
                  <h3 className="font-bold mb-4">
                    Zonen für {viewLabels[currentView]}
                  </h3>
                  
                  {/* Zone Name Editor - shown when a zone is selected */}
                  {selectedZoneIndex !== null && zones[currentView][selectedZoneIndex] && (
                    <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <Label htmlFor="zone-name" className="text-sm font-semibold mb-2 block">
                        Zone-Name bearbeiten
                      </Label>
                      <Input
                        id="zone-name"
                        value={zones[currentView][selectedZoneIndex].name}
                        onChange={(e) => {
                          const updatedZones = [...zones[currentView]];
                          updatedZones[selectedZoneIndex] = {
                            ...updatedZones[selectedZoneIndex],
                            name: e.target.value,
                          };
                          setZones((prev) => ({
                            ...prev,
                            [currentView]: updatedZones,
                          }));
                          
                          // Update label on canvas
                          if (fabricCanvas) {
                            const label = fabricCanvas.getObjects().find(
                              (obj: any) => obj.name === `zone-label-${currentView}-${selectedZoneIndex}`
                            ) as FabricText;
                            if (label) {
                              label.set({ text: e.target.value });
                              fabricCanvas.renderAll();
                            }
                          }
                        }}
                        placeholder="Zone-Name eingeben..."
                        className="mb-2"
                      />
                      <p className="text-xs text-muted-foreground mb-3">
                        Klicke auf eine Zone im Bild, um sie auszuwählen und den Namen zu bearbeiten.
                      </p>
                      {/* MM-Maße: Breite in mm; Höhe automatisch aus Zonen-Aspect oder eigenes Höhenmaß */}
                      <div className="space-y-3 pt-2 border-t border-border">
                        <Label className="text-sm font-semibold">Reale Maße (mm)</Label>
                        <p className="text-xs text-muted-foreground">
                          Nur Breite nötig – Höhe wird aus dem Seitenverhältnis der Zone berechnet. Mit Haken: Breite und Höhe frei wählbar.
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="zone-width-mm" className="text-xs">Breite (mm)</Label>
                            <Input
                              id="zone-width-mm"
                              type="number"
                              min={0}
                              step={0.1}
                              placeholder="z. B. 280"
                              value={zones[currentView][selectedZoneIndex].widthMm ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                const updatedZones = [...zones[currentView]];
                                const z = { ...updatedZones[selectedZoneIndex] };
                                z.widthMm = v != null && !Number.isNaN(v) ? v : undefined;
                                if (!z.customMmSize && z.widthMm != null && z.width > 0) {
                                  z.heightMm = Math.round(((z.widthMm * z.height) / z.width) * 10) / 10;
                                }
                                updatedZones[selectedZoneIndex] = z;
                                setZones((prev) => ({ ...prev, [currentView]: updatedZones }));
                              }}
                              className="w-28"
                            />
                          </div>
                          <div className="flex items-center gap-2 pb-2">
                            <Checkbox
                              id="zone-custom-mm"
                              checked={!!zones[currentView][selectedZoneIndex].customMmSize}
                              onCheckedChange={(checked) => {
                                const updatedZones = [...zones[currentView]];
                                const z = { ...updatedZones[selectedZoneIndex] };
                                z.customMmSize = !!checked;
                                if (!z.customMmSize && z.widthMm != null && z.width > 0) {
                                  z.heightMm = Math.round(((z.widthMm * z.height) / z.width) * 10) / 10;
                                }
                                updatedZones[selectedZoneIndex] = z;
                                setZones((prev) => ({ ...prev, [currentView]: updatedZones }));
                              }}
                            />
                            <Label htmlFor="zone-custom-mm" className="text-xs cursor-pointer">
                              Eigenes Höhenmaß
                            </Label>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="zone-height-mm" className="text-xs">
                              Höhe (mm){!zones[currentView][selectedZoneIndex].customMmSize && zones[currentView][selectedZoneIndex].widthMm != null && (
                                <span className="text-muted-foreground font-normal"> – automatisch</span>
                              )}
                            </Label>
                            <Input
                              id="zone-height-mm"
                              type="number"
                              min={0}
                              step={0.1}
                              placeholder="auto"
                              disabled={!zones[currentView][selectedZoneIndex].customMmSize}
                              value={
                                zones[currentView][selectedZoneIndex].customMmSize
                                  ? (zones[currentView][selectedZoneIndex].heightMm ?? "")
                                  : (effectiveZoneHeightMm(zones[currentView][selectedZoneIndex]) ?? "")
                              }
                              onChange={(e) => {
                                if (!zones[currentView][selectedZoneIndex].customMmSize) return;
                                const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                const updatedZones = [...zones[currentView]];
                                updatedZones[selectedZoneIndex] = {
                                  ...updatedZones[selectedZoneIndex],
                                  heightMm: v != null && !Number.isNaN(v) ? v : undefined,
                                };
                                setZones((prev) => ({ ...prev, [currentView]: updatedZones }));
                              }}
                              className="w-28"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {zones[currentView].length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Zonen erstellt. Zeichne eine Zone auf dem Bild.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {zones[currentView].map((zone, index) => (
                        <div
                          key={zone.id}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                            selectedZoneIndex === index
                              ? 'bg-primary/20 border-2 border-primary'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                          onClick={() => {
                            // Select zone on canvas
                            if (fabricCanvas) {
                              const rect = fabricCanvas.getObjects().find(
                                (obj: any) => obj.name === `zone-${currentView}-${index}`
                              );
                              if (rect) {
                                fabricCanvas.setActiveObject(rect);
                                fabricCanvas.renderAll();
                                setSelectedZoneIndex(index);
                              }
                            }
                          }}
                        >
                          <div className="flex-1">
                            <p className="font-semibold">{zone.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.round(zone.x * 100)}%, {Math.round(zone.y * 100)}% -{" "}
                              {Math.round(zone.width * 100)}% × {Math.round(zone.height * 100)}%
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteZone(currentView, index);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleSave}
                  disabled={!selectedProductId}
                >
                  <Save className="w-5 h-5 mr-2" />
                  Zones speichern
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminPlacementZones;

