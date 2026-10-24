/** Dark green banner at the top of a page: serif title, optional breadcrumb and a short note on the right. */
export default function PageBand({ title, breadcrumb, note, children }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-hero px-6 py-8 text-hero-fg sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-10 -top-10 select-none text-[14rem] leading-none text-hero-fg/5" aria-hidden="true">✳</div>
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl sm:text-5xl">{title}</h1>
          {breadcrumb && <nav aria-label="Breadcrumb" className="mt-4 text-sm text-hero-fg/80">{breadcrumb}</nav>}
        </div>
        {note && <p className="max-w-xs text-sm text-hero-fg/80">{note}</p>}
      </div>
      {children}
    </section>
  );
}
