/**
 * Exports the layout canvas as a PNG. The SVG's styling lives in style.css, which a standalone image
 * can't see, so the computed styles are copied onto an off-screen clone before it is drawn to a canvas.
 */
const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor'];
const PADDING = 24;
const SCALE = 2;
const BACKGROUND = '#1a1a1a';

function svgToCanvas(svg) {
  const box = svg.getBBox();
  const width = Math.ceil(box.x + box.width + PADDING);
  const height = Math.ceil(box.y + box.height + PADDING);

  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden';
  const clone = svg.cloneNode(true);
  clone.removeAttribute('style');
  clone.querySelectorAll('.port-hit, .rubber-band').forEach((el) => el.remove());
  clone.querySelectorAll('.selected, .drag-source, .drop-target').forEach((el) => el.classList.remove('selected', 'drag-source', 'drop-target'));
  holder.append(clone);
  document.body.append(holder);
  clone.querySelectorAll('*').forEach((el) => {
    const computed = getComputedStyle(el);
    el.style.cssText = STYLE_PROPS.map((p) => `${p}:${computed.getPropertyValue(p)}`).join(';');
  });
  holder.remove();

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  bg.setAttribute('fill', BACKGROUND);
  clone.prepend(bg);
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

// Resolves with a PNG Blob of the canvas contents; rejects if there is nothing to draw.
export function canvasToPng(svg) {
  const { markup, width, height } = svgToCanvas(svg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = width * SCALE;
      c.height = height * SCALE;
      const ctx = c.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.drawImage(img, 0, 0, width, height);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('could not create the image'))), 'image/png');
    };
    img.onerror = () => reject(new Error('could not draw the layout'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
