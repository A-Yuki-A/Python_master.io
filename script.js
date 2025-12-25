/* script.js
  - ./questions.json（配列）を読み込み
  - HTMLの各idに出力
  - choices（選択肢）表示、answerIndex で判定
  - 正解時は levelAward 分だけLv加算
  - 正解時に自動で次の問題へ（最後以外）
*/

(() => {
  "use strict";

  const DATA_URL = "./questions.json";
  const STORAGE_KEY = "python_master_progress_v3";

  const AUTO_NEXT_MS = 900; // 0にすると自動遷移なし

  // ===== DOM（あなたのHTMLのidに合わせる） =====
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

  // ===== state =====
  let questions = [];
  let state = loadState();

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
    // あなたのHTMLは hidden 属性で隠している
    if (el.resultBox) el.resultBox.hidden = true;
    if (el.resultMsg) el.resultMsg.textContent = "";
    if (el.explainText) el.explainText.textContent = "";
    if (el.autoNextText) el.autoNextText.textContent = "";
  }

  function showResult(ok, explain) {
    if (el.resultBox) el.resultBox.hidden = false;
    if (el.resultMsg) el.resultMsg.textContent = ok ? "正解" : "不正解";
    if (el.explainText) el.explainText.textContent = safeText(explain || "");
  }

  function getAnsweredKey(q) {
    return safeText(q.id || `idx_${state.index}`);
  }

  function renderChoices(q) {
    el.choicesForm.innerHTML = "";

    const choices = Array.isArray(q.choices) ? q.choices : [];
    if (!choices.length) {
      el.checkBtn.disabled = true;
      const p = document.createElement("p");
      p.textContent = "（choices がありません）";
      p.style.color = "#5b6578";
      el.choicesForm.appendChild(p);
      return;
    }

    el.checkBtn.disabled = false;

    const key = getAnsweredKey(q);
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

    // ステージ
    if (el.stageBadge) el.stageBadge.textContent = safeText(q.stageName || "ステージ");
    setBodyTheme(q.stageName);

    // レベル・進捗
    if (el.levelText) el.levelText.textContent = `Lv.${state.level}`;
    if (el.progressText) el.progressText.textContent = `${state.index + 1}/${questions.length}`;

    // 長老テキスト・画像
    if (el.talkText) el.talkText.textContent = safeText(q.preTalk || "");
    if (el.talkImage) {
      if (q.preImage) {
        el.talkImage.src = safeText(q.preImage);
        el.talkImage.classList.remove("hidden");
      } else {
        el.talkImage.removeAttribute("src");
        el.talkImage.classList.add("hidden");
      }
    }

    // 問題情報
    if (el.qidPill) el.qidPill.textContent = q.id ? `Q-${safeText(q.id)}` : `Q-${state.index + 1}`;
    if (el.promptText) el.promptText.textContent = safeText(q.prompt || "");
    if (el.pythonCode) el.pythonCode.textContent = safeText(q.pythonCode || "");
    if (el.refCode) el.refCode.textContent = safeText(q.refCode || "");

    // 選択肢
    renderChoices(q);

    // 結果は毎回隠す
    hideResult();
  }

  function getSelectedIndex() {
    const checked = el.choicesForm.querySelector('input[name="choice"]:checked');
    if (!checked) return null;
    const v = Number(checked.value);
    return Number.isFinite(v) ? v : null;
  }

  function judge() {
    const q = questions[state.index];
    if (!q) return;

    const selected = getSelectedIndex();
    if (selected === null) {
      showResult(false, "選択肢を1つ選んでから判定してください。");
      return;
    }

    const correctIndex = Number(q.answerIndex);
    if (!Number.isFinite(correctIndex)) {
      showResult(true, q.explain || "（answerIndex が未設定のため判定できません）");
      return;
    }

    const key = getAnsweredKey(q);
    const firstTime = (state.answered[key] === undefined);

    state.answered[key] = selected;

    const ok = selected === correctIndex;

    // 初回正解なら levelAward 加算
    if (ok && firstTime) {
      const add = Number(q.levelAward);
      if (Number.isFinite(add) && add > 0) state.level += add;
      else state.level += 1;
    }

    saveState();
    showResult(ok, q.explain || "");

    // 自動で次へ
    if (ok && AUTO_NEXT_MS > 0 && state.index < questions.length - 1) {
      if (el.autoNextText) el.autoNextText.textContent = "正解！ 次の問題へ進みます…";
      window.setTimeout(() => {
        state.index += 1;
        saveState();
        renderQuestion();
      }, AUTO_NEXT_MS);
    } else {
      if (el.autoNextText) el.autoNextText.textContent = "";
    }
  }

  // ===== init =====
  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`questions.json の読み込みに失敗しました (${res.status})`);

      const json = await res.json();
      if (!Array.isArray(json)) {
        throw new Error("questions.json は配列形式（先頭が [ ）である必要があります。");
      }

      questions = json;
      if (!questions.length) throw new Error("questions.json の配列が空です。");

      // indexが末尾を超えてたら調整
      clampIndex();
      renderQuestion();

      // ボタンは form の外にあるので submit になりやすい → click を止める
      el.checkBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        judge();
      });

      // Enter で判定（ラジオ選択後に便利）
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          judge();
        }
      });

    } catch (err) {
      console.error(err);

      // 画面に表示
      if (el.resultBox) el.resultBox.hidden = false;
      if (el.resultMsg) el.resultMsg.textContent = "エラー";
      if (el.explainText) {
        el.explainText.textContent =
          safeText(err?.message || err) +
          "\n\n確認ポイント：\n・game.html と questions.json が同じ階層か\n・GitHub Pages で questions.json が 404 になっていないか\n・JSONの先頭が [ から始まっているか";
      }
    }
  }

  init();
})();
