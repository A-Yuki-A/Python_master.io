"use strict";

/* =============================
   設定
============================= */
const DATA_URL = "./questions.json";
const STORAGE_KEY = "python_master_progress_pyodide_v1";
const AUTO_NEXT_MS = 900;

/* =============================
   DOM（あなたのHTMLのidに合わせる）
============================= */
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

  resultBox: document.getElementById("resultBox"),
  resultMsg: document.getElementById("resultMsg"),
  explainText: document.getElementById("explainText"),
  autoNextText: document.getElementById("autoNextText"),
};

/* =============================
   状態
============================= */
let questions = [];
let state = loadState();

/* =============================
   ユーティリティ
============================= */
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

function clampIndex() {
  if (state.index < 0) state.index = 0;
  if (state.index >= questions.length) state.index = Math.max(0, questions.length - 1);
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

function showError(msg) {
  // 画面内で分かるように表示
  el.resultBox.hidden = false;
  el.resultMsg.textContent = "エラー";
  el.explainText.textContent = safeText(msg);
  el.autoNextText.textContent = "";
}

/* =============================
   Pyodide（本物のPython実行）
============================= */
let pyodideReady = null;

async function initPyodideOnce() {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      // loadPyodide が無い場合（pyodide.js読み込み失敗）
      if (typeof loadPyodide !== "function") {
        throw new Error("pyodide.js が読み込めていません。game.htmlで pyodide.js を script.js より前に読み込んでください。");
      }
      const pyodide = await loadPyodide();
      return pyodide;
    })();
  }
  return pyodideReady;
}

async function runPythonAndCapture(code) {
  const pyodide = await initPyodideOnce();
  try {
    // stdout を吸い取る
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);
    pyodide.runPython(code);
    pyodide.runPython(`_out = sys.stdout.getvalue()`);
    return pyodide.globals.get("_out") || "";
  } catch (e) {
    return String(e);
  }
}

/* =============================
   描画
============================= */
function renderChoices(q) {
  el.choicesForm.innerHTML = "";

  const choices = Array.isArray(q.choices) ? q.choices : [];
  if (!choices.length) {
    el.checkBtn.disabled = true;
    return;
  }

  el.checkBtn.disabled = false;

  const key = q.id || `idx_${state.index}`;
  const prev = state.answered[key];

  choices.forEach((text, idx) => {
    const label = document.createElement("label");
    label.className = "choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "choice";
    input.value = String(idx);
    if (prev !== undefined && Number(prev) === idx) input.checked = true;

    const div = document.createElement("div");
    div.className = "choice__text";
    div.textContent = safeText(text);

    label.appendChild(input);
    label.appendChild(div);
    el.choicesForm.appendChild(label);
  });
}

function renderQuestion() {
  clampIndex();
  const q = questions[state.index];
  if (!q) return;

  // ステージ・進捗・Lv
  el.stageBadge.textContent = safeText(q.stageName || "ステージ");
  el.levelText.textContent = `Lv.${state.level}`;
  el.progressText.textContent = `${state.index + 1}/${questions.length}`;
  setBodyTheme(q.stageName);

  // 長老
  el.talkText.textContent = safeText(q.preTalk || "");
  if (q.preImage) {
    el.talkImage.src = safeText(q.preImage);
    el.talkImage.hidden = false;
  } else {
    el.talkImage.hidden = true;
  }

  // 問題
  el.qidPill.textContent = q.id ? `Q-${safeText(q.id)}` : `Q-${state.index + 1}`;
  el.promptText.textContent = safeText(q.prompt || "");

  // Python（編集できる）
  el.pythonEditor.value = safeText(q.pythonCode || "");

  // 共通テスト用言語
  el.refCode.textContent = safeText(q.refCode || "");

  // 出力欄をクリア
  el.runOutput.textContent = "";

  // 選択肢
  renderChoices(q);

  // 結果表示を隠す
  hideResult();
}

/* =============================
   判定
============================= */
function getSelectedIndex() {
  const checked = el.choicesForm.querySelector("input[name='choice']:checked");
  if (!checked) return null;
  const v = Number(checked.value);
  return Number.isFinite(v) ? v : null;
}

function judge() {
  const q = questions[state.index];
  if (!q) return;

  const selected = getSelectedIndex();
  if (selected === null) {
    el.resultBox.hidden = false;
    el.resultMsg.textContent = "未選択";
    el.explainText.textContent = "選択肢を1つ選んでから判定してください。";
    el.autoNextText.textContent = "";
    return;
  }

  const correctIndex = Number(q.answerIndex);
  if (!Number.isFinite(correctIndex)) {
    showError("answerIndex が設定されていません。questions.json を確認してください。");
    return;
  }

  const key = q.id || `idx_${state.index}`;
  const firstTime = (state.answered[key] === undefined);
  state.answered[key] = selected;

  const ok = (selected === correctIndex);

  if (ok && firstTime) {
    const add = Number(q.levelAward);
    if (Number.isFinite(add) && add > 0) state.level += add;
    else state.level += 1;
  }

  saveState();

  el.resultBox.hidden = false;
  el.resultMsg.textContent = ok ? "正解" : "不正解";
  el.explainText.textContent = safeText(q.explain || "");
  el.autoNextText.textContent = "";

  if (ok && state.index < questions.length - 1) {
    el.autoNextText.textContent = "正解！次の問題へ進みます…";
    setTimeout(() => {
      state.index += 1;
      saveState();
      renderQuestion();
    }, AUTO_NEXT_MS);
  }
}

/* =============================
   初期化
============================= */
async function init() {
  try {
    // questions.json を読む
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`questions.json の取得に失敗しました（HTTP ${res.status}）\n同階層に questions.json があるか、GitHub Pagesに反映されているか確認してください。`);
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
      throw new Error("questions.json は配列形式（先頭が [ ）である必要があります。");
    }

    questions = json;

    if (!questions.length) {
      throw new Error("questions.json の配列が空です。");
    }

    // 表示
    renderQuestion();

    // ボタンイベント
    el.checkBtn.addEventListener("click", judge);

    el.runBtn.addEventListener("click", async () => {
      el.runOutput.textContent = "実行中...";
      const code = el.pythonEditor.value; // ★編集した内容を実行
      const result = await runPythonAndCapture(code);
      el.runOutput.textContent = result;
    });

  } catch (e) {
    // 0/0のままにならないように、画面に出す
    el.progressText.textContent = "0/0";
    el.checkBtn.disabled = true;

    showError(
      `${safeText(e)}\n\n【よくある原因】\n・questions.json が game.html と同じ階層に無い\n・ファイル名の大小文字が違う（GitHub Pagesは区別します）\n・GitHub Pagesが別ブランチ/別フォルダを公開している`
    );
  }
}

init();
