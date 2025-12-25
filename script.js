"use strict";

/**
 * questions.json は 2形式に対応
 * A) 配列のみ:
 *    [ {id, stageName, ...} ]
 * B) meta + questions:
 *    { meta:{ learnTopics:[...] }, questions:[ ... ] }
 */

const $ = (id) => document.getElementById(id);

const LEVEL_PLUS = 5;
const AUTO_NEXT_DELAY_MS = 1200;

const DEFAULT_LEARN_TOPICS = [
  "range を使った繰り返し",
  "変数と値の変化",
  "コードの実行結果の読み取り",
  "共通テスト形式の疑似コード"
];

/** ステージ背景の割り当て（必要なら追加してOK） */
const STAGE_THEME_RULES = [
  { includes: ["チュートリアル", "草原", "平原"], theme: "stage-tutorial" },
  { includes: ["洞窟", "坑道", "迷宮"], theme: "stage-cave" },
  { includes: ["火山", "溶岩", "灼熱"], theme: "stage-volcano" },
  { includes: ["氷", "雪", "凍"], theme: "stage-ice" },
];

const state = {
  heroName: "アルテミス",
  questions: [],
  learnTopics: [],
  index: 0,
  cleared: new Set(),
  level: 1,
  judged: false,
  autoNextTimer: null,
};

function storageKey(heroName) {
  return `pyquest_progress_v3_${heroName}`;
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

function clearAutoNextTimer() {
  if (state.autoNextTimer) {
    clearTimeout(state.autoNextTimer);
    state.autoNextTimer = null;
  }
}

function setStatus(msg) {
  $("statusNote").textContent = msg || "";
}

function setBodyTheme(stageName) {
  const classes = ["stage-default","stage-tutorial","stage-cave","stage-volcano","stage-ice"];
  classes.forEach(c => document.body.classList.remove(c));

  const name = String(stageName || "");
  let theme = "stage-default";

  for (const rule of STAGE_THEME_RULES) {
    if (rule.includes.some(w => name.includes(w))) {
      theme = rule.theme;
      break;
    }
  }
  document.body.classList.add(theme);
}

function renderLearnList(listEl, topics) {
  listEl.innerHTML = "";
  topics.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    listEl.appendChild(li);
  });
}

function setTopLearnTopics() {
  // トップ画面（JSONのmetaがあれば自動。なければデフォルト）
  const topics = (Array.isArray(state.learnTopics) && state.learnTopics.length)
    ? state.learnTopics
    : DEFAULT_LEARN_TOPICS;

  renderLearnList($("learnList"), topics);

  const note = (Array.isArray(state.learnTopics) && state.learnTopics.length)
    ? "※ この一覧は questions.json の meta.learnTopics から自動表示しています。"
    : "※ meta.learnTopics が未設定のため、デフォルト表示です。";

  $("learnNote").textContent = note;
}

function setEndLearnTopics() {
  const topics = (Array.isArray(state.learnTopics) && state.learnTopics.length)
    ? state.learnTopics
    : DEFAULT_LEARN_TOPICS;

  renderLearnList($("endLearnList"), topics);
}

function updateStats() {
  const total = state.questions.length || 0;
  const clearedCount = state.cleared.size;

  $("heroText").textContent = state.heroName ? state.heroName : "-";
  $("levelText").textContent = state.heroName ? `Lv.${state.level}` : "Lv.1";
  $("progressText").textContent = `${clearedCount}/${total}`;

  const pct = total ? Math.round((clearedCount / total) * 100) : 0;
  $("progressFill").style.width = `${pct}%`;
}

function updateHeader(q) {
  $("stageBadge").textContent = q?.stageName ? `ステージ：${q.stageName}` : "ステージ";
  $("qidPill").textContent = q?.id ? q.id : "Q-";
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

function hideResult() {
  $("resultBox").hidden = true;
  $("resultMsg").textContent = "";
  $("explainText").textContent = "";
  $("autoNextText").textContent = "";
}

function setResult({ ok, msg, explain, autoNextText }) {
  $("resultBox").hidden = false;
  $("resultHead").textContent = ok ? "正解！" : "不正解…";
  $("resultHead").style.background = ok ? "#e8fff1" : "#fff0f0";

  $("resultMsg").textContent = msg;

  // 解説は必ず表示（空なら準備中）
  const exp = (explain && String(explain).trim()) ? explain : "（解説は準備中です）";
  $("explainText").textContent = exp;

  $("autoNextText").textContent = autoNextText || "";
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
      if (state.judged) return;
      input.checked = true;
      $("checkBtn").disabled = false;
      hideResult();
      setStatus("");
    });

    form.appendChild(label);
  });

  $("checkBtn").disabled = true;
}

function getSelectedIndex() {
  const checked = document.querySelector('input[name="choice"]:checked');
  if (!checked) return null;
  const n = Number(checked.value);
  return Number.isFinite(n) ? n : null;
}

function canGoNext() {
  return state.index < state.questions.length - 1;
}

function showQuestion() {
  clearAutoNextTimer();

  const q = state.questions[state.index];
  if (!q) return;

  state.judged = false;

  setBodyTheme(q.stageName);
  updateHeader(q);
  updateStats();

  renderTalk(q);
  renderProblem(q);
  renderChoices(q);
  hideResult();

  $("resetBtn").disabled = false;

  setStatus("選択肢を選んで「判定する」を押してください。");
}

function applyCorrect(q) {
  const wasCleared = state.cleared.has(q.id);
  state.cleared.add(q.id);

  // 初回正解だけレベル加算（稼ぎ防止）
  if (!wasCleared) state.level += LEVEL_PLUS;

  saveProgress();
  updateStats();
}

function lockAfterJudge() {
  state.judged = true;
  $("checkBtn").disabled = true;
  document.querySelectorAll('input[name="choice"]').forEach(el => el.disabled = true);
}

function unlockForRetry() {
  state.judged = false;
  document.querySelectorAll('input[name="choice"]').forEach(el => el.disabled = false);
}

function goEnding() {
  // エンディングに到達レベルを表示
  $("endHero").textContent = state.heroName;
  $("endLevel").textContent = `Lv.${state.level}`;
  $("endCorrect").textContent = `${state.cleared.size}/${state.questions.length}`;

  setEndLearnTopics();

  $("gameScreen").classList.add("hidden");
  $("endingScreen").classList.remove("hidden");
}

function nextQuestion() {
  clearAutoNextTimer();

  if (!canGoNext()) {
    goEnding();
    return;
  }
  state.index += 1;
  saveProgress();
  updateStats();
  showQuestion();
}

function checkAnswer() {
  clearAutoNextTimer();

  const q = state.questions[state.index];
  if (!q) return;
  if (state.judged) return;

  const selected = getSelectedIndex();
  if (selected === null) {
    alert("選択肢を選んでください。");
    return;
  }

  const ok = selected === Number(q.answerIndex);

  // 解説は必ず表示
  if (ok) {
    lockAfterJudge();
    applyCorrect(q);

    if (canGoNext()) {
      setResult({
        ok: true,
        msg: `正解です。レベル+${LEVEL_PLUS}！`,
        explain: q.explain || "",
        autoNextText: `${AUTO_NEXT_DELAY_MS / 1000}秒後に自動で次の問題へ進みます…`
      });
      state.autoNextTimer = setTimeout(nextQuestion, AUTO_NEXT_DELAY_MS);
      setStatus("正解！自動で次へ進みます。");
    } else {
      // 最終問題
      setResult({
        ok: true,
        msg: `正解です。全問クリア！レベル+${LEVEL_PLUS}！`,
        explain: q.explain || "",
        autoNextText: `エンディングへ移動します…`
      });
      state.autoNextTimer = setTimeout(goEnding, AUTO_NEXT_DELAY_MS);
      setStatus("全問クリアです！");
    }
  } else {
    setResult({
      ok: false,
      msg: "不正解です。解説を読んで、もう一度選び直しましょう。",
      explain: q.explain || "",
      autoNextText: ""
    });
    unlockForRetry();
    $("checkBtn").disabled = false; // 押せる状態維持
    setStatus("不正解のときは、選び直して「判定する」を押してください。");
  }
}

function startAdventure() {
  clearAutoNextTimer();

  state.index = 0;
  state.cleared = new Set();
  state.level = 1;

  $("topScreen").classList.add("hidden");
  $("endingScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");

  updateStats();
  showQuestion(); // ← Q01（＝チュートリアルの平原）
  }

  state.heroName = heroName;

  const saved = loadProgress(heroName);
  state.index = 0;
  state.cleared = new Set();
  state.level = 1;

  if (saved) {
    if (Number.isFinite(saved.index)) state.index = saved.index;
    if (Array.isArray(saved.clearedIds)) state.cleared = new Set(saved.clearedIds);
    if (Number.isFinite(saved.level)) state.level = saved.level;
  }

  $("topScreen").classList.add("hidden");
  $("endingScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");

  updateStats();
  showQuestion();
  setStatus(`勇者「${state.heroName}」の冒険を開始！`);
}

function resetAll() {
  clearAutoNextTimer();

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

async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json が読み込めませんでした");

  const raw = await res.json();

  // 2形式対応
  let questions;
  let learnTopics = [];

  if (Array.isArray(raw)) {
    questions = raw;
  } else if (raw && typeof raw === "object" && Array.isArray(raw.questions)) {
    questions = raw.questions;
    if (raw.meta && Array.isArray(raw.meta.learnTopics)) {
      learnTopics = raw.meta.learnTopics;
    }
  } else {
    throw new Error("questions.json の形式が不正です（配列 or {meta,questions}）");
  }

  // 最低限チェック
  questions.forEach((q, i) => {
    if (!q.id) throw new Error(`${i}番目の問題に id がありません`);
    if (!Array.isArray(q.choices)) throw new Error(`${q.id} の choices が配列ではありません`);
    if (!Number.isFinite(Number(q.answerIndex))) throw new Error(`${q.id} の answerIndex が数値ではありません`);
  });

  state.learnTopics = learnTopics;
  return questions;
}

(function init(){
  document.body.classList.add("stage-default");

  $("startAdventureBtn").addEventListener("click", startAdventure);
  $("checkBtn").addEventListener("click", checkAnswer);
  $("resetBtn").addEventListener("click", resetAll);
  $("restartBtn").addEventListener("click", () => location.reload());

  $("heroName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startAdventure();
  });

  // まずトップに学習内容を出したいので、JSON読み込み後に反映
  (async () => {
    try {
      state.questions = await loadQuestions();
      setTopLearnTopics();
    } catch (e) {
      console.error(e);
      // JSONが読めなくてもトップは出す（デフォルト内容で）
      state.learnTopics = [];
      setTopLearnTopics();
      alert(String(e.message || e));
    }
  })();
})();
