export function PageHero({ title, description, badge, actions, align = "between" }) {
  return (
    <div
      className={`flex flex-col gap-5 ${
        align === "center" ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between"
      }`}
    >
      <div>
        <h1 className="text-4xl font-light text-neu-text tracking-tight">
          Console <span className="text-neu-dim font-thin">/ {title}</span>
        </h1>
        <p className="text-neu-dim/60 font-mono text-[11px] uppercase tracking-[0.28em] mt-3">
          {description}
        </p>
        <div className="w-16 h-px bg-neu-accent/30 mt-5" />
      </div>
      {(badge || actions) && (
        <div className={`flex flex-wrap gap-3 ${align === "center" ? "justify-center" : "lg:justify-end"}`}>
          {badge && <div className="neu-inset px-4 py-2 rounded-xl">{badge}</div>}
          {actions}
        </div>
      )}
    </div>
  );
}

export function ConsoleSection({ title, icon: Icon, badge, action, children, className = "" }) {
  return (
    <section className={`neu-section ${className}`}>
      <div className="neu-section-header flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-neu-accent shrink-0">
              <Icon size={16} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-neu-text font-bold tracking-tight">{title}</h2>
            {badge && <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">{badge}</div>}
          </div>
        </div>
        {action && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{action}</div>}
      </div>
      <div className="neu-section-body">{children}</div>
    </section>
  );
}

export function EmptyPanel({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-14 space-y-4">
      {Icon && <Icon size={28} className="mx-auto text-neu-dim/40" />}
      <div>
        <p className="text-neu-text text-sm font-medium">{title}</p>
        {description && <p className="text-neu-dim/70 text-xs mt-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}
