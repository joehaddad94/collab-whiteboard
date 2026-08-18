import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Socket } from "socket.io-client";
import type { Point, Stroke, Tool } from "../../types";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getViewTransform,
  quantize,
  screenToWorld,
  type ViewTransform,
} from "../../lib/worldView";

interface UseWhiteboardOptions {
  userId: number;
  tool: Tool;
  color: string;
  brushSize: number;
  socket: Socket | null;
  disabled?: boolean;
  onStrokesChange?: (strokes: Stroke[]) => void;
}

const CURSOR_THROTTLE_MS = 40;

// Points and brushSize are in world units. The context already holds the
// world -> device transform, so draw as-is and scaling comes for free.
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

// Live strokes are painted straight to the canvas, not through React - a
// re-render per pointer-move would repaint the whole board for one segment.
// Remote strokes work the same way. `strokes` state is only for full
// redraws: resize, undo/redo, joining a board.
export function useWhiteboard({
  userId,
  tool,
  color,
  brushSize,
  socket,
  disabled = false,
  onStrokesChange,
}: UseWhiteboardOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const remoteInProgressRef = useRef<Map<string, Stroke>>(new Map());
  const strokesRef = useRef<Stroke[]>([]);
  const lastCursorEmitRef = useRef(0);
  const viewRef = useRef<ViewTransform>(getViewTransform(0, 0));

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Only positions the page rect in the markup. Drawing and hit-testing read
  // viewRef, so a resize is correct before React re-renders.
  const [view, setView] = useState<ViewTransform>(() => getViewTransform(0, 0));

  useEffect(() => {
    strokesRef.current = strokes;
    onStrokesChange?.(strokes);
    // onStrokesChange left out on purpose: BoardPage doesn't memoize it, so
    // including it would re-run this on every parent render instead of only
    // when strokes change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  // Includes unfinished strokes. Leaving them out would blank whatever people
  // are drawing right now on every resize, undo, or join.
  function redrawAll() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Clear in device space: the context carries the world transform, and only
    // the backing store's size is known in device pixels.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    for (const stroke of remoteInProgressRef.current.values()) {
      drawStroke(ctx, stroke);
    }
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
  }

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Setting width/height wipes the context state, transform and clip
    // included. Both get re-established below, every time.
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const nextView = getViewTransform(rect.width, rect.height);
    viewRef.current = nextView;
    setView(nextView);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(
        dpr * nextView.scale,
        0,
        0,
        dpr * nextView.scale,
        dpr * nextView.offsetX,
        dpr * nextView.offsetY,
      );
      // Clip to the page so a stroke running off the edge is cut the same for
      // everyone, not left visible to whoever has a wider window.
      ctx.beginPath();
      ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.clip();
    }
    redrawAll();
  }

  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    return () => observer.disconnect();
    // resizeCanvas/redrawAll left out: they read live refs, not closed-over
    // state, so they never go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleBoardJoined(payload: {
      strokes: Stroke[];
      inProgressStrokes?: Stroke[];
    }) {
      strokesRef.current = payload.strokes;
      setStrokes(payload.strokes);
      // Seed strokes other people are still drawing - the stroke-point and
      // stroke-end events that follow carry only a strokeId and need something
      // to attach to. Copy the points, since they get mutated in place.
      remoteInProgressRef.current = new Map(
        (payload.inProgressStrokes ?? []).map((stroke) => [
          stroke.id,
          { ...stroke, points: [...stroke.points] },
        ]),
      );
      redrawAll();
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

    // Undo/redo/clear go to the whole room including whoever triggered them,
    // so there's no local-vs-remote branching here like the stroke-* handlers
    // have. None of the three can be drawn incrementally either, so they all
    // redraw in full.
    function handleStrokeRemoved({ strokeId }: { strokeId: string }) {
      // Also covers a stroke abandoned by someone who disconnected mid-draw -
      // the server sends the same event, and it's still unfinished here.
      remoteInProgressRef.current.delete(strokeId);
      const next = strokesRef.current.filter((s) => s.id !== strokeId);
      strokesRef.current = next;
      setStrokes(next);
      redrawAll();
    }

    function handleStrokeRestored({ stroke }: { stroke: Stroke }) {
      const next = [...strokesRef.current, stroke];
      strokesRef.current = next;
      setStrokes(next);
      redrawAll();
    }

    function handleBoardCleared() {
      strokesRef.current = [];
      setStrokes([]);
      // The server drops its in-progress strokes on clear too, so nothing
      // unfinished here will ever get another point or an end event.
      remoteInProgressRef.current.clear();
      redrawAll();
    }

    socket.on("board-joined", handleBoardJoined);
    socket.on("stroke-start", handleRemoteStrokeStart);
    socket.on("stroke-point", handleRemoteStrokePoint);
    socket.on("stroke-end", handleRemoteStrokeEnd);
    socket.on("stroke-removed", handleStrokeRemoved);
    socket.on("stroke-restored", handleStrokeRestored);
    socket.on("board-cleared", handleBoardCleared);

    return () => {
      socket.off("board-joined", handleBoardJoined);
      socket.off("stroke-start", handleRemoteStrokeStart);
      socket.off("stroke-point", handleRemoteStrokePoint);
      socket.off("stroke-end", handleRemoteStrokeEnd);
      socket.off("stroke-removed", handleStrokeRemoved);
      socket.off("stroke-restored", handleStrokeRestored);
      socket.off("board-cleared", handleBoardCleared);
      remoteInProgressRef.current.clear();
    };
  }, [socket]);

  function getPoint(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    // Quantize once, here - the only place coordinates enter the app - so
    // canvas, socket and database all carry identical values.
    return quantize(
      screenToWorld(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        viewRef.current,
      ),
    );
  }

  // A stroke in flight when the connection drops is abandoned. The server
  // never got its stroke-end, so finishing it locally would just draw
  // something the next board-joined wipes.
  useEffect(() => {
    if (!disabled || !currentStrokeRef.current) return;
    currentStrokeRef.current = null;
    redrawAll();
    // redrawAll reads live refs, not closed-over state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
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
    // Socket.io buffers emits while disconnected and flushes them on reconnect,
    // so staying quiet here also avoids a burst of stale cursor positions.
    if (disabled) return;
    const point = getPoint(e);

    const now = Date.now();
    if (now - lastCursorEmitRef.current >= CURSOR_THROTTLE_MS) {
      lastCursorEmitRef.current = now;
      socket?.emit("cursor-move", point);
    }

    const stroke = currentStrokeRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!stroke || !ctx) return;

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
    view,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
