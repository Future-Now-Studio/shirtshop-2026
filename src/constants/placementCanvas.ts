/**
 * Einheitliche Canvas-Größe für Placement Zones: Admin-Editor und Creator müssen
 * dieselbe interne Fabric-Größe und denselben Hintergrund-Rahmen nutzen, sonst
 * liegen Zonen (0–1 relativ) visuell verschoben.
 */
export const PLACEMENT_ZONE_CANVAS_SIZE = 800;

/** Sichere Canvas-Seitenlänge aus Container – nie größer als PLACEMENT_ZONE_CANVAS_SIZE */
export function getPlacementCanvasSize(containerWidth: number): number {
  const w = Number.isFinite(containerWidth) ? containerWidth : PLACEMENT_ZONE_CANVAS_SIZE;
  const floored = Math.floor(w);
  // Noch nicht gelayoutet (<100px): feste Größe wie im Admin, sonst Zonen-Sprung beim ersten Resize
  if (floored < 100) return PLACEMENT_ZONE_CANVAS_SIZE;
  return Math.min(PLACEMENT_ZONE_CANVAS_SIZE, floored);
}
