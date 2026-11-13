const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const h=require('./support.cjs');
const {portalUrl,loginAdmin,loginClient,desktopEvidence,browserFailures}=require('./browser-support.cjs');

test('estoque indisponível: três retentativas, orientação ao consultor e reposição contextual na filial',async({browser},testInfo)=>{
  const actors=await h.setup();
  const branch=`ui-retry-${randomUUID()}`;
  const consultantEmail=`consultor-retry-${randomUUID()}@example.com`;
  const consultantPassword='Local-only-consultant-password';
  await h.request('os','/api/v1/usuarios',actors.admin.accessToken,{nome:'Consultor da recuperação',email:consultantEmail,senha:consultantPassword,papel:'CONSULTOR_TECNICO'},'POST');
  const order=await h.prepare(actors,1,1,branch);
  const pieceCode=`JUNTA-${randomUUID().slice(0,8)}`;
  const piece=await h.request('os','/api/v1/estoque/pecas',actors.admin.accessToken,{
    filialId:branch,codigo:pieceCode,nome:'Junta da regressão de preparação',precoVenda:25,quantidadeInicial:0,quantidadeMinima:1,
  },'POST');
  const otherBranch=branch+'-outra';
  const otherPiece=await h.request('os','/api/v1/estoque/pecas',actors.admin.accessToken,{
    filialId:otherBranch,codigo:pieceCode,nome:'Junta da regressão de preparação',precoVenda:25,quantidadeInicial:0,quantidadeMinima:1,
  },'POST');
  const missingId=piece.peca.id;
  await h.request('billing',`/api/v1/billing/orders/${order.id}/budget`,actors.mechanic.accessToken,{items:[
    {description:'Revisão',quantity:1,unitPriceCents:10000},
    {description:'Filtro disponível',quantity:1,unitPriceCents:5000,pecaId:order.pecaId},
    {description:'Junta em falta',quantity:1,unitPriceCents:2500,pecaId:missingId},
  ]},'PUT');
  await h.eventually(()=>h.read(actors,order.id),r=>r.totalCents===17500);
  const contexts=[];const errors=[];let completed=false;
  async function pageFor(login, protectedPath) {
    const context=await browser.newContext({baseURL:portalUrl,viewport:testInfo.project.use.viewport,deviceScaleFactor:1});contexts.push(context);
    const page=await context.newPage();errors.push(browserFailures(page));
    if(protectedPath) { await page.goto(`${portalUrl}/#${protectedPath}`);await expect(page).toHaveURL(/#\/login\/?$/); }
    await login(page);
    if(protectedPath) await expect(page).toHaveURL(`${portalUrl}/#${protectedPath}`);
    return page;
  }
  async function loginConsultant(page) {
    await page.goto(`${portalUrl}/#/login`);
    await page.getByRole('tab',{name:'Equipe',exact:true}).click();
    await page.locator('#operator-email').fill(consultantEmail);
    await page.locator('#operator-password').fill(consultantPassword);
    await page.getByRole('button',{name:'Entrar como equipe',exact:true}).click();
    await expect(page).not.toHaveURL(/#\/login\/?$/);
  }
  const shortage=page=>page.getByRole('region',{name:'Peças que impedem a preparação',exact:true});
  async function expectShortage(page,canSeeBalance) {
    const panel=shortage(page);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(piece.peca.nome);
    await expect(panel).toContainText(pieceCode);
    await expect(panel).toContainText(`Filial: ${branch}`);
    await expect(panel).toContainText('Necessária: 1');
    await expect(panel).toContainText('Falta: 1');
    await expect(panel).toContainText('Saldo insuficiente nesta filial.');
    if(canSeeBalance) await expect(panel).toContainText('Disponível: 0');
    else {
      await expect(panel).not.toContainText('Disponível:');
      await expect(panel).toContainText('Solicite ao administrador a reposição');
      await expect(panel.getByRole('link',{name:'Consultar e repor nesta filial',exact:true})).toHaveCount(0);
    }
  }
  async function evidence(page,name) {
    await desktopEvidence(page,testInfo,name);
    const file=testInfo.outputPath(`${name}-viewport.png`);
    await page.screenshot({path:file,fullPage:false,animations:'disabled'});
    await testInfo.attach(`${name}-viewport`,{path:file,contentType:'image/png'});
  }
  try {
    const admin=await pageFor(loginAdmin), client=await pageFor(loginClient,`/ordens/${order.id}`), consultant=await pageFor(loginConsultant);
    await client.goto(`${portalUrl}/#/ordens/${order.id}`);
    await client.getByRole('button',{name:'Aprovar orçamento',exact:true}).click();
    await client.getByRole('dialog').getByRole('button',{name:'Aprovar orçamento',exact:true}).click();
    await expect(client.getByRole('heading',{name:'Preparação cancelada',exact:true})).toBeVisible({timeout:60000});
    await expect(client.getByRole('button',{name:'Tentar preparação novamente',exact:true})).toHaveCount(0);
    await expect(shortage(client)).toHaveCount(0);
    await expect(client.getByRole('heading',{name:'Peças desta OS',exact:true})).toHaveCount(0);
    await consultant.goto(`${portalUrl}/#/ordens/${order.id}`);
    const seen=new Set();
    for(let attempt=0;attempt<3;attempt++) {
      await expect(consultant.getByRole('heading',{name:'Preparação cancelada',exact:true})).toBeVisible({timeout:60000});
      await expectShortage(consultant,false);
      const before=await h.read(actors,order.id);seen.add(before.sagaId);
      const pending=consultant.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith(`/ordens-servico/${order.id}/saga/retry`));
      await consultant.getByRole('button',{name:'Tentar preparação novamente',exact:true}).click();expect((await pending).ok()).toBeTruthy();
      const failed=await h.eventually(()=>h.read(actors,order.id),r=>r.sagaId!==before.sagaId&&['COMPENSATED','MANUAL_ATTENTION'].includes(r.sagaState),60000);
      expect(failed.sagaState).toBe('COMPENSATED');expect(seen.has(failed.sagaId)).toBe(false);seen.add(failed.sagaId);expect(failed.status).toBe('APROVADA');
      await expect(consultant.getByRole('heading',{name:'Preparação cancelada',exact:true})).toBeVisible({timeout:60000});
      const billing=await h.request('billing',`/api/v1/billing/internal/orders/${order.id}`);
      expect(billing.budget).toMatchObject({approved:true,frozen:false,totalCents:17500});expect(billing.payment).toBeUndefined();
      const available=await h.request('production',`/api/v1/production/inventory/${order.pecaId}?filialId=${branch}`,actors.admin.accessToken);
      expect(available.quantidadeDisponivel).toBe(1);expect(available.quantidadeReservada).toBe(0);
    }
    await expect(consultant.locator('.sidebar').getByRole('link',{name:'Estoque',exact:true})).toHaveCount(0);
    await evidence(consultant,'consultant-shortage-handoff');
    await consultant.goto(`${portalUrl}/#/estoque`);
    await expect(consultant.getByRole('heading',{name:/Você não tem (?:permissão|acesso) (?:para|a) esta área/})).toBeVisible();
    await consultant.goBack();
    await expectShortage(consultant,false);
    await admin.goto(`${portalUrl}/#/ordens/${order.id}`);
    await expectShortage(admin,true);
    await evidence(admin,'retry-without-stock-compensated');
    await shortage(admin).getByRole('link',{name:'Consultar e repor nesta filial',exact:true}).click();
    await expect(admin.getByRole('searchbox',{name:'Buscar peças',exact:true})).toHaveValue(pieceCode);
    await expect(admin.getByLabel('Filial',{exact:true})).toHaveValue(branch);
    const row=admin.getByRole('row').filter({hasText:'Junta da regressão de preparação'});
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(`Filial: ${branch}`);
    await expect(row).toContainText(`Código: ${pieceCode}`);
    await row.getByRole('button',{name:'Dar entrada',exact:true}).click();
    const dialog=admin.getByRole('dialog',{name:'Dar entrada no estoque',exact:true});
    await dialog.getByRole('spinbutton',{name:/^Quantidade de entrada/}).fill('1');
    await expect(dialog).toContainText(branch);
    await evidence(admin,'restock-dialog');
    const entered=admin.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname.endsWith(`/pecas/${missingId}/entrada`));
    await dialog.getByRole('button',{name:'Registrar entrada',exact:true}).click();expect((await entered).ok()).toBeTruthy();
    const untouched=await h.request('production',`/api/v1/production/inventory/${otherPiece.peca.id}?filialId=${otherBranch}`,actors.admin.accessToken);
    expect(untouched.quantidadeDisponivel).toBe(0);
    await consultant.getByRole('button',{name:'Tentar preparação novamente',exact:true}).click();
    const ready=await h.eventually(()=>h.read(actors,order.id),r=>r.sagaState==='COMPLETED',60000);
    expect(ready.totalCents).toBe(17500);expect(ready.status).toBe('APROVADA');expect(seen.has(ready.sagaId)).toBe(false);
    await expect(consultant.getByRole('button',{name:'Tentar preparação novamente',exact:true})).toHaveCount(0,{timeout:60000});
    await expect(shortage(consultant)).toHaveCount(0);
    await consultant.getByRole('tab',{name:'Histórico',exact:true}).click();
    await expect(consultant.locator('#panel-history')).toContainText('EXECUCAO LIBERADA');
    await evidence(consultant,'same-order-ready-after-restock');
    expect(errors.flat(),'No errors during compensation/recovery UI').toEqual([]);completed=true;
  } finally {
    for(const [index,context] of contexts.entries()) {
      if(!completed) {
        await context.pages()[0]?.screenshot({path:testInfo.outputPath(`preparation-${index}-failure.png`),fullPage:true}).catch(()=>{});
      }
      await context.close();
    }
  }
});
