interface KinescopePlayerProps {
  url: string;
  title?: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /kinescope\.io\/embed\/(\d+)/,
    /kinescope\.io\/(\d+)/,
    /kinescope\.io\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  if (url.match(/^\d+$/)) {
    return url;
  }
  if (url.match(/^[a-zA-Z0-9_-]+$/)) {
    return url;
  }

  return null;
}

export function KinescopePlayer({ url, title }: KinescopePlayerProps) {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return (
      <div className="aspect-video bg-[#ebe8dc] rounded-xl flex items-center justify-center text-[#3d3527]/60">
        Неверный формат ссылки на видео
      </div>
    );
  }

  const embedUrl = `https://kinescope.io/embed/${videoId}`;

  return (
    <div className="space-y-2">
      {title && (
        <h4 className="font-medium text-[#3d3527]">{title}</h4>
      )}
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={embedUrl}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media;"
          frameBorder="0"
          allowFullScreen
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
          }}
          className="rounded-xl"
        />
      </div>
    </div>
  );
}

interface KinescopeMultiPlayerProps {
  videos: Array<{ id?: string; url: string; title?: string; order?: number }>;
}

export function KinescopeMultiPlayer({ videos }: KinescopeMultiPlayerProps) {
  if (!videos || videos.length === 0) {
    return null;
  }

  const sortedVideos = [...videos].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-6">
      {sortedVideos.map((video, index) => (
        <KinescopePlayer
          key={video.id || index}
          url={video.url}
          title={video.title || (sortedVideos.length > 1 ? `Видео ${index + 1}` : undefined)}
        />
      ))}
    </div>
  );
}
