const { expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const portalUrl = process.env.MANUAL_PORTAL_URL || 'http://localhost:5273';

async function loginAdmin(page) {
  await page.goto(`${portalUrl}/#/login`);
  await page.getByRole('tab', { name: 'Equipe', exact: true }).click();
  await page.locator('#operator-email').fill(process.env.DEMO_ADMIN_EMAIL || 'admin@oficina.com');
  await page.locator('#operator-password').fill(process.env.DEMO_ADMIN_PASSWORD || 'Local-only-admin-password-2026');
  await page.getByRole('button', { name: 'Entrar como equipe', exact: true }).click();
  await expect(page).not.toHaveURL(/#\/login\/?$/);
}
async function loginClient(page) {
  await page.goto(`${portalUrl}/#/login`);
  await page.getByRole('tab', { name: 'Cliente', exact: true }).click();
  await page.locator('#client-cpf').fill(process.env.DEMO_CLIENT_CPF || '52998224725');
  await page.getByRole('button', { name: 'Acompanhar meu veículo', exact: true }).click();
  await expect(page).not.toHaveURL(/#\/login\/?$/);
}
async function desktopEvidence(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready);
  const layout=await page.evaluate(()=>{
    const sidebar=document.querySelector('.sidebar'), shell=document.querySelector('.app-shell'), container=document.querySelector('.page-container');
    const styles=sidebar&&getComputedStyle(sidebar);
    return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},shell:shell?.className,sidebar:sidebar?{rectWidth:sidebar.getBoundingClientRect().width,computedWidth:styles.width,transform:styles.transform,appWidth:styles.getPropertyValue('--app-sidebar-width'),baseWidth:styles.getPropertyValue('--sidebar-width')}:null,containerWidth:container?.getBoundingClientRect().width,rootFont:getComputedStyle(document.documentElement).fontSize};
  });
  await testInfo.attach(`${name}-layout`,{body:Buffer.from(JSON.stringify(layout,null,2)),contentType:'application/json'});
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
  expect(dimensions.scroll, `${name}: page must not overflow horizontally`).toBeLessThanOrEqual(dimensions.width+1);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await testInfo.attach(`${name}-accessibility`,{body:Buffer.from(JSON.stringify(result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),null,2)),contentType:'application/json'});
  expect(result.violations.filter(v=>['critical','serious'].includes(v.impact)), `${name}: serious/critical WCAG violations`).toEqual([]);
  const screenshotPath=testInfo.outputPath(`${name}.png`);
  await page.screenshot({path:screenshotPath,fullPage:true,animations:'disabled'});
  await testInfo.attach(name,{path:screenshotPath,contentType:'image/png'});
}
function browserFailures(page) {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  return errors;
}
module.exports={portalUrl,loginAdmin,loginClient,desktopEvidence,browserFailures};
