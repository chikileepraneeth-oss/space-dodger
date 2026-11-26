import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';

const dir = path.resolve('.certs');

export async function loadCertificate(ips) {
  if (process.env.CERT_FILE && process.env.CERT_KEY) {
    return {
      key: fs.readFileSync(process.env.CERT_KEY),
      cert: fs.readFileSync(process.env.CERT_FILE),
      generated: false,
    };
  }

  fs.mkdirSync(dir, { recursive: true });
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  const metaPath = path.join(dir, 'meta.json');
  const hosts = ['localhost', ...ips].sort().join(',');

  if (fs.existsSync(metaPath) && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.hosts === hosts) {
      return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath), generated: true };
    }
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...ips.map((ip) => ({ type: 7, ip })),
  ];
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'SPACE DODGER Local' }], {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames },
    ],
  });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(metaPath, JSON.stringify({ hosts }));
  return { key: pems.private, cert: pems.cert, generated: true };
}

export function certificatePem() {
  const certPath = process.env.CERT_FILE || path.join(dir, 'cert.pem');
  return fs.readFileSync(certPath);
}
