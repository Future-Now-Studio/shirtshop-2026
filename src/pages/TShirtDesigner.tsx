import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, FabricImage, FabricText } from "fabric";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import tshirtWhite from "@/assets/tshirt-mockup-white.png";
import tshirtBlack from "@/assets/tshirt-mockup-black.png";

const shirtColors = [
  { name: "Weiß", value: "#FFFFFF", image: tshirtWhite },
  { name: "Schwarz", value: "#1a1a1a", image: tshirtBlack },
];

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

const TShirtDesigner = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedShirt, setSelectedShirt] = useState(shirtColors[0]);
  const [selectedSize, setSelectedSize] = useState("M");
  const [textInput, setTextInput] = useState("");
  const [hasDesign, setHasDesign] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

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

    // Track changes
    const updateHasDesign = () => {
      const objects = canvas.getObjects();
      setHasDesign(objects.length > 0);
    };

    canvas.on("object:added", updateHasDesign);
    canvas.on("object:removed", updateHasDesign);

    return () => {
      canvas.dispose();
    };
  }, []);

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
      fontFamily: "Outfit",
      fill: selectedShirt.value === "#FFFFFF" ? "#1a1a1a" : "#FFFFFF",
      fontWeight: "bold",
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    setTextInput("");
    toast.success("Text hinzugefügt!");
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
    setHasDesign(false);
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
    if (!ctx) return;

    const shirtImg = new Image();
    shirtImg.crossOrigin = "anonymous";
    shirtImg.onload = () => {
      ctx.drawImage(shirtImg, 0, 0, 800, 800);

      // Draw fabric canvas design
      const designDataUrl = fabricCanvas.toDataURL({
        format: "png",
        multiplier: 800 / fabricCanvas.getWidth(),
      });

      const designImg = new Image();
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

    // Generate preview image
    let previewImage = selectedShirt.image;
    if (fabricCanvas && hasDesign) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 400;
      tempCanvas.height = 400;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        const shirtImg = new Image();
        shirtImg.crossOrigin = "anonymous";
        shirtImg.onload = () => {
          ctx.drawImage(shirtImg, 0, 0, 400, 400);
          const designDataUrl = fabricCanvas.toDataURL({
            format: "png",
            multiplier: 400 / fabricCanvas.getWidth(),
          });
          const designImg = new Image();
          designImg.onload = () => {
            ctx.drawImage(designImg, 0, 0, 400, 400);
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
            });

            toast.success("Dein Design wurde zum Warenkorb hinzugefügt!");
          };
          designImg.src = designDataUrl;
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
            T-Shirt <span className="text-secondary">Designer</span>
          </h1>
          <p className="text-muted-foreground">
            Lade dein eigenes Design hoch und platziere es auf dem T-Shirt
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Canvas Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div
              ref={containerRef}
              className="relative bg-muted/30 rounded-3xl p-4 sm:p-8 flex items-center justify-center"
            >
              {/* T-Shirt Background */}
              <div className="relative w-full max-w-[500px] aspect-square">
                <img
                  src={selectedShirt.image}
                  alt="T-Shirt"
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

            {/* Shirt Color */}
            <div className="glass-card p-6">
              <h3 className="font-bold mb-4">T-Shirt Farbe</h3>
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
                {hasDesign && (
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
