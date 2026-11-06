const {test,expect}=require('@playwright/test');
const h=require('./support.cjs');
async function actorPage(browser,session,osId){const context=await browser.newContext();await context.addInitScript(s=>sessionStorage.setItem('oficina.session.v1',JSON.stringify(s)),session);const page=await context.newPage();await page.goto(`http://localhost:5173/#/ordens/${osId}`);return page;}
function session(token,kind,role){return{version:1,kind,role,accessToken:token,refreshToken:kind==='client'?null:'local-refresh',accessExpiresAt:Date.now()+3600000,refreshExpiresAt:Date.now()+3600000,createdAt:Date.now()};}
test('portal aprova orçamento, abre checkout e libera entrega somente após pagamento',async({browser})=>{
 const data=await h.setup(),order=await h.prepare(data);
 const client=await actorPage(browser,session(data.clientToken,'client','CLIENTE'),order.id);
 await client.getByRole('button',{name:'Aprovar orçamento',exact:true}).click();
 await client.getByRole('dialog').getByRole('button',{name:'Aprovar orçamento',exact:true}).click();
 await h.eventually(()=>h.read(data,order.id),r=>r.sagaState==='COMPLETED');
 await h.complete(data,order);
 const admin=await actorPage(browser,session(data.admin.accessToken,'operator','ADMINISTRADOR'),order.id);
 await expect(admin.getByRole('heading',{name:'Reparo concluído: aguardando pagamento'})).toBeVisible();
 await expect(admin.getByRole('button',{name:'Registrar entrega',exact:true})).toHaveCount(0);
 await client.reload();await client.getByRole('button',{name:'Pagar OS',exact:true}).click();
 await expect(client).toHaveURL(/localhost:8088\/checkout\//);
 await h.pay(data,order);await admin.reload();
 await admin.getByRole('button',{name:'Registrar entrega',exact:true}).click();
 await admin.getByRole('dialog').getByRole('button',{name:'Confirmar entrega',exact:true}).click();
 await expect.poll(async()=> (await h.read(data,order.id)).status).toBe('ENTREGUE');
 await admin.context().close();await client.context().close();
});
