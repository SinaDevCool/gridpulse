// Capture branch UI using an unmodified, genuinely solved hosted job.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const job = JSON.parse(await fs.readFile("browser-milp-job.json", "utf8"));
if (job.status !== "succeeded" || !job.result_payload.result.assessment.feasible) throw Error("Accepted solve required");
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"], { stdio: "ignore" });
const browser = await chromium.launch();
try {
  for (let i=0;i<40;i++) { try { if ((await fetch("http://127.0.0.1:4173")).ok) break; } catch {} await new Promise(r=>setTimeout(r,500)); }
  const page = await browser.newPage({ viewport: {width:1600,height:1000}, deviceScaleFactor:1 });
  const token = "e30."+Buffer.from(JSON.stringify({role:"gridpulse_public_visitor",exp:4102444800})).toString("base64url")+".capture";
  await page.route("**/auth/v1/signup", r=>r.fulfill({json:{access_token:token,token_type:"bearer",refresh_token:"capture",expires_in:3600,user:{id:job.owner_id,is_anonymous:true,aud:"authenticated"}}}));
  await page.route("**/v1/jobs/**", r=>r.fulfill({json:r.request().method()==="POST"?{job_id:job.id,status:"queued"}:job}));
  await page.goto("http://127.0.0.1:4173/operations?view=overview&mode=scenario&window=today");
  await page.getByRole("button",{name:"Recalculate MILP",exact:true}).click();
  const result=page.locator("[data-assessment-id]");
  await result.waitFor({state:"visible",timeout:30000});
  await fs.mkdir("marketing-captures",{recursive:true});
  for (const [label,name] of [["Overview","overview"],["Compute & Workloads","workloads"],["Power & Battery","battery"]]) {
    await page.getByRole("link",{name:label,exact:true}).click();
    await result.waitFor({state:"visible"});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(700);
    await result.screenshot({path:`marketing-captures/facility-operations-${name}.png`});
  }
  await page.getByRole("link",{name:"Overview",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(700);
  await result.screenshot({path:"marketing-captures/facility-operations-mobile.png"});
  await fs.writeFile("marketing-captures/provenance.json",JSON.stringify({source:"Hosted synthetic MILP; unmodified accepted job rendered in branch UI",commit:process.env.GITHUB_SHA,solver:job.result_payload.result.solver,status:job.result_payload.result.status,physical_dispatch:false},null,2));
} finally { await browser.close(); server.kill(); }

