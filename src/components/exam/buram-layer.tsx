"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Eraser, Highlighter, Trash2, Undo2, X, Pen } from "lucide-react";

type Tool = "pen" | "marker" | "eraser";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

const COLORS = [
  { id: "ink", value: "#1a1a1b", label: "Pena gelap" },
  { id: "clay", value: "#dc2626", label: "Pena merah" },
];

export function BuramLayer({
  active,
  onClose,
  containerRef,
}: {
  active: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const strokesRef = React.useRef<Stroke[]>([]);
  const currentRef = React.useRef<Stroke | null>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState(COLORS[0].value);
  const [count, setCount] = React.useState(0);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.globalCompositeOperation =
        stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.globalAlpha = stroke.tool === "marker" ? 0.32 : 1;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }, [containerRef]);

  React.useEffect(() => {
    if (!active) return;
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, redraw]);

  if (!active) return null;

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const widthFor = (t: Tool) => (t === "marker" ? 18 : t === "eraser" ? 24 : 3);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30 touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          currentRef.current = {
            tool,
            color: tool === "marker" ? "#ffe16f" : color,
            width: widthFor(tool),
            points: [pos(e)],
          };
          setCount((c) => c + 1);
        }}
        onPointerMove={(e) => {
          const stroke = currentRef.current;
          if (!stroke) return;
          stroke.points.push(pos(e));
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!ctx || stroke.points.length < 2) return;
          const a = stroke.points[stroke.points.length - 2];
          const b = stroke.points[stroke.points.length - 1];
          ctx.beginPath();
          ctx.globalCompositeOperation =
            stroke.tool === "eraser" ? "destination-out" : "source-over";
          ctx.globalAlpha = stroke.tool === "marker" ? 0.32 : 1;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        }}
        onPointerUp={() => {
          if (currentRef.current) {
            strokesRef.current.push(currentRef.current);
            currentRef.current = null;
          }
        }}
        onPointerLeave={() => {
          if (currentRef.current) {
            strokesRef.current.push(currentRef.current);
            currentRef.current = null;
          }
        }}
      />

      <div className="absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-3">
        <span className="pointer-events-none flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1 text-center font-heading text-[11.5px] font-semibold text-white">
          <Pen className="size-3 shrink-0" aria-hidden /> Mode buram aktif,
          coret-coret di atas soal
        </span>

        <div className="pointer-events-auto flex max-w-full flex-col items-center gap-1 rounded-field border border-navy-700 bg-navy-900 p-1.5 shadow-pop">
          {/* Dua baris yang disengaja: alat gambar di atas, aksi di bawah.
              Sebelumnya tujuh tombol 44 px dibiarkan membungkus sendiri dan
              barisnya pecah di tempat acak pada layar 360 px. */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                onClick={() => {
                  setColor(c.value);
                  setTool("pen");
                }}
                aria-pressed={tool === "pen" && color === c.value}
                className={cn(
                  "grid size-11 place-items-center rounded-full border-2 transition-colors",
                  tool === "pen" && color === c.value
                    ? "border-accent-500 bg-white/10"
                    : "border-transparent hover:bg-white/10",
                )}
              >
                <span
                  className="size-3.5 rounded-full"
                  style={{
                    backgroundColor:
                      c.value === "#1a1a1b" ? "#e5e7eb" : c.value,
                  }}
                  aria-hidden
                />
              </button>
            ))}

            <span className="mx-0.5 h-6 w-px bg-white/15" />

            <button
              type="button"
              title="Stabilo"
              aria-label="Stabilo"
              onClick={() => setTool("marker")}
              aria-pressed={tool === "marker"}
              className={cn(
                "grid size-11 place-items-center rounded-full border-2 transition-colors",
                tool === "marker"
                  ? "border-accent-500 bg-white/10 text-accent-500"
                  : "border-transparent text-white/70 hover:bg-white/10",
              )}
            >
              <Highlighter className="size-4" aria-hidden />
            </button>

            <button
              type="button"
              title="Penghapus"
              aria-label="Penghapus"
              onClick={() => setTool("eraser")}
              aria-pressed={tool === "eraser"}
              className={cn(
                "grid size-11 place-items-center rounded-full border-2 transition-colors",
                tool === "eraser"
                  ? "border-accent-500 bg-white/10 text-accent-500"
                  : "border-transparent text-white/70 hover:bg-white/10",
              )}
            >
              <Eraser className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Urungkan"
              aria-label="Urungkan"
              disabled={count === 0}
              onClick={() => {
                strokesRef.current.pop();
                setCount((c) => Math.max(0, c - 1));
                redraw();
              }}
              className="grid size-11 place-items-center rounded-field text-white/70 transition-colors hover:bg-white/10 disabled:text-white/25"
            >
              <Undo2 className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              title="Hapus semua"
              aria-label="Hapus semua"
              onClick={() => {
                strokesRef.current = [];
                setCount(0);
                redraw();
              }}
              className="grid size-11 place-items-center rounded-field text-clay-200 transition-colors hover:bg-white/10"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>

            <span className="mx-0.5 h-6 w-px bg-white/15" />

            <button
              type="button"
              title="Tutup Buram"
              aria-label="Tutup Buram"
              onClick={onClose}
              className="grid size-11 place-items-center rounded-field bg-accent-500 text-navy-900 transition-colors hover:bg-accent-400"
            >
              <X className="size-4" strokeWidth={2.6} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
