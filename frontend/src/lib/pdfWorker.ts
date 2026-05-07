import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - Vite handles ?url for worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export { pdfjsLib };
