const {test,expect}=require('@playwright/test');
const {portalUrl,loginAdmin,desktopEvidence,browserFailures}=require('./browser-support.cjs');

test('páginas desktop: navegação, legibilidade, acessibilidade e ausência de erros',async({page},testInfo)=>{
  const errors=browserFailures(page);
  await page.goto(`${portalUrl}/#/login`);
  await expect(page.getByRole('button',{name:'Acompanhar meu veículo',exact:true})).toBeVisible();
  await desktopEvidence(page,testInfo,'page-login');
  await loginAdmin(page);
  for(const route of ['inicio','ordens','ordens/nova','clientes','veiculos','estoque','catalogo','usuarios','relatorios']) {
    await page.goto(`${portalUrl}/#/${route}`);
    await expect(page.locator('#main-content h1')).toBeVisible();
    await expect(page.locator('.skeleton:visible,[data-skeleton-row]:visible')).toHaveCount(0,{timeout:20000});
    await desktopEvidence(page,testInfo,`page-${route.replace('/','-')}`);
  }
  expect(errors,'No console/page errors across desktop pages').toEqual([]);
});
