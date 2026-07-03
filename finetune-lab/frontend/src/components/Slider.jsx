import React, { useRef, useCallback } from "react";

export function Slider({ label, min, max, step, value, onChange, disabled }) {
  const trackRef = useRef(null);
  const isDragging = useRef(false);
  const [active, setActive] = React.useState(false);
  const [dragPct, setDragPct] = React.useState(null); // Pure visual tracking

  const clamp = useCallback(
    (raw) => {
      const steps = Math.round((raw - min) / step);
      const snapped = min + steps * step;
      const clamped = Math.min(max, Math.max(min, snapped));
      return step < 1 ? parseFloat(clamped.toFixed(2)) : Math.round(clamped);
    },
    [min, max, step]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      // Calculate clamped ratio strictly between 0 and 1
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));

      // 1. Update visual indicator smoothly (no steps)
      setDragPct(ratio * 100);

      // 2. Propagate the snapped value to parent
      onChange(clamp(min + ratio * (max - min)));
    },
    [min, max, clamp, onChange, disabled]
  );

  const onPointerDown = useCallback(
    (e) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      setActive(true);
      handlePointerMove(e);
    },
    [disabled, handlePointerMove]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging.current) return;
      handlePointerMove(e);
    },
    [handlePointerMove]
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    setActive(false);
    setDragPct(null); // Snap back to true value visually on release
  }, []);

  // If actively dragging, use the buttery smooth internal percentage.
  // Otherwise, base the visual position on the parent's actual grounded value.
  const pct = active && dragPct !== null ? dragPct : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className="select-none">
      <div className="flex justify-between items-center mb-3">
        <label className="text-xs font-bold text-neu-dim tracking-widest uppercase">{label}</label>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded border transition-all duration-200"
          style={{
            color: active ? "var(--accent-light)" : "var(--accent)",
            background: active ? "rgba(255,107,0,0.15)" : "rgba(255,107,0,0.08)",
            borderColor: active ? "rgba(255,107,0,0.4)" : "rgba(255,107,0,0.2)",
            boxShadow: active ? "0 0 8px rgba(255,107,0,0.3)" : "none",
          }}
        >
          {value}
        </span>
      </div>

      {/* Track area — captures pointer events */}
      <div
        ref={trackRef}
        className={`relative h-10 flex items-center touch-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Sunken trough */}
        <div
          className="absolute inset-y-0 my-auto w-full rounded-full pointer-events-none"
          style={{
            height: "8px",
            background: "var(--bg-dark)",
            boxShadow: "inset 3px 3px 7px #111315, inset -3px -3px 7px #2c323a",
            border: "1px solid rgba(0,0,0,0.35)",
          }}
        />

        {/* Filled portion */}
        <div
          className="absolute left-0 rounded-full pointer-events-none"
          style={{
            height: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            width: `${pct}%`,
            background: active ? "linear-gradient(90deg, #ff6b00, #ff9d4d)" : "linear-gradient(90deg, #cc5500, #ff6b00)",
            boxShadow: active ? "0 0 12px rgba(255,107,0,0.7), 0 0 24px rgba(255,107,0,0.3)" : "0 0 6px rgba(255,107,0,0.4)",
            transition: "background 0.2s ease, box-shadow 0.2s ease",
            borderRadius: "99px",
          }}
        />

        {/* Thumb */}
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{
            left: `calc(${pct}% - ${active ? 13 : 11}px)`,
            top: "50%",
            transform: `translateY(-50%) scale(${active ? 1.15 : 1})`,
            width: active ? "26px" : "22px",
            height: active ? "26px" : "22px",
            borderRadius: "50%",
            background: "var(--bg-dark)",
            border: active ? "2px solid var(--accent)" : "1px solid rgba(255,107,0,0.4)",
            boxShadow: active
              ? `0 0 16px rgba(255,107,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1), 4px 4px 10px rgba(0,0,0,0.6)`
              : `0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.05)`,
            transition: "width 0.15s ease, height 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, border 0.15s ease",
            zIndex: 10,
          }}
        >
          {/* Inner glowing core */}
          <div
            style={{
              width: active ? "8px" : "4px",
              height: active ? "8px" : "4px",
              borderRadius: "50%",
              background: active ? "var(--accent-light)" : "var(--accent)",
              boxShadow: active ? "0 0 10px var(--accent-light)" : "none",
              transition: "all 0.15s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}
