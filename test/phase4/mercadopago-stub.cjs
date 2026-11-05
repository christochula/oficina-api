// Deterministic provider simulator used exclusively by the local integration stack.
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const preferences = new Map();
const payments = new Map();
http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, 'http://localhost');
  let result;
  if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
    const id = randomUUID(); result = { id, init_point: `http://localhost:8088/checkout/${id}`, sandbox_init_point: `http://localhost:8088/checkout/${id}` };
    preferences.set(id, { ...body, ...result });
  } else if (url.pathname === '/checkout/preferences/search') {
    result = { elements: [...preferences.values()].filter(p => p.external_reference === url.searchParams.get('external_reference')) };
  } else if (url.pathname === '/v1/payments/search') {
    result = { results: [...payments.values()].filter(p => p.external_reference === url.searchParams.get('external_reference')) };
  } else if (url.pathname.startsWith('/checkout/preferences/')) {
    result = preferences.get(url.pathname.split('/').pop());
  } else if (req.method === 'POST' && url.pathname === '/test/payments') {
    result = { id: randomUUID(), currency_id: 'BRL', status: 'approved', ...body }; payments.set(String(result.id), result);
  } else if (url.pathname.startsWith('/v1/payments/')) {
    result = payments.get(url.pathname.split('/').pop());
  } else if (url.pathname.startsWith('/checkout/')) {
    res.writeHead(200, {'Content-Type':'text/html'}); res.end('<h1>Checkout de teste</h1>'); return;
  } else { result = { status: 'ok' }; }
  res.writeHead(result ? 200 : 404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result || { error: 'Not found' }));
}).listen(8088, '0.0.0.0');
