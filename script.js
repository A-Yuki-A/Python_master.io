"use strict";

/**
 * questions.json 形式（あなたのデータに対応）
 * [
 *  {
 *    id, stageName, preTalk, preImage, prompt, pythonCode, refCode,
 *    choices: [..], answerIndex, levelAward, explain
 *  }
 * ]
 */

const $ = (id) => document.getElementById(id);

const state = {
  heroName: "",
  questions: [],
  index: 0,
  cleared: new Set(),   // クリアした問題id
  level: 1,
  locked: false,        // 1問で1回だけ判定させる
};

function storageKey(heroName) {
  return `pyquest_progress_v1_${heroName}`;
}

function loadProgress(heroName) {
  const raw = localStorage.getItem(storageKey(heroName));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveProgress() {
  if (!state.heroName) return;
  const data = {
    index: state.index,
    clearedIds: Array.from(state.cleared),
    level: state.level
  };
  localStorage.setItem(storageKey(state.heroName), JSON.stringify(data));
}

function resetProgress() {
  if (!state.heroName) return;
  localStorage.removeItem(storageKey(state.heroName));
}

function setStatus(msg) {
  $("statusNote").textContent = msg || "";
}

function setResult({ ok, msg, explain }) {
  const box = $("resultBox");
  box.hidden = false;

  $("resultHead").textContent = ok ? "正解！" : "不正解…";
  $("resultHead").style.background = ok ? "#e8fff1" : "#fff0f0";
  $("resultMsg").textContent = msg;
  $("explainText").textContent = explain || "";
}

function hideResult() {
  $("resultBox").hidden = true;
  $("resultMsg").textContent = "";
  $("explainText").textContent = "";
}

function updateHeader(q) {
  $("stageBadge").textContent = q?.stageName ? `ステージ：${q.stageName}` : "ステージ";
  $("qidPill").textContent = q?.id ? q.id : "Q-";
}

function updateStats() {
  const total = state.questions.length || 0;
  const clearedCount = state.cleared.size;

  $("levelText").textContent = state.heroName ? `Lv.${state.level}` : "-";
  $("progressText").textContent = state.heroName ? `${clearedCount}/${total}` : "-";

  const pct = total ? Math.round((clearedCount / total) * 100) : 0;
  $("progressFill").style.width = `${pct}%`;
}

function renderTalk(q) {
  $("talkText").textContent = q.preTalk || "";

  const img = $("talkImage");
  if (q.preImage && String(q.preImage).trim()) {
    img.src = q.preImage;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

function renderProblem(q) {
  $("promptText").textContent = q.prompt || "";
  $("pythonCode").textContent = q.pythonCode || "";
  $("refCode").textContent = q.refCode || "";
}

function renderChoices(q) {
  const form = $("choicesForm");
  form.innerHTML = "";

  const name = "choice";
  const choices = Array.isArray(q.choices) ? q.choices : [];

  choices.forEach((text, idx) => {
    const label = document.createElement("label");
    label.className = "choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = String(idx);

    const span = document.createElement("span");
    span.className = "choice__text";
    span.textContent = String(text);

    label.appendChild(input);
    label.appendChild(span);

    label.addEventListener("click", () => {
      if (state.locked) return;
      input.checked = true;
      $("checkBtn").disabled = false;
      hideResult();
      setStatus("");
    });

    form.appendChild(label);
  });

  $("checkBtn").disabled = true;
  $("nextBtn").disabled = true;
}

function getSelectedIndex() {
  const checked = document.querySelector('input[name="choice"]:checked');
  if (!checked) return null;
  const n = Number(checked.value);
  return Number.isFinite(n) ? n : null;
}

function applyCorrect(q) {
  // 1) クリア登録
  state.cleared.add(q.id);

  // 2) レベルは「到達レベル方式」（大きい方を採用）
  const award = Number(q.levelAward);
  if (Number.isFinite(award) && award > 0) {
    state.level = Math.max(state.level, award);
  } else {
    // levelAwardが無い場合は +1 にする（保険）
    state.level += 1;
  }

  saveProgress();
  updateStats();
}

function canGoNext() {
  return state.index < state.questions.length - 1;
}

function showQuestion() {
  const q = state.questions[state.index];
  if (!q) return;

  state.locked = false;
  updateHeader(q);
  renderTalk(q);
  renderProblem(q);
  renderChoices(q);
  hideResult();

  setStatus(`問題を選んで「判定する」を押してください。`);
  $("resetBtn").disabled = false;
}

async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json が読み込めませんでした");
  const data = await res.json();

  if (!Array.isArray(data)) throw new Error("questions.json は配列である必要があります");
  // 最低限の形チェック
  data.forEach((q, i) => {
    if (!q.id) throw new Error(`questions.json: ${i}番目の問題に id がありません`);
    if (!Array.isArray(q.choices)) throw new Error(`questions.json: ${q.id} の choices が配列ではありません`);
  });

  return data;
}

function startGame() {
  const heroName = $("heroName").value.trim();
  if (!heroName) {
    alert("勇者の名前を入力してください。");
    return;
  }

  state.heroName = heroName;

  // 進捗ロード（同じブラウザなら続きから）
  const saved = loadProgress(heroName);
  state.index = 0;
  state.cleared = new Set();
  state.level = 1;

  if (saved) {
    if (Number.isFinite(saved.index)) state.index = saved.index;
    if (Array.isArray(saved.clearedIds)) state.cleared = new Set(saved.clearedIds);
    if (Number.isFinite(saved.level)) state.level = saved.level;
  }

  updateStats();
  showQuestion();

  $("startBtn").textContent = "続きから";
  setStatus(`勇者「${heroName}」の修行を開始！`);
}

function checkAnswer() {
  const q = state.questions[state.index];
  if (!q) return;
  if (state.locked) return;

  const selected = getSelectedIndex();
  if (selected === null) {
    alert("選択肢を選んでください。");
    return;
  }

  state.locked = true;

  const ok = selected === Number(q.answerIndex);
  if (ok) {
    applyCorrect(q);
    setResult({
      ok: true,
      msg: `正解です。勇者「${state.heroName}」はレベルアップ！`,
      explain: q.explain || ""
    });
    $("nextBtn").disabled = !canGoNext();
    setStatus(canGoNext() ? "「次の問題へ」で進めます。" : "全問クリアです！");
  } else {
    setResult({
      ok: false,
      msg: "もう一度、コードと選択肢を見直しましょう。",
      explain: ""
    });
    $("nextBtn").disabled = true;
    setStatus("不正解のときは、もう一度選び直して「判定する」を押してください。");

    // 不正解なら再挑戦できるようにロック解除
    state.locked = false;
  }
}

function nextQuestion() {
  if (!canGoNext()) return;
  state.index += 1;
  saveProgress();
  updateStats();
  showQuestion();
}

function resetAll() {
  if (!state.heroName) return;
  const ok = confirm(`勇者「${state.heroName}」の進捗をリセットしますか？`);
  if (!ok) return;

  resetProgress();
  state.index = 0;
  state.cleared = new Set();
  state.level = 1;
  saveProgress();
  updateStats();
  showQuestion();
}

(async function init(){
  $("startBtn").addEventListener("click", startGame);
  $("checkBtn").addEventListener("click", checkAnswer);
  $("nextBtn").addEventListener("click", nextQuestion);
  $("resetBtn").addEventListener("click", resetAll);

  $("heroName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });

  try {
    state.questions = await loadQuestions();
    setStatus("questions.json を読み込みました。勇者名を入力して開始してください。");
  } catch (e) {
    console.error(e);
    setStatus("エラー：questions.json を読み込めません。配置を確認してください。");
    alert(String(e.message || e));
  }

  updateStats();
})();
