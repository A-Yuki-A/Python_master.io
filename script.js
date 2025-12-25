"use strict";

/* ===== 設定 ===== */
const DATA_URL = "/Python_master.io/questions.json";
const AUTO_NEXT_MS = 900;

/* ===== DOM取得 ===== */
const el = {
  stageBadge: document.getElementById("stageBadge"),
  levelText: document.getElementById("levelText"),
  progressText: document.getElementById("progressText"),

  talkImage: document.getElementById("talkImage"),
  talkText: document.getElementById("talkText"),

  qidPill: document.getElementById("qidPill"),
  promptText: document.getElementById("promptText"),

  pythonEditor: document.getElementById("pythonEditor"),
  refCode: document.getElementById("refCode"),

  runBtn: document.getElementById("runBtn"),
  runOutput: document.getElementById("runOutput"),

  choicesForm: document.getElementById("choicesForm"),
  checkBtn: document.getElementById("checkBtn"),
  backBtn: document.getElementById("backBtn"),

  resultBox: document.getElementById("resultBox"),
  resultMsg: document.getElementById("resultMsg"),
  explainText: document.getElementById("explainText"),
  autoNextText: document.getElementById("autoNextText"),

  /* ★ ポップアップ用 */
  popup: document.getElementById("popup"),
  popupResult: document.getElementById("popupResult"),
  popupBefore: document.getElementById("popupBefore"),
  popupAfter: document.getElementById("popupAfter"),
};

/* ===== 状態 ===== */
let questions = [];
let state = {
  index: 0,
  level: 1
};

/* ===== Pyodide（Python実行） ===== */
let pyodideReady = null;

async function runPython(code){
  if(!pyodideReady){
    pyodideReady = loadPyodide();
  }
  const py = await pyodideReady;

  try{
    py.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);
    py.runPython(code);
    py.runPython("_out = sys.stdout.getvalue()");
    return py.globals.get("_out") || "";
  }catch(e){
    return String(e);
  }
}

/* ===== 表示処理 ===== */
function renderQuestion(){
  const q = questions[state.index];
  if(!q) return;

  el.stageBadge.textContent = q.stageName;
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index + 1}/${questions.length}`;

  el.talkText.textContent = q.preTalk || "";
  if(q.preImage){
    el.talkImage.src = q.preImage;
    el.talkImage.hidden = false;
  }else{
    el.talkImage.hidden = true;
  }

  el.qidPill.textContent = `Q-${q.id}`;
  el.promptText.textContent = q.prompt || "";
  el.pythonEditor.value = q.pythonCode || "";
  el.refCode.textContent = q.refCode || "";
  el.runOutput.textContent = "";

  el.choicesForm.innerHTML = "";
  q.choices.forEach((c, i) => {
    const label = document.createElement("label");
    label.className = "choice";
    label.innerHTML = `
      <input type="radio" name="choice" value="${i}">
      <div class="choice__text">${c}</div>
    `;
    el.choicesForm.appendChild(label);
  });

  el.resultBox.classList.add("hidden");
  el.backBtn.disabled = (state.index === 0);
}

/* ===== 判定処理 ===== */
function judge(){
  const q = questions[state.index];
  const checked = el.choicesForm.querySelector("input[name='choice']:checked");
  if(!checked) return;

  const beforeLv = state.level;
  const ok = Number(checked.value) === Number(q.answerIndex);

  el.resultBox.classList.remove("hidden");
  el.resultMsg.textContent = ok ? "正解！" : "不正解";
  el.explainText.textContent = q.explain || "";
  el.autoNextText.textContent = "";

  if(ok){
    const add = Number(q.levelAward) || 1;
    state.level += add;

    /* ===== ヘッダ更新 ===== */
    el.levelText.textContent = `Lv.${state.level}`;

    /* ===== ポップアップ表示 ===== */
    el.popupResult.textContent = "正解！";
    el.popupBefore.textContent = `Lv.${beforeLv}`;
    el.popupAfter.textContent  = `Lv.${state.level}`;

    el.popup.classList.remove("hidden");

    /* 2秒後に消す */
    setTimeout(() => {
      el.popup.classList.add("hidden");
    }, 2000);

    /* 次の問題へ */
    if(state.index < questions.length - 1){
      setTimeout(() => {
        state.index++;
        renderQuestion();
      }, AUTO_NEXT_MS);
    }
  }
}

/* ===== 初期化 ===== */
async function init(){
  const res = await fetch(DATA_URL);
  questions = await res.json();

  renderQuestion();

  el.checkBtn.addEventListener("click", judge);

  el.backBtn.addEventListener("click", () => {
    if(state.index > 0){
      state.index--;
      renderQuestion();
    }
  });

  el.runBtn.addEventListener("click", async () => {
    el.runOutput.textContent = "実行中...";
    el.runOutput.textContent = await runPython(el.pythonEditor.value);
  });
}

init();
