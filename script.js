"use strict";

/* ===== 設定 ===== */
const DATA_URL = "/Python_master.io/questions.json";
const AUTO_NEXT_MS = 900;
const POPUP_MS = 2000;
const POPUP_SKIP_MS = 500;

/* ===== DOM ===== */
const el = {
  stageBadge: document.getElementById("stageBadge"),
  levelText: document.getElementById("levelText"),
  progressText: document.getElementById("progressText"),

  // ストーリー
  storyCaption: document.getElementById("storyCaption"),
  talkImage: document.getElementById("talkImage"),
  talkText: document.getElementById("talkText"),

  // 問題
  qidPill: document.getElementById("qidPill"),
  promptText: document.getElementById("promptText"),

  pythonEditor: document.getElementById("pythonEditor"),
  refCode: document.getElementById("refCode"),
  runBtn: document.getElementById("runBtn"),
  runOutput: document.getElementById("runOutput"),

  inputArea: document.getElementById("inputArea"),
  choicesForm: document.getElementById("choicesForm"),

  backBtn: document.getElementById("backBtn"),
  checkBtn: document.getElementById("checkBtn"),
  skipBtn: document.getElementById("skipBtn"),

  resultBox: document.getElementById("resultBox"),
  resultMsg: document.getElementById("resultMsg"),
  explainText: document.getElementById("explainText"),

  popup: document.getElementById("popup"),
  popupResult: document.getElementById("popupResult"),
  popupLevelRow: document.getElementById("popupLevelRow"),
  popupBefore: document.getElementById("popupBefore"),
  popupAfter: document.getElementById("popupAfter"),

  // ★ ステージ選択モーダル
  stageModal: document.getElementById("stageModal"),
  stageList: document.getElementById("stageList"),
  stageCloseBtn: document.getElementById("stageCloseBtn"),
};

/* ===== 状態 ===== */
let questions = [];
let state = {
  index: 0,
  level: 1
};

/* ===== Pyodide ===== */
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

/* ===== ユーティリティ ===== */
function normalizeText(s){
  return String(s ?? "").trim();
}

/* ===== ポップアップ ===== */
function showPopup({ title, before = "", after = "", duration = POPUP_MS }){
  el.popupResult.textContent = title;

  if(before && after){
    el.popupLevelRow.style.display = "flex";
    el.popupBefore.textContent = before;
    el.popupAfter.textContent = after;
  }else{
    el.popupLevelRow.style.display = "none";
  }

  el.popup.classList.remove("hidden");
  clearTimeout(showPopup._t);

  showPopup._t = setTimeout(() => {
    el.popup.classList.add("hidden");
  }, duration);
}

/* ===== 表示 ===== */
function renderInput(q){
  el.inputArea.innerHTML = "";
  el.inputArea.classList.remove("hidden");
  el.choicesForm.classList.add("hidden");

  q.blanks.forEach((b, i) => {
    const row = document.createElement("div");

    const label = document.createElement("div");
    label.textContent = b.label || `入力${i+1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.dataset.type = b.type || "text";
    input.placeholder = b.placeholder || "";

    row.appendChild(label);
    row.appendChild(input);
    el.inputArea.appendChild(row);
  });
}

function renderChoice(q){
  el.choicesForm.innerHTML = "";
  el.choicesForm.classList.remove("hidden");
  el.inputArea.classList.add("hidden");

  q.choices.forEach((c, i) => {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="radio" name="choice" value="${i}">
      ${c}
    `;
    el.choicesForm.appendChild(label);
  });
}

function renderQuestion(){
  const q = questions[state.index];
  if(!q) return;

  el.stageBadge.textContent = q.stageName;
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index + 1}/${questions.length}`;

  // preCaption
  const cap = (q.preCaption || "").trim();
  if(cap){
    el.storyCaption.textContent = cap;
    el.storyCaption.classList.remove("hidden");
  }else{
    el.storyCaption.textContent = "";
    el.storyCaption.classList.add("hidden");
  }

  // ストーリー
  el.talkText.textContent = q.preTalk || "";
  el.talkImage.src = q.preImage || "";
  el.talkImage.hidden = !q.preImage;

  // 問題
  el.qidPill.textContent = `Q-${q.id}`;
  el.promptText.textContent = q.prompt || "";

  el.pythonEditor.value = q.pythonCode || "";
  el.refCode.textContent = q.refCode || "";
  el.runOutput.textContent = "";

  if(q.mode === "input"){
    renderInput(q);
  }else{
    renderChoice(q);
  }

  el.resultBox.classList.add("hidden");
  el.backBtn.disabled = (state.index === 0);
}

/* ===== 判定 ===== */
function judgeInput(q){
  const inputs = el.inputArea.querySelectorAll("input");
  for(let i=0;i<inputs.length;i++){
    const user = normalizeText(inputs[i].value);
    if(user === "") return { ok:false, empty:true };

    if(inputs[i].dataset.type === "int"){
      if(Number(user) !== q.answers[i]) return { ok:false };
    }else{
      if(user !== normalizeText(q.answers[i])) return { ok:false };
    }
  }
  return { ok:true };
}

function judgeChoice(q){
  const checked = el.choicesForm.querySelector("input:checked");
  if(!checked) return { ok:false, empty:true };
  return { ok:Number(checked.value) === q.answerIndex };
}

function judge(){
  const q = questions[state.index];
  const beforeLv = state.level;
  const result = (q.mode === "input") ? judgeInput(q) : judgeChoice(q);

  if(result.empty){
    el.resultBox.classList.remove("hidden");
    el.resultMsg.textContent = "未入力";
    el.explainText.textContent = "答えを入力してください。";
    return;
  }

  if(result.ok){
    state.level += q.levelAward || 0;
    el.levelText.textContent = `Lv.${state.level}`;

    el.resultMsg.textContent = "正解！";
    el.explainText.textContent = q.explain || "";

    showPopup({
      title: "正解！",
      before: `Lv.${beforeLv}`,
      after: `Lv.${state.level}`,
      duration: POPUP_MS
    });

    setTimeout(() => {
      state.index++;
      renderQuestion();
    }, AUTO_NEXT_MS);
  }else{
    el.resultMsg.textContent = "不正解";
    el.explainText.textContent = "もう一度考えてみよう。";

    showPopup({
      title: "残念…",
      duration: POPUP_MS
    });
  }
}

/* ===== スキップ ===== */
function skipQuestion(){
  el.resultBox.classList.remove("hidden");
  el.resultMsg.textContent = "スキップしました";
  el.explainText.textContent = "この問題は後で戻って挑戦できます。";

  showPopup({
    title: "スキップ",
    duration: POPUP_SKIP_MS
  });

  setTimeout(() => {
    state.index++;
    renderQuestion();
  }, AUTO_NEXT_MS);
}

/* ===== ステージ選択 ===== */
function buildStages(){
  const map = new Map();
  questions.forEach((q, i) => {
    if(!map.has(q.stageName)){
      map.set(q.stageName, { name: q.stageName, startIndex: i, count: 1 });
    }else{
      map.get(q.stageName).count++;
    }
  });
  return Array.from(map.values());
}

function openStageModal(){
  el.stageList.innerHTML = "";
  buildStages().forEach(s => {
    const item = document.createElement("div");
    item.className = "stageItem";
    item.innerHTML = `
      <div>${s.name}</div>
      <div class="stageItem__meta">問題数：${s.count}</div>
    `;
    item.addEventListener("click", () => {
      state.index = s.startIndex;
      renderQuestion();
      closeStageModal();
    });
    el.stageList.appendChild(item);
  });

  el.stageModal.classList.remove("hidden");
}

function closeStageModal(){
  el.stageModal.classList.add("hidden");
}

/* ===== 初期化 ===== */
async function init(){
  const res = await fetch(DATA_URL, { cache:"no-store" });
  questions = await res.json();

  renderQuestion();

  el.checkBtn.addEventListener("click", judge);
  el.skipBtn.addEventListener("click", skipQuestion);

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

  // ★ ステージ選択
  el.stageBadge.addEventListener("click", openStageModal);
  el.stageCloseBtn.addEventListener("click", closeStageModal);
  el.stageModal.addEventListener("click", (e) => {
    if(e.target === el.stageModal) closeStageModal();
  });
}

init();
