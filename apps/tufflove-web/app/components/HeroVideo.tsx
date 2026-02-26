"use client";

const YOUTUBE_ID = "c9fvF4jEDFI";
const YOUTUBE_EMBED = `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=0&controls=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;

export default function HeroVideo() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_-20px_rgba(219,39,119,0.35)]">
      <div className="aspect-video w-full">
        <iframe
          src={YOUTUBE_EMBED}
          title="TUFF LOVE Masterclass"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
