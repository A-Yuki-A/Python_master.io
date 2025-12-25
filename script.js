/* =========================================================
   script.js
   - questions.json（配列形式）を読み込む
   - 問題表示・選択肢判定
   - Pyodideで「本物のPython」を実行
   - 出力結果を画面に表示
   ========================================================= */

"use strict";

/* ---------- 設定 ---------- */
const DATA_URL = "./questions.json";
const STORAGE_KEY = "python_master_progress_pyodide";
const AUTO_NEXT_MS = 900;

/* ---------- DOM ---------- */
const el = {
  stageBadge: document.getElementById("stageBadge"),
  levelText: document.getElementById("levelText"),
  progressText: document.getElementById("progressText"),

  talkImage: document.getElementById("talkImage"),
  talkText: document.getElementById("talkText"),

  qidPill: document.getElementById("qidPill"),
  promptText: document.getElementById("promptText"),
  pythonCode: document.getElementById("pythonCode"),
  refCode: document.getElementById("refCode"),

  choicesForm: document.getElementById("choicesForm"),
  checkBtn: document.getElementById("checkBtn"),

  resultBox: document.getElementById("resultBox"),
  resultMsg: document.getElementById("resultMsg"),
  explainText: document.getElementById("explainText"),
  autoNextText: document.getElementById("autoNextText"),
};

/* ===== 実行ボタン・出力欄（JSで生成） ===== */
const runBtn = document.createElement("button");
runBtn.id = "runBtn";
runBtn.className = "btn";
runBtn.textContent = "▶ 実行";

const runOutput = document.createElement("pre");
runOutput.id = "runOutput";
runOutput.className = "code";
runOutput.style.marginTop = "8px";

/* Pythonコード欄の直後に挿入 */
el.pythonCode.parentElement.appendChild(runBtn);
el.pythonCode.parentElement.appendChild(runOutput);

/* ---------- 状態 ---------- */
let questions = [];
let state = loadState();

/* ---------- ユーティリティ ---------- */
function safeText(v) {
  return v === null || v === undefined ? "" : String(v);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { index: 0, level: 1, answered: {} };
    const s = JSON.parse(raw);
    return {
      index: Number.isFinite(s.index) ? s.index : 0,
      level: Number.isFinite(s.level) ? s.level : 1,
      answered: s.answered && typeof s.answered === "object" ? s.answered : {},
    };
  } catch {
    return { index: 0, level: 1, answered: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setBodyTheme(stageName) {
  document.body.classList.remove("stage-default", "stage-tutorial");
  if (safeText(stageName).includes("チュートリアル")) {
    document.body.classList.add("stage-tutorial");
  } else {
    document.body.classList.add("stage-default");
  }
}

function hideResult() {
  el.resultBox.hidden = true;
  el.resultMsg.textContent = "";
  el.explainText.textContent = "";
  el.autoNextText.textContent = "";
}

/* ---------- Pyodide ---------- */
let pyodide = null;

async function initPyodide() {
  pyodide = await loadPyodide();
}

async function runPython(code) {
  try {
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
${code}
output = sys.stdout.getvalue()
`);
    return pyodide.globals.get("output");
  } catch (e) {
    return e.toString();
  }
}

/* ---------- 描画 ---------- */
function renderChoices(q) {
  el.choicesForm.innerHTML = "";
  el.checkBtn.disabled = false;

  const key = q.id;
  const prev = state.answered[key];

  q.choices.forEach((text, idx) => {
    const label = document.createElement("label");
    label.className = "choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "choice";
    input.value = idx;
    if (prev === idx) input.checked = true;

    const div = document.createElement("div");
    div.className = "choice__text";
    div.textContent = text;

    label.appendChild(input);
    label.appendChild(div);
    el.choicesForm.appendChild(label);
  });
}

function renderQuestion() {
  const q = questions[state.index];
  if (!q) return;

  el.stageBadge.textContent = q.stageName;
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index + 1}/${questions.length}`;
  setBodyTheme(q.stageName);

  el.talkText.textContent = q.preTalk;
  if (q.preImage) {
    el.talkImage.src = q.preImage;
    el.talkImage.hidden = false;
  } else {
    el.talkImage.hidden = true;
  }

  el.qidPill.textContent = `Q-${q.id}`;
  el.promptText.textContent = q.prompt;
  el.pythonCode.textContent = q.pythonCode;
  el.refCode.textContent = q.refCode;

  runOutput.textContent = "";

  renderChoices(q);
  hideResult();
}

/* ---------- 判定 ---------- */
function getSelectedIndex() {
  const c = el.choicesForm.querySelector("input[name='choice']:checked");
  return c ? Number(c.value) : null;
}

function judge() {
  const q = questions[state.index];
  const selected = getSelectedIndex();
  if (selected === null) return;

  const ok = selected === q.answerIndex;
  const first = state.answered[q.id] === undefined;
  state.answered[q.id] = selected;

  if (ok && first) {
    state.level += q.levelAward || 1;
  }

  saveState();

  el.resultBox.hidden = false;
  el.resultMsg.textContent = ok ? "正解" : "不正解";
  el.explainText.textContent = q.explain || "";

  if (ok && state.index < questions.length - 1) {
    el.autoNextText.textContent = "正解！次の問題へ進みます…";
    setTimeout(() => {
      state.index++;
      renderQuestion();
    }, AUTO_NEXT_MS);
  }
}

/* ---------- 初期化 ---------- */
async function init() {
  await initPyodide();

  const res = await fetch(DATA_URL);
  questions = await res.json();

  renderQuestion();

  el.checkBtn.addEventListener("click", judge);

  runBtn.addEventListener("click", async () => {
    runOutput.textContent = "実行中...";
    runOutput.textContent = await runPython(el.pythonCode.textContent);
  });
}

init();
