/* script.js
  game.html で questions.json を読み込み、各UIに反映するためのコードです。
  ※ game.html 側に、下の「ID一覧」の要素を用意してください（id 名はこのJSに合わせています）。

  【ID一覧（最低限）】
  - stageName        : ステージ名表示（例：バッジ）
  - title            : タイトル（例：# 勇者のPython修行）
  - playerLevel      : レベル表示（例：Lv.1 の 1 の部分 or 全体でもOK）
  - progressText     : 進捗表示（例：0/0）
  - elderText        : 長老のことば
  - qNo              : 問題番号表示（例：Q-）
  - prompt           : 問題文
  - codePython       : Pythonコード表示（pre/code）
  - codePseudo       : 共通テスト用言語表示（pre/code）
  - choicesForm      : 選択肢（radio）を入れる場所（form/div）
  - judgeBtn         : 「判定する」ボタン
  - resultArea       : 結果エリア（全体）
  - resultMsg        : 正誤メッセージ
  - resultExplain    : 解説表示
  - nextBtn          : 次へボタン（任意）
  - restartBtn       : 最初から（任意）
  - learnTopicsList  : 学習内容（任意 / ul）

  【questions.json 想定（ゆるく対応）】
  - meta.learnTopics : ["...", "..."]
  - questions        : 配列
    - id
    - stageName
    - preTalk
    - prompt / question / text / problem （どれか）
    - python / pythonCode / codePython （どれか）
    - pseudo / testLang / codePseudo   （どれか）
    - choices : ["A ...", "B ..."] or [{key:"ア", text:"..."}, ...]
    - answer  : 0-based index / "A" / "ア" / "Q01-A" 等もある程度吸収
    - explain / explanation
*/

(() => {
  "use strict";

  // ====== 設定 ======
  const DATA_URL = "./questions.json";
  const STORAGE_KEY = "python_master_progress_v1";

  // 自動で次へ進む（正解時）
  const AUTO_NEXT_MS = 700; // 0にすると自動遷移しない

  // ====== DOM取得 ======
  const el = {
    stageName: document.getElementById("stageName"),
    title: document.getElementById("title"),
    playerLevel: document.getElementById("playerLevel"),
    progressText: document.getElementById("progressText"),

    elderText: document.getElementById("elderText"),
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

    learnTopicsList: document.getElementById("learnTopicsList"),
  };

  // 必須要素チェック（足りないと動かないので早めに分かるように）
  const required = [
    "stageName",
    "playerLevel",
    "progressText",
    "elderText",
    "qNo",
    "prompt",
    "codePython",
    "codePseudo",
    "choicesForm",
    "judgeBtn",
    "resultArea",
    "resultMsg",
    "resultExplain",
  ];
  for (const k of required) {
    if (!el[k]) {
      console.error(`[script.js] #${k} が見つかりません。game.html に id="${k}" の要素を用意してください。`);
    }
  }

  // ====== 状態 ======
  let data = null;
  let questions = [];
  let state = loadState();

  // ====== ユーティリティ ======
  function safeText(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function pick(obj, keys, fallback = "") {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return fallback;
  }

  function normalizeChoices(rawChoices) {
    // rawChoices:
    //  - ["...", "..."]
    //  - [{key:"ア", text:"..."}, ...]
    //  - [{label:"A", value:"...", text:"..."}, ...]
    if (!rawChoices) return [];

    if (Array.isArray(rawChoices)) {
      if (rawChoices.length === 0) return [];
      if (typeof rawChoices[0] === "string") {
        return rawChoices.map((t, i) => ({ key: String(i), label: "", text: t }));
      }
      if (typeof rawChoices[0] === "object") {
        return rawChoices.map((c, i) => {
          const key = pick(c, ["key", "id", "value", "label"], String(i));
          const label = pick(c, ["label", "key"], "");
          const text = pick(c, ["text", "value", "body"], "");
          return { key: String(key), label: safeText(label), text: safeText(text) };
        });
      }
    }
    return [];
  }

  function answerToIndex(q, choices) {
    // answer を 0-based index に変換（できるだけ吸収）
    const ans = pick(q, ["answer", "correct", "correctAnswer", "ans"], null);
    if (ans === null || ans === undefined) return null;

    // すでに数値（0-based/1-based両方をそれっぽく吸収）
    if (typeof ans === "number" && Number.isFinite(ans)) {
      if (ans >= 0 && ans < choices.length) return ans;        // 0-based
      if (ans >= 1 && ans <= choices.length) return ans - 1;   // 1-based
    }

    const s = safeText(ans).trim();

    // "A" "B" "C" 形式
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (s.length === 1 && alpha.includes(s.toUpperCase())) {
      const idx = alpha.indexOf(s.toUpperCase());
      if (idx >= 0 && idx < choices.length) return idx;
    }

    // "ア" "イ" "ウ" 形式（よくある）
    const kana = ["ア","イ","ウ","エ","オ","カ","キ","ク","ケ","コ","サ","シ","ス","セ","ソ"];
    if (kana.includes(s)) {
      const idx = kana.indexOf(s);
      if (idx >= 0 && idx < choices.length) return idx;
    }

    // "Q01-A" "Q01_ア" みたいなのが来た場合、末尾の記号を拾う
    const tail = s.slice(-1);
    if (alpha.includes(tail.toUpperCase())) {
      const idx = alpha.indexOf(tail.toUpperCase());
      if (idx >= 0 && idx < choices.length) return idx;
    }
    if (kana.includes(tail)) {
      const idx = kana.indexOf(tail);
      if (idx >= 0 && idx < choices.length) return idx;
    }

    // choices の key と一致する場合（object choices）
    const idxByKey = choices.findIndex(c => safeText(c.key) === s);
    if (idxByKey !== -1) return idxByKey;

    return null;
  }

  function setBodyTheme(stageName) {
    // ステージ名で背景テーマを切り替え（必要なら増やせます）
    document.body.classList.remove("stage-default", "stage-tutorial");
    if (safeText(stageName).includes("チュートリアル")) {
      document.body.classList.add("stage-tutorial");
    } else {
      document.body.classList.add("stage-default");
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { index: 0, correct: 0, answered: {} };
      }
      const parsed = JSON.parse(raw);
      return {
        index: Number.isFinite(parsed.index) ? parsed.index : 0,
        correct: Number.isFinite(parsed.correct) ? parsed.correct : 0,
        answered: parsed.answered && typeof parsed.answered === "object" ? parsed.answered : {},
      };
    } catch {
      return { index: 0, correct: 0, answered: {} };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    state = { index: 0, correct: 0, answered: {} };
    saveState();
  }

  function clampIndex() {
    if (state.index < 0) state.index = 0;
    if (state.index >= questions.length) state.index = Math.max(0, questions.length - 1);
  }

  function updateHeader(q) {
    const stageName = pick(q, ["stageName", "stage", "stage_title"], "ステージ");
    if (el.stageName) el.stageName.textContent = safeText(stageName);
    setBodyTheme(stageName);

    // レベル：正解数に応じてLvを上げる例（好きに変更OK）
    const lv = Math.max(1, 1 + Math.floor(state.correct / 3));
    if (el.playerLevel) el.playerLevel.textContent = `Lv.${lv}`;

    if (el.progressText) el.progressText.textContent = `${Math.min(state.index + 1, questions.length)}/${questions.length}`;
  }

  function clearResult() {
    if (!el.resultArea) return;
    el.resultArea.classList.add("hidden");
    if (el.resultMsg) el.resultMsg.textContent = "";
    if (el.resultExplain) el.resultExplain.textContent = "";
  }

  function showResult(ok, explainText) {
    if (!el.resultArea) return;
    el.resultArea.classList.remove("hidden");
    if (el.resultMsg) el.resultMsg.textContent = ok ? "正解" : "不正解";
    if (el.resultExplain) el.resultExplain.textContent = safeText(explainText || "");
  }

  function renderLearnTopics() {
    if (!el.learnTopicsList) return;
    const topics = (data && data.meta && Array.isArray(data.meta.learnTopics)) ? data.meta.learnTopics : [];
    el.learnTopicsList.innerHTML = "";
    for (const t of topics) {
      const li = document.createElement("li");
      li.textContent = safeText(t);
      el.learnTopicsList.appendChild(li);
    }
  }

  function renderQuestion() {
    clampIndex();
    const q = questions[state.index];
    if (!q) return;

    updateHeader(q);
    clearResult();

    // 長老
    if (el.elderText) el.elderText.textContent = safeText(pick(q, ["preTalk", "elder", "talk", "intro"], ""));

    // 問題番号
    if (el.qNo) {
      const id = pick(q, ["id", "qid", "no"], "");
      el.qNo.textContent = id ? `Q-${safeText(id)}` : `Q-${state.index + 1}`;
    }

    // 問題文
    const promptText = pick(q, ["prompt", "question", "text", "problem", "body"], "");
    if (el.prompt) el.prompt.textContent = safeText(promptText);

    // コード
    const py = pick(q, ["python", "pythonCode", "codePython", "code_py"], "");
    const pseudo = pick(q, ["pseudo", "testLang", "codePseudo", "dncl", "code_test"], "");
    if (el.codePython) el.codePython.textContent = safeText(py);
    if (el.codePseudo) el.codePseudo.textContent = safeText(pseudo);

    // 選択肢
    const choices = normalizeChoices(pick(q, ["choices", "options", "selects"], []));
    el.choicesForm.innerHTML = "";

    // 選択肢がない問題もある（穴埋めや入力式など）想定：その場合はボタン無効
    if (!choices.length) {
      const p = document.createElement("p");
      p.textContent = "（この問題は選択肢がありません。questions.json の choices を確認してください）";
      p.style.color = "#5b6578";
      el.choicesForm.appendChild(p);
      el.judgeBtn.disabled = true;
      return;
    }

    el.judgeBtn.disabled = false;

    // 既に回答済みなら復元
    const answeredKey = safeText(pick(q, ["id"], `idx_${state.index}`));
    const prev = state.answered[answeredKey];

    choices.forEach((c, idx) => {
      const label = document.createElement("label");
      label.className = "choice";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "choice";
      input.value = String(idx);

      const textWrap = document.createElement("div");
      textWrap.className = "choice__text";

      // 表示ラベル（ア/イ など）があるなら先頭に付ける
      const head =
        c.label && safeText(c.label).trim()
          ? `${safeText(c.label).trim()} `
          : "";

      textWrap.textContent = head + safeText(c.text);

      // 復元
      if (prev !== undefined && prev !== null && Number(prev) === idx) input.checked = true;

      label.appendChild(input);
      label.appendChild(textWrap);
      el.choicesForm.appendChild(label);
    });

    // 次へボタンの表示（任意）
    if (el.nextBtn) {
      el.nextBtn.disabled = state.index >= questions.length - 1;
    }
  }

  function getSelectedIndex() {
    const checked = el.choicesForm.querySelector('input[name="choice"]:checked');
    if (!checked) return null;
    const v = Number(checked.value);
    if (!Number.isFinite(v)) return null;
    return v;
  }

  function judge() {
    const q = questions[state.index];
    if (!q) return;

    const choices = normalizeChoices(pick(q, ["choices", "options", "selects"], []));
    const correctIndex = answerToIndex(q, choices);

    const selected = getSelectedIndex();
    if (selected === null) {
      showResult(false, "選択肢を1つ選んでから判定してください。");
      return;
    }

    // 記録（同じ問題で何度も correct++ しないように）
    const answeredKey = safeText(pick(q, ["id"], `idx_${state.index}`));
    const firstTime = (state.answered[answeredKey] === undefined);

    state.answered[answeredKey] = selected;

    const explain = pick(q, ["explain", "explanation", "commentary"], "");

    // 正解データが無い場合でも、選んだ内容を出して止める
    if (correctIndex === null) {
      saveState();
      showResult(true, explain || "（正解データが未設定のため、判定は行いませんでした）");
      return;
    }

    const ok = selected === correctIndex;
    if (ok && firstTime) state.correct += 1;

    saveState();
    showResult(ok, explain);

    if (ok && AUTO_NEXT_MS > 0) {
      // 最後の問題でなければ次へ
      if (state.index < questions.length - 1) {
        window.setTimeout(() => {
          state.index += 1;
          saveState();
          renderQuestion();
        }, AUTO_NEXT_MS);
      }
    }
  }

  function next() {
    if (state.index < questions.length - 1) {
      state.index += 1;
      saveState();
      renderQuestion();
    }
  }

  function prev() {
    if (state.index > 0) {
      state.index -= 1;
      saveState();
      renderQuestion();
    }
  }

  // ====== 初期化 ======
  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`questions.json の読み込みに失敗しました (${res.status})`);
      data = await res.json();

      questions = Array.isArray(data.questions) ? data.questions : [];
      if (!questions.length) throw new Error("questions.json に questions 配列が見つかりません。");

      renderLearnTopics();
      renderQuestion();

      // イベント
      el.judgeBtn?.addEventListener("click", judge);

      // Enterで判定（ラジオ選択後に便利）
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          // 入力欄がある場合の誤爆を避けたいなら追加条件を入れる
          judge();
        }
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      });

      el.nextBtn?.addEventListener("click", next);

      el.restartBtn?.addEventListener("click", () => {
        resetState();
        renderQuestion();
      });

    } catch (err) {
      console.error(err);
      // 画面に出す（最低限）
      if (el.resultArea) {
        el.resultArea.classList.remove("hidden");
        if (el.resultMsg) el.resultMsg.textContent = "エラー";
        if (el.resultExplain) el.resultExplain.textContent =
          safeText(err?.message || err) + "\n\n・game.html と questions.json が同じ階層にあるか\n・GitHub Pages で questions.json が公開されているか\nを確認してください。";
      }
    }
  }

  init();
})();
