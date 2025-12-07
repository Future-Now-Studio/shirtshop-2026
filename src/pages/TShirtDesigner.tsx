import { useEffect, useRef, useState, useCallback } from "react";
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
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { useProduct } from "@/hooks/useProducts";
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

const TShirtDesigner = () => {
  const [searchParams] = useSearchParams();
  const productImage = searchParams.get("productImage");
  const productId = searchParams.get("productId");
  
  // Fetch product data to get placement zones
  const { data: product } = useProduct(productId ? Number(productId) : 0);
  const placementZones = product?.placementZones;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const zoneObjectsRef = useRef<any[]>([]); // Store zone rectangle objects
  const [selectedShirt, setSelectedShirt] = useState(
    productImage 
      ? { name: "Produkt", value: "#FFFFFF", image: productImage }
      : shirtColors[0]
  );
  const [selectedSize, setSelectedSize] = useState("M");
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
      const json = JSON.stringify(fabricCanvas.toJSON(['data']));
      setViewData(prev => ({
        ...prev,
        [currentView]: json,
      }));
    } catch (error) {
      console.error('Error saving view data:', error);
    }
  }, [fabricCanvas, currentView]);

  // Load view data when switching views
  const loadView = useCallback((view: ViewType) => {
    if (!fabricCanvas) return;
    
    // Save current view before switching
    saveCurrentView();
    
    // Clear canvas
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "transparent";
    
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
  }, [fabricCanvas, viewData, saveCurrentView]);

  // Render placement zones on canvas
  const renderZones = useCallback((canvas: FabricCanvas, zones: PlacementZone[] | undefined) => {
    if (!zones || zones.length === 0) return;

    // Remove existing zones
    zoneObjectsRef.current.forEach(zoneObj => {
      canvas.remove(zoneObj);
    });
    zoneObjectsRef.current = [];

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    zones.forEach((zone) => {
      const rect = new Rect({
        left: zone.x * canvasWidth,
        top: zone.y * canvasHeight,
        width: zone.width * canvasWidth,
        height: zone.height * canvasHeight,
        fill: 'rgba(59, 130, 246, 0.1)', // Blue with transparency
        stroke: 'rgba(59, 130, 246, 0.5)',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true, // Don't include zones in exported images
        name: `zone-${zone.id}`,
      });

      // Add zone label
      const label = new FabricText(zone.name, {
        left: zone.x * canvasWidth + 5,
        top: zone.y * canvasHeight + 5,
        fontSize: 12,
        fill: 'rgba(59, 130, 246, 0.8)',
        fontFamily: 'Outfit',
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });

      canvas.add(rect);
      canvas.add(label);
      zoneObjectsRef.current.push(rect, label);
    });

    // Send zones to back so design elements appear on top
    zoneObjectsRef.current.forEach(zoneObj => {
      canvas.sendToBack(zoneObj);
    });

    canvas.renderAll();
  }, []);

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

  // Constrain object movement to zones
  const constrainToZones = useCallback((obj: any, zones: PlacementZone[] | undefined) => {
    if (!zones || zones.length === 0) return; // No zones = no constraint

    if (!fabricCanvas) return;
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Get object center
    const centerX = obj.left || 0;
    const centerY = obj.top || 0;

    // Check if center is in any zone
    const inZone = zones.some(zone => {
      const zoneLeft = zone.x * canvasWidth;
      const zoneTop = zone.y * canvasHeight;
      const zoneRight = zoneLeft + (zone.width * canvasWidth);
      const zoneBottom = zoneTop + (zone.height * canvasHeight);

      return centerX >= zoneLeft && centerX <= zoneRight && 
             centerY >= zoneTop && centerY <= zoneBottom;
    });

    if (!inZone) {
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
        const zoneCenterX = zoneLeft + (nearestZone.width * canvasWidth) / 2;
        const zoneCenterY = zoneTop + (nearestZone.height * canvasHeight) / 2;

        // Constrain to zone bounds
        const objWidth = (obj.width || 0) * (obj.scaleX || 1);
        const objHeight = (obj.height || 0) * (obj.scaleY || 1);
        
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
        fabricCanvas.renderAll();
      }
    }
  }, [fabricCanvas]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const canvasSize = Math.min(containerWidth, 500);

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasSize,
      height: canvasSize,
      backgroundColor: "transparent",
      selection: true,
      preserveObjectStacking: true,
    });

    setFabricCanvas(canvas);

    // Track changes and save to current view
    const updateViewData = () => {
      try {
        const json = JSON.stringify(canvas.toJSON(['data']));
        setViewData(prev => ({
          ...prev,
          [currentView]: json,
        }));
      } catch (error) {
        console.error('Error updating view data:', error);
      }
    };

    canvas.on("object:added", updateViewData);
    canvas.on("object:removed", updateViewData);
    canvas.on("object:modified", updateViewData);
    canvas.on("path:created", updateViewData);

    return () => {
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
      constrainToZones(obj, currentZones);
    };

    const handleObjectModified = (e: any) => {
      const obj = e.target;
      if (!obj) return;
      const currentZones = placementZones[currentView];
      constrainToZones(obj, currentZones);
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
        const json = JSON.stringify(fabricCanvas.toJSON(['data']));
        setViewData(prev => ({
          ...prev,
          [prevView]: json,
        }));
      } catch (error) {
        console.error('Error saving previous view:', error);
      }
    }
    
    // Load new view
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "transparent";
    
    const viewJson = viewData[currentView];
    if (viewJson) {
      try {
        fabricCanvas.loadFromJSON(viewJson, () => {
          // Render zones after loading view data
          const currentZones = placementZones?.[currentView];
          renderZones(fabricCanvas, currentZones);
        });
      } catch (error) {
        console.error('Error loading view data:', error);
        // Still render zones even if view data fails to load
        const currentZones = placementZones?.[currentView];
        renderZones(fabricCanvas, currentZones);
      }
    } else {
      // Render zones for new view
      const currentZones = placementZones?.[currentView];
      renderZones(fabricCanvas, currentZones);
    }
  }, [currentView, fabricCanvas, placementZones, renderZones, viewData]);

  // Render zones when placementZones are loaded
  useEffect(() => {
    if (!fabricCanvas || !placementZones) return;
    const currentZones = placementZones[currentView];
    renderZones(fabricCanvas, currentZones);
  }, [fabricCanvas, placementZones, currentView, renderZones]);

  // Update selected product when URL parameter changes
  useEffect(() => {
    if (productImage) {
      setSelectedShirt({ name: "Produkt", value: "#FFFFFF", image: productImage });
    }
  }, [productImage]);

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
      const canvasSize = Math.min(containerWidth, 500);
      fabricCanvas.setDimensions({ width: canvasSize, height: canvasSize });
      fabricCanvas.renderAll();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fabricCanvas]);

  // Handle image upload
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !fabricCanvas) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const imgUrl = event.target?.result as string;

        try {
          const img = await FabricImage.fromURL(imgUrl);
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
          });

          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          
          // Constrain to zones after adding
          const currentZones = placementZones?.[currentView];
          if (currentZones && currentZones.length > 0) {
            constrainToZones(img, currentZones);
          }
          
          fabricCanvas.renderAll();
          toast.success("Bild hinzugefügt!");
        } catch (error) {
          toast.error("Fehler beim Laden des Bildes");
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [fabricCanvas]
  );

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
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    
    // Constrain to zones after adding
    const currentZones = placementZones?.[currentView];
    if (currentZones && currentZones.length > 0) {
      constrainToZones(text, currentZones);
    }
    
    fabricCanvas.renderAll();
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

    fabricCanvas.on("selection:created", updateFormattingButtons);
    fabricCanvas.on("selection:updated", updateFormattingButtons);
    fabricCanvas.on("selection:cleared", updateFormattingButtons);

    return () => {
      fabricCanvas.off("selection:created", updateFormattingButtons);
      fabricCanvas.off("selection:updated", updateFormattingButtons);
      fabricCanvas.off("selection:cleared", updateFormattingButtons);
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
      toast.success("Element gelöscht");
    }
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

  // Download design
  const handleDownload = () => {
    if (!fabricCanvas) return;

    // Create a temporary canvas with shirt + design
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 800;
    tempCanvas.height = 800;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) {
      toast.error("Fehler beim Erstellen des Canvas");
      return;
    }

    const shirtImg = new Image();
    shirtImg.crossOrigin = "anonymous";
    
    shirtImg.onerror = () => {
      toast.error("Fehler beim Laden des Produktbildes");
    };

    shirtImg.onload = () => {
      ctx.drawImage(shirtImg, 0, 0, 800, 800);

      // Draw current fabric canvas design
      const designDataUrl = fabricCanvas.toDataURL({
        format: "png",
        multiplier: 800 / fabricCanvas.getWidth(),
      });

      const designImg = new Image();
      designImg.onerror = () => {
        toast.error("Fehler beim Laden des Designs");
      };
      
      designImg.onload = () => {
        ctx.drawImage(designImg, 0, 0, 800, 800);

        const link = document.createElement("a");
        link.download = "mein-design.png";
        link.href = tempCanvas.toDataURL("image/png");
        link.click();
        toast.success("Design heruntergeladen!");
      };
      designImg.src = designDataUrl;
    };
    
    shirtImg.src = selectedShirt.image;
  };

  // Add to cart
  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error("Bitte wähle eine Größe");
      return;
    }

    // Save current view before processing
    if (fabricCanvas) {
      try {
        const json = JSON.stringify(fabricCanvas.toJSON(['data']));
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

      // Create a combined preview image showing all views
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 800;
      tempCanvas.height = 800;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        const shirtImg = new Image();
        shirtImg.crossOrigin = "anonymous";
        shirtImg.onload = async () => {
          // Draw shirt base
          ctx.drawImage(shirtImg, 0, 0, 800, 800);
          
          // Draw designs from all views
          const views: ViewType[] = ["front", "back", "left", "right"];
          for (const view of views) {
            const viewJson = viewData[view];
            if (viewJson) {
              try {
                // Create a temporary canvas for this view
                const viewCanvas = document.createElement("canvas");
                viewCanvas.width = 400;
                viewCanvas.height = 400;
                const viewCtx = viewCanvas.getContext("2d");
                if (viewCtx) {
                  // Load fabric canvas with this view's data
                  const tempFabricCanvas = new FabricCanvas(viewCanvas, {
                    width: 400,
                    height: 400,
                    backgroundColor: "transparent",
                  });
                  
                  await new Promise<void>((resolve) => {
                    tempFabricCanvas.loadFromJSON(viewJson, () => {
                      const designDataUrl = tempFabricCanvas.toDataURL({
                        format: "png",
                      });
                      const designImg = new Image();
                      designImg.onload = () => {
                        // Position designs based on view
                        // For simplicity, overlay all on center (you can adjust positioning)
                        ctx.drawImage(designImg, 0, 0, 800, 800);
                        tempFabricCanvas.dispose();
                        resolve();
                      };
                      designImg.src = designDataUrl;
                    });
                  });
                }
              } catch (error) {
                console.error(`Error rendering ${view} view:`, error);
              }
            }
          }
          
          previewImage = tempCanvas.toDataURL("image/png");

          addItem({
            productId: 999,
            name: "Custom T-Shirt",
            price: 24.95,
            image: selectedShirt.image,
            color: selectedShirt.name,
            size: selectedSize,
            quantity: 1,
            customDesign: previewImage,
            customDesignRaw: rawDesignData,
            designElementCount: totalDesignElementCount,
          });

          toast.success(`Dein Design wurde zum Warenkorb hinzugefügt! (${totalDesignElementCount} Element${totalDesignElementCount !== 1 ? 'e' : ''})`);
        };
        shirtImg.src = selectedShirt.image;
      }
    } else {
      addItem({
        productId: 999,
        name: "Custom T-Shirt",
        price: 24.95,
        image: selectedShirt.image,
        color: selectedShirt.name,
        size: selectedSize,
        quantity: 1,
      });
      toast.success("Zum Warenkorb hinzugefügt!");
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Canvas Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            {/* View Selector */}
            <div className="mb-4 flex gap-2 flex-wrap justify-center">
              {(["front", "back", "left", "right"] as ViewType[]).map((view) => (
                <Button
                  key={view}
                  variant={currentView === view ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => loadView(view)}
                  className="rounded-full"
                >
                  <Shirt className="w-4 h-4 mr-2" />
                  {viewLabels[view]}
                  {viewData[view] && (
                    <span className="ml-2 w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
              ))}
            </div>

            <div
              ref={containerRef}
              className="relative bg-muted/30 rounded-3xl p-4 sm:p-8 flex items-center justify-center"
            >
              {/* Product Background */}
              <div className="relative w-full max-w-[500px] aspect-square">
                <img
                  src={selectedShirt.image}
                  alt="Produkt"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
                {/* Canvas overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="cursor-move"
                    style={{ touchAction: "none" }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Tools */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScaleUp}
                disabled={!fabricCanvas?.getActiveObject()}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScaleDown}
                disabled={!fabricCanvas?.getActiveObject()}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFlipHorizontal}
                disabled={!fabricCanvas?.getActiveObject()}
              >
                <FlipHorizontal className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFlipVertical}
                disabled={!fabricCanvas?.getActiveObject()}
              >
                <FlipVertical className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={!fabricCanvas?.getActiveObject()}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <RotateCcw className="w-4 h-4" />
                Zurücksetzen
              </Button>
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Upload */}
            <div className="glass-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Design hochladen
              </h3>
              <label className="block">
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Klicke oder ziehe ein Bild hierher
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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
            </div>

            {/* Add Text */}
            <div className="glass-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Type className="w-5 h-5 text-primary" />
                Text hinzufügen
              </h3>
              
              {/* Font Selection */}
              <div className="mb-3">
                <label className="text-sm text-muted-foreground mb-2 block">Schriftart</label>
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
            </div>

            {/* Shirt Color - Only show if no product image is provided */}
            {!productImage && (
              <div className="glass-card p-6">
                <h3 className="font-bold mb-4">Produkt Farbe</h3>
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

            {/* Size */}
            <div className="glass-card p-6">
              <h3 className="font-bold mb-4">Größe</h3>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 rounded-xl border-2 font-semibold transition-all ${
                      selectedSize === size
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Price & Actions */}
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted-foreground">Preis</span>
                <span className="text-3xl font-bold text-primary">24,95 €</span>
              </div>
              <div className="space-y-3">
                <Button size="lg" className="w-full" onClick={handleAddToCart}>
                  <ShoppingBag className="w-5 h-5" />
                  In den Warenkorb
                </Button>
                {Object.values(viewData).some(v => v !== null) && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={handleDownload}
                  >
                    <Download className="w-5 h-5" />
                    Design herunterladen
                  </Button>
                )}
              </div>
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
    </Layout>
  );
};

export default TShirtDesigner;
