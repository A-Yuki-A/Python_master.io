"use strict";

/* ===== 設定 ===== */
const DATA_URL = "./questions.json";
const STORAGE_KEY = "python_master_progress_pyodide_v2";
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
};

/* ===== 状態 ===== */
let questions = [];
let state = loadState();

/* ===== ユーティリティ ===== */
function safeText(v){ return v == null ? "" : String(v); }

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { index:0, level:1, answered:{} };
    const s = JSON.parse(raw);
    return {
      index: Number.isFinite(s.index) ? s.index : 0,
      level: Number.isFinite(s.level) ? s.level : 1,
      answered: s.answered || {}
    };
  }catch{
    return { index:0, level:1, answered:{} };
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clampIndex(){
  if(state.index < 0) state.index = 0;
  if(state.index >= questions.length) state.index = Math.max(0, questions.length-1);
}

function setBodyTheme(stageName){
  document.body.classList.remove("stage-default","stage-tutorial");
  if(safeText(stageName).includes("チュートリアル")){
    document.body.classList.add("stage-tutorial");
  }else{
    document.body.classList.add("stage-default");
  }
}

function hideResult(){
  el.resultBox.hidden = true;
  el.resultMsg.textContent = "";
  el.explainText.textContent = "";
  el.autoNextText.textContent = "";
}

/* ===== Pyodide ===== */
let pyodideReady = null;

async function initPyodideOnce(){
  if(!pyodideReady){
    pyodideReady = (async ()=>{
      if(typeof loadPyodide !== "function"){
        throw new Error("pyodide.js が読み込めていません");
      }
      return await loadPyodide();
    })();
  }
  return pyodideReady;
}

async function runPythonAndCapture(code){
  const pyodide = await initPyodideOnce();
  try{
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);
    pyodide.runPython(code);
    pyodide.runPython(`_out = sys.stdout.getvalue()`);
    return pyodide.globals.get("_out") || "";
  }catch(e){
    return String(e);
  }
}

/* ===== 描画 ===== */
function renderChoices(q){
  el.choicesForm.innerHTML = "";
  const choices = Array.isArray(q.choices) ? q.choices : [];
  el.checkBtn.disabled = !choices.length;

  const key = q.id || `idx_${state.index}`;
  const prev = state.answered[key];

  choices.forEach((text, idx)=>{
    const label = document.createElement("label");
    label.className = "choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "choice";
    input.value = idx;
    if(prev === idx) input.checked = true;

    const div = document.createElement("div");
    div.className = "choice__text";
    div.textContent = safeText(text);

    label.appendChild(input);
    label.appendChild(div);
    el.choicesForm.appendChild(label);
  });
}

function renderQuestion(){
  clampIndex();
  const q = questions[state.index];
  if(!q) return;

  el.stageBadge.textContent = safeText(q.stageName || "ステージ");
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index+1}/${questions.length}`;
  setBodyTheme(q.stageName);

  el.talkText.textContent = safeText(q.preTalk || "");
  if(q.preImage){
    el.talkImage.src = q.preImage;
    el.talkImage.hidden = false;
  }else{
    el.talkImage.hidden = true;
  }

  el.qidPill.textContent = q.id ? `Q-${q.id}` : `Q-${state.index+1}`;
  el.promptText.textContent = safeText(q.prompt || "");
  el.pythonEditor.value = safeText(q.pythonCode || "");
  el.refCode.textContent = safeText(q.refCode || "");
  el.runOutput.textContent = "";

  renderChoices(q);
  hideResult();

  /* ★ 先頭では戻れない */
  el.backBtn.disabled = (state.index === 0);
}

/* ===== 判定 ===== */
function getSelectedIndex(){
  const c = el.choicesForm.querySelector("input[name='choice']:checked");
  return c ? Number(c.value) : null;
}

function judge(){
  const q = questions[state.index];
  const selected = getSelectedIndex();
  if(selected == null){
    el.resultBox.hidden = false;
    el.resultMsg.textContent = "未選択";
    el.explainText.textContent = "選択肢を1つ選んでください。";
    return;
  }

  const ok = selected === Number(q.answerIndex);
  const key = q.id || `idx_${state.index}`;
  const first = (state.answered[key] === undefined);
  state.answered[key] = selected;

  if(ok && first){
    state.level += Number(q.levelAward) || 1;
  }
  saveState();

  el.resultBox.hidden = false;
  el.resultMsg.textContent = ok ? "正解" : "不正解";
  el.explainText.textContent = safeText(q.explain || "");

  if(ok && state.index < questions.length-1){
    el.autoNextText.textContent = "正解！次へ進みます…";
    setTimeout(()=>{
      state.index++;
      renderQuestion();
    }, AUTO_NEXT_MS);
  }
}

/* ===== 初期化 ===== */
async function init(){
  try{
    const res = await fetch(DATA_URL, { cache:"no-store" });
    if(!res.ok) throw new Error("questions.json を取得できません");
    const json = await res.json();
    if(!Array.isArray(json)) throw new Error("questions.json は配列形式です");

    questions = json;
    renderQuestion();

    el.checkBtn.addEventListener("click", judge);

    /* ★ 戻るボタン */
    el.backBtn.addEventListener("click", ()=>{
      if(state.index > 0){
        state.index--;
        saveState();
        renderQuestion();
      }
    });

    el.runBtn.addEventListener("click", async ()=>{
      el.runOutput.textContent = "実行中...";
      el.runOutput.textContent = await runPythonAndCapture(el.pythonEditor.value);
    });

  }catch(e){
    el.progressText.textContent = "0/0";
    el.checkBtn.disabled = true;
    el.resultBox.hidden = false;
    el.resultMsg.textContent = "エラー";
    el.explainText.textContent = String(e);
  }
}

init();
