import https from "node:https";
import { execSync } from "node:child_process";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = "prj_Tc4a1ogZ4HE9ZiMYkshbB7O6mBCs";
const REPO_ID = "1359650935";

if (!VERCEL_TOKEN) {
  console.error("VERCEL_TOKEN is not provided!");
  process.exit(1);
}

const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
console.log("[Vercel Deploy] Triggering production deployment for commit:", sha);

const postData = JSON.stringify({
  name: "milling-intelligence",
  project: PROJECT_ID,
  target: "production",
  gitSource: {
    type: "github",
    repoId: REPO_ID,
    ref: "main",
    sha: sha
  }
});

function postDeployment() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.vercel.com",
      port: 443,
      path: "/v13/deployments",
      method: "POST",
      headers: {
        Authorization: "Bearer " + VERCEL_TOKEN,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch (e) {
          reject(new Error("Invalid JSON response: " + d));
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function pollStatus(depId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 40;

    function check() {
      attempts++;
      https.get({
        hostname: "api.vercel.com",
        path: "/v13/deployments/" + depId,
        headers: { Authorization: "Bearer " + VERCEL_TOKEN }
      }, res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => {
          try {
            const j = JSON.parse(d);
            console.log("[Vercel Deploy] (" + attempts + "/" + maxAttempts + ") State: " + j.readyState);
            if (j.readyState === "READY") {
              console.log("[Vercel Deploy] SUCCESS! Production URL: https://milling-intelligence.vercel.app");
              resolve();
            } else if (j.readyState === "ERROR" || j.readyState === "CANCELED") {
              reject(new Error("Deployment failed with state: " + j.readyState));
            } else if (attempts >= maxAttempts) {
              reject(new Error("Deployment polling timed out."));
            } else {
              setTimeout(check, 4000);
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on("error", reject);
    }
    check();
  });
}

async function main() {
  const result = await postDeployment();
  if (result.status !== 200 || !result.body.id) {
    throw new Error("Failed to create deployment: " + JSON.stringify(result.body));
  }
  console.log("[Vercel Deploy] Created deployment ID:", result.body.id);
  await pollStatus(result.body.id);
}

main().catch(err => {
  console.error("[Vercel Deploy] Error:", err.message);
  process.exit(1);
});
