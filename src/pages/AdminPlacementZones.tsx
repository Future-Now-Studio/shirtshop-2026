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
import { Save, Trash2, ArrowLeft, Shirt } from "lucide-react";
import { WOOCOMMERCE_CONFIG } from "@/lib/woocommerce";
import { useQueryClient } from "@tanstack/react-query";

type ViewType = "front" | "back" | "left" | "right";

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
          
          // Organize images by view type based on filename - use first matching image for each view
          matchingImages.forEach(img => {
            const name = img.name || img.src || '';
            // Check filename for view indicators: _F (front), _B (back), _SL (left), _SR (right)
            if ((name.includes('_F') || name.includes('-F')) && views.front === (product?.image || "")) {
              views.front = img.src;
            } else if ((name.includes('_B') || name.includes('-B')) && views.back === (product?.image || "")) {
              views.back = img.src;
            } else if ((name.includes('_SL') || name.includes('-SL')) && views.left === (product?.image || "")) {
              views.left = img.src;
            } else if ((name.includes('_SR') || name.includes('-SR')) && views.right === (product?.image || "")) {
              views.right = img.src;
            }
          });
        }
      }
    }

    return views;
  }, [selectedColor, wcProduct, product?.image]);

  // Update view images when color or view changes
  useEffect(() => {
    setViewImages(viewImagesForColor);
  }, [viewImagesForColor]);

  // Load zones from product
  useEffect(() => {
    if (product?.placementZones) {
      setZones({
        front: product.placementZones.front || [],
        back: product.placementZones.back || [],
        left: product.placementZones.left || [],
        right: product.placementZones.right || [],
      });
    } else {
      setZones({
        front: [],
        back: [],
        left: [],
        right: [],
      });
    }
  }, [product]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const currentImage = viewImages[currentView] || product?.image;
    if (!currentImage) return;

    const containerWidth = containerRef.current.offsetWidth;
    const canvasSize = Math.min(containerWidth, 600);

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasSize,
      height: canvasSize,
      backgroundColor: "transparent",
      selection: true,
    });

    // Load current view image as background
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Scale image to fit canvas
      const scale = Math.min(canvasSize / img.width, canvasSize / img.height);
      
      canvas.setBackgroundImage(
        currentImage,
        canvas.renderAll.bind(canvas),
        {
          scaleX: scale,
          scaleY: scale,
          originX: "left",
          originY: "top",
        }
      );
      canvas.renderAll();
    };
    img.src = currentImage;

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [viewImages, currentView, product?.image, product?.id]);

  // Render zones on canvas
  useEffect(() => {
    if (!fabricCanvas) return;

    // Clear existing zone rectangles
    const objectsToRemove = fabricCanvas.getObjects().filter(
      (obj: any) => obj.name?.startsWith("zone-")
    );
    objectsToRemove.forEach((obj) => fabricCanvas.remove(obj));

    // Add zones for current view
    const currentZones = zones[currentView];
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    currentZones.forEach((zone, index) => {
      const rect = new Rect({
        left: zone.x * canvasWidth,
        top: zone.y * canvasHeight,
        width: zone.width * canvasWidth,
        height: zone.height * canvasHeight,
        fill: "rgba(59, 130, 246, 0.2)",
        stroke: "rgba(59, 130, 246, 0.8)",
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: true,
        evented: true,
        name: `zone-${currentView}-${index}`,
        data: { view: currentView, index },
      });

      // Add label
      const label = new FabricText(zone.name, {
        left: zone.x * canvasWidth + 5,
        top: zone.y * canvasHeight + 5,
        fontSize: 14,
        fill: "rgba(59, 130, 246, 1)",
        fontFamily: "Outfit",
        fontWeight: "bold",
        selectable: false,
        evented: false,
        name: `zone-label-${currentView}-${index}`,
      });

      fabricCanvas.add(rect);
      fabricCanvas.add(label);

      // Make rect editable
      rect.on("modified", () => {
        const updatedZones = [...zones[currentView]];
        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        
        updatedZones[index] = {
          ...updatedZones[index],
          x: rect.left! / canvasWidth,
          y: rect.top! / canvasHeight,
          width: (rect.width! * rect.scaleX!) / canvasWidth,
          height: (rect.height! * rect.scaleY!) / canvasHeight,
        };
        setZones((prev) => ({
          ...prev,
          [currentView]: updatedZones,
        }));
      });
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, zones, currentView]);

  // Handle canvas click to start drawing
  const handleCanvasMouseDown = useCallback(
    (e: any) => {
      if (!fabricCanvas || isDrawing) return;
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
      });

      fabricCanvas.add(rect);
      setCurrentRect(rect);
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

    // Prompt for zone name
    const name = prompt("Zone Name (e.g., 'Brustbereich'):");
    if (!name) {
      fabricCanvas.remove(currentRect);
      fabricCanvas.renderAll();
      setCurrentRect(null);
      return;
    }

    // Convert to relative coordinates
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    const newZone: PlacementZone = {
      id: `zone-${Date.now()}`,
      name: name.trim(),
      x: currentRect.left! / canvasWidth,
      y: currentRect.top! / canvasHeight,
      width: currentRect.width! / canvasWidth,
      height: currentRect.height! / canvasHeight,
    };

    // Make it selectable and editable
    currentRect.set({
      selectable: true,
      evented: true,
      name: `zone-${currentView}-${zones[currentView].length}`,
      data: { view: currentView, index: zones[currentView].length },
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
      name: `zone-label-${currentView}-${zones[currentView].length}`,
    });

    fabricCanvas.add(label);

    // Update zones state
    setZones((prev) => ({
      ...prev,
      [currentView]: [...prev[currentView], newZone],
    }));

    setCurrentRect(null);
    toast.success("Zone hinzugefügt!");
  }, [fabricCanvas, isDrawing, currentRect, currentView, zones]);

  // Setup canvas event listeners
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.on("mouse:down", handleCanvasMouseDown);
    fabricCanvas.on("mouse:move", handleCanvasMouseMove);
    fabricCanvas.on("mouse:up", handleCanvasMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleCanvasMouseDown);
      fabricCanvas.off("mouse:move", handleCanvasMouseMove);
      fabricCanvas.off("mouse:up", handleCanvasMouseUp);
    };
  }, [fabricCanvas, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp]);

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
      console.log("Saving zones:", zonesData);
      console.log("Back zones count:", zonesData.back.length);

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
      console.log("Saved product meta_data:", savedZonesMeta);
      
      if (savedZonesMeta?.value) {
        try {
          const parsedSavedZones = typeof savedZonesMeta.value === 'string' 
            ? JSON.parse(savedZonesMeta.value) 
            : savedZonesMeta.value;
          console.log("Parsed saved zones:", parsedSavedZones);
          console.log("Back zones in saved data:", parsedSavedZones.back?.length || 0);
        } catch (e) {
          console.error("Error parsing saved zones:", e);
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
      console.error("Error saving zones:", error);
      toast.error(`Fehler beim Speichern: ${error.message}`);
    }
  };

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    navigate(`/admin/placement-zones/${productId}`);
  };

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

        {/* Product Selection */}
        <div className="glass-card p-6 mb-6">
          <Label htmlFor="product-select" className="mb-2 block">
            Produkt auswählen
          </Label>
          <Select
            value={selectedProductId}
            onValueChange={handleProductSelect}
          >
            <SelectTrigger id="product-select" className="w-full">
              <SelectValue placeholder="Produkt wählen..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id.toString()}>
                  {product.name} (ID: {product.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <div className="relative w-full max-w-[600px] aspect-square">
                      <img
                        src={viewImages[currentView] || product.image}
                        alt={`${product.name} - ${viewLabels[currentView]}`}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 cursor-crosshair"
                        style={{ touchAction: "none" }}
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
                  {zones[currentView].length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Zonen erstellt. Zeichne eine Zone auf dem Bild.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {zones[currentView].map((zone, index) => (
                        <div
                          key={zone.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-semibold">{zone.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.round(zone.x * 100)}%, {Math.round(zone.y * 100)}% -{" "}
                              {Math.round(zone.width * 100)}% × {Math.round(zone.height * 100)}%
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteZone(currentView, index)}
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

