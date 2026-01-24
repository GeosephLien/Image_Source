const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { willReadFrequently: false });

const btnGen = document.getElementById("btnGen");
const btnUpload = document.getElementById("btnUpload");

const elFname = document.getElementById("fname");
const elStatus = document.getElementById("status");

const inputToken = document.getElementById("token");
const inputRepo = document.getElementById("repo");
const inputFolder = document.getElementById("folder");
const inputBranch = document.getElementById("branch");
const inputMsg = document.getElementById("msg");

let lastPngBlob = null;
let lastFilename = null;

function setStatus(text){ elStatus.textContent = text; }

function pad2(n){ return String(n).padStart(2, "0"); }
function makeFilename(){
  // 用 UTC 時間戳，避免撞名（精確到毫秒）
  const d = new Date();
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `gen_${y}${mo}${da}_${h}${mi}${s}_${ms}.png`;
}

function rand(min, max){ return min + Math.random() * (max - min); }

function generateRandomImage512(){
  // 背景
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = `hsl(${Math.floor(rand(0, 360))} 30% 12%)`;
  ctx.fillRect(0, 0, 512, 512);

  // 漸層塊
  const g = ctx.createLinearGradient(rand(0,512), rand(0,512), rand(0,512), rand(0,512));
  g.addColorStop(0, `hsla(${Math.floor(rand(0,360))}, 90%, 60%, 0.9)`);
  g.addColorStop(1, `hsla(${Math.floor(rand(0,360))}, 90%, 55%, 0.2)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  // 隨機圓 / 斑點
  for(let i=0;i<120;i++){
    ctx.beginPath();
    ctx.arc(rand(0,512), rand(0,512), rand(6, 80), 0, Math.PI*2);
    ctx.fillStyle = `hsla(${Math.floor(rand(0,360))}, ${Math.floor(rand(50,100))}%, ${Math.floor(rand(30,75))}%, ${rand(0.05, 0.22)})`;
    ctx.fill();
  }

  // 線條
  ctx.lineWidth = rand(1, 4);
  for(let i=0;i<26;i++){
    ctx.beginPath();
    ctx.moveTo(rand(0,512), rand(0,512));
    ctx.bezierCurveTo(rand(0,512), rand(0,512), rand(0,512), rand(0,512), rand(0,512), rand(0,512));
    ctx.strokeStyle = `hsla(${Math.floor(rand(0,360))}, 90%, 70%, ${rand(0.08,0.35)})`;
    ctx.stroke();
  }
}

async function canvasToPngBlob(){
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
}

async function blobToBase64(blob){
  const ab = await blob.arrayBuffer();
  // ArrayBuffer -> base64
  let binary = "";
  const bytes = new Uint8Array(ab);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function githubGetFileSha({token, owner, repo, path, branch}){
  // 取已存在檔案的 sha（如果不存在就回 null）
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F","/")}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET sha failed: ${res.status}`);
  const json = await res.json();
  return json?.sha ?? null;
}

async function githubPutFile({token, owner, repo, path, branch, message, base64Content, sha=null}){
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F","/")}`;
  const body = {
    message,
    content: base64Content,
    branch,
  };
  if (sha) body.sha = sha; // 若你要覆蓋同名檔案才需要

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`PUT file failed: ${res.status} ${t}`);
  }
  return res.json();
}

function parseOwnerRepo(value){
  const s = value.trim();
  const parts = s.split("/");
  if (parts.length !== 2) throw new Error("目標 Repo 格式需為 OWNER/REPO");
  return { owner: parts[0], repo: parts[1] };
}

btnGen.addEventListener("click", async () => {
  btnGen.disabled = true;
  try{
    setStatus("生成中…");
    generateRandomImage512();
    const blob = await canvasToPngBlob();
    if (!blob) throw new Error("PNG 生成失敗（toBlob 回傳 null）");

    lastPngBlob = blob;
    lastFilename = makeFilename();

    elFname.textContent = lastFilename;
    setStatus("已生成（可上傳）");
    btnUpload.disabled = false;
  }catch(e){
    console.error(e);
    setStatus("生成失敗");
  }finally{
    btnGen.disabled = false;
  }
});

btnUpload.addEventListener("click", async () => {
  if (!lastPngBlob) return;

  const token = inputToken.value.trim();
  if (!token){
    alert("請先貼上 GitHub Token（Fine-grained PAT）");
    return;
  }

  let owner, repo;
  try{
    ({ owner, repo } = parseOwnerRepo(inputRepo.value));
  }catch(e){
    alert(e.message);
    return;
  }

  const folder = inputFolder.value.trim().replace(/^\/+|\/+$/g, "") || "images";
  const branch = inputBranch.value.trim() || "main";
  const message = inputMsg.value.trim() || "add generated png";

  const targetPath = `${folder}/${lastFilename}`;

  btnUpload.disabled = true;
  btnGen.disabled = true;

  try{
    setStatus("上傳中…（GitHub API）");
    const b64 = await blobToBase64(lastPngBlob);

    // 預設不覆蓋同名：如果存在就直接報錯提醒（你也可改成覆蓋）
    const sha = await githubGetFileSha({ token, owner, repo, path: targetPath, branch });
    if (sha){
      throw new Error(`同名檔案已存在：${targetPath}\n請再生成一次（會換新檔名），或改成覆蓋模式。`);
    }

    await githubPutFile({
      token, owner, repo,
      path: targetPath,
      branch,
      message,
      base64Content: b64,
      sha: null
    });

    setStatus(`上傳成功：${owner}/${repo}/${targetPath}`);
    // 安全起見：你也可以自動清空 token（可選）
    // inputToken.value = "";
  }catch(e){
    console.error(e);
    alert(String(e.message || e));
    setStatus("上傳失敗");
  }finally{
    btnUpload.disabled = false;
    btnGen.disabled = false;
  }
});
