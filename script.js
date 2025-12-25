"use strict";

/* ===== 設定 ===== */
const DATA_URL = "/Python_master.io/questions.json";
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
let state = { index: 0, level: 1 };

/* ===== Pyodide ===== */
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

  el.resultBox.classList.add("hidden");
  el.levelUpAnim.classList.add("hidden");
  el.levelUpAnim.classList.remove("play");

  el.backBtn.disabled = (state.index === 0);
}

/* ===== 判定（★ここが肝） ===== */
function judge(){
  const q = questions[state.index];
  const checked = el.choicesForm.querySelector("input:checked");
  if(!checked) return;

  const beforeLv = state.level;
  const ok = Number(checked.value) === Number(q.answerIndex);

  el.resultBox.classList.remove("hidden");
  el.resultMsg.textContent = ok ? "正解！" : "不正解";
  el.explainText.textContent = q.explain || "";
  el.autoNextText.textContent = "";

  /* ★ 演出を必ずリセット */
  el.levelUpAnim.classList.add("hidden");
  el.levelUpAnim.classList.remove("play");

  if(ok){
    state.level += q.levelAward || 1;

    /* ヘッダのLv更新 */
    el.levelText.textContent = `Lv.${state.level}`;

    /* ★ Lv.X → Lv.Y 表示 */
    el.levelBefore.textContent = `Lv.${beforeLv}`;
    el.levelAfter.textContent  = `Lv.${state.level}`;

    el.levelUpAnim.classList.remove("hidden");

    /* ★ 強制リフローでアニメ再発火 */
    void el.levelUpAnim.offsetWidth;
    el.levelUpAnim.classList.add("play");

    if(state.index < questions.length - 1){
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
    if(state.index > 0){
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
