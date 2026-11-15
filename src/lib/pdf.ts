/**
 * PDF из HTML-элемента (отчёт). Страница рендерится в изображение (html2canvas)
 * и раскладывается по листам A4 (jsPDF). Так арабский текст и кириллица выглядят
 * ровно как на экране, без встраивания шрифтов. Библиотеки загружаются только здесь.
 */
export async function elementToPdf(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  // PDF всегда в светлой теме — его печатают и пересылают.
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  if (wasDark) root.classList.remove('dark');
  let canvas: HTMLCanvasElement;
  try {
    await document.fonts?.ready;
    canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  } finally {
    if (wasDark) root.classList.add('dark');
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const margin = 28;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW - margin * 2;
  const k = imgW / canvas.width; // pt на пиксель
  const sliceH = Math.floor((pageH - margin * 2) / k); // высота листа в пикселях холста

  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
    const h = Math.min(sliceH, canvas.height - y);
    const part = document.createElement('canvas');
    part.width = canvas.width;
    part.height = h;
    part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, h * k);
  }
  return pdf.output('blob');
}
