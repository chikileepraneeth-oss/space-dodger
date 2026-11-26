import { spawn } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import path from 'path';
import { pathToFileURL } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { certificatePem, loadCertificate } from './server/certs.js';
import { lanIpv4Addresses, preferredLanIp } from './server/hostInfo.js';
import { createSessionManager } from './server/sessionManager.js';
import { attachWebSocket } from './server/websocket.js';

function setupPage(baseUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SPACE DODGER setup</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", sans-serif; background: #070b12; color: #e8fbff; }
    main { max-width: 38rem; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    h1 { font-weight: 650; letter-spacing: 0.14em; font-size: 1.2rem; }
    a.button { display: inline-block; margin: 1rem 0; padding: 0.9rem 1.1rem; background: #37e7ff; color: #041018; text-decoration: none; font-weight: 700; }
    ol { line-height: 1.5; padding-left: 1.2rem; }
    code { color: #9cf6ff; }
    p.note { color: #9eb4c4; }
  </style>
</head>
<body>
  <main>
    <h1>SPACE DODGER</h1>
    <p>iPhone motion sensors only work on a trusted HTTPS page. Install this certificate, then trust it.</p>
    <a class="button" href="/setup/ca.crt">Download certificate</a>
    <ol>
      <li>Install the downloaded profile when iOS asks.</li>
      <li>Open Settings, General, VPN &amp; Device Management, and install the SPACE DODGER profile.</li>
      <li>Open Settings, General, About, Certificate Trust Settings, and enable full trust for SPACE DODGER Local.</li>
      <li>Return to this page and confirm the warning is gone.</li>
      <li>Scan the QR code on the PC game. This phone must use <code>${baseUrl}</code>, not localhost.</li>
    </ol>
    <p class="note">A normal http:// address cannot enable the gyroscope. If you use a trusted tunnel, set PUBLIC_URL and you can skip this certificate.</p>
  </main>
</body>
</html>`;
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
}

export async function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 8443);
  const ips = lanIpv4Addresses();
  const hostIp = process.env.HOST_IP || preferredLanIp(ips);
  // Render (and similar hosts) terminate HTTPS in front of the app, so the app itself speaks plain HTTP.
  const useTls = options.tls ?? (process.env.TLS !== 'off' && !process.env.RENDER);
  const credentials = useTls
    ? await loadCertificate(hostIp ? [hostIp, ...ips.filter((ip) => ip !== hostIp)] : ips)
    : null;
  const isProd = options.production ?? process.argv.includes('--production');
  const scheme = useTls ? 'https' : 'http';
  const trim = (url) => url.replace(/\/$/, '');
  // Where the phone opens the controller page. On Netlify this is the frontend, not this server.
  const frontendUrl = trim(options.frontendUrl ?? process.env.FRONTEND_URL ?? '');
  // Browsers send Origin on WebSocket upgrades; in production only our own site may connect.
  // RENDER_EXTERNAL_URL is set by Render: when one service hosts everything, that is our only origin.
  const hostedUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
  const allowedOrigins = (options.allowedOrigins ?? (process.env.ALLOWED_ORIGINS || frontendUrl || process.env.RENDER_EXTERNAL_URL || '').split(','))
    .map((o) => trim(o.trim()))
    .filter(Boolean);
  const app = express();
  app.disable('x-powered-by');

  let baseUrl = trim(hostedUrl || (hostIp ? `${scheme}://${hostIp}:${port}` : `${scheme}://localhost:${port}`));
  const controllerBase = () => frontendUrl || baseUrl;

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/setup/ca.crt', (_req, res) => {
    if (!useTls) {
      res.status(404).end();
      return;
    }
    res.set('Content-Type', 'application/x-x509-ca-cert');
    res.send(certificatePem());
  });
  app.get('/setup', (_req, res) => {
    res.type('html').send(setupPage(baseUrl));
  });
  app.get(['/controller', '/controller/'], (req, _res, next) => {
    req.url = '/controller.html';
    next();
  });

  let vite = null;
  if (isProd) {
    app.use(express.static(path.resolve('dist')));
  } else {
    // Vite rejects unknown Host headers; allow the PUBLIC_URL host (e.g. a Tailscale name).
    const allowedHosts = process.env.PUBLIC_URL ? [new URL(process.env.PUBLIC_URL).hostname] : [];
    // Imported lazily: production installs (Render) do not need Vite.
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, allowedHosts },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
  }

  const httpsServer = useTls
    ? createHttpsServer({ key: credentials.key, cert: credentials.cert }, app)
    : createHttpServer(app);
  const wss = new WebSocketServer({
    server: httpsServer,
    path: '/ws',
    verifyClient: ({ origin }) => allowedOrigins.length === 0 || allowedOrigins.includes(origin),
  });
  const sessions = createSessionManager();
  const stopHeartbeat = attachWebSocket(wss, { sessions, getBaseUrl: controllerBase });

  await new Promise((resolve, reject) => {
    httpsServer.once('error', reject);
    httpsServer.listen(port, '0.0.0.0', resolve);
  });
  const address = httpsServer.address();
  const boundPort = address.port;
  if (!hostedUrl) {
    baseUrl = hostIp ? `${scheme}://${hostIp}:${boundPort}` : `${scheme}://localhost:${boundPort}`;
  }

  if (options.openBrowser) openBrowser(`${scheme}://localhost:${boundPort}`);

  return {
    httpsServer,
    wss,
    vite,
    port: boundPort,
    get baseUrl() {
      return baseUrl;
    },
    controllerBase,
    allowedOrigins,
    useTls,
    hostIp,
    ips,
    stopHeartbeat,
    async close() {
      stopHeartbeat();
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(resolve));
      if (vite) await vite.close();
      await new Promise((resolve) => httpsServer.close(resolve));
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const hosted = Boolean(process.env.RENDER) || process.argv.includes('--production');
  startServer({ openBrowser: process.env.NO_OPEN !== '1' && !hosted }).then((server) => {
    // Render sends SIGTERM on redeploy: close sockets cleanly so phones reconnect to the new instance.
    for (const signal of ['SIGTERM', 'SIGINT']) {
      process.once(signal, () => {
        server.close().finally(() => process.exit(0));
      });
    }
    console.log('');
    console.log('SPACE DODGER');
    if (hosted) {
      console.log(`  Backend listening on port ${server.port} (${server.useTls ? 'HTTPS' : 'HTTP behind host TLS'})`);
      console.log(`  Controller links point to: ${server.controllerBase()}`);
      console.log(`  Allowed origins: ${server.allowedOrigins.join(', ') || 'any (set FRONTEND_URL!)'}`);
      return;
    }
    console.log(`  PC:      https://localhost:${server.port}`);
    console.log(`  Phone:   ${server.baseUrl}`);
    console.log(`  Setup:   ${server.baseUrl}/setup`);
    if (!server.hostIp && !process.env.PUBLIC_URL) {
      console.log('  No LAN address found. The QR code cannot reach this PC from an iPhone until HOST_IP or PUBLIC_URL is set.');
    }
    console.log('');
    console.log('On the PC, accept the certificate warning once.');
    console.log('On the iPhone, open the setup URL above before scanning the QR code.');
    console.log('Motion sensors require trusted HTTPS. http:// will not work.');
  }).catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
