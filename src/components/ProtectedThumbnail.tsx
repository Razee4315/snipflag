import { useEffect, useState } from 'react';
import type { CaptureImage } from '../model';
import { thumbnail } from '../render';

/**
 * Flattened thumbnail of an image. While a new revision renders, the previous flattened thumbnail of the same
 * image stays on screen, so the tile does not blink after every mark. The original pixels are never shown.
 */
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
  // A thumbnail of other pixels (after a crop, or another image in this slot) is never reused.
  const usable = preview?.source === image.dataUrl ? preview : null;
  const ready = !!usable && usable.annotations === image.annotations;
  return <img src={usable?.url} alt="" draggable={false} decoding="async" data-protected-thumbnail={ready ? 'ready' : 'pending'} style={usable ? undefined : { visibility: 'hidden' }} />;
}
