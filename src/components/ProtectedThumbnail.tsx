import { useEffect, useState } from 'react';
import type { CaptureImage } from '../model';
import { thumbnail } from '../render';

export default function ProtectedThumbnail({ image }: { image: CaptureImage }) {
  const [preview, setPreview] = useState<{ source: string; annotations: CaptureImage['annotations']; url: string } | null>(null);
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      thumbnail(image).then(url => { if (live) setPreview({ source: image.dataUrl, annotations: image.annotations, url }); })
        .catch(() => { if (live) setPreview(null); });
    }, 80);
    return () => { live = false; window.clearTimeout(timer); };
  }, [image.dataUrl, image.annotations]);
  const ready = preview?.source === image.dataUrl && preview.annotations === image.annotations;
  return <img src={ready ? preview.url : undefined} alt="" draggable={false} decoding="async" data-protected-thumbnail={ready ? 'ready' : 'pending'} style={ready ? undefined : { visibility: 'hidden' }} />;
}
