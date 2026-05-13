"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad({
  name = "signature_data",
  width = 600,
  height = 200,
  onChange,
}: {
  name?: string;
  width?: number;
  height?: number;
  onChange?: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#0f172a";
    }
  }, [width, height]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point(e);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    const last = lastPointRef.current!;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    setHasInk(true);
  }

  function onUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setDataUrl(dataUrl);
    onChange?.(dataUrl);
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
    setDataUrl("");
    setHasInk(false);
    onChange?.("");
  }

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-md inline-block bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: "none", display: "block", maxWidth: "100%" }}
        />
      </div>
      <div className="flex justify-between items-center mt-1">
        <p className="text-xs text-gray-500">
          {hasInk ? "Drawn signature captured." : "Sign with your finger, stylus, or mouse."}
        </p>
        <button type="button" onClick={clear} className="text-xs text-brand-600 hover:underline">Clear</button>
      </div>
      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}
