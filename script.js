"use strict";

/**
 * questions.json 形式（例）
 * [
 *  {
 *    "id": "Q01",
 *    "stageName": "チュートリアルの平原",
 *    "preTalk": "...",
 *    "preImage": "images/scene01.JPG",
 *    "prompt": "...",
 *    "pythonCode": "...",
 *    "refCode": "...",
 *    "choices": ["...", "...", "...", "...", "..."],
 *    "answerIndex": 0,
 *    "explain": "..."
 *  }
 * ]
 */

const $ = (id) => document.getElementById(id);

const LEVEL_PLUS = 5;
const AUTO_NEXT_DELAY_MS = 1200;

/** ステージ背景の割り当て（必要なら追加してOK） */
const STAGE_THEME_RULES = [
  { includes: ["チュートリアル", "草原", "平原"], theme: "stage-tutorial" },
  { includes: ["洞窟", "坑道", "迷宮"], theme: "stage-cave" },
  { includes: ["火山", "溶岩", "灼熱"], theme: "stage-volcano" },
  { includes: ["氷", "雪", "凍"], theme: "stage-ice" },
];

const state = {
  heroName: "",
  questions: [],
  index: 0,
  cleared: new Set(),   // クリアした問題id
  level: 1,
  judged: false,        // 判定済みか
  autoNextTimer: null,
};

function storageKey(heroName) {
  return `pyquest_progress_v2_${heroName}`;
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

function setBodyTheme(stageName) {
  // まず全部外す
  const classes = ["stage-default", "stage-tutorial", "stage-cave", "stage-volcano", "stage-ice"];
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

function setResult({ ok, msg, explain, autoNextText }) {
  const box = $("resultBox");
  box.hidden = false;

  $("resultHead").textContent = ok ? "正解！" : "不正解…";
  $("resultHead").style.background = ok ? "#e8fff1" : "#fff0f0";

  $("resultMsg").textContent = msg;

  // 解説は必ず表示（空なら「準備中」）
  const exp = (explain && String(explain).trim()) ? explain : "（解説は準備中です）";
  $("explainText").textContent = exp;

  $("autoNextText").textContent = autoNextText || "";
}

function hideResult() {
  $("resultBox").hidden = true;
  $("resultMsg").textContent = "";
  $("explainText").textContent = "";
  $("autoNextText").textContent = "";
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
      if (state.judged) return; // 判定後は触れない
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

function applyCorrect(q) {
  // クリア登録（初回だけカウントしたいならここで条件分岐）
  const wasCleared = state.cleared.has(q.id);
  state.cleared.add(q.id);

  // レベルは「正解1回につき +5」
  // ただし同じ問題を何度も正解して稼げないように、初回だけ加算にする
  if (!wasCleared) state.level += LEVEL_PLUS;

  saveProgress();
  updateStats();
}

function clearAutoNextTimer() {
  if (state.autoNextTimer) {
    clearTimeout(state.autoNextTimer);
    state.autoNextTimer = null;
  }
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
  renderTalk(q);
  renderProblem(q);
  renderChoices(q);
  hideResult();

  $("resetBtn").disabled = false;

  setStatus("選択肢を選んで「判定する」を押してください。");
}

async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json が読み込めませんでした");

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("questions.json は配列である必要があります");

  data.forEach((q, i) => {
    if (!q.id) throw new Error(`${i}番目の問題に id がありません`);
    if (!Array.isArray(q.choices)) throw new Error(`${q.id} の choices が配列ではありません`);
    if (!Number.isFinite(Number(q.answerIndex))) throw new Error(`${q.id} の answerIndex が数値ではありません`);
  });

  return data;
}

function startGame() {
  clearAutoNextTimer();

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

function lockAfterJudge() {
  state.judged = true;
  $("checkBtn").disabled = true;
  // ラジオもクリック無効に（見た目は残す）
  document.querySelectorAll('input[name="choice"]').forEach(el => el.disabled = true);
}

function unlockForRetry() {
  state.judged = false;
  $("checkBtn").disabled = false; // 選択されていれば押せるようにする
  document.querySelectorAll('input[name="choice"]').forEach(el => el.disabled = false);
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
        msg: `正解です。勇者「${state.heroName}」はレベルアップ！（+${LEVEL_PLUS}）`,
        explain: q.explain || "",
        autoNextText: `${AUTO_NEXT_DELAY_MS / 1000}秒後に自動で次の問題へ進みます…`
      });

      // 自動で次へ
      state.autoNextTimer = setTimeout(() => {
        nextQuestion();
      }, AUTO_NEXT_DELAY_MS);

      setStatus("正解！自動で次へ進みます。");
    } else {
      setResult({
        ok: true,
        msg: `正解です。全問クリア！勇者「${state.heroName}」は修行を終えました。（+${LEVEL_PLUS}）`,
        explain: q.explain || "",
        autoNextText: ""
      });
      setStatus("全問クリアです！");
    }
  } else {
    // 不正解でも解説は出す（必ず表示）
    setResult({
      ok: false,
      msg: "不正解です。解説を読んで、もう一度選び直しましょう。",
      explain: q.explain || "",
      autoNextText: ""
    });

    // 不正解は再挑戦できる（ロックしない）
    unlockForRetry();
    setStatus("不正解のときは、選び直して「判定する」を押してください。");
  }
}

function nextQuestion() {
  clearAutoNextTimer();

  if (!canGoNext()) return;
  state.index += 1;

  saveProgress();
  updateStats();
  showQuestion();
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

(async function init(){
  // 初期テーマ
  document.body.classList.add("stage-default");

  $("startBtn").addEventListener("click", startGame);
  $("checkBtn").addEventListener("click", checkAnswer);
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
