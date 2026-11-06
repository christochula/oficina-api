const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({testDir:'.',testMatch:'portal.spec.cjs',timeout:180000,workers:1,use:{baseURL:'http://localhost:5173',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},webServer:{command:'npm run dev --prefix frontend',cwd:path.resolve(__dirname,'../..'),url:'http://localhost:5173',reuseExistingServer:!process.env.CI}});
