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
  heroName: "勇者",          // TOPで名前入力はしないので固定
  questions: [],
  learnTopics: [],
  index: 0,
  cleared: new Set(),
  level: 1,
  judged: false,
  autoNextTimer: null,
};

function storageKey() {
  // 名前固定なので固定キーでOK
  return `pyquest_progress_v3_fixedhero`;
}

function loadProgress() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveProgress() {
  const data = {
    index: state.index,
    clearedIds: Array.from(state.cleared),
    level: state.level
  };
  localStorage.setItem(storageKey(), JSON.stringify(data));
}

function resetProgress() {
  localStorage.removeItem(storageKey());
}

function clearAutoNextTimer() {
  if (state.autoNextTimer) {
    clearTimeout(state.autoNextTimer);
    state.autoNextTimer = null;
  }
}

function setStatus(msg) {
  const el = $("statusNote");
  if (el) el.textContent = msg || "";
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
  if (!listEl) return;
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

  const noteEl = $("learnNote");
  if (noteEl) noteEl.textContent = note;
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

  const heroEl = $("heroText");
  if (heroEl) heroEl.textContent = state.heroName;

  const levelEl = $("levelText");
  if (levelEl) levelEl.textContent = `Lv.${state.level}`;

  const progEl = $("progressText");
  if (progEl) progEl.textContent = `${clearedCount}/${total}`;

  const fill = $("progressFill");
  const pct = total ? Math.round((clearedCount / total) * 100) : 0;
  if (fill) fill.style.width = `${pct}%`;
}

function updateHeader(q) {
  const badge = $("stageBadge");
  if (badge) badge.textContent = q?.stageName ? `ステージ：${q.stageName}` : "ステージ";

  const pill = $("qidPill");
  if (pill) pill.textContent = q?.id ? q.id : "Q-";
}

function renderTalk(q) {
  const talk = $("talkText");
  if (talk) talk.textContent = q.preTalk || "";

  const img = $("talkImage");
  if (!img) return;

  if (q.preImage && String(q.preImage).trim()) {
    img.src = q.preImage;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

function renderProblem(q) {
  const p = $("promptText");
  if (p) p.textContent = q.prompt || "";

  const py = $("pythonCode");
  if (py) py.textContent = q.pythonCode || "";

  const ref = $("refCode");
  if (ref) ref.textContent = q.refCode || "";
}

function hideResult() {
  const box = $("resultBox");
  if (box) box.hidden = true;

  const msg = $("resultMsg");
  if (msg) msg.textContent = "";

  const exp = $("explainText");
  if (exp) exp.textContent = "";

  const auto = $("autoNextText");
  if (auto) auto.textContent = "";
}

function setResult({ ok, msg, explain, autoNextText }) {
  const box = $("resultBox");
  if (box) box.hidden = false;

  const head = $("resultHead");
  if (head) {
    head.textContent = ok ? "正解！" : "不正解…";
    head.style.background = ok ? "#e8fff1" : "#fff0f0";
  }

  const msgEl = $("resultMsg");
  if (msgEl) msgEl.textContent = msg;

  // 解説は必ず表示（空なら準備中）
  const expText = (explain && String(explain).trim()) ? explain : "（解説は準備中です）";
  const expEl = $("explainText");
  if (expEl) expEl.textContent = expText;

  const autoEl = $("autoNextText");
  if (autoEl) autoEl.textContent = autoNextText || "";
}

function renderChoices(q) {
  const form = $("choicesForm");
  if (!form) return;

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

      const checkBtn = $("checkBtn");
      if (checkBtn) checkBtn.disabled = false;

      hideResult();
      setStatus("");
    });

    form.appendChild(label);
  });

  const checkBtn = $("checkBtn");
  if (checkBtn) checkBtn.disabled = true;
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
  if (!q) {
    setStatus("問題データがありません（questions.json を確認してください）。");
    return;
  }

  state.judged = false;

  setBodyTheme(q.stageName);
  updateHeader(q);
  updateStats();

  renderTalk(q);
  renderProblem(q);
  renderChoices(q);
  hideResult();

  const resetBtn = $("resetBtn");
  if (resetBtn) resetBtn.disabled = false;

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

  const checkBtn = $("checkBtn");
  if (checkBtn) checkBtn.disabled = true;

  document.querySelectorAll('input[name="choice"]').forEach(el => el.disabled = true);
}

function unlockForRetry() {
  state.judged = false;
  document.querySelectorAll('input[name="choice"]').forEach(el => el.disabled = false);
}

function goEnding() {
  const endHero = $("endHero");
  if (endHero) endHero.textContent = state.heroName;

  const endLevel = $("endLevel");
  if (endLevel) endLevel.textContent = `Lv.${state.level}`;

  const endCorrect = $("endCorrect");
  if (endCorrect) endCorrect.textContent = `${state.cleared.size}/${state.questions.length}`;

  setEndLearnTopics();

  $("gameScreen")?.classList.add("hidden");
  $("endingScreen")?.classList.remove("hidden");
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

    const checkBtn = $("checkBtn");
    if (checkBtn) checkBtn.disabled = false;

    setStatus("不正解のときは、選び直して「判定する」を押してください。");
  }
}

function startAdventure() {
  clearAutoNextTimer();

  // 進捗を復元（あれば）
  const saved = loadProgress();
  state.index = 0;
  state.cleared = new Set();
  state.level = 1;

  if (saved) {
    if (Number.isFinite(saved.index)) state.index = saved.index;
    if (Array.isArray(saved.clearedIds)) state.cleared = new Set(saved.clearedIds);
    if (Number.isFinite(saved.level)) state.level = saved.level;
  }

  $("topScreen")?.classList.add("hidden");
  $("endingScreen")?.classList.add("hidden");
  $("gameScreen")?.classList.remove("hidden");

  updateStats();
  showQuestion();
  setStatus("冒険を開始しました！");
}

function resetAll() {
  clearAutoNextTimer();

  const ok = confirm("進捗をリセットしますか？");
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

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("stage-default");

  // イベント登録（存在チェック付き）
  const startBtn = $("startAdventureBtn");
  if (startBtn) startBtn.addEventListener("click", startAdventure);

  const checkBtn = $("checkBtn");
  if (checkBtn) checkBtn.addEventListener("click", checkAnswer);

  const resetBtn = $("resetBtn");
  if (resetBtn) resetBtn.addEventListener("click", resetAll);

  const restartBtn = $("restartBtn");
  if (restartBtn) restartBtn.addEventListener("click", () => location.reload());

  // TOPに学習内容を出す（JSON読み込み後）
  (async () => {
    try {
      state.questions = await loadQuestions();
      setTopLearnTopics();
      updateStats(); // 進捗表示を初期化
    } catch (e) {
      console.error(e);
      state.learnTopics = [];
      setTopLearnTopics();
      alert(String(e.message || e));
    }
  })();
});
