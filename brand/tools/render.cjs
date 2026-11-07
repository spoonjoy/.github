// Render one header or social preview from compose.html at 2x.
//   node render.cjs <out.png> "art=web&theme=dark"
//   node render.cjs <out.png> "kind=og&art=web&ox=900&kicker=...&title=...&sub=...&foot=..."
// compose.html loads its source images from the folder it sits in: copy the files that
// brand/provenance.json lists as sources next to it first. Needs playwright (npm i -g playwright);
// set CHROMIUM to a Chromium binary if Playwright's own isn't installed.
const { execSync } = require("child_process");
const { chromium } = require(require("path").join(execSync("npm root -g").toString().trim(), "playwright"));
(async () => {
  const [out, query] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--allow-file-access-from-files"] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await p.goto("file://" + __dirname + "/compose.html?" + query);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(400);
  await p.locator("#root > .art").screenshot({ path: out });
  await b.close();
  console.log(out);
})();
