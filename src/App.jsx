import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = ["#7CB342", "#4ECDC4", "#FF6B6B", "#A78BFA", "#E8B931", "#F06292", "#42A5F5", "#78909C", "#FF8A65", "#AED581"];

const TOOLS = {
  select: { id: "select", label: "Select", icon: "↖" },
  box: { id: "box", label: "Box", icon: "▢" },
  arrow: { id: "arrow", label: "Arrow", icon: "→" },
  text: { id: "text", label: "Text", icon: "T" },
};

let nextId = 1;
const genId = () => `el-${nextId++}`;

export default function ArcBrainstorm() {
  const [elements, setElements] = useState([]);
  const [arrows, setArrows] = useState([]);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#4ECDC4");
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [drawingArrow, setDrawingArrow] = useState(null);
  const [drawingBox, setDrawingBox] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showExport, setShowExport] = useState(false);
  const svgRef = useRef(null);

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const getBoxCenter = (el) => ({
    x: el.x + el.width / 2,
    y: el.y + el.height / 2,
  });

  const getBoxEdgePoint = (box, target) => {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const angle = Math.atan2(dy, dx);
    const hw = box.width / 2;
    const hh = box.height / 2;
    const tanA = Math.abs(dy / (dx || 0.001));
    if (tanA <= hh / hw) {
      const sign = dx >= 0 ? 1 : -1;
      return { x: cx + sign * hw, y: cy + sign * hw * tanA * (dy >= 0 ? 1 : -1) };
    } else {
      const sign = dy >= 0 ? 1 : -1;
      return { x: cx + sign * hh / tanA * (dx >= 0 ? 1 : -1), y: cy + sign * hh };
    }
  };

  const hitTest = (pt) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "box" || el.type === "text") {
        if (pt.x >= el.x && pt.x <= el.x + el.width && pt.y >= el.y && pt.y <= el.y + el.height) {
          return el;
        }
      }
    }
    return null;
  };

  const hitTestResize = (pt, el) => {
    if (!el || el.type !== "box") return false;
    const rx = el.x + el.width;
    const ry = el.y + el.height;
    return Math.abs(pt.x - rx) < 14 && Math.abs(pt.y - ry) < 14;
  };

  const handlePointerDown = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const pt = getSVGPoint(e);
    setMousePos(pt);

    if (tool === "select") {
      const hit = hitTest(pt);
      if (hit) {
        setSelected(hit.id);
        if (hitTestResize(pt, hit)) {
          setResizing({ id: hit.id, startX: pt.x, startY: pt.y, origW: hit.width, origH: hit.height });
        } else {
          setDragging({ id: hit.id, offsetX: pt.x - hit.x, offsetY: pt.y - hit.y });
        }
      } else {
        setSelected(null);
        setEditingText(null);
      }
    } else if (tool === "box") {
      setDrawingBox({ x: pt.x, y: pt.y, startX: pt.x, startY: pt.y });
    } else if (tool === "arrow") {
      const hit = hitTest(pt);
      if (hit) {
        setDrawingArrow({ fromId: hit.id, startPt: getBoxCenter(hit) });
      } else {
        setDrawingArrow({ fromId: null, startPt: pt });
      }
    } else if (tool === "text") {
      const id = genId();
      const newText = {
        id, type: "text", x: pt.x - 60, y: pt.y - 16, width: 120, height: 32,
        label: "", color: color,
      };
      setElements(prev => [...prev, newText]);
      setSelected(id);
      setEditingText(id);
      setTool("select");
    }
  };

  const handlePointerMove = (e) => {
    const pt = getSVGPoint(e);
    setMousePos(pt);

    if (dragging) {
      setElements(prev => prev.map(el =>
        el.id === dragging.id
          ? { ...el, x: Math.max(0, pt.x - dragging.offsetX), y: Math.max(0, pt.y - dragging.offsetY) }
          : el
      ));
    }

    if (resizing) {
      setElements(prev => prev.map(el =>
        el.id === resizing.id
          ? {
            ...el,
            width: Math.max(60, resizing.origW + (pt.x - resizing.startX)),
            height: Math.max(30, resizing.origH + (pt.y - resizing.startY)),
          }
          : el
      ));
    }

    if (drawingBox) {
      setDrawingBox(prev => ({
        ...prev,
        x: Math.min(prev.startX, pt.x),
        y: Math.min(prev.startY, pt.y),
        width: Math.abs(pt.x - prev.startX),
        height: Math.abs(pt.y - prev.startY),
      }));
    }
  };

  const handlePointerUp = (e) => {
    const pt = getSVGPoint(e.changedTouches ? e.changedTouches[0] || e : e);

    if (drawingBox && drawingBox.width > 20 && drawingBox.height > 15) {
      const id = genId();
      setElements(prev => [...prev, {
        id, type: "box",
        x: drawingBox.x, y: drawingBox.y,
        width: drawingBox.width, height: drawingBox.height,
        label: "", color: color,
      }]);
      setSelected(id);
      setEditingText(id);
      setTool("select");
    }

    if (drawingArrow) {
      const hit = hitTest(pt);
      const arrowId = genId();
      if (drawingArrow.fromId && hit && hit.id !== drawingArrow.fromId) {
        setArrows(prev => [...prev, { id: arrowId, from: drawingArrow.fromId, to: hit.id, color: color, label: "" }]);
      }
    }

    setDragging(null);
    setResizing(null);
    setDrawingBox(null);
    setDrawingArrow(null);
  };

  const updateLabel = (id, label) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, label } : el));
  };

  const updateArrowLabel = (id, label) => {
    setArrows(prev => prev.map(a => a.id === id ? { ...a, label } : a));
  };

  const updateSelectedColor = (c) => {
    setColor(c);
    if (selected) {
      setElements(prev => prev.map(el => el.id === selected ? { ...el, color: c } : el));
    }
  };

  const deleteSelected = () => {
    if (!selected) return;
    setElements(prev => prev.filter(el => el.id !== selected));
    setArrows(prev => prev.filter(a => a.from !== selected && a.to !== selected));
    setSelected(null);
    setEditingText(null);
  };

  const clearCanvas = () => {
    setElements([]);
    setArrows([]);
    setSelected(null);
    setEditingText(null);
    nextId = 1;
  };

  const exportJSON = () => {
    const data = {
      version: "arc-brainstorm-v1",
      timestamp: new Date().toISOString(),
      elements: elements.map(el => ({
        id: el.id, type: el.type,
        x: Math.round(el.x), y: Math.round(el.y),
        width: Math.round(el.width), height: Math.round(el.height),
        label: el.label, color: el.color,
      })),
      arrows: arrows.map(a => ({
        id: a.id, from: a.from, to: a.to, label: a.label, color: a.color,
      })),
    };
    return JSON.stringify(data, null, 2);
  };

  const downloadJSON = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arc-brainstorm-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingText) return;
        deleteSelected();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setEditingText(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const selectedEl = elements.find(el => el.id === selected);

  return (
    <div style={{
      fontFamily: "'Inter', 'SF Pro', -apple-system, sans-serif",
      background: "#0a0a0f", color: "#e0e0e0",
      height: "100vh", display: "flex", flexDirection: "column",
      overflow: "hidden", userSelect: "none",
    }}>
      {/* Top Bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", background: "#0f0f18",
        borderBottom: "1px solid #1a1a2e", flexShrink: 0,
        flexWrap: "wrap",
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 14, fontWeight: 800, marginRight: 8,
          background: "linear-gradient(135deg, #4ECDC4, #7CB342)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>ARC ✦ Brainstorm</div>

        <div style={{ width: 1, height: 24, background: "#1a1a2e", margin: "0 4px" }} />

        {/* Tools */}
        {Object.values(TOOLS).map(t => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); setEditingText(null); }}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: tool === t.id ? "#4ECDC420" : "transparent",
              color: tool === t.id ? "#4ECDC4" : "#666",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: "#1a1a2e", margin: "0 4px" }} />

        {/* Colors */}
        <div style={{ display: "flex", gap: 3 }}>
          {COLORS.map(c => (
            <div
              key={c}
              onClick={() => updateSelectedColor(c)}
              style={{
                width: 18, height: 18, borderRadius: 4, cursor: "pointer",
                background: c, border: color === c ? "2px solid #fff" : "2px solid transparent",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        {selected && (
          <button
            onClick={deleteSelected}
            style={{
              padding: "5px 10px", borderRadius: 5, border: "1px solid #F4433630",
              background: "#F4433610", color: "#F44336", cursor: "pointer",
              fontSize: 11, fontFamily: "inherit",
            }}
          >Delete</button>
        )}
        <button
          onClick={clearCanvas}
          style={{
            padding: "5px 10px", borderRadius: 5, border: "1px solid #FF6B6B20",
            background: "transparent", color: "#666", cursor: "pointer",
            fontSize: 11, fontFamily: "inherit",
          }}
        >Clear</button>
        <button
          onClick={() => setShowExport(!showExport)}
          style={{
            padding: "5px 10px", borderRadius: 5, border: "1px solid #4ECDC430",
            background: "#4ECDC410", color: "#4ECDC4", cursor: "pointer",
            fontSize: 11, fontFamily: "inherit",
          }}
        >{showExport ? "Hide JSON" : "View JSON"}</button>
        <button
          onClick={downloadJSON}
          style={{
            padding: "5px 10px", borderRadius: 5, border: "1px solid #7CB34230",
            background: "#7CB34215", color: "#7CB342", cursor: "pointer",
            fontSize: 11, fontWeight: 700, fontFamily: "inherit",
          }}
        >⬇ Export</button>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Canvas */}
        <svg
          ref={svgRef}
          style={{
            flex: 1, background: "#0a0a0f", cursor: tool === "box" ? "crosshair" : tool === "arrow" ? "crosshair" : tool === "text" ? "text" : "default",
            touchAction: "none",
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="#1a1a2e" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Arrows */}
          {arrows.map(a => {
            const fromEl = elements.find(el => el.id === a.from);
            const toEl = elements.find(el => el.id === a.to);
            if (!fromEl || !toEl) return null;
            const fromCenter = getBoxCenter(fromEl);
            const toCenter = getBoxCenter(toEl);
            const start = getBoxEdgePoint(fromEl, toCenter);
            const end = getBoxEdgePoint(toEl, fromCenter);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const arrowLen = 10;
            return (
              <g key={a.id}>
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  stroke={a.color} strokeWidth={2} strokeLinecap="round" />
                <polygon
                  points={`${end.x},${end.y} ${end.x - arrowLen * Math.cos(angle - 0.4)},${end.y - arrowLen * Math.sin(angle - 0.4)} ${end.x - arrowLen * Math.cos(angle + 0.4)},${end.y - arrowLen * Math.sin(angle + 0.4)}`}
                  fill={a.color}
                />
                {a.label && (
                  <text x={midX} y={midY - 6} textAnchor="middle" fontSize={11} fill="#999" fontFamily="inherit">{a.label}</text>
                )}
              </g>
            );
          })}

          {/* Drawing arrow preview */}
          {drawingArrow && (
            <line
              x1={drawingArrow.startPt.x} y1={drawingArrow.startPt.y}
              x2={mousePos.x} y2={mousePos.y}
              stroke={color} strokeWidth={2} strokeDasharray="6,4" opacity={0.6}
            />
          )}

          {/* Drawing box preview */}
          {drawingBox && drawingBox.width && (
            <rect
              x={drawingBox.x} y={drawingBox.y}
              width={drawingBox.width || 0} height={drawingBox.height || 0}
              fill={color + "15"} stroke={color} strokeWidth={2} strokeDasharray="6,4"
              rx={8} opacity={0.7}
            />
          )}

          {/* Elements */}
          {elements.map(el => {
            const isSelected = selected === el.id;
            if (el.type === "box") {
              return (
                <g key={el.id}>
                  <rect
                    x={el.x} y={el.y} width={el.width} height={el.height}
                    rx={8} ry={8}
                    fill={el.color + "12"} stroke={isSelected ? "#fff" : el.color + "60"}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                  {el.label && (
                    <text
                      x={el.x + el.width / 2} y={el.y + el.height / 2}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={13} fill="#e0e0e0" fontFamily="inherit" fontWeight={600}
                      style={{ pointerEvents: "none" }}
                    >
                      {el.label}
                    </text>
                  )}
                  {/* Resize handle */}
                  {isSelected && (
                    <rect
                      x={el.x + el.width - 8} y={el.y + el.height - 8}
                      width={10} height={10} rx={2}
                      fill={el.color} opacity={0.8}
                      style={{ cursor: "nwse-resize" }}
                    />
                  )}
                </g>
              );
            }
            if (el.type === "text") {
              return (
                <g key={el.id}>
                  {isSelected && (
                    <rect
                      x={el.x - 2} y={el.y - 2}
                      width={el.width + 4} height={el.height + 4}
                      rx={4} fill="none" stroke="#ffffff30" strokeWidth={1} strokeDasharray="4,3"
                    />
                  )}
                  {el.label && editingText !== el.id && (
                    <text
                      x={el.x + el.width / 2} y={el.y + el.height / 2}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={13} fill={el.color} fontFamily="inherit" fontWeight={500}
                      style={{ pointerEvents: "none" }}
                    >
                      {el.label}
                    </text>
                  )}
                </g>
              );
            }
            return null;
          })}
        </svg>

        {/* Text editing overlay */}
        {editingText && (() => {
          const el = elements.find(e => e.id === editingText);
          if (!el) return null;
          const svg = svgRef.current;
          if (!svg) return null;
          const rect = svg.getBoundingClientRect();
          return (
            <input
              autoFocus
              value={el.label}
              onChange={(e) => updateLabel(el.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingText(null);
                if (e.key === "Escape") setEditingText(null);
              }}
              onBlur={() => setEditingText(null)}
              style={{
                position: "absolute",
                left: el.x + (el.type === "box" ? 8 : 0),
                top: el.y + (el.type === "box" ? el.height / 2 - 12 : 4),
                width: el.width - (el.type === "box" ? 16 : 0),
                height: 24,
                background: "#12121f", border: `1px solid ${el.color}60`,
                borderRadius: 4, color: "#e0e0e0", fontSize: 13,
                fontFamily: "inherit", fontWeight: 600, textAlign: "center",
                outline: "none", padding: "0 4px",
              }}
            />
          );
        })()}

        {/* Properties Panel */}
        {selected && selectedEl && !showExport && (
          <div style={{
            position: "absolute", right: 12, top: 12, width: 200,
            background: "#0f0f18", borderRadius: 10, border: "1px solid #1a1a2e",
            padding: 14,
          }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {selectedEl.type === "box" ? "Box" : "Text"} Properties
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: "#444", marginBottom: 3 }}>Label</div>
              <input
                value={selectedEl.label}
                onChange={(e) => updateLabel(selected, e.target.value)}
                onFocus={() => setEditingText(null)}
                placeholder="Type label..."
                style={{
                  width: "100%", background: "#080810", border: "1px solid #1a1a2e",
                  borderRadius: 4, color: "#e0e0e0", fontSize: 12, padding: "6px 8px",
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: "#444", marginBottom: 3 }}>Color</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, color: c } : el));
                    }}
                    style={{
                      width: 18, height: 18, borderRadius: 3, cursor: "pointer",
                      background: c,
                      border: selectedEl.color === c ? "2px solid #fff" : "2px solid transparent",
                      boxSizing: "border-box",
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 9, color: "#333" }}>
              {Math.round(selectedEl.x)}, {Math.round(selectedEl.y)} · {Math.round(selectedEl.width)}×{Math.round(selectedEl.height)}
            </div>
          </div>
        )}

        {/* JSON Export Panel */}
        {showExport && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 340,
            background: "#0c0c14", borderLeft: "1px solid #1a1a2e",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid #1a1a2e",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4ECDC4" }}>JSON Export</span>
              <button onClick={downloadJSON} style={{
                padding: "4px 10px", borderRadius: 4, border: "1px solid #7CB34230",
                background: "#7CB34210", color: "#7CB342", cursor: "pointer",
                fontSize: 10, fontFamily: "inherit",
              }}>⬇ Download</button>
            </div>
            <pre style={{
              flex: 1, margin: 0, padding: 16, overflow: "auto",
              fontSize: 10, color: "#888", lineHeight: 1.5,
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            }}>
              {exportJSON()}
            </pre>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div style={{
        padding: "6px 12px", background: "#0f0f18", borderTop: "1px solid #1a1a2e",
        display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "#444",
        flexShrink: 0,
      }}>
        <span>{elements.length} elements · {arrows.length} connections</span>
        <span>·</span>
        <span>Tool: <strong style={{ color: "#666" }}>{TOOLS[tool]?.label}</strong></span>
        <span>·</span>
        <span style={{ color: "#333" }}>Draw boxes, connect with arrows, add text. Export JSON for Willow.</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#333" }}>Delete: ⌫ · Escape: deselect</span>
      </div>
    </div>
  );
}
