# Placement Zones Setup Guide

## Overview
Placement zones define specific areas on products where users can place their custom designs (text, images, etc.). Zones are stored in WooCommerce product meta_data, making them easy to copy between products.

## 🎨 Visual Admin Interface (Recommended)

The easiest way to configure placement zones is using the visual admin interface:

1. Navigate to `/admin/placement-zones` in your browser
2. Select a product from the dropdown
3. Choose the view (Front, Back, Left, Right) using the buttons
4. **Click and drag** on the product image to create a zone rectangle
5. Enter a name for the zone when prompted (e.g., "Brustbereich", "Rückenmitte")
6. **Adjust existing zones** by clicking and dragging them, or resize using the corner handles
7. **Delete zones** using the trash icon in the zones list
8. Click **"Zones speichern"** to save to WooCommerce

The visual interface automatically:
- Calculates relative coordinates (0-1) from your drawn rectangles
- Saves zones to the product's `design_placement_zones` meta_data
- Supports all four views (front, back, left, right)
- Shows zone names and positions in the sidebar

### Tips:
- Draw zones that match the printable areas on your products
- You can have multiple zones per view (e.g., left chest, right chest, center)
- Zones are automatically constrained - users can only place designs within them
- Zones are saved per product, so you can copy the meta_data between similar products

## Zone Configuration Format

Zones are stored in WooCommerce product meta_data with the key: `design_placement_zones`

### JSON Structure:
```json
{
  "front": [
    {
      "id": "chest",
      "name": "Brustbereich",
      "x": 0.25,
      "y": 0.3,
      "width": 0.5,
      "height": 0.4
    },
    {
      "id": "left-chest",
      "name": "Linke Brust",
      "x": 0.1,
      "y": 0.25,
      "width": 0.2,
      "height": 0.15
    }
  ],
  "back": [
    {
      "id": "back-center",
      "name": "Rückenmitte",
      "x": 0.25,
      "y": 0.2,
      "width": 0.5,
      "height": 0.5
    }
  ],
  "left": [],
  "right": []
}
```

### Zone Properties:
- **id**: Unique identifier for the zone (e.g., "chest", "back-center")
- **name**: Display name shown on the canvas (e.g., "Brustbereich")
- **x**: Horizontal position (0-1, where 0 = left edge, 1 = right edge)
- **y**: Vertical position (0-1, where 0 = top edge, 1 = bottom edge)
- **width**: Zone width (0-1, as percentage of canvas width)
- **height**: Zone height (0-1, as percentage of canvas height)
- **minSize** (optional): Minimum element size in pixels
- **maxSize** (optional): Maximum element size in pixels

## How to Add Zones in WooCommerce

### Method 1: Using Custom Fields Plugin
1. Install a custom fields plugin (e.g., Advanced Custom Fields, Custom Fields Suite)
2. Go to Products → Edit Product
3. Add a custom field with key: `design_placement_zones`
4. Set value type to "Textarea" or "JSON"
5. Paste the JSON structure above

### Method 2: Using WooCommerce Meta Data Directly
1. Go to Products → Edit Product in WooCommerce admin
2. Scroll to "Product Data" → "Advanced" tab
3. Add custom field:
   - **Name**: `design_placement_zones`
   - **Value**: Paste the JSON structure

### Method 3: Using WooCommerce REST API
```json
{
  "meta_data": [
    {
      "key": "design_placement_zones",
      "value": "{\"front\":[{\"id\":\"chest\",\"name\":\"Brustbereich\",\"x\":0.25,\"y\":0.3,\"width\":0.5,\"height\":0.4}]}"
    }
  ]
}
```

## Copying Zones Between Products

Since zones are stored in meta_data, you can easily copy them:

1. **In WooCommerce Admin:**
   - Edit source product → Copy the meta_data value
   - Edit target product → Paste the value

2. **Using Export/Import:**
   - Export products with meta_data
   - Copy the `design_placement_zones` value
   - Import to new product

3. **Using REST API:**
   - GET product → Copy meta_data entry
   - POST/UPDATE to new product with same meta_data

## Zone Examples

### T-Shirt - Front Only
```json
{
  "front": [
    {
      "id": "chest",
      "name": "Brustbereich",
      "x": 0.25,
      "y": 0.3,
      "width": 0.5,
      "height": 0.4
    }
  ],
  "back": [],
  "left": [],
  "right": []
}
```

### T-Shirt - Front and Back
```json
{
  "front": [
    {
      "id": "chest",
      "name": "Brustbereich",
      "x": 0.25,
      "y": 0.3,
      "width": 0.5,
      "height": 0.4
    }
  ],
  "back": [
    {
      "id": "back-center",
      "name": "Rückenmitte",
      "x": 0.2,
      "y": 0.2,
      "width": 0.6,
      "height": 0.5
    }
  ],
  "left": [],
  "right": []
}
```

### Multiple Zones Per View
```json
{
  "front": [
    {
      "id": "left-chest",
      "name": "Linke Brust",
      "x": 0.1,
      "y": 0.25,
      "width": 0.2,
      "height": 0.15
    },
    {
      "id": "right-chest",
      "name": "Rechte Brust",
      "x": 0.7,
      "y": 0.25,
      "width": 0.2,
      "height": 0.15
    },
    {
      "id": "center-chest",
      "name": "Brustmitte",
      "x": 0.3,
      "y": 0.3,
      "width": 0.4,
      "height": 0.3
    }
  ],
  "back": [],
  "left": [],
  "right": []
}
```

## Notes

- Zones are **optional** - if no zones are defined, users can place designs anywhere
- Zones are **per-view** - you can define different zones for front, back, left, and right
- Coordinates are **relative** (0-1) so they work with any canvas size
- Zones are **visual guides** - shown as semi-transparent blue rectangles on the canvas
- Objects are **automatically constrained** to stay within zones when moved
- Zones are **not exported** in the final design image

