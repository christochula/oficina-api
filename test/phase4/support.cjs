const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomUUID, createHmac } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const urls = { os: process.env.OS_TEST_URL || 'http://localhost:3000', billing: process.env.BILLING_TEST_URL || 'http://localhost:3001', production: process.env.PRODUCTION_TEST_URL || 'http://localhost:3002', provider: 'http://localhost:8088' };
const secret = 'local-only-access-secret-32-bytes-minimum';
const internal = 'local-only-internal-token-32-bytes-minimum';
async function request(service, path, token, body, method = 'GET', expected) {
  const response = await fetch(urls[service] + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Internal-Token': internal }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (expected) { assert.equal(response.status, expected, JSON.stringify(data)); return data; }
  assert.ok(response.ok, `${service} ${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data.data ?? data;
}
async function eventually(work, test, timeout = 60000) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) { try { last = await work(); if (test(last)) return last; } catch (e) { last = e.message; } await new Promise(r => setTimeout(r, 500)); }
  throw new Error(`Estado não convergiu: ${JSON.stringify(last)}`);
}
const id = record => typeof record.id === 'string' ? record.id : record.id.valor;
async function setup() {
  execFileSync('docker', ['compose','-f','compose.phase4.yml','exec','-T','-e','ADMIN_SEED_PASSWORD=Local-only-admin-password-2026','os','npm','run','seed'], { stdio: 'pipe' });
  const admin = await request('os','/api/v1/auth/login', null, { email:'admin@oficina.com', senha:'Local-only-admin-password-2026' },'POST');
  const unique = randomUUID();
  const user = await request('os','/api/v1/usuarios', admin.accessToken, { nome:'Mecânico demonstração',email:`mecanico-${unique}@example.com`,senha:'Local-only-mechanic-password',papel:'MECANICO' },'POST');
  const mechanic = await request('os','/api/v1/auth/login',null,{email:`mecanico-${unique}@example.com`,senha:'Local-only-mechanic-password'},'POST');
  let client;
  try { client = await request('os','/api/v1/clientes/documento/52998224725',admin.accessToken); }
  catch { client = await request('os','/api/v1/clientes',admin.accessToken,{tipoDoc:'CPF',numeroDoc:'52998224725',nome:'Cliente fictício Fase 4',email:'cliente@example.com',telefone:'11999990000'},'POST'); }
  let vehicle;
  try { vehicle = await request('os','/api/v1/veiculos/placa/BRA2E19',admin.accessToken); }
  catch { vehicle = await request('os','/api/v1/veiculos',admin.accessToken,{placa:'BRA2E19',renavam:'12345678901',chassi:'9BWZZZ377VT004251',marca:'Fiat',modelo:'Demo',ano:2020,cor:'Prata'},'POST'); }
  const clientToken = jwt.sign({sub:id(client),client_id:id(client),role:'CLIENTE',papel:'CLIENTE',token_use:'client'},secret,{issuer:'oficina-auth-serverless',audience:'oficina-api',expiresIn:'1h'});
  return {admin,mechanic,mechanicId:id(user),clientId:id(client),vehicleId:id(vehicle),clientToken};
}
async function prepare(data, quantity = 1, stock = 10, filialId = 'filial-sp') {
  const pecaId = `peca-${randomUUID()}`;
  await request('production',`/api/v1/production/stock/${pecaId}`,data.admin.accessToken,{filialId,quantity:stock,description:'Filtro demonstração'},'PUT');
  const order = await request('os','/api/v1/ordens-servico',data.admin.accessToken,{clienteId:data.clientId,veiculoId:data.vehicleId,filialId,problemasRelatados:[{descricao:'Revisão de demonstração'}]},'POST');
  await eventually(() => request('billing',`/api/v1/billing/internal/orders/${order.id}`),Boolean);
  await eventually(() => request('production',`/api/v1/production/internal/orders/${order.id}`),Boolean);
  await request('production',`/api/v1/production/orders/${order.id}/assign`,data.admin.accessToken,{mecanicoId:data.mechanicId},'POST');
  await eventually(() => request('billing',`/api/v1/billing/internal/orders/${order.id}`),r=>r.mecanicoId===data.mechanicId);
  await request('production',`/api/v1/production/orders/${order.id}/diagnosis`,data.mechanic.accessToken,{descricao:'Substituir filtro'},'POST');
  await request('billing',`/api/v1/billing/orders/${order.id}/budget`,data.mechanic.accessToken,{items:[{description:'Filtro',quantity,unitPriceCents:10000,pecaId}]},'PUT');
  await eventually(() => read(data,order.id),r=>r.status==='AGUARDANDO_APROVACAO');
  return {...order,pecaId};
}
function read(data,osId) { return request('os',`/api/v1/ordens-servico/${osId}`,data.admin.accessToken); }
async function approve(data,order) {
  await request('billing',`/api/v1/billing/orders/${order.id}/approve`,data.clientToken,{},'POST');
  return eventually(()=>read(data,order.id),r=>r.sagaState==='COMPLETED'||r.sagaState==='COMPENSATED');
}
async function complete(data,order) {
  await request('production',`/api/v1/production/orders/${order.id}/start`,data.mechanic.accessToken,{},'POST');
  await request('production',`/api/v1/production/orders/${order.id}/consume`,data.mechanic.accessToken,{pecaId:order.pecaId,quantidade:1},'POST');
  await request('production',`/api/v1/production/orders/${order.id}/complete`,data.mechanic.accessToken,{},'POST');
  return eventually(()=>request('billing',`/api/v1/billing/orders/${order.id}`,data.clientToken),r=>Boolean(r.payment?.checkoutUrl));
}
async function pay(data,order) {
  const billing = await request('billing',`/api/v1/billing/orders/${order.id}`,data.clientToken);
  const p = await request('provider','/test/payments',null,{external_reference:billing.payment.externalReference,transaction_amount:billing.payment.amountCents/100},'POST');
  const requestId=randomUUID(),ts=String(Math.floor(Date.now()/1000));
  const signature=createHmac('sha256','local-only-webhook-secret').update(`id:${String(p.id).toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  const response=await fetch(urls.billing+`/api/v1/billing/webhooks/mercadopago?data.id=${p.id}`,{method:'POST',headers:{'X-Request-Id':requestId,'X-Signature':`ts=${ts},v1=${signature}`}});
  assert.ok(response.ok,await response.text());
  return eventually(()=>read(data,order.id),r=>r.status==='PRONTA_PARA_ENTREGA');
}
module.exports={request,eventually,setup,prepare,approve,complete,pay,read};
