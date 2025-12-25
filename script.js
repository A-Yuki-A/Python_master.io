/* script.js（questions.json が「配列」形式の版）
  - 同階層の ./questions.json を fetch
  - 1問ずつ表示
  - 判定（answerIndex）
  - 進捗・Lv（levelAward で加算）
  - preImage を表示

  【game.html 側のid（この名前で用意してください）】
  stageName, playerLevel, progressText
  elderText, elderImg
  qNo, prompt, codePython, codePseudo
  choicesForm, judgeBtn
  resultArea, resultMsg, resultExplain
  nextBtn, restartBtn
*/

(() => {
  "use strict";

  const DATA_URL = "./questions.json";
  const STORAGE_KEY = "python_master_progress_v2";
  const AUTO_NEXT_MS = 700; // 正解時に自動で次へ（0なら無し）

  const el = {
    stageName: document.getElementById("stageName"),
    playerLevel: document.getElementById("playerLevel"),
    progressText: document.getElementById("progressText"),

    elderText: document.getElementById("elderText"),
    elderImg: document.getElementById("elderImg"), // <img id="elderImg">

    qNo: document.getElementById("qNo"),
    prompt: document.getElementById("prompt"),
    codePython: document.getElementById("codePython"),
    codePseudo: document.getElementById("codePseudo"),

    choicesForm: document.getElementById("choicesForm"),
    judgeBtn: document.getElementById("judgeBtn"),

    resultArea: document.getElementById("resultArea"),
    resultMsg: document.getElementById("resultMsg"),
    resultExplain: document.getElementById("resultExplain"),

    nextBtn: document.getElementById("nextBtn"),
    restartBtn: document.getElementById("restartBtn"),
  };

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

  function resetState() {
    state = { index: 0, level: 1, answered: {} };
    saveState();
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

  function clearResult() {
    el.resultArea?.classList.add("hidden");
    if (el.resultMsg) el.resultMsg.textContent = "";
    if (el.resultExplain) el.resultExplain.textContent = "";
  }

  function showResult(ok, explainText) {
    el.resultArea?.classList.remove("hidden");
    if (el.resultMsg) el.resultMsg.textContent = ok ? "正解" : "不正解";
    if (el.resultExplain) el.resultExplain.textContent = safeText(explainText || "");
  }

  function renderQuestion() {
    clampIndex();
    const q = questions[state.index];
    if (!q) return;

    // ステージ・進捗
    if (el.stageName) el.stageName.textContent = safeText(q.stageName || "");
    if (el.playerLevel) el.playerLevel.textContent = `Lv.${state.level}`;
    if (el.progressText) el.progressText.textContent = `${state.index + 1}/${questions.length}`;

    setBodyTheme(q.stageName);

    // 長老テキスト・画像
    if (el.elderText) el.elderText.textContent = safeText(q.preTalk || "");
    if (el.elderImg) {
      if (q.preImage) {
        el.elderImg.src = safeText(q.preImage);
        el.elderImg.alt = "scene";
        el.elderImg.classList.remove("hidden");
      } else {
        el.elderImg.classList.add("hidden");
      }
    }

    // 問題番号
    if (el.qNo) el.qNo.textContent = safeText(q.id ? `Q-${q.id}` : `Q-${state.index + 1}`);

    // 問題文
    if (el.prompt) el.prompt.textContent = safeText(q.prompt || "");

    // コード
    if (el.codePython) el.codePython.textContent = safeText(q.pythonCode || "");
    if (el.codePseudo) el.codePseudo.textContent = safeText(q.refCode || "");

    // 選択肢
    el.choicesForm.innerHTML = "";
    const choices = Array.isArray(q.choices) ? q.choices : [];
    if (!choices.length) {
      el.judgeBtn.disabled = true;
      const p = document.createElement("p");
      p.textContent = "（choices がありません）";
      p.style.color = "#5b6578";
      el.choicesForm.appendChild(p);
      return;
    }
    el.judgeBtn.disabled = false;

    const answeredKey = safeText(q.id || `idx_${state.index}`);
    const prev = state.answered[answeredKey];

    choices.forEach((text, idx) => {
      const label = document.createElement("label");
      label.className = "choice";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "choice";
      input.value = String(idx);

      if (prev !== undefined && Number(prev) === idx) input.checked = true;

      const t = document.createElement("div");
      t.className = "choice__text";
      t.textContent = safeText(text);

      label.appendChild(input);
      label.appendChild(t);
      el.choicesForm.appendChild(label);
    });

    clearResult();

    if (el.nextBtn) el.nextBtn.disabled = state.index >= questions.length - 1;
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
    const ok = Number.isFinite(correctIndex) ? (selected === correctIndex) : false;

    const answeredKey = safeText(q.id || `idx_${state.index}`);
    const firstTime = (state.answered[answeredKey] === undefined);

    state.answered[answeredKey] = selected;

    // 初回正解ならレベル加算（levelAward）
    if (ok && firstTime) {
      const add = Number(q.levelAward);
      if (Number.isFinite(add) && add > 0) state.level += add;
      else state.level += 1; // levelAwardが無い時の保険
    }

    saveState();
    showResult(ok, q.explain || "");

    if (ok && AUTO_NEXT_MS > 0 && state.index < questions.length - 1) {
      window.setTimeout(() => {
        state.index += 1;
        saveState();
        renderQuestion();
      }, AUTO_NEXT_MS);
    }
  }

  function next() {
    if (state.index < questions.length - 1) {
      state.index += 1;
      saveState();
      renderQuestion();
    }
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`questions.json の読み込みに失敗しました (${res.status})`);

      const json = await res.json();

      // ★ここが重要：配列形式かどうか
      if (!Array.isArray(json)) {
        throw new Error("questions.json が配列形式ではありません。先頭が [ から始まっているか確認してください。");
      }

      questions = json;

      if (!questions.length) throw new Error("questions.json の配列が空です。");

      renderQuestion();

      el.judgeBtn?.addEventListener("click", judge);
      el.nextBtn?.addEventListener("click", next);
      el.restartBtn?.addEventListener("click", () => {
        resetState();
        renderQuestion();
      });

      // Enterで判定
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") judge();
        if (e.key === "ArrowRight") next();
      });

    } catch (err) {
      console.error(err);
      el.resultArea?.classList.remove("hidden");
      if (el.resultMsg) el.resultMsg.textContent = "エラー";
      if (el.resultExplain) {
        el.resultExplain.textContent =
          safeText(err?.message || err) +
          "\n\n・game.html と questions.json が同じ階層か\n・GitHub Pages で questions.json が公開されているか\n・JSONの先頭が [ から始まっているか\nを確認してください。";
      }
    }
  }

  init();
})();
