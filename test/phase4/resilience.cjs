/* Run against the real Compose stack. Restart is opt-in to avoid interrupting other suites. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const execFileAsync = require('node:util').promisify(execFile);
const { SQSClient, SendMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
const h = require('./support.cjs');

const endpoint = process.env.LOCALSTACK_TEST_URL || 'http://localhost:4566';
const sqs = new SQSClient({ endpoint, region:'us-east-1',credentials:{accessKeyId:'test',secretAccessKey:'test'} });
const queues = {
  production: process.env.PRODUCTION_TEST_QUEUE_URL || `${endpoint}/queue/us-east-1/000000000000/production-commands`,
  os: process.env.OS_TEST_QUEUE_URL || `${endpoint}/queue/us-east-1/000000000000/os-events`,
};
let actors;
before(async () => { actors=await h.setup(); });
after(() => sqs.destroy());

function envelope(order,type,payload={},sagaId=order.sagaId) {
  return {messageId:randomUUID(),type,version:1,sagaId,osId:order.id,filialId:order.filialId,correlationId:`resilience-${order.id}`,occurredAt:new Date().toISOString(),payload};
}
async function send(queue,event) {
  await sqs.send(new SendMessageCommand({QueueUrl:queues[queue],MessageBody:JSON.stringify(event),
    ...(queues[queue].endsWith('.fifo')?{MessageGroupId:event.osId,MessageDeduplicationId:event.messageId}:{})}));
}
async function drained(queue) {
  return h.eventually(async()=>{
    const {Attributes={}}=await sqs.send(new GetQueueAttributesCommand({QueueUrl:queues[queue],AttributeNames:['ApproximateNumberOfMessages','ApproximateNumberOfMessagesNotVisible']}));
    return Number(Attributes.ApproximateNumberOfMessages || 0)+Number(Attributes.ApproximateNumberOfMessagesNotVisible || 0);
  },count=>count===0,60000);
}
const production=order=>h.request('production',`/api/v1/production/internal/orders/${order.id}`);
const stock=order=>h.request('production',`/api/v1/production/inventory/${order.pecaId}?filialId=${encodeURIComponent(order.filialId)}`,actors.admin.accessToken);

test('inventory compatibility facade stores catalog and additive stock only in Production', {timeout:90000},async()=>{
  const filialId=`resilience-${randomUUID()}`;
  const piece=await h.request('os','/api/v1/estoque/pecas',actors.admin.accessToken,{filialId,codigo:'FILTER',nome:'Filtro integração',precoVenda:15.5,quantidadeInicial:3,quantidadeMinima:1},'POST');
  await h.request('os',`/api/v1/estoque/pecas/${piece.peca.id}/entrada?filialId=${filialId}`,actors.admin.accessToken,{quantidade:2},'PATCH');
  await h.request('os',`/api/v1/estoque/pecas/${piece.peca.id}?filialId=${filialId}`,actors.admin.accessToken,{nome:'Filtro atualizado',precoVenda:16},'PATCH');
  const own=await h.request('production',`/api/v1/production/inventory/${piece.peca.id}?filialId=${filialId}`,actors.admin.accessToken);
  assert.equal(own.quantidadeDisponivel,5);assert.equal(own.peca.nome,'Filtro atualizado');assert.equal(own.peca.precoVenda,16);
  await h.request('os',`/api/v1/estoque/pecas/${piece.peca.id}/desativar?filialId=${filialId}`,actors.admin.accessToken,{},'PATCH');
  const inactive=await h.request('os',`/api/v1/estoque/pecas/${piece.peca.id}?filialId=${filialId}`,actors.admin.accessToken);
  assert.equal(inactive.peca.ativo,false);
  await h.request('os',`/api/v1/estoque/pecas/${piece.peca.id}/ativar?filialId=${filialId}`,actors.admin.accessToken,{},'PATCH');
  const all=await h.request('os',`/api/v1/estoque?filialId=${filialId}`,actors.admin.accessToken);
  assert.equal(all.length,1); // support intentionally unwraps paginated data
});

test('duplicate SQS messages cannot reserve stock twice or duplicate the released-execution history', {timeout:120000},async()=>{
  const order=await h.prepare(actors,1,5,`dup-${randomUUID()}`);
  const approved=await h.approve(actors,order);assert.equal(approved.sagaState,'COMPLETED');
  const initialProduction=await production(order),initialStock=await stock(order);
  const billing=await h.request('billing',`/api/v1/billing/internal/orders/${order.id}`);
  const repeated=envelope(approved,'ReserveExecution',{budget:billing.budget});
  await send('production',repeated);await send('production',repeated);
  await send('production',{...repeated,messageId:randomUUID()}); // same saga step, different transport ID
  await send('production',envelope(approved,'ConfirmExecution'));
  const ready=envelope(approved,'ExecutionReady');await send('os',ready);await send('os',ready);
  await drained('production');await drained('os');
  assert.deepEqual(await stock(order),initialStock);
  assert.equal((await production(order)).revision,initialProduction.revision);
  const final=await h.read(actors,order.id);
  assert.equal(final.sagaState,'COMPLETED');
  assert.equal(final.historico.filter(item=>item.evento==='EXECUCAO_LIBERADA').length,1);
});

test('stock failure compensates, replenishment retries the same OS with a new Saga, old messages stay ineffective', {timeout:180000},async()=>{
  const order=await h.prepare(actors,2,1,`retry-${randomUUID()}`);
  const failed=await h.approve(actors,order);assert.equal(failed.sagaState,'COMPENSATED');
  assert.equal((await production(order)).status,'CANCELLED');
  assert.equal((await stock(order)).quantidadeDisponivel,1);
  await h.request('production',`/api/v1/production/inventory/${order.pecaId}/entrada?filialId=${order.filialId}`,actors.admin.accessToken,{quantidade:4},'PATCH');
  await h.request('os',`/api/v1/ordens-servico/${order.id}/saga/retry`,actors.admin.accessToken,{},'POST');
  const recovered=await h.eventually(()=>h.read(actors,order.id),result=>result.sagaState==='COMPLETED',90000);
  assert.notEqual(recovered.sagaId,failed.sagaId);assert.equal(recovered.status,'APROVADA');
  const before=await production(order),reserved=await stock(order);
  assert.equal(before.status,'READY');assert.equal(before.sagaId,recovered.sagaId);
  assert.equal(reserved.quantidadeDisponivel,3);assert.equal(reserved.quantidadeReservada,2);
  const bill=await h.request('billing',`/api/v1/billing/internal/orders/${order.id}`);
  await send('production',envelope(recovered,'ConfirmExecution',{},failed.sagaId));
  await send('production',envelope(recovered,'ReserveExecution',{budget:bill.budget},failed.sagaId));
  await send('production',envelope(recovered,'CancelExecutionReservation',{},failed.sagaId));
  await send('os',envelope(recovered,'ExecutionStarted',{},failed.sagaId));
  await send('os',envelope(recovered,'ProductionCompleted',{},failed.sagaId));
  await send('os',envelope(recovered,'BudgetReleased',{},failed.sagaId));
  await drained('production');await drained('os');
  assert.deepEqual(await production(order),before);assert.deepEqual(await stock(order),reserved);
  const final=await h.read(actors,order.id);assert.equal(final.sagaState,'COMPLETED');assert.equal(final.sagaId,recovered.sagaId);assert.equal(final.status,'APROVADA');
  assert.equal(final.historico.filter(item=>item.evento==='EXECUCAO_LIBERADA').length,1);
  const after=await h.request('billing',`/api/v1/billing/internal/orders/${order.id}`);
  assert.ok(!after.payment,'A late completion event must not start charging');
});

test('OS restart preserves persisted order and resumes messages queued while the orchestrator is offline', {
  skip:process.env.ALLOW_SERVICE_RESTART!=='true'?'Set ALLOW_SERVICE_RESTART=true after other suites finish':false,
  timeout:180000,
},async()=>{
  const order=await h.prepare(actors,1,5,`restart-${randomUUID()}`);
  const compose=(...args)=>execFileAsync('docker',['compose','-f','compose.phase4.yml',...args],{cwd:require('node:path').resolve(__dirname,'../..'),timeout:60000});
  try {
    await compose('stop','--timeout','30','os');
    // Approval is idempotent; retry a transient transport reset rather than losing the restart test.
    await h.eventually(()=>h.request('billing',`/api/v1/billing/orders/${order.id}/approve`,actors.clientToken,{},'POST'),result=>Boolean(result.budget?.approved),15000);
    await h.eventually(async()=>{
      const r=await sqs.send(new GetQueueAttributesCommand({QueueUrl:queues.os,AttributeNames:['ApproximateNumberOfMessages']}));
      return Number(r.Attributes?.ApproximateNumberOfMessages || 0);
    },count=>count>0,30000);
  } finally { await compose('start','os'); }
  const restored=await h.eventually(()=>h.read(actors,order.id),result=>result.sagaState==='COMPLETED',90000);
  assert.equal(restored.id,order.id);assert.equal(restored.sagaId,order.sagaId);
  assert.equal((await production(order)).status,'READY');
  assert.equal((await stock(order)).quantidadeDisponivel,4);
  assert.equal(restored.historico.filter(item=>item.evento==='EXECUCAO_LIBERADA').length,1);
});
