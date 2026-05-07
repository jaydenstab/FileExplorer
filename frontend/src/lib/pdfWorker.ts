let pdfjsLoadPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Lazy-load pdf.js and worker (keeps main bundle smaller until a PDF is opened).
 */
export async function getPdfJsLib(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsLoadPromise) {
    pdfjsLoadPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      return pdfjs;
    })();
  }
  return pdfjsLoadPromise;
}
