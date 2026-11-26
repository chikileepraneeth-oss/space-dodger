import os from 'os';

export function lanIpv4Addresses() {
  const ips = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) ips.push(entry.address);
    }
  }
  return ips;
}

function rank(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 2;
  return 3;
}

export function preferredLanIp(ips = lanIpv4Addresses()) {
  return [...ips].sort((a, b) => rank(a) - rank(b))[0] || null;
}

export function controllerUrl(base, sessionId, token) {
  const url = new URL('/controller', base);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('token', token);
  return url.toString();
}
