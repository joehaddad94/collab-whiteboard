import type { Point } from "../types";

// The board is a fixed logical surface every client scales to fit, rather
// than each drawing in its own CSS pixels. Strokes and cursors are stored and
// sent in these units, so the same drawing lands in the same place for
// everyone - a different screen size changes how big it looks, never where.
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Fit, not stretch - one uniform scale for both axes keeps a circle round on
// any window shape. The leftover becomes an even margin on the two sides that
// don't match the aspect ratio.
export function getViewTransform(width: number, height: number): ViewTransform {
  const fitted = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  const scale = Number.isFinite(fitted) && fitted > 0 ? fitted : 0;
  return {
    scale,
    offsetX: (width - WORLD_WIDTH * scale) / 2,
    offsetY: (height - WORLD_HEIGHT * scale) / 2,
  };
}

// Captured coordinates are full floats and the trailing digits are noise -
// one decimal is finer than a tenth of a pixel at this board size, and it
// roughly halves what a stroke costs to stream and store.
const COORD_PRECISION = 10;

export function quantize(point: Point): Point {
  return {
    x: Math.round(point.x * COORD_PRECISION) / COORD_PRECISION,
    y: Math.round(point.y * COORD_PRECISION) / COORD_PRECISION,
  };
}

export function screenToWorld(point: Point, view: ViewTransform): Point {
  if (view.scale <= 0) return { x: 0, y: 0 };
  return {
    x: (point.x - view.offsetX) / view.scale,
    y: (point.y - view.offsetY) / view.scale,
  };
}

export function worldToScreen(point: Point, view: ViewTransform): Point {
  return {
    x: point.x * view.scale + view.offsetX,
    y: point.y * view.scale + view.offsetY,
  };
}
