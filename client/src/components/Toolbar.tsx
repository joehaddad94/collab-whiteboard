import { memo } from "react";
import type { Tool } from "../types";
import { PenIcon, EraserIcon, UndoIcon, RedoIcon, ClearIcon } from "./icons";

const COLORS = ["#1b1d22", "#2454ff", "#ff6b4a", "#14b8a6", "#f5a623", "#8b5cf6"];
const MIN_BRUSH_SIZE = 2;
const MAX_BRUSH_SIZE = 22;

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export const Toolbar = memo(function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        type="button"
        className={`tool-btn ${tool === "pen" ? "active" : ""}`}
        onClick={() => onToolChange("pen")}
        title="Pen"
        aria-label="Pen"
      >
        <PenIcon />
      </button>
      <button
        type="button"
        className={`tool-btn ${tool === "eraser" ? "active" : ""}`}
        onClick={() => onToolChange("eraser")}
        title="Eraser"
        aria-label="Eraser"
      >
        <EraserIcon />
      </button>

      <div className="toolbar-sep" />

      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${color === c ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => onColorChange(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div className="toolbar-sep" />

      <label className="brush-size">
        <input
          type="range"
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        />
      </label>

      <div className="toolbar-sep" />

      <button type="button" className="tool-btn" onClick={onUndo} title="Undo" aria-label="Undo">
        <UndoIcon />
      </button>
      <button type="button" className="tool-btn" onClick={onRedo} title="Redo" aria-label="Redo">
        <RedoIcon />
      </button>
      <button
        type="button"
        className="tool-btn"
        onClick={onClear}
        title="Clear board"
        aria-label="Clear board"
      >
        <ClearIcon />
      </button>
    </div>
  );
});
