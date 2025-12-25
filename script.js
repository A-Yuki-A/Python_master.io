"use strict";

/* ===== 設定 ===== */
const DATA_URL = "/Python_master.io/questions.json";
const STORAGE_KEY = "python_master_progress_lv";
const AUTO_NEXT_MS = 900;

/* ===== DOM ===== */
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

  levelUpAnim: document.getElementById("levelUpAnim"),
  levelBefore: document.getElementById("levelBefore"),
  levelAfter: document.getElementById("levelAfter"),
};

/* ===== 状態 ===== */
let questions = [];
let state = loadState();

/* ===== 状態管理 ===== */
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { index:0, level:1, answered:{} };
    return JSON.parse(raw);
  }catch{
    return { index:0, level:1, answered:{} };
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ===== Pyodide ===== */
let pyodideReady = null;

async function getPyodide(){
  if(!pyodideReady){
    pyodideReady = loadPyodide();
  }
  return pyodideReady;
}

async function runPython(code){
  const py = await getPyodide();
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

/* ===== 表示 ===== */
function renderQuestion(){
  const q = questions[state.index];
  if(!q) return;

  el.stageBadge.textContent = q.stageName;
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index+1}/${questions.length}`;

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
  q.choices.forEach((c,i)=>{
    const label = document.createElement("label");
    label.className = "choice";
    label.innerHTML = `
      <input type="radio" name="choice" value="${i}">
      <div class="choice__text">${c}</div>
    `;
    el.choicesForm.appendChild(label);
  });

  el.checkBtn.disabled = false;
  el.backBtn.disabled = (state.index === 0);
  el.resultBox.hidden = true;
  el.levelUpAnim.classList.add("hidden");
}

/* ===== 判定 ===== */
function judge(){
  const q = questions[state.index];
  const sel = el.choicesForm.querySelector("input:checked");
  if(!sel) return;

  const beforeLv = state.level;
  const ok = Number(sel.value) === q.answerIndex;

  el.resultBox.hidden = false;
  el.resultMsg.textContent = ok ? "正解！" : "不正解";
  el.explainText.textContent = q.explain || "";

  if(ok){
    state.level += q.levelAward || 1;
    saveState();

    if(state.level > beforeLv){
      el.levelBefore.textContent = `Lv.${beforeLv}`;
      el.levelAfter.textContent  = `Lv.${state.level}`;
      el.levelUpAnim.classList.remove("hidden");

      el.levelUpAnim.style.animation = "none";
      el.levelUpAnim.offsetHeight;
      el.levelUpAnim.style.animation = "";
    }

    if(state.index < questions.length-1){
      el.autoNextText.textContent = "次の問題へ進みます…";
      setTimeout(()=>{
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
  el.backBtn.addEventListener("click", ()=>{
    if(state.index>0){
      state.index--;
      renderQuestion();
    }
  });

  el.runBtn.addEventListener("click", async ()=>{
    el.runOutput.textContent = "実行中...";
    el.runOutput.textContent = await runPython(el.pythonEditor.value);
  });
}

init();
