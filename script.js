"use strict";

const $ = (id) => document.getElementById(id);

const LEVEL_PLUS = 5;
const AUTO_NEXT_DELAY_MS = 1200;

const DEFAULT_LEARN_TOPICS = [
  "rangeを使った繰り返し",
  "変数と値の変化",
  "実行結果の読み取り",
  "共通テスト形式の疑似コード"
];

const state = {
  questions: [],
  learnTopics: [],
  index: 0,
  level: 1,
  cleared: new Set(),
  judged: false
};

async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  const json = await res.json();
  state.questions = json.questions;
  state.learnTopics = json.meta?.learnTopics || [];
}

function updateStats() {
  $("levelText").textContent = `Lv.${state.level}`;
  $("progressText").textContent =
    `${state.cleared.size}/${state.questions.length}`;
}

function showQuestion() {
  const q = state.questions[state.index];
  if (!q) return;

  $("stageBadge").textContent = `ステージ：${q.stageName}`;
  $("qidPill").textContent = q.id;

  $("talkText").textContent = q.preTalk || "";
  $("talkImage").src = q.preImage || "";

  $("promptText").textContent = q.prompt || "";
  $("pythonCode").textContent = q.pythonCode || "";
  $("refCode").textContent = q.refCode || "";

  const form = $("choicesForm");
  form.innerHTML = "";

  q.choices.forEach((c, i) => {
    const label = document.createElement("label");
    label.className = "choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "choice";
    input.value = i;

    const span = document.createElement("span");
    span.className = "choice__text";
    span.textContent = c;

    label.appendChild(input);
    label.appendChild(span);

    label.onclick = () => {
      if (!state.judged) $("checkBtn").disabled = false;
    };

    form.appendChild(label);
  });

  $("checkBtn").disabled = true;
  $("resultBox").hidden = true;
  state.judged = false;
}

function checkAnswer() {
  if (state.judged) return;

  const checked = document.querySelector("input[name=choice]:checked");
  if (!checked) return;

  const q = state.questions[state.index];
  const ok = Number(checked.value) === q.answerIndex;

  $("resultBox").hidden = false;
  $("explainText").textContent = q.explain || "（解説は準備中）";

  if (ok) {
    $("resultMsg").textContent = "正解！";
    state.level += LEVEL_PLUS;
    state.cleared.add(q.id);
    updateStats();

    setTimeout(() => {
      state.index++;
      if (state.index < state.questions.length) {
        showQuestion();
      }
    }, AUTO_NEXT_DELAY_MS);
  } else {
    $("resultMsg").textContent = "不正解";
  }

  state.judged = true;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadQuestions();
  updateStats();
  showQuestion();
  $("checkBtn").onclick = checkAnswer;
});
