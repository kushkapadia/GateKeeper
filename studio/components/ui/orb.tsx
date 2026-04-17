"use client";

import { useRef, useEffect, useCallback } from "react";

interface OrbProps {
  className?: string;
}

export function Orb({ className = "" }: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;

    const draw = () => {
      t += 0.003;
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.42;
      const baseR = Math.min(w, h) * 0.38;

      // Large ambient glow fills viewport
      ctx.globalAlpha = 0.12;
      const ambGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.5);
      ambGrad.addColorStop(0, "#7C6CF7");
      ambGrad.addColorStop(0.4, "#6C5CE7");
      ambGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ambGrad;
      ctx.fillRect(0, 0, w, h);

      // Smooth blob layers
      const layers = [
        { r: baseR * 1.2, alpha: 0.06, c: "#4834B0", off: 0 },
        { r: baseR * 1.0, alpha: 0.10, c: "#5A4BD1", off: 1.0 },
        { r: baseR * 0.8, alpha: 0.18, c: "#6C5CE7", off: 2.0 },
        { r: baseR * 0.6, alpha: 0.28, c: "#7C6CF7", off: 3.0 },
        { r: baseR * 0.42, alpha: 0.35, c: "#A29BFE", off: 4.0 },
        { r: baseR * 0.25, alpha: 0.4,  c: "#C4B5FD", off: 5.0 },
      ];

      for (const l of layers) {
        ctx.beginPath();
        const n = 100;
        const pts: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          const wobble =
            Math.sin(a * 2 + t * 1.2 + l.off) * 0.08 +
            Math.cos(a * 3 - t * 0.8 + l.off * 0.7) * 0.06 +
            Math.sin(a * 5 + t * 1.8 + l.off * 1.3) * 0.03;
          const r = l.r * (1 + wobble);
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }

        // Catmull-Rom for smoothness
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[(i - 1 + pts.length) % pts.length];
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          const p3 = pts[(i + 2) % pts.length];
          ctx.bezierCurveTo(
            p1[0] + (p2[0] - p0[0]) / 6,
            p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6,
            p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1]
          );
        }
        ctx.closePath();

        const g = ctx.createRadialGradient(
          cx + Math.sin(t + l.off) * 10,
          cy + Math.cos(t * 0.6 + l.off) * 10,
          0, cx, cy, l.r * 1.3
        );
        g.addColorStop(0, l.c);
        g.addColorStop(1, l.c + "00"); // transparent
        ctx.globalAlpha = l.alpha;
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Core glow
      ctx.globalAlpha = 0.45;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.2);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.3, "#DDD6FE");
      core.addColorStop(0.7, "#A29BFE");
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Specular
      const sx = cx + Math.sin(t * 0.3) * baseR * 0.2;
      const sy = cy - baseR * 0.15 + Math.cos(t * 0.25) * baseR * 0.1;
      ctx.globalAlpha = 0.15;
      const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, baseR * 0.3);
      spec.addColorStop(0, "#ffffff");
      spec.addColorStop(1, "transparent");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(sx, sy, baseR * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  useEffect(() => {
    init();
    const handleResize = () => {
      cancelAnimationFrame(animRef.current);
      init();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: "block" }}
    />
  );
}
