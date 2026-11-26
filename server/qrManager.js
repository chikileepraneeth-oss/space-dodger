import QRCode from 'qrcode';

export function makeQrDataUrl(url) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 480,
    color: { dark: '#041018', light: '#f4fdff' },
  });
}
