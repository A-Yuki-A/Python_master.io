"use strict";

const $ = (id) => document.getElementById(id);

const DEFAULT_LEARN_TOPICS = [
  "rangeを使った繰り返し",
  "変数と値の変化",
  "実行結果の読み取り",
  "共通テスト形式の疑似コード"
];

const state = {
  questions: [],
  learnTopics: []
};

async function loadQuestions() {
  try {
    const res = await fetch("questions.json", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch失敗");
    const json = await res.json();
    state.questions = json.questions || [];
    state.learnTopics = json.meta?.learnTopics || [];
  } catch (e) {
    console.warn("questions.json を読めません。TOPはデフォルト表示にします。");
    state.learnTopics = [];
  }
}

/* ===== TOP画面 ===== */
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

document.addEventListener("DOMContentLoaded", async () => {

  /* --- 冒険を始めるボタンは最優先で有効化 --- */
  const startBtn = $("startAdventureBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      location.href = "game.html";
    });
  }

  /* --- JSON読み込み（失敗してもOK） --- */
  await loadQuestions();

  /* --- TOP画面なら学習内容を表示 --- */
  if ($("learnList")) {
    setTopLearnTopics();
  }
});
