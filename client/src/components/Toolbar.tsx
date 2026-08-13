import type { Tool } from "../types";

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

export function Toolbar({
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
      >
        Pen
      </button>
      <button
        type="button"
        className={`tool-btn ${tool === "eraser" ? "active" : ""}`}
        onClick={() => onToolChange("eraser")}
      >
        Eraser
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

      <button type="button" className="tool-btn" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="tool-btn" onClick={onRedo}>
        Redo
      </button>
      <button type="button" className="tool-btn" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
