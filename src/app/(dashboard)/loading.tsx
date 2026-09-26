// Shown instantly while a server-rendered page (like Overview) is being built
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-[250px] rounded-[34px] bg-card border border-white/[0.05] overflow-hidden relative">
        <div className="absolute inset-0 prism-hero opacity-25 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[190px] rounded-[30px] bg-card border border-white/[0.05] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[280px] rounded-[30px] bg-card border border-white/[0.05] animate-pulse" />
        <div className="h-[280px] rounded-[30px] bg-card border border-white/[0.05] animate-pulse" />
      </div>
    </div>
  );
}
