const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const h=require('./support.cjs');
const {portalUrl,loginAdmin,desktopEvidence,browserFailures}=require('./browser-support.cjs');

test('cliente rejeita orçamento e recebe próximo passo; administração orienta novo atendimento sem reservar estoque',async({browser},testInfo)=>{
  // API creates only an independent fixture. Rejection and all navigation use real UI logins.
  const actors=await h.setup();
  const marker=randomUUID().slice(0,8);
  const order=await h.prepare(actors,1,3,`reject-ui-${marker}`);
  const publicNote=`Orientação pública da rejeição ${marker}`;
  const internalNote=`NOTA INTERNA REJEIÇÃO ${marker}`;
  await h.request('billing',`/api/v1/billing/orders/${order.id}/budget`,actors.mechanic.accessToken,{
    groups:[{title:'Avaliação para decisão do cliente',items:[{description:'Filtro da revisão',quantity:1,unitPriceCents:10000,pecaId:order.pecaId}]}],
    notasCliente:publicNote,notasInternas:internalNote,
  },'PUT');
  await h.eventually(()=>h.read(actors,order.id),value=>value.status==='AGUARDANDO_APROVACAO'&&value.orcamento?.notasCliente===publicNote);
  const stockPath=`/api/v1/production/inventory/${order.pecaId}?filialId=${order.filialId}`;
  const stockBefore=await h.request('production',stockPath,actors.admin.accessToken);
  const productionBefore=await h.request('production',`/api/v1/production/orders/${order.id}`,actors.admin.accessToken);
  expect(stockBefore.quantidadeDisponivel).toBe(3);
  expect(stockBefore.quantidadeReservada).toBe(0);
  expect(productionBefore.parts).toEqual([]);

  const contexts=[],errors=[],orderMutations=[];
  let complete=false;
  async function newPage() {
    const context=await browser.newContext({baseURL:portalUrl,viewport:testInfo.project.use.viewport,deviceScaleFactor:1});
    contexts.push(context);
    const page=await context.newPage();
    errors.push(browserFailures(page));
    page.on('request',request=>{
      const route=new URL(request.url()).pathname;
      if(!['GET','HEAD','OPTIONS'].includes(request.method())&&route.includes(order.id))orderMutations.push({method:request.method(),route});
    });
    return page;
  }
  async function openFromNumber(page,menu) {
    await page.locator('.sidebar').getByRole('link',{name:menu,exact:true}).click();
    const search=page.locator('#order-search');
    await expect(search).toBeVisible();
    const found=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).searchParams.get('busca')===`#${order.numero}`);
    await search.fill(`#${order.numero}`);
    expect((await found).ok()).toBeTruthy();
    const row=page.locator('tbody tr').filter({has:page.getByText(`#${order.numero}`,{exact:true})});
    await expect(row).toHaveCount(1);
    await row.getByRole('link',{name:/Abrir|Analisar/}).click();
    await expect(page.locator('.page-header h1')).toHaveText(`#${order.numero}`);
  }
  async function evidence(page,name) {
    await desktopEvidence(page,testInfo,name);
    const file=testInfo.outputPath(`${name}-viewport.png`);
    await page.screenshot({path:file,fullPage:false,animations:'disabled'});
    await testInfo.attach(`${name}-viewport`,{path:file,contentType:'image/png'});
  }
  try {
    const client=await newPage();
    await client.goto(`${portalUrl}/#/login`);
    await client.getByRole('tab',{name:'Cliente',exact:true}).click();
    await client.locator('#client-cpf').fill('52998224725');
    await client.getByRole('button',{name:'Acompanhar meu veículo',exact:true}).click();
    await expect(client).not.toHaveURL(/#\/login\/?$/);
    await openFromNumber(client,'Minhas ordens');
    await client.getByRole('tab',{name:/Orçamento/}).click();
    await expect(client.locator('#panel-budget')).toContainText(publicNote);
    await expect(client.locator('body')).not.toContainText(internalNote);
    await evidence(client,'client-budget-before-rejection');
    await client.getByRole('button',{name:'Rejeitar orçamento',exact:true}).click();
    const dialog=client.getByRole('dialog',{name:'Rejeitar este orçamento?',exact:true});
    await expect(dialog).toContainText('A rejeição cancelará esta ordem de serviço');
    await expect(dialog).toContainText('não poderá ser desfeita pela interface');
    await evidence(client,'client-rejection-confirmation');
    const rejected=client.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname.endsWith(`/ordens-servico/${order.id}/rejeitar`));
    await dialog.getByRole('button',{name:'Rejeitar e cancelar',exact:true}).click();
    expect((await rejected).ok()).toBeTruthy();
    await expect(dialog).toHaveCount(0);
    await expect(client.locator('.page-header .status-badge')).toContainText('Cancelada',{timeout:60000});
    await expect(client.locator('#next-action-title')).toHaveText('Ordem cancelada');
    await expect(client.locator('.next-action-panel')).toContainText('Fale com a oficina');
    await expect(client.locator('.next-action-panel')).toContainText('informando o número desta OS');
    await expect(client.getByRole('button',{name:/^(Aprovar orçamento|Rejeitar orçamento|Pagar OS|Tentar preparação novamente)$/})).toHaveCount(0);
    await expect(client.getByRole('link',{name:'Novo atendimento',exact:true})).toHaveCount(0);
    const refreshed=client.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname.endsWith(`/ordens-servico/minhas/${order.id}`));
    await client.reload();
    const envelope=await (await refreshed).json(),publicOrder=envelope.data??envelope;
    expect(publicOrder.status).toBe('CANCELADA');
    expect(publicOrder.notasInternas).toBeUndefined();
    expect(publicOrder.orcamento.notasInternas).toBeUndefined();
    expect(publicOrder.consumosPeca).toBeUndefined();
    expect(publicOrder.faltasEstoque).toBeUndefined();
    await expect(client.locator('#next-action-title')).toHaveText('Ordem cancelada');
    await expect(client.getByRole('heading',{name:'Peças desta OS',exact:true})).toHaveCount(0);
    await expect(client.locator('body')).not.toContainText(internalNote);
    await evidence(client,'client-cancelled-next-step');

    const admin=await newPage();
    await loginAdmin(admin);
    await openFromNumber(admin,'Ordens de serviço');
    await expect(admin.locator('.page-header .status-badge')).toContainText('Cancelada');
    await expect(admin.locator('#next-action-title')).toHaveText('Ordem cancelada');
    await expect(admin.locator('.next-action-panel')).toContainText('Contate o cliente');
    await expect(admin.getByRole('link',{name:'Novo atendimento',exact:true})).toHaveAttribute('href','#/ordens/nova');
    await expect(admin.getByRole('button',{name:/^(Aprovar orçamento|Registrar entrega|Iniciar execução|Tentar preparação novamente)$/})).toHaveCount(0);
    await admin.getByRole('tab',{name:/Orçamento/}).click();
    await expect(admin.locator('#panel-budget')).toContainText(internalNote);
    await evidence(admin,'admin-cancelled-next-step');

    const stockAfter=await h.request('production',stockPath,actors.admin.accessToken);
    const productionAfter=await h.eventually(()=>h.request('production',`/api/v1/production/orders/${order.id}`,actors.admin.accessToken),value=>value.status==='CANCELLED');
    const cancelled=await h.read(actors,order.id);
    const billingAfter=await h.request('billing',`/api/v1/billing/orders/${order.id}`,actors.admin.accessToken);
    expect(stockAfter).toEqual(stockBefore);
    // Rejection records one cancellation in Production; it must not reserve or consume stock.
    expect(productionAfter).toEqual({...productionBefore,status:'CANCELLED',sagaId:cancelled.sagaId,revision:productionBefore.revision+1});
    expect(billingAfter.status).toBe('REJECTED');
    expect(billingAfter.budget.approved).toBe(false);
    expect(billingAfter.budget.frozen).toBe(false);
    expect(billingAfter.payment).toBeUndefined();
    expect(orderMutations).toEqual([{method:'PATCH',route:`/api/v1/ordens-servico/${order.id}/rejeitar`}]);
    expect(errors.flat()).toEqual([]);
    await testInfo.attach('rejection-no-stock-side-effects',{body:Buffer.from(JSON.stringify({numero:order.numero,osId:order.id,status:publicOrder.status,stockBefore,stockAfter,revisionBefore:productionBefore.revision,revisionAfter:productionAfter.revision,orderMutations,clientInternalNotesAbsent:true})),contentType:'application/json'});
    complete=true;
  } finally {
    for(const [index,context] of contexts.entries()) {
      if(!complete)await context.pages()[0]?.screenshot({path:testInfo.outputPath(`rejection-${index}-failure.png`),fullPage:true}).catch(()=>{});
      await context.close();
    }
  }
});
