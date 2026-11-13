const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const {execFile}=require('node:child_process');
const execute=require('node:util').promisify(execFile);
const path=require('node:path');
const h=require('./support.cjs');
const {portalUrl,loginAdmin,desktopEvidence,browserFailures}=require('./browser-support.cjs');
const compose=(...args)=>execute('docker',h.composeArgs(...args),{cwd:path.resolve(__dirname,'../..'),timeout:60000});

test('intervenção após indisponibilidade: cancelar modal, reconciliar e recuperar a mesma OS',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1080p','Interrupção real é exercitada uma vez; os demais projetos verificam apresentação e retry.');
  test.skip(process.env.ALLOW_SERVICE_RESTART!=='true','Requer pilha local exclusiva com ALLOW_SERVICE_RESTART=true.');
  expect(process.env.COMPOSE_PROJECT_NAME || process.env.PHASE4_COMPOSE_PROJECT).toMatch(/^oficina-phase4-(?:test|ci)-/);
  const actors=await h.setup();const order=await h.prepare(actors,1,0,`ui-outage-${randomUUID()}`);
  await loginAdmin(page);
  let interrupted;
  try {
    await compose('stop','--timeout','10','production');
    await h.request('billing',`/api/v1/billing/orders/${order.id}/approve`,actors.clientToken,{},'POST');
    interrupted=await h.eventually(async()=>{
      const rows=await h.request('os',`/api/v1/ordens-servico?filialId=${order.filialId}`,actors.admin.accessToken);
      return rows.find(row=>row.id===order.id);
    },row=>row?.sagaState==='MANUAL_ATTENTION',160000);
  } finally { await compose('start','production'); }
  await h.eventually(()=>h.request('production','/api/v1/production/health'),Boolean,60000);
  const errors=browserFailures(page);
  await page.goto(`${portalUrl}/#/ordens/${order.id}`);
  await expect(page.getByRole('heading',{name:'Preparação exige intervenção',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Tentar preparação novamente',exact:true})).toHaveCount(0);
  await desktopEvidence(page,testInfo,'manual-attention-visible');
  let mutations=0;page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/saga/reconcile'))mutations++;});
  await page.getByRole('button',{name:'Reconciliar preparação',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Reconciliar a preparação?',exact:true});
  await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(mutations).toBe(0);
  await page.getByRole('button',{name:'Reconciliar preparação',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Reconciliar a preparação?',exact:true});
  await desktopEvidence(page,testInfo,'reconciliation-confirmation');
  const sent=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname.endsWith('/saga/reconcile'));
  await dialog.getByRole('button',{name:'Reconciliar preparação',exact:true}).click();
  const response=await sent;expect(response.ok()).toBeTruthy();expect(response.request().postDataJSON()).toEqual({expectedSagaId:interrupted.sagaId});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Preparação cancelada',exact:true})).toBeVisible({timeout:90000});
  const recovered=await h.read(actors,order.id);expect(recovered.sagaId).toBe(interrupted.sagaId);expect(recovered.sagaState).toBe('COMPENSATED');expect(recovered.status).toBe('APROVADA');
  expect(mutations).toBe(1);expect(recovered.historico.filter(item=>item.evento==='RECONCILIACAO_SOLICITADA')).toHaveLength(1);
  const billing=await h.request('billing',`/api/v1/billing/internal/orders/${order.id}`);expect(billing.budget).toMatchObject({approved:true,frozen:false});expect(billing.payment).toBeUndefined();
  await desktopEvidence(page,testInfo,'intervention-recovered-with-approval-preserved');
  expect(errors).toEqual([]);
});
