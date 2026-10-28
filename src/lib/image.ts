/** Perkecil foto (mis. screenshot chat) jadi JPEG ±1280px supaya upload cepat & hemat Drive. */
export function compressImage(file: File, max = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('File harus berupa gambar.')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Gagal membaca file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gambar tidak bisa dibuka.'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}
export const dataUrlKB = (u: string) => Math.round((u.length * 3) / 4 / 1024);
