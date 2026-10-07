/**
 * Local: the steps of the PNG export and the image copy (Actions.svelte) as
 * promises, so the whole of it — image load, canvas, blob, clipboard write —
 * settles only when it is done and a failure reaches the caller (the copy
 * button then shows an error rather than a tick). Upstream registered the
 * image handlers and returned, and did not wait for the clipboard write.
 */

/** Load an image from a URL (a `data:` SVG); rejects on an error or when it takes too long. */
export const loadImage = (src: string, timeoutMs = 10_000): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      reject(new Error('The diagram image did not load in time'));
    }, timeoutMs);
    image.addEventListener('load', () => {
      clearTimeout(timer);
      resolve(image);
    });
    image.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('The diagram could not be drawn as an image'));
    });
    image.src = src;
  });

/** The canvas as a PNG blob; rejects when the canvas gives none. */
export const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The image is empty'));
    }, type);
  });

/** Put the image on the clipboard; settles when the browser has done so (or refused). */
export const copyImageBlob = async (
  blob: Blob,
  clipboard: Clipboard = navigator.clipboard
): Promise<void> => {
  if (typeof ClipboardItem === 'undefined' || typeof clipboard?.write !== 'function') {
    throw new Error('This browser cannot copy images to the clipboard');
  }
  await clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
};

/**
 * Pan/zoom is turned off while the diagram is captured (so the export is not the
 * zoomed view) and set back to what it was afterwards — also when the capture
 * fails before an image exists (no diagram, no canvas). Captures that overlap
 * (a second click) share one pause, so the second does not take "off" for the
 * value to go back to.
 */
export const createPanZoomPause = (
  get: () => boolean | undefined,
  set: (panZoom: boolean) => void
) => {
  let running = 0;
  let previous: boolean | undefined;
  return async <T>(work: () => Promise<T>): Promise<T> => {
    if (running === 0) previous = get();
    running++;
    set(false);
    try {
      return await work();
    } finally {
      running--;
      if (running === 0) set(previous ?? true);
    }
  };
};
