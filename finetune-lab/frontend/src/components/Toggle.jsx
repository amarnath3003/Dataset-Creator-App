export function Toggle({ on, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-shadow duration-200 outline-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{
        background: "var(--bg-dark)",
        boxShadow: on
          ? "inset 3px 3px 7px #111315, inset -3px -3px 7px #2c323a, 0 0 10px var(--accent-glow-sm)"
          : "inset 3px 3px 7px #111315, inset -3px -3px 7px #2c323a",
        border: "1px solid rgba(0,0,0,0.35)",
      }}
    >
      <div
        className="absolute top-1/2 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          left: on ? "calc(100% - 24px)" : "4px",
          transform: "translateY(-50%)",
          width: "20px",
          height: "20px",
          background: "var(--bg-base)",
          border: on ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.05)",
          boxShadow: on
            ? "0 0 10px var(--accent-glow), inset 0 1px 2px rgba(255,255,255,0.1)"
            : "3px 3px 6px #141619, -3px -3px 6px #2e343b",
        }}
      >
        {on && (
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent)",
            }}
          />
        )}
      </div>
    </button>
  );
}
