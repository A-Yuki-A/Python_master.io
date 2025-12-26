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

  checkBtn: document.getElementById("checkBtn"),
  backBtn: document.getElementById("backBtn"),

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
let state = { index: 0, level: 1 };

/* ===== Pyodide（Python実行） ===== */
let pyodideReady = null;

async function runPython(code){
  if(!pyodideReady) pyodideReady = loadPyodide();
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
  if(s == null) return "";
  // 全角スペース→半角、前後空白を削除
  return String(s).replace(/\u3000/g, " ").trim();
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

  // animation を毎回確実に再発火させる
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

  const blanks = Array.isArray(q.blanks) ? q.blanks : [];
  blanks.forEach((b, idx) => {
    const row = document.createElement("div");
    row.className = "inputRow";

    const label = document.createElement("div");
    label.className = "inputLabel";
    label.textContent = b.label || `入力${idx + 1}`;

    const input = document.createElement("input");
    input.className = "inputBox";
    input.type = "text";
    input.inputMode = (b.type === "int") ? "numeric" : "text";
    input.placeholder = (b.placeholder || "");
    input.dataset.index = String(idx);
    input.dataset.type = b.type || "text";

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

  // 最初の入力欄にフォーカス
  const first = el.inputArea.querySelector(".inputBox");
  if(first) first.focus();
}

function renderChoice(q){
  el.choicesForm.innerHTML = "";
  el.choicesForm.classList.remove("hidden");
  el.inputArea.classList.add("hidden");

  (q.choices || []).forEach((c, i) => {
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

  el.stageBadge.textContent = q.stageName || "ステージ";
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index + 1}/${questions.length}`;

  el.talkText.textContent = q.preTalk || "";
  if(q.preImage){
    el.talkImage.src = q.preImage;
    el.talkImage.hidden = false;
  }else{
    el.talkImage.hidden = true;
  }

  el.qidPill.textContent = `Q-${q.id || "-"}`;
  el.promptText.textContent = q.prompt || "";

  el.pythonEditor.value = q.pythonCode || "";
  el.refCode.textContent = q.refCode || "";
  el.runOutput.textContent = "";

  const mode = q.mode || "choice";
  if(mode === "input") renderInput(q);
  else renderChoice(q);

  el.resultBox.classList.add("hidden");
  el.autoNextText.textContent = "";
  el.backBtn.disabled = (state.index === 0);
}

/* ===== 判定 ===== */
function judgeChoice(q){
  const checked = el.choicesForm.querySelector("input[name='choice']:checked");
  if(!checked) return { ok:false, reason:"未選択" };
  const ok = Number(checked.value) === Number(q.answerIndex);
  return { ok, reason: ok ? "" : "不正解" };
}

function judgeInput(q){
  const inputs = Array.from(el.inputArea.querySelectorAll(".inputBox"));
  const answers = Array.isArray(q.answers) ? q.answers : [];

  if(inputs.length === 0) return { ok:false, reason:"入力欄なし" };
  if(answers.length !== inputs.length) return { ok:false, reason:"answers数と入力欄数が不一致" };

  for(let i=0;i<inputs.length;i++){
    const type = inputs[i].dataset.type || "text";
    const userRaw = inputs[i].value;

    if(normalizeText(userRaw) === ""){
      return { ok:false, reason:"未入力" };
    }

    if(type === "int"){
      const userNum = Number(normalizeText(userRaw));
      const ansNum = Number(answers[i]);
      if(!Number.isFinite(userNum)) return { ok:false, reason:"数値で入力してください" };
      if(userNum !== ansNum) return { ok:false, reason:"不正解" };
    }else{
      const userText = normalizeText(userRaw);
      const ansText = normalizeText(answers[i]);
      if(userText !== ansText) return { ok:false, reason:"不正解" };
    }
  }

  return { ok:true, reason:"" };
}

function applyResult({ ok, q, beforeLv }){
  el.resultBox.classList.remove("hidden");
  el.resultMsg.textContent = ok ? "正解！" : "不正解";
  el.explainText.textContent = q.explain || "";
  el.autoNextText.textContent = "";

  if(ok){
    const add = Number(q.levelAward) || 1;
    state.level += add;
    el.levelText.textContent = `Lv.${state.level}`;

    showPopup({
      title: "正解！",
      before: `Lv.${beforeLv}`,
      after: `Lv.${state.level}`
    });

    if(state.index < questions.length - 1){
      el.autoNextText.textContent = "次の問題へ進みます…";
      setTimeout(() => {
        state.index++;
        renderQuestion();
      }, AUTO_NEXT_MS);
    }
  }else{
    showPopup({ title: "残念…" });
  }
}

function judge(){
  const q = questions[state.index];
  if(!q) return;

  const beforeLv = state.level;
  const mode = q.mode || "choice";

  let res;
  if(mode === "input") res = judgeInput(q);
  else res = judgeChoice(q);

  if(!res.ok && (res.reason === "未選択" || res.reason === "未入力")){
    // 未入力・未選択は結果欄だけ出して注意
    el.resultBox.classList.remove("hidden");
    el.resultMsg.textContent = "未入力";
    el.explainText.textContent = (mode === "input")
      ? "すべての入力欄に答えを入れてください。"
      : "選択肢を1つ選んでください。";
    el.autoNextText.textContent = "";
    return;
  }

  applyResult({ ok: res.ok, q, beforeLv });
}

/* ===== 初期化 ===== */
async function init(){
  const res = await fetch(DATA_URL, { cache: "no-store" });
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

  // Enterで判定（inputモードのとき便利）
  document.addEventListener("keydown", (e) => {
    const q = questions[state.index];
    if(!q) return;
    if(q.mode === "input" && e.key === "Enter"){
      // textareaのEnterは除外
      if(document.activeElement && document.activeElement.id === "pythonEditor") return;
      e.preventDefault();
      judge();
    }
  });
}

init();
