import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Point, Stroke, Tool } from "../../types";

interface UseWhiteboardOptions {
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  ctx.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.brushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);
  if (rest.length === 0) {
    ctx.lineTo(first.x + 0.1, first.y + 0.1);
  } else {
    for (const point of rest) ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

// Strokes are drawn to the canvas imperatively (not via React re-render) while
// active, for the same reason ADR-018 calls out: repainting the whole canvas
// per pointer-move is wasteful. React state (`strokes`) only gets updated once
// a stroke finishes - it exists as the source of truth for full redraws
// (resize, and later undo/redo/sync), not for driving the live drawing itself.
export function useWhiteboard({ userId, tool, color, brushSize }: UseWhiteboardOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);

  const [strokes, setStrokes] = useState<Stroke[]>([]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  function redrawAll() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
  }

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  }

  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    return () => observer.disconnect();
    // resizeCanvas/redrawAll intentionally excluded: they read live refs, not
    // closed-over state, so they don't need to be dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPoint(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);

    const stroke: Stroke = {
      id: crypto.randomUUID(),
      userId,
      tool,
      color,
      brushSize,
      points: [getPoint(e)],
    };
    currentStrokeRef.current = stroke;
    drawStroke(ctx, stroke);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const stroke = currentStrokeRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!stroke || !ctx) return;

    stroke.points.push(getPoint(e));
    drawStroke(ctx, { ...stroke, points: stroke.points.slice(-2) });
  }

  function handlePointerUp() {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, stroke]);
  }

  return {
    containerRef,
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
