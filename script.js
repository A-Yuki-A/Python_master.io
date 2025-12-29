"use strict";

/* ===== 設定 ===== */
const DATA_URL = "/Python_master.io/questions.json";
const AUTO_NEXT_MS = 900;
const POPUP_MS = 2000;

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

  inputArea: document.getElementById("inputArea"),
  choicesForm: document.getElementById("choicesForm"),

  backBtn: document.getElementById("backBtn"),
  checkBtn: document.getElementById("checkBtn"),
  skipBtn: document.getElementById("skipBtn"),

  resultBox: document.getElementById("resultBox"),
  resultMsg: document.getElementById("resultMsg"),
  explainText: document.getElementById("explainText"),
  autoNextText: document.getElementById("autoNextText"),

  popup: document.getElementById("popup"),
  popupResult: document.getElementById("popupResult"),
  popupLevelRow: document.getElementById("popupLevelRow"),
  popupBefore: document.getElementById("popupBefore"),
  popupAfter: document.getElementById("popupAfter"),
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
  return String(s ?? "")
    .replace(/\u3000/g, " ")
    .trim();
}

function showPopup({ title, before = "", after = "" }){
  el.popupResult.textContent = title;

  if(before && after){
    el.popupLevelRow.style.display = "flex";
    el.popupBefore.textContent = before;
    el.popupAfter.textContent = after;
  }else{
    el.popupLevelRow.style.display = "none";
  }

  el.popup.classList.remove("hidden");

  const card = el.popup.querySelector(".popup__card");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "";

  clearTimeout(showPopup._t);
  showPopup._t = setTimeout(() => {
    el.popup.classList.add("hidden");
  }, POPUP_MS);
}

/* ===== 表示 ===== */
function renderInput(q){
  el.inputArea.innerHTML = "";
  el.inputArea.classList.remove("hidden");
  el.choicesForm.classList.add("hidden");

  q.blanks.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "inputRow";

    const label = document.createElement("div");
    label.className = "inputLabel";
    label.textContent = b.label || `入力${i+1}`;

    const input = document.createElement("input");
    input.className = "inputBox";
    input.type = "text";
    input.dataset.type = b.type || "text";
    input.placeholder = b.placeholder || "";

    row.appendChild(label);
    row.appendChild(input);
    el.inputArea.appendChild(row);

    if(b.hint){
      const hint = document.createElement("div");
      hint.className = "inputHint";
      hint.textContent = b.hint;
      el.inputArea.appendChild(hint);
    }
  });
}

function renderChoice(q){
  el.choicesForm.innerHTML = "";
  el.choicesForm.classList.remove("hidden");
  el.inputArea.classList.add("hidden");

  q.choices.forEach((c, i) => {
    const label = document.createElement("label");
    label.className = "choice";
    label.innerHTML = `
      <input type="radio" name="choice" value="${i}">
      <div class="choice__text">${c}</div>
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

  el.talkText.textContent = q.preTalk || "";
  el.talkImage.src = q.preImage || "";
  el.talkImage.hidden = !q.preImage;

  el.qidPill.textContent = `Q-${q.id}`;
  el.promptText.innerHTML = q.prompt || "";

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
function judgeChoice(q){
  const checked = el.choicesForm.querySelector("input[name='choice']:checked");
  if(!checked) return { ok:false, reason:"未選択" };
  return { ok: Number(checked.value) === q.answerIndex };
}

function judgeInput(q){
  const inputs = el.inputArea.querySelectorAll(".inputBox");
  if(inputs.length !== q.answers.length){
    return { ok:false, reason:"不一致" };
  }

  for(let i=0;i<inputs.length;i++){
    const type = inputs[i].dataset.type;
    const user = normalizeText(inputs[i].value);

    if(user === ""){
      return { ok:false, reason:"未入力" };
    }

    if(type === "int"){
      if(Number(user) !== q.answers[i]) return { ok:false };
    }else{
      if(user !== normalizeText(q.answers[i])) return { ok:false };
    }
  }
  return { ok:true };
}

function applyResult(ok, q, beforeLv){
  el.resultBox.classList.remove("hidden");

  if(ok){
    state.level += q.levelAward || 0;
    el.levelText.textContent = `Lv.${state.level}`;

    el.resultMsg.textContent = "正解！";
    el.explainText.textContent = q.explain || "";

    showPopup({
      title: "正解！",
      before: `Lv.${beforeLv}`,
      after: `Lv.${state.level}`
    });

    if(state.index < questions.length - 1){
      setTimeout(() => {
        state.index++;
        renderQuestion();
      }, AUTO_NEXT_MS);
    }
  }else{
    el.resultMsg.textContent = "不正解";
    el.explainText.textContent = "もう一度考えてみよう。";
    showPopup({ title: "残念…" });
  }
}

function judge(){
  const q = questions[state.index];
  const beforeLv = state.level;

  let result;
  if(q.mode === "input"){
    result = judgeInput(q);
  }else{
    result = judgeChoice(q);
  }

  if(result.reason === "未入力" || result.reason === "未選択"){
    el.resultBox.classList.remove("hidden");
    el.resultMsg.textContent = "未入力";
    el.explainText.textContent = "答えを入力してください。";
    return;
  }

  applyResult(result.ok, q, beforeLv);
}

/* ===== スキップ ===== */
function skipQuestion(){
  showPopup({ title: "スキップ" });

  el.resultBox.classList.remove("hidden");
  el.resultMsg.textContent = "スキップしました";
  el.explainText.textContent = "この問題は後で戻って挑戦できます。";

  if(state.index < questions.length - 1){
    setTimeout(() => {
      state.index++;
      renderQuestion();
    }, AUTO_NEXT_MS);
  }
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
}

init();
