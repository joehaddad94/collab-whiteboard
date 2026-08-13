import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Socket } from "socket.io-client";
import type { Point, Stroke, Tool } from "../../types";

interface UseWhiteboardOptions {
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
  socket: Socket | null;
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
// per pointer-move is wasteful. This applies to remote strokes exactly the
// same way as local ones - both are drawn segment-by-segment straight to the
// canvas as points arrive, and only committed to `strokes` React state once
// finished, since that state exists for full redraws (resize now; undo/redo/
// initial-load sync), not for driving the live drawing itself.
export function useWhiteboard({ userId, tool, color, brushSize, socket }: UseWhiteboardOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const remoteInProgressRef = useRef<Map<string, Stroke>>(new Map());
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

  useEffect(() => {
    if (!socket) return;

    function handleBoardJoined(payload: { strokes: Stroke[] }) {
      setStrokes(payload.strokes);
    }

    function handleRemoteStrokeStart(stroke: Stroke) {
      remoteInProgressRef.current.set(stroke.id, stroke);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) drawStroke(ctx, stroke);
    }

    function handleRemoteStrokePoint({
      strokeId,
      point,
    }: {
      strokeId: string;
      point: Point;
    }) {
      const stroke = remoteInProgressRef.current.get(strokeId);
      if (!stroke) return;
      stroke.points.push(point);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) drawStroke(ctx, { ...stroke, points: stroke.points.slice(-2) });
    }

    function handleRemoteStrokeEnd({ strokeId }: { strokeId: string }) {
      const stroke = remoteInProgressRef.current.get(strokeId);
      if (!stroke) return;
      remoteInProgressRef.current.delete(strokeId);
      setStrokes((prev) => [...prev, stroke]);
    }

    socket.on("board-joined", handleBoardJoined);
    socket.on("stroke-start", handleRemoteStrokeStart);
    socket.on("stroke-point", handleRemoteStrokePoint);
    socket.on("stroke-end", handleRemoteStrokeEnd);

    return () => {
      socket.off("board-joined", handleBoardJoined);
      socket.off("stroke-start", handleRemoteStrokeStart);
      socket.off("stroke-point", handleRemoteStrokePoint);
      socket.off("stroke-end", handleRemoteStrokeEnd);
      remoteInProgressRef.current.clear();
    };
  }, [socket]);

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

    socket?.emit("stroke-start", {
      strokeId: stroke.id,
      tool: stroke.tool,
      color: stroke.color,
      brushSize: stroke.brushSize,
      point: stroke.points[0],
    });
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const stroke = currentStrokeRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!stroke || !ctx) return;

    const point = getPoint(e);
    stroke.points.push(point);
    drawStroke(ctx, { ...stroke, points: stroke.points.slice(-2) });

    socket?.emit("stroke-point", { strokeId: stroke.id, point });
  }

  function handlePointerUp() {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, stroke]);

    socket?.emit("stroke-end", { strokeId: stroke.id });
  }

  return {
    containerRef,
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
