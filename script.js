"use strict";

/* =====================================================
   共通ユーティリティ
===================================================== */
const $ = (id) => document.getElementById(id);

/* =====================================================
   デフォルト学習内容（questions.json が無い場合）
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
   値取得ヘルパ（キー名違い対応）
===================================================== */
function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return fallback;
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

  /* --- デバッグ用（必要なければ削除OK） --- */
  console.log("Question data:", q);

  /* --- 問題文・ID --- */
  if ($("qidPill")) {
    $("qidPill").textContent = pick(q, ["id", "qid"], `Q${state.idx + 1}`);
  }
  if ($("promptText")) {
    $("promptText").textContent = pick(
      q,
      ["prompt", "question", "mondai"],
      ""
    );
  }

  /* --- Pythonコード --- */
  if ($("pythonCode")) {
    $("pythonCode").textContent = pick(
      q,
      ["python", "pythonCode", "codePython"],
      ""
    );
  }

  /* --- 共通テスト用言語 --- */
  if ($("refCode")) {
    $("refCode").textContent = pick(
      q,
      ["ref", "refCode", "common", "commonTest", "commonTestCode"],
      ""
    );
  }

  /* --- 長老のことば --- */
  if ($("talkText")) {
    $("talkText").textContent = pick(
      q,
      ["preTalk", "talk", "serif"],
      ""
    );
  }

  /* --- 画像 --- */
  const imgEl = $("talkImage");
  if (imgEl) {
    const imgPath = pick(
      q,
      ["image", "img", "imagePath", "talkImage"],
      ""
    );
    if (imgPath) {
      imgEl.src = imgPath;
      imgEl.hidden = false;
    } else {
      imgEl.removeAttribute("src");
      imgEl.hidden = true;
    }
  }

  /* --- 進捗 --- */
  if ($("progressText")) {
    $("progressText").textContent =
      `${state.idx + 1}/${state.questions.length}`;
  }

  /* --- 選択肢 --- */
  const form = $("choicesForm");
  const checkBtn = $("checkBtn");
  const choices =
    q.choices || q.options || q.sentakushi || [];

  if (form) {
    form.innerHTML = "";

    choices.forEach((text, i) => {
      const label = document.createElement("label");
      label.className = "choice";
      label.innerHTML = `
        <input type="radio" name="choice" value="${i}">
        <span class="choice__text"></span>
      `;
      label.querySelector(".choice__text").textContent = String(text);
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

  /* --- index.html --- */
  if ($("learnList")) {
    setTopLearnTopics();
  }

  /* --- game.html --- */
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
