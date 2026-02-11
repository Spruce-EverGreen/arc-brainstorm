import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = [
  { name: "Spruce", hex: "#7CB342" },
  { name: "Willow", hex: "#4ECDC4" },
  { name: "Alert", hex: "#FF6B6B" },
  { name: "Magic", hex: "#A78BFA" },
  { name: "Gold", hex: "#E8B931" },
  { name: "Pink", hex: "#F06292" },
  { name: "Blue", hex: "#42A5F5" },
  { name: "Gray", hex: "#78909C" },
  { name: "Orange", hex: "#FF8A65" },
  { name: "Green", hex: "#AED581" }
];

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
  const selectedColor = COLORS.find(c => c.hex === color);

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Inter', -apple-system, sans-serif",
      background: "#020205",
      backgroundImage: `radial-gradient(circle at 20% 50%, rgba(78, 205, 196, 0.05) 0%, transparent 50%), 
                       radial-gradient(circle at 80% 80%, rgba(123, 179, 66, 0.05) 0%, transparent 50%)`,
      color: "#e0e0e0",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      userSelect: "none",
    }}>
      <style>{`
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(78, 205, 196, 0.3)); }
          50% { filter: drop-shadow(0 0 20px rgba(78, 205, 196, 0.6)); }
        }
        .arc-glow { animation: glow 3s ease-in-out infinite; }
        button:hover { transform: translateY(-1px); }
        button:active { transform: translateY(0px); }
      `}</style>

      {/* Top Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "linear-gradient(180deg, rgba(15, 15, 24, 0.9) 0%, rgba(10, 10, 20, 0.5) 100%)",
        borderBottom: "1px solid rgba(78, 205, 196, 0.1)",
        backdropFilter: "blur(10px)",
        flexShrink: 0,
        flexWrap: "wrap",
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: -0.5,
          background: "linear-gradient(135deg, #4ECDC4 0%, #7CB342 50%, #E8B931 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 20px rgba(78, 205, 196, 0.3)",
          marginRight: 4,
        }}>
          ARC
        </div>
        <div style={{
          fontSize: 10,
          color: "#666",
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}>BRAINSTORM</div>

        <div style={{
          width: 1,
          height: 24,
          background: "linear-gradient(180deg, transparent, #4ECDC4, transparent)",
          opacity: 0.3,
          margin: "0 4px",
        }} />

        {/* Tools */}
        <div style={{ display: "flex", gap: 2 }}>
          {Object.values(TOOLS).map(t => {
            const isActive = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: isActive ? `1px solid #4ECDC4` : "1px solid rgba(78, 205, 196, 0.2)",
                  cursor: "pointer",
                  background: isActive ? "rgba(78, 205, 196, 0.15)" : "transparent",
                  color: isActive ? "#4ECDC4" : "#666",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? "inset 0 0 10px rgba(78, 205, 196, 0.2)" : "none",
                }}
              >
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                <span style={{ fontSize: 10 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{
          width: 1,
          height: 24,
          background: "linear-gradient(180deg, transparent, #4ECDC4, transparent)",
          opacity: 0.3,
          margin: "0 4px",
        }} />

        {/* Colors */}
        <div style={{ display: "flex", gap: 4 }}>
          {COLORS.map(c => (
            <div
              key={c.hex}
              onClick={() => updateSelectedColor(c.hex)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                cursor: "pointer",
                background: c.hex,
                border: color === c.hex ? `2px solid #fff` : `2px solid rgba(78, 205, 196, 0.2)`,
                boxSizing: "border-box",
                transition: "all 0.2s ease",
                boxShadow: color === c.hex ? `0 0 12px ${c.hex}60` : "none",
                title: c.name,
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
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid rgba(244, 67, 54, 0.3)",
              background: "rgba(244, 67, 54, 0.1)",
              color: "#FF6B6B",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "inherit",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
          >⌫ Delete</button>
        )}
        <button
          onClick={clearCanvas}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid rgba(100, 100, 120, 0.2)",
            background: "transparent",
            color: "#666",
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "inherit",
            fontWeight: 600,
            transition: "all 0.2s ease",
          }}
        >Clear</button>
        <button
          onClick={() => setShowExport(!showExport)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: `1px solid rgba(78, 205, 196, 0.3)`,
            background: "rgba(78, 205, 196, 0.1)",
            color: "#4ECDC4",
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "inherit",
            fontWeight: 600,
            transition: "all 0.2s ease",
          }}
        >{showExport ? "Hide" : "View"} JSON</button>
        <button
          onClick={downloadJSON}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid rgba(123, 179, 66, 0.4)",
            background: "rgba(123, 179, 66, 0.15)",
            color: "#7CB342",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "inherit",
            transition: "all 0.2s ease",
            boxShadow: "0 0 8px rgba(123, 179, 66, 0.2)",
          }}
        >⬇ Export</button>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Canvas */}
        <svg
          ref={svgRef}
          style={{
            flex: 1,
            background: `linear-gradient(135deg, #020205 0%, #0a0a15 100%)`,
            cursor: tool === "box" || tool === "arrow" ? "crosshair" : tool === "text" ? "text" : "default",
            touchAction: "none",
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          {/* Animated Grid Background */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#4ECDC4" strokeWidth="0.5" opacity="0.05"/>
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
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
            const arrowLen = 12;
            return (
              <g key={a.id}>
                <line
                  x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  stroke={a.color} strokeWidth={2.5} strokeLinecap="round"
                  filter="url(#glow)" opacity="0.8"
                />
                <polygon
                  points={`${end.x},${end.y} ${end.x - arrowLen * Math.cos(angle - 0.4)},${end.y - arrowLen * Math.sin(angle - 0.4)} ${end.x - arrowLen * Math.cos(angle + 0.4)},${end.y - arrowLen * Math.sin(angle + 0.4)}`}
                  fill={a.color} opacity="0.9"
                />
                {a.label && (
                  <text
                    x={midX} y={midY - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#aaa"
                    fontFamily="inherit"
                    fontWeight={500}
                  >{a.label}</text>
                )}
              </g>
            );
          })}

          {/* Drawing arrow preview */}
          {drawingArrow && (
            <line
              x1={drawingArrow.startPt.x} y1={drawingArrow.startPt.y}
              x2={mousePos.x} y2={mousePos.y}
              stroke={color} strokeWidth={2} strokeDasharray="6,4" opacity="0.5"
              filter="url(#glow)"
            />
          )}

          {/* Drawing box preview */}
          {drawingBox && drawingBox.width && (
            <rect
              x={drawingBox.x} y={drawingBox.y}
              width={drawingBox.width} height={drawingBox.height}
              fill={color + "10"} stroke={color} strokeWidth={2} strokeDasharray="6,4"
              rx={8} opacity="0.6" filter="url(#glow)"
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
                    rx={10} ry={10}
                    fill={el.color + "08"}
                    stroke={isSelected ? "#fff" : el.color}
                    strokeWidth={isSelected ? 2.5 : 2}
                    filter={isSelected ? "url(#glow)" : "none"}
                    opacity={isSelected ? 1 : 0.85}
                  />
                  {el.label && (
                    <text
                      x={el.x + el.width / 2} y={el.y + el.height / 2}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={13} fill="#e0e0e0" fontFamily="inherit" fontWeight={700}
                      style={{ pointerEvents: "none" }}
                      letterSpacing={0.5}
                    >
                      {el.label}
                    </text>
                  )}
                  {/* Resize handle */}
                  {isSelected && (
                    <circle
                      cx={el.x + el.width} cy={el.y + el.height}
                      r={6}
                      fill={el.color} opacity={0.9}
                      filter="url(#glow)"
                      style={{ cursor: "nwse-resize" }}
                    />
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
                background: "rgba(15, 15, 24, 0.9)",
                border: `2px solid ${el.color}`,
                borderRadius: 6,
                color: "#e0e0e0",
                fontSize: 13,
                fontFamily: "inherit",
                fontWeight: 700,
                textAlign: "center",
                outline: "none",
                padding: "0 4px",
                boxShadow: `0 0 12px ${el.color}40`,
                backdropFilter: "blur(5px)",
              }}
            />
          );
        })()}

        {/* Properties Panel */}
        {selected && selectedEl && !showExport && (
          <div style={{
            position: "absolute",
            right: 16,
            top: 16,
            width: 220,
            background: "linear-gradient(135deg, rgba(15, 15, 24, 0.95) 0%, rgba(20, 20, 30, 0.85) 100%)",
            borderRadius: 12,
            border: "1px solid rgba(78, 205, 196, 0.2)",
            padding: 16,
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(78, 205, 196, 0.05)",
          }}>
            <div style={{
              fontSize: 9,
              color: "#4ECDC4",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontWeight: 700,
            }}>
              {selectedEl.type === "box" ? "Box" : "Text"}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 8, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Label</div>
              <input
                value={selectedEl.label}
                onChange={(e) => updateLabel(selected, e.target.value)}
                onFocus={() => setEditingText(null)}
                placeholder="Type label..."
                style={{
                  width: "100%",
                  background: "rgba(10, 10, 15, 0.5)",
                  border: "1px solid rgba(78, 205, 196, 0.2)",
                  borderRadius: 6,
                  color: "#e0e0e0",
                  fontSize: 11,
                  padding: "7px 10px",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 8, color: "#888", marginBottom: 6, textTransform: "uppercase" }}>Color</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {COLORS.map(c => (
                  <div
                    key={c.hex}
                    onClick={() => {
                      setColor(c.hex);
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, color: c.hex } : el));
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      cursor: "pointer",
                      background: c.hex,
                      border: selectedEl.color === c.hex ? "2px solid #fff" : "2px solid transparent",
                      boxSizing: "border-box",
                      boxShadow: selectedEl.color === c.hex ? `0 0 8px ${c.hex}60` : "none",
                      transition: "all 0.2s ease",
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* JSON Export Panel */}
        {showExport && (
          <div style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 380,
            background: "linear-gradient(180deg, rgba(10, 10, 15, 0.98) 0%, rgba(15, 15, 25, 0.95) 100%)",
            borderLeft: "1px solid rgba(78, 205, 196, 0.2)",
            display: "flex",
            flexDirection: "column",
            backdropFilter: "blur(10px)",
            boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(78, 205, 196, 0.05)",
          }}>
            <div style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(78, 205, 196, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#4ECDC4",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}>JSON Export</span>
              <button
                onClick={downloadJSON}
                style={{
                  padding: "5px 10px",
                  borderRadius: 5,
                  border: "1px solid rgba(123, 179, 66, 0.3)",
                  background: "rgba(123, 179, 66, 0.1)",
                  color: "#7CB342",
                  cursor: "pointer",
                  fontSize: 9,
                  fontFamily: "inherit",
                  fontWeight: 700,
                }}
              >⬇ Download</button>
            </div>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: 16,
              overflow: "auto",
              fontSize: 9,
              color: "#999",
              lineHeight: 1.5,
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              background: "rgba(0, 0, 0, 0.3)",
            }}>
              {exportJSON()}
            </pre>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div style={{
        padding: "8px 16px",
        background: "linear-gradient(180deg, rgba(10, 10, 20, 0.5) 0%, rgba(15, 15, 24, 0.9) 100%)",
        borderTop: "1px solid rgba(78, 205, 196, 0.1)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 9,
        color: "#555",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, color: "#666" }} id="stats">{elements.length} elements · {arrows.length} connections</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span>Tool: <strong style={{ color: "#7CB342" }}>{TOOLS[tool]?.label}</strong></span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span style={{ color: "#444" }}>Draw boxes, connect with arrows, export JSON for Willow</span>
        <div style={{ flex: 1 }} />
        <span style={{ opacity: 0.5, fontSize: 8 }}>⌫ Delete · Esc Deselect · ↵ Confirm</span>
      </div>
    </div>
  );
}
