"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tool = "arrow" | "rect" | "circle" | "text" | "free";
type Color = "#ef4444" | "#eab308" | "#22c55e" | "#3b82f6" | "#ffffff" | "#0f172a";

type ShapeBase = { id: string; kind: Tool; color: Color; thickness: number };
type ArrowShape = ShapeBase & { kind: "arrow"; x1: number; y1: number; x2: number; y2: number };
type RectShape = ShapeBase & { kind: "rect"; x: number; y: number; w: number; h: number };
type CircleShape = ShapeBase & { kind: "circle"; cx: number; cy: number; r: number };
type FreeShape = ShapeBase & { kind: "free"; points: Array<[number, number]> };
type TextShape = ShapeBase & { kind: "text"; x: number; y: number; text: string; size: number };
type Shape = ArrowShape | RectShape | CircleShape | FreeShape | TextShape;

const COLORS: Color[] = ["#ef4444", "#eab308", "#22c55e", "#3b82f6", "#ffffff", "#0f172a"];

export function PhotoAnnotator({
  photoId,
  imageUrl,
  organizationId,
  initialShapes,
  onClose,
}: {
  photoId: string;
  imageUrl: string;
  organizationId: string;
  initialShapes?: Shape[];
  onClose?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<Shape[]>(initialShapes ?? []);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState<Color>("#ef4444");
  const [thickness, setThickness] = useState(4);
  const [drafting, setDrafting] = useState<Shape | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const supabase = createClient();

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      draw(shapes, null);
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => {
    draw(shapes, drafting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, drafting]);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!imgRef.current) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const [x, y] = getCanvasPoint(e);
    const id = crypto.randomUUID();
    if (tool === "arrow") setDrafting({ id, kind: "arrow", color, thickness, x1: x, y1: y, x2: x, y2: y });
    else if (tool === "rect") setDrafting({ id, kind: "rect", color, thickness, x, y, w: 0, h: 0 });
    else if (tool === "circle") setDrafting({ id, kind: "circle", color, thickness, cx: x, cy: y, r: 0 });
    else if (tool === "free") setDrafting({ id, kind: "free", color, thickness, points: [[x, y]] });
    else if (tool === "text") {
      const text = prompt("Annotation text:")?.trim();
      if (text) {
        setShapes((s) => [...s, { id, kind: "text", color, thickness, x, y, text, size: 28 }]);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drafting) return;
    const [x, y] = getCanvasPoint(e);
    setDrafting((d) => {
      if (!d) return d;
      if (d.kind === "arrow") return { ...d, x2: x, y2: y };
      if (d.kind === "rect") return { ...d, w: x - d.x, h: y - d.y };
      if (d.kind === "circle") {
        const r = Math.hypot(x - d.cx, y - d.cy);
        return { ...d, r };
      }
      if (d.kind === "free") return { ...d, points: [...d.points, [x, y]] };
      return d;
    });
  }

  function onPointerUp() {
    if (drafting) {
      setShapes((s) => [...s, drafting]);
      setDrafting(null);
    }
  }

  function draw(allShapes: Shape[], extra: Shape | null) {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    for (const sh of allShapes) drawShape(ctx, sh);
    if (extra) drawShape(ctx, extra);
  }

  function undo() {
    setShapes((s) => s.slice(0, -1));
  }
  function clear() {
    if (confirm("Remove all annotations?")) setShapes([]);
  }

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const { data: existing } = await (supabase as any)
        .from("photo_annotations")
        .select("id")
        .eq("photo_id", photoId)
        .maybeSingle();
      const payload = {
        organization_id: organizationId,
        photo_id: photoId,
        shapes,
      };
      if (existing?.id) {
        await (supabase as any).from("photo_annotations").update(payload).eq("id", existing.id);
      } else {
        await (supabase as any).from("photo_annotations").insert(payload);
      }
      // Also export a flattened JPEG and store in photos bucket for reuse in PDFs / emails
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b), "image/jpeg", 0.9);
      });
      if (blob) {
        const path = `${organizationId}/annotated/${photoId}.jpg`;
        await supabase.storage.from("photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
        const { data: signed } = await supabase.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) {
          await (supabase as any).from("photo_attachments").update({ annotated_url: signed.signedUrl }).eq("id", photoId);
        }
      }
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e) {
      setSavedMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded">
        <ToolBtn label="Arrow" active={tool === "arrow"} onClick={() => setTool("arrow")} />
        <ToolBtn label="Box" active={tool === "rect"} onClick={() => setTool("rect")} />
        <ToolBtn label="Circle" active={tool === "circle"} onClick={() => setTool("circle")} />
        <ToolBtn label="Free" active={tool === "free"} onClick={() => setTool("free")} />
        <ToolBtn label="Text" active={tool === "text"} onClick={() => setTool("text")} />
        <span className="mx-2 text-gray-300">|</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Pick ${c}`}
            className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-gray-800" : "border-white"} shadow`}
            style={{ background: c }}
          />
        ))}
        <span className="mx-2 text-gray-300">|</span>
        <label className="text-xs text-gray-600 flex items-center gap-1">
          Thickness
          <input
            type="range"
            min={1}
            max={20}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
          />
        </label>
        <span className="mx-2 text-gray-300">|</span>
        <button type="button" onClick={undo} className="btn-secondary text-xs">Undo</button>
        <button type="button" onClick={clear} className="btn-secondary text-xs">Clear</button>
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs">
          {saving ? "Saving…" : "Save annotations"}
        </button>
        {savedMsg && <span className="text-xs text-green-700">{savedMsg}</span>}
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto btn-ghost text-xs">Close</button>
        )}
      </div>
      <div className="border rounded overflow-hidden bg-gray-900 grid place-items-center">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ touchAction: "none", maxWidth: "100%", maxHeight: "70vh", display: "block" }}
        />
      </div>
      {imgSize.w === 0 && <p className="text-xs text-gray-500">Loading image…</p>}
    </div>
  );
}

function ToolBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded ${active ? "bg-brand-600 text-white" : "bg-white border"}`}
    >
      {label}
    </button>
  );
}

function drawShape(ctx: CanvasRenderingContext2D, sh: Shape) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = sh.color;
  ctx.fillStyle = sh.color;
  ctx.lineWidth = sh.thickness;

  if (sh.kind === "rect") {
    ctx.strokeRect(sh.x, sh.y, sh.w, sh.h);
  } else if (sh.kind === "circle") {
    ctx.beginPath();
    ctx.arc(sh.cx, sh.cy, Math.max(0, sh.r), 0, Math.PI * 2);
    ctx.stroke();
  } else if (sh.kind === "free") {
    if (sh.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(sh.points[0][0], sh.points[0][1]);
    for (let i = 1; i < sh.points.length; i++) ctx.lineTo(sh.points[i][0], sh.points[i][1]);
    ctx.stroke();
  } else if (sh.kind === "text") {
    ctx.font = `${sh.size}px sans-serif`;
    ctx.textBaseline = "top";
    // backdrop for legibility
    const metrics = ctx.measureText(sh.text);
    const pad = 4;
    ctx.fillStyle = "rgba(15,23,42,0.65)";
    ctx.fillRect(sh.x - pad, sh.y - pad, metrics.width + pad * 2, sh.size + pad * 2);
    ctx.fillStyle = sh.color;
    ctx.fillText(sh.text, sh.x, sh.y);
  } else if (sh.kind === "arrow") {
    const dx = sh.x2 - sh.x1;
    const dy = sh.y2 - sh.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    ctx.beginPath();
    ctx.moveTo(sh.x1, sh.y1);
    ctx.lineTo(sh.x2, sh.y2);
    ctx.stroke();
    const headLen = Math.max(12, sh.thickness * 3);
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(sh.x2, sh.y2);
    ctx.lineTo(sh.x2 - headLen * Math.cos(angle - Math.PI / 6), sh.y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(sh.x2 - headLen * Math.cos(angle + Math.PI / 6), sh.y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
}
