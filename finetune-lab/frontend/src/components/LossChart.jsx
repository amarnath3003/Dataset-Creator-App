import React, { useMemo } from "react";

// Dependency-free SVG line chart for the training loss series.
// `data` is [{ step, loss }]. Renders an area+line with a subtle grid.

export default function LossChart({ data = [], height = 200 }) {
  const width = 600; // viewBox units; scales responsively via preserveAspectRatio

  const geom = useMemo(() => {
    const pts = data.filter((d) => d && typeof d.loss === "number" && !Number.isNaN(d.loss));
    if (pts.length < 2) return null;

    const xs = pts.map((p) => p.step ?? 0);
    const ys = pts.map((p) => p.loss);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = 12;
    const padY = 16;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const sx = (x) => padX + ((x - minX) / spanX) * (width - padX * 2);
    const sy = (y) => padY + (1 - (y - minY) / spanY) * (height - padY * 2);

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.step ?? 0).toFixed(1)} ${sy(p.loss).toFixed(1)}`).join(" ");
    const area = `${line} L ${sx(maxX).toFixed(1)} ${(height - padY).toFixed(1)} L ${sx(minX).toFixed(1)} ${(height - padY).toFixed(1)} Z`;

    return { line, area, minY, maxY, first: ys[0], last: ys[ys.length - 1] };
  }, [data, height]);

  if (!geom) {
    return (
      <div className="neu-trough rounded-xl flex items-center justify-center text-neu-dim/60 text-xs font-mono uppercase tracking-widest" style={{ height }}>
        Waiting for loss data…
      </div>
    );
  }

  const trendDown = geom.last <= geom.first;

  return (
    <div className="neu-trough rounded-xl p-3 relative">
      <div className="absolute top-3 right-4 flex gap-4 text-[10px] font-mono text-neu-dim uppercase tracking-widest z-10">
        <span>min {geom.minY.toFixed(3)}</span>
        <span className={trendDown ? "text-green-500" : "text-red-400"}>
          now {geom.last.toFixed(3)}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        <path d={geom.area} fill="url(#lossFill)" />
        <path d={geom.line} fill="none" stroke="#FF6B00" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
