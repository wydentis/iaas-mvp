export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-red-950">
      {/* deep radial base that pulses */}
      <div className="animate-radial-pulse absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,_#7f1d1d_0%,_#3b0000_55%,_#0d0000_100%)]" />

      {/* blobs */}
      <div className="animate-blob1 absolute -left-48 -top-48 h-[640px] w-[640px] rounded-full bg-red-700/60 blur-[110px]" />
      <div className="animate-blob2 absolute -bottom-48 -right-48 h-[580px] w-[580px] rounded-full bg-rose-800/55 blur-[100px]" />
      <div className="animate-blob3 absolute left-1/2 top-1/4 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-red-600/40 blur-[90px]" />
      <div className="animate-blob4 absolute bottom-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-rose-700/45 blur-[80px]" />
      <div className="animate-blob5 absolute right-1/4 top-1/2 h-[340px] w-[340px] rounded-full bg-red-500/30 blur-[70px]" />

      {/* sweeping shimmer */}
      <div className="animate-sweep absolute inset-y-0 w-80 bg-gradient-to-r from-transparent via-rose-400/12 to-transparent" />

      {/* dark vignette edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_#0a0000_100%)] opacity-75" />
    </div>
  );
}
