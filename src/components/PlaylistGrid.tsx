import { ThumbsUp } from "lucide-react";

export interface Track {
  id: number;
  track_name: string;
  artist_name?: string;
  image_url?: string;
  spotify_url?: string;
  votes: number;
  already_voted?: boolean;
}

type LikeDisplayMode = "button" | "count" | "both";

export default function PlaylistGrid({
  tracks,
  onVote,
  likeDisplay = "button",
  enableRedirect = false,
  hrefForTrack,
  onCardClick,
}: {
  tracks: Track[];
  onVote: (trackId: number) => void;
  likeDisplay?: LikeDisplayMode;
  enableRedirect?: boolean;
  hrefForTrack?: (t: Track) => string | undefined;
  onCardClick?: (t: Track) => void;
}) {
  const sorted = [...tracks].sort((a, b) => b.votes - a.votes);

  const CardShell: React.FC<{ t: Track; children: React.ReactNode }> = ({ t, children }) => {
    const href = enableRedirect ? hrefForTrack?.(t) ?? t.spotify_url : undefined;
    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative rounded-lg overflow-hidden shadow-md group hover:scale-[1.02] transition-transform cursor-pointer"
          style={{
            backgroundImage: `url(${t.image_url || "https://via.placeholder.com/300"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            aspectRatio: "1 / 1",
          }}
        >
          {children}
        </a>
      );
    }
    return (
      <div
        onClick={() => onCardClick?.(t)}
        className="relative rounded-lg overflow-hidden shadow-md group hover:scale-[1.02] transition-transform cursor-pointer"
        style={{
          backgroundImage: `url(${t.image_url || "https://via.placeholder.com/300"})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          aspectRatio: "1 / 1",
        }}
      >
        {children}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {sorted.map((t) => (
        <CardShell key={t.id} t={t}>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-between items-center">
            <div className="text-white">
              <p className="font-semibold text-sm leading-tight">{t.track_name}</p>
              {t.artist_name && <p className="text-xs text-gray-300">{t.artist_name}</p>}
            </div>

            {/* Zone Like */}
            {likeDisplay !== "count" && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVote(t.id); }}>
                <ThumbsUp
                  className={`h-5 w-5 transition ${
                    t.already_voted ? "text-red-500" : "text-white/80"
                  }`}
                />
              </button>
            )}
            {likeDisplay !== "button" && (
              <span className="ml-2 text-white/90 text-sm font-semibold">{t.votes}</span>
            )}
          </div>
        </CardShell>
      ))}
    </div>
  );
}
