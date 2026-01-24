// ===============================
// Image_Generate – app.js
// Token-free upload via GitHub Actions
// ===============================

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const btnGen = document.getElementById("btnGen");
const btnUpload = document.getElementById("btnUpload");

const elStatus = document.getElementById("status");
const elFname = document.getElementById("fname");

let lastBlob = null;
let lastFilename = null;

// ---------- utils ----------
function setStatus(text) {
  elStatus.textContent = text;
}

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function makeFilename() {
  const d = new Date();
  return (
    "gen_" +
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "_" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "_" +
    pad(d.getUTCMilliseconds(), 3) +
    ".png"
  );
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// ---------- image generation ----------
function generateImage() {
  const W = 512;
  const H = 512;

  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = `hsl(${rand(0, 360)}, 30%, 12%)`;
  ctx.fillRect(0, 0, W, H);

  // gradient
  const g = ctx.createLinearGradient(
    rand(0, W), rand(0, H),
    rand(0, W), rand(0, H)
  );
  g.addColorStop(0, `hsla(${rand(0, 360)}, 90%, 65%, 0.9)`);
  g.addColorStop(1, `hsla(${rand(0, 360)}, 90%, 55%, 0.25)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // blobs
  for (let i = 0; i < 120; i++) {
    ctx.beginPath();
    ctx.arc(rand(0, W), rand(0, H), rand(6, 80), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${rand(0, 360)}, ${rand(50, 100)}%, ${rand(30, 75)}%, ${rand(0.05, 0.25)})`;
    ctx.fill();
  }

  // lines
  ctx.lineWidth = rand(1, 4);
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.moveTo(rand(0, W), rand(0, H));
    ctx.bezierCurveTo(
      rand(0, W), rand(0, H),
      rand(0, W), rand(0, H),
      rand(0, W), rand(0, H)
    );
    ctx.strokeStyle = `hsla(${rand(0, 360)}, 90%, 70%, ${rand(0.08, 0.35)})`;
    ctx.stroke();
  }
}

function canvasToBlob() {
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), "image/png", 1.0);
  });
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---------- GitHub Actions upload ----------
async function uploadViaActions(filename, blob) {
  const base64 = await blobToBase64(blob);

  const res = await fetch(
    "https://api.github.com/repos/GeosephLien/Image_Source/actions/workflows/upload-from-generator.yml/dispatches",
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          filename,
          content_base64: base64
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error("無法觸發 GitHub Actions 上傳流程");
  }
}

// ---------- UI ----------
btnGen.addEventListener("click", async () => {
  btnGen.disabled = true;
  try {
    setStatus("生成中…");
    generateImage();
    const blob = await canvasToBlob();
    if (!blob) throw new Error("PNG 生成失敗");

    lastBlob = blob;
    lastFilename = makeFilename();
    elFname.textContent = lastFilename;

    btnUpload.disabled = false;
    setStatus("已生成（可上傳）");
  } catch (e) {
    console.error(e);
    setStatus("生成失敗");
  } finally {
    btnGen.disabled = false;
  }
});

btnUpload.addEventListener("click", async () => {
  if (!lastBlob || !lastFilename) return;

  btnUpload.disabled = true;
  btnGen.disabled = true;

  try {
    setStatus("上傳中（GitHub Actions）…");
    await uploadViaActions(lastFilename, lastBlob);
    setStatus("已送出，圖片將自動進 images/");
  } catch (e) {
    console.error(e);
    setStatus("上傳失敗");
    alert(e.message);
  } finally {
    btnUpload.disabled = false;
    btnGen.disabled = false;
  }
});

// init
btnUpload.disabled = true;
setStatus("尚未生成");
