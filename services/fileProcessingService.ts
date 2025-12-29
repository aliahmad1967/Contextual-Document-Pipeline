import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(' ') + '\n';
  }
  
  return fullText;
};

export const extractTextFromEpub = async (file: File): Promise<string> => {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  let fullText = '';

  // EPUB text is usually in OEBPS/ or OPS/ folders in .xhtml or .html files
  const textFiles = Object.keys(content.files).filter(name => 
    name.endsWith('.xhtml') || name.endsWith('.html') || name.endsWith('.htm')
  );

  // Sorting to maintain some level of order, though spine order is usually defined in .opf
  textFiles.sort();

  for (const fileName of textFiles) {
    const text = await content.file(fileName)?.async('string');
    if (text) {
      // Basic HTML tag stripping
      const doc = new DOMParser().parseFromString(text, 'text/html');
      fullText += (doc.body.textContent || '') + '\n';
    }
  }

  return fullText;
};