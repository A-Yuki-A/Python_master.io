"use strict";

/* =====================================================
   共通ユーティリティ
===================================================== */
const $ = (id) => document.getElementById(id);

/* =====================================================
   デフォルト学習内容（JSONが無い場合の保険）
===================================================== */
const DEFAULT_LEARN_TOPICS = [
  "rangeを使った繰り返し",
  "変数と値の変化",
  "実行結果の読み取り",
  "共通テスト形式の疑似コード"
];

/* =====================================================
   状態管理
===================================================== */
const state = {
  questions: [],
  learnTopics: [],
  idx: 0
};

/* =====================================================
   questions.json 読み込み
===================================================== */
async function loadQuestions() {
  try {
    const res = await fetch("questions.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();

    state.questions = json.questions || [];
    state.learnTopics = json.meta?.learnTopics || [];
  } catch (e) {
    console.warn("questions.json を読み込めませんでした", e);
    state.questions = [];
    state.learnTopics = [];
  }
}

/* =====================================================
   TOP画面（index.html）
===================================================== */
function setTopLearnTopics() {
  const ul = $("learnList");
  if (!ul) return;

  const topics = state.learnTopics.length
    ? state.learnTopics
    : DEFAULT_LEARN_TOPICS;

  ul.innerHTML = "";
  topics.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });

  const note = $("learnNote");
  if (note) {
    note.textContent =
      "※ この一覧は questions.json の meta.learnTopics から自動表示しています。";
  }
}

/* =====================================================
   game画面（game.html）
===================================================== */
function renderQuestion() {
  const q = state.questions[state.idx];

  if (!q) {
    if ($("promptText")) {
      $("promptText").textContent =
        "問題データがありません。questions.json を確認してください。";
    }
    return;
  }

  /* --- 基本表示 --- */
  if ($("qidPill")) $("qidPill").textContent = q.id || `Q${state.idx + 1}`;
  if ($("promptText")) $("promptText").textContent = q.prompt || "";

  if ($("pythonCode")) $("pythonCode").textContent = q.python || "";
  if ($("refCode")) $("refCode").textContent = q.ref || "";

  if ($("talkText")) $("talkText").textContent = q.preTalk || "";
  if ($("talkImage") && q.image) $("talkImage").src = q.image;

  /* --- 進捗・レベル --- */
  if ($("progressText")) {
    $("progressText").textContent =
      `${state.idx + 1}/${state.questions.length}`;
  }

  /* --- 選択肢 --- */
  const form = $("choicesForm");
  const checkBtn = $("checkBtn");

  if (form) {
    form.innerHTML = "";

    (q.choices || []).forEach((text, i) => {
      const label = document.createElement("label");
      label.className = "choice";
      label.innerHTML = `
        <input type="radio" name="choice" value="${i}">
        <span class="choice__text"></span>
      `;
      label.querySelector(".choice__text").textContent = text;
      form.appendChild(label);
    });

    if (checkBtn) checkBtn.disabled = true;

    form.addEventListener(
      "change",
      () => {
        if (checkBtn) checkBtn.disabled = false;
      },
      { once: true }
    );
  }
}

/* =====================================================
   初期化
===================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  /* --- JSON読み込み --- */
  await loadQuestions();

  /* --- index.html（TOP） --- */
  if ($("learnList")) {
    setTopLearnTopics();
  }

  /* --- game.html（問題画面） --- */
  if ($("promptText")) {
    renderQuestion();
  }

  /* --- 冒険開始ボタン --- */
  const startBtn = $("startAdventureBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      location.href = "game.html";
    });
  }
});
