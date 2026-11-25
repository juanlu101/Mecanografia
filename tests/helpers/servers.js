/* Servidores para las pruebas de navegador:
   - la app (archivos estáticos, como GitHub Pages)
   - un «Google Apps Script» que ejecuta el Code.gs real sobre la hoja simulada */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadServer } = require('./load-server');
const { ROOT } = require('./load-client');

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function listen(handler) {
  return new Promise(resolve => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function startServers() {
  const app = await listen((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  const gas = { server: loadServer(), busy: 0, requests: 0, down: false };
  const google = await listen((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = obj => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
    // controles de las pruebas
    if (u.pathname === '/__reset') { gas.server = loadServer(); gas.busy = 0; gas.down = false; return send({ ok: true }); }
    if (gas.down) { res.writeHead(503, { 'Access-Control-Allow-Origin': '*' }); return res.end('<html>Error</html>'); }
    gas.requests++;
    if (req.method === 'POST') {
      let body = '';
      req.on('data', ch => { body += ch; });
      req.on('end', () => {
        if (gas.busy > 0) { gas.busy--; return send({ ok: false, error: 'ocupado' }); }
        send(JSON.parse(gas.server.ctx.doPost({ postData: { contents: body } }).getContent()));
      });
      return;
    }
    send(JSON.parse(gas.server.ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }).getContent()));
  });

  const appUrl = `http://127.0.0.1:${app.address().port}/`;
  const syncUrl = `http://127.0.0.1:${google.address().port}/exec`;
  return {
    appUrl, syncUrl, gas,
    sheet: name => (gas.server.sheets[name] ? gas.server.sheets[name].rows() : []),
    reset: () => { gas.server = loadServer(); gas.busy = 0; gas.down = false; },
    stop: () => Promise.all([app, google].map(s => new Promise(r => { s.closeAllConnections && s.closeAllConnections(); s.close(r); })))
  };
}

module.exports = { startServers };
