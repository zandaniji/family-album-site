/* Persistent exploration spread, followed by a separate reveal spread.
   Portraits illustrate roles; kinship terms come from vendor/kinship.js. */
(() => {
  "use strict";
  const Kinship = window.Kinship;
  const PageFlip = window.St?.PageFlip;
  const stage = document.getElementById("album-stage");
  const fallback = document.getElementById("album-fallback");
  const relationLabel = document.getElementById("album-relation");
  const pathLabel = document.getElementById("album-path");
  const prevButton = document.getElementById("album-prev");
  const resetButton = document.getElementById("album-reset");
  const undoButton = document.getElementById("album-undo");
  const mobileChoices = document.getElementById("mobile-choice-panel");
  if (!Kinship || !PageFlip) {
    fallback.textContent = "相簿暂时无法打开，请重新载入。The album could not open; please reload the page.";
    return;
  }
  const BY_ID = Object.fromEntries(Kinship.listRelationshipAtoms().map(atom => [atom.id, atom]));
  const CHOICES = ["father", "mother", "older_brother", "older_sister", "younger_brother",
    "younger_sister", "husband", "wife", "son", "daughter"];
  const DISPLAY = { father: "爸爸", mother: "妈妈", older_brother: "哥哥", older_sister: "姐姐",
    younger_brother: "弟弟", younger_sister: "妹妹", husband: "丈夫", wife: "妻子", son: "儿子", daughter: "女儿" };
  const ENGLISH_DISPLAY = { father: "Father", mother: "Mother", older_brother: "Older brother", older_sister: "Older sister",
    younger_brother: "Younger brother", younger_sister: "Younger sister", husband: "Husband", wife: "Wife", son: "Son", daughter: "Daughter" };
  const ENGLISH_TERM = {
    我: "Me", 爸爸: "Father", 父亲: "Father", 妈妈: "Mother", 母亲: "Mother",
    哥哥: "Older brother", 哥: "Older brother", 弟弟: "Younger brother", 弟: "Younger brother", 兄弟: "Brother",
    姐姐: "Older sister", 姐: "Older sister", 妹妹: "Younger sister", 妹: "Younger sister", 姐妹: "Sister",
    丈夫: "Husband", 老公: "Husband", 妻子: "Wife", 老婆: "Wife", 配偶: "Spouse", 儿子: "Son", 女儿: "Daughter",
    爷爷: "Paternal grandfather", 祖父: "Paternal grandfather",
    奶奶: "Paternal grandmother", 祖母: "Paternal grandmother",
    外公: "Maternal grandfather", 姥爷: "Maternal grandfather", 外祖父: "Maternal grandfather",
    外婆: "Maternal grandmother", 姥姥: "Maternal grandmother", 外祖母: "Maternal grandmother",
    曾祖父: "Great-grandfather", 太爷爷: "Great-grandfather",
    曾祖母: "Great-grandmother", 太奶奶: "Great-grandmother",
    外曾祖父: "Mother’s paternal grandfather", 外曾祖母: "Mother’s paternal grandmother",
    曾外祖父: "Father’s maternal grandfather", 曾外祖母: "Father’s maternal grandmother",
    外曾外祖父: "Mother’s maternal grandfather", 外曾外祖母: "Mother’s maternal grandmother",
    高祖父: "Great-great-grandfather", 高祖母: "Great-great-grandmother",
    伯父: "Father’s older brother", 伯伯: "Father’s older brother", 大伯: "Father’s older brother",
    叔父: "Father’s younger brother", 叔叔: "Father’s younger brother",
    姑母: "Father’s sister", 姑妈: "Father’s sister", 姑姑: "Father’s sister",
    舅父: "Mother’s brother", 舅舅: "Mother’s brother",
    姨母: "Mother’s sister", 姨妈: "Mother’s sister", 阿姨: "Mother’s sister",
    孙子: "Grandson", 外孙: "Grandson", 孙女: "Granddaughter", 外孙女: "Granddaughter",
    侄子: "Nephew", 外甥: "Nephew", 侄女: "Niece", 外甥女: "Niece",
    堂兄: "Older male paternal cousin", 堂哥: "Older male paternal cousin",
    堂弟: "Younger male paternal cousin", 堂姐: "Older female paternal cousin", 堂妹: "Younger female paternal cousin",
    堂兄弟: "Male paternal cousin", 堂姐妹: "Female paternal cousin",
    表兄: "Older male cousin", 表哥: "Older male cousin", 表弟: "Younger male cousin",
    表姐: "Older female cousin", 表妹: "Younger female cousin",
    表兄弟: "Male cousin", 表姐妹: "Female cousin",
    嫂子: "Older brother’s wife", 弟媳: "Younger brother’s wife",
    姐夫: "Older sister’s husband", 妹夫: "Younger sister’s husband",
    岳父: "Father-in-law", 岳母: "Mother-in-law", 公公: "Father-in-law", 婆婆: "Mother-in-law",
    儿媳: "Daughter-in-law", 女婿: "Son-in-law",
    大舅子: "Wife’s older brother", 小舅子: "Wife’s younger brother",
    大姨子: "Wife’s older sister", 小姨子: "Wife’s younger sister",
    大伯子: "Husband’s older brother", 小叔子: "Husband’s younger brother",
    大姑子: "Husband’s older sister", 小姑子: "Husband’s younger sister",
    继父: "Stepfather", 继母: "Stepmother",
    继祖父: "Paternal step-grandfather", 继祖母: "Paternal step-grandmother",
    继外祖父: "Maternal step-grandfather", 继外祖母: "Maternal step-grandmother",
    侄孙: "Brother’s grandson", 侄孙女: "Brother’s granddaughter",
    侄外孙: "Brother’s daughter’s son", 侄外孙女: "Brother’s daughter’s daughter",
    外甥孙: "Sister’s grandson", 外甥孙女: "Sister’s granddaughter",
    外甥外孙: "Sister’s daughter’s son", 外甥外孙女: "Sister’s daughter’s daughter",
    侄媳: "Nephew’s wife", 外甥媳妇: "Nephew’s wife", 侄女婿: "Niece’s husband", 外甥女婿: "Niece’s husband",
    内侄: "Wife’s nephew", 内侄女: "Wife’s niece",
    堂伯: "Father’s older paternal cousin", 堂叔: "Father’s younger paternal cousin", 堂姑: "Father’s female paternal cousin",
    表伯: "Father’s older cousin", 表叔: "Father’s younger cousin", 表姑: "Father’s female cousin",
    堂舅: "Mother’s male paternal cousin", 堂姨: "Mother’s female paternal cousin",
    表舅: "Mother’s male cousin", 表姨: "Mother’s female cousin",
    堂伯母: "Wife of father’s older paternal cousin", 堂婶: "Wife of father’s younger paternal cousin", 堂姑父: "Husband of father’s female paternal cousin",
    表伯母: "Wife of father’s older cousin", 表婶: "Wife of father’s younger cousin", 表姑父: "Husband of father’s female cousin",
    堂舅母: "Wife of mother’s male paternal cousin", 堂姨父: "Husband of mother’s female paternal cousin",
    表舅母: "Wife of mother’s male cousin", 表姨父: "Husband of mother’s female cousin",
    亲属: "Relative",
    暂无法确定: "Unable to determine",
  };
  const IMAGE = { father: "father", mother: "mother", older_brother: "olderBrother", older_sister: "olderSister",
    younger_brother: "youngerBrother", younger_sister: "youngerSister", husband: "husband", wife: "wife", son: "son", daughter: "daughter" };
  const PINYIN = {
    我: "wǒ", 爸: "bà", 妈: "mā", 哥: "gē", 姐: "jiě", 弟: "dì", 妹: "mèi",
    爷: "yé", 奶: "nǎi", 儿: "ér", 子: "zǐ", 女: "nǚ", 丈: "zhàng", 夫: "fū", 妻: "qī",
    父: "fù", 母: "mǔ", 祖: "zǔ", 外: "wài", 公: "gōng", 婆: "pó", 伯: "bó", 叔: "shū",
    姑: "gū", 舅: "jiù", 姨: "yí", 堂: "táng", 表: "biǎo", 兄: "xiōng", 侄: "zhí", 甥: "shēng",
    孙: "sūn", 嫂: "sǎo", 婶: "shěn", 婿: "xù", 岳: "yuè", 曾: "zēng", 高: "gāo", 长: "zhǎng",
    辈: "bèi", 亲: "qīn", 戚: "qī", 的: "de", 同: "tóng", 族: "zú",
    老: "lǎo", 姥: "lǎo", 继: "jì", 媳: "xí", 大: "dà", 太: "tài", 内: "nèi", 阿: "ā",
    从: "cóng", 远: "yuǎn", 房: "fáng", 姊: "zǐ",
  };
  // Whole-word readings the character table cannot give: 亲家 is qìng jia.
  const PINYIN_WORDS = { 亲家公: "qìng jia gōng", 亲家母: "qìng jia mǔ", 外甥媳妇: "wài shēng xí fu", 大伯子: "dà bǎi zi" };
  // Every rule and structural term pack lists formal (reference) words beside
  // spoken (address) words. Index them so each displayed candidate can show both.
  const LEXICON = new Map();
  const addLexicon = (reference, address) => {
    for (const value of reference) if (!LEXICON.has(value)) LEXICON.set(value, { reference, address });
  };
  for (const rule of Kinship.rules) {
    addLexicon(rule.output.reference.map(term => term.value), rule.output.address.map(term => term.value));
  }
  (function indexPack(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.reference)) addLexicon(value.reference, value.address || []);
    else Object.values(value).forEach(indexPack);
  })(Kinship.structuralTermPacks);
  // Composed peer terms (远房表姐, 从堂哥 …) are built from a prefix, so index
  // each form with its spoken word for candidates shown before the age is known.
  for (const family of Object.values(Kinship.structuralTermPacks["zh-Hans-CN"].extendedPeerBranches)) {
    for (const [suffixes, said] of [[["哥", "兄"], "哥"], [["弟"], "弟"], [["姐", "姊"], "姐"], [["妹"], "妹"]]) {
      addLexicon(suffixes.map(suffix => family.prefix + suffix), [(family.spoken || family.prefix) + said]);
    }
  }
  // Formal: the written register term, skipping words listed only because people
  // say them (爷爷 → 祖父). Spoken: what people most likely call this person.
  const termEntry = (reference, address) => ({
    formal: reference.find(value => !address.includes(value)) || reference[0],
    spoken: [...new Set(address)],
  });
  const termEntries = result => {
    if (!result) return [];
    if (result.status !== "ambiguous" && result.terms) {
      const advice = result.termMetadata || {};
      return [{
        ...termEntry(result.terms.reference.map(term => term.value), result.terms.address.map(term => term.value)),
        byName: Boolean(advice.spokenByName), ifOlder: advice.spokenIfOlder || null,
      }];
    }
    const values = result.status === "ambiguous" && result.candidates.length ? result.candidates : [result.term];
    const entries = values.map(value => {
      if (value === "自己") return { formal: "我", spoken: ["我"] };
      const known = LEXICON.get(value);
      return known ? termEntry(known.reference, known.address) : { formal: value, spoken: [] };
    });
    return entries.filter((entry, index) => entries.findIndex(other => other.formal === entry.formal) === index);
  };
  let path = [];
  let cursorDepth = 0;
  let egoGender = "unknown";
  let relativeAge = {};
  let resultOpen = false;
  let resultPages = [];
  let flip = null;
  let selecting = false;
  let turning = false;
  let transfer = null;
  let photoReturn = null;
  let photoAdd = null;
  let suppressReturnClick = false;
  let suppressAddClick = false;
  let revision = 0;
  let focusAfterTurn = null;
  let resultView = null;
  const history = [];
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };
  const appendChinese = (element, text) => {
    for (const part of String(text).split(/([A-Za-z]+)/)) {
      if (/^[A-Za-z]+$/.test(part)) element.append(node("span", "latin-run", part));
      else if (part) element.append(part);
    }
  };
  const bilingualNode = (tag, className, chinese, english) => {
    const element = node(tag, `${className || ""} bilingual-copy`.trim());
    const zh = node("span", "bilingual-zh");
    appendChinese(zh, chinese);
    zh.lang = "zh-Hans";
    const en = node("span", "bilingual-en", english);
    en.lang = "en";
    element.append(zh, en);
    return element;
  };
  const setBilingual = (element, chinese, english) => {
    const copy = bilingualNode("span", "", chinese, english);
    element.replaceChildren(...copy.childNodes);
  };
  const svgNode = tag => document.createElementNS("http://www.w3.org/2000/svg", tag);
  const labelFor = id => DISPLAY[id] || BY_ID[id]?.label || id;
  const englishLabelFor = id => ENGLISH_DISPLAY[id] || id.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
  const trailFor = (depth = path.length) => ["我", ...path.slice(0, depth).map(labelFor)].join(" → ");
  const englishTrailFor = (depth = path.length) => ["Me", ...path.slice(0, depth).map(englishLabelFor)].join(" → ");
  const contextFor = () => cursorDepth ? labelFor(path[cursorDepth - 1]) : "我";
  const englishContextFor = () => cursorDepth ? englishLabelFor(path[cursorDepth - 1]) : "Me";
  const englishPathDescription = () => {
    const labels = path.map(englishLabelFor);
    if (!labels.length) return "Me";
    return labels.map((label, index) => index ? label.toLowerCase() : label).join("’s ");
  };
  // Second cousins share one gloss pattern: 从堂哥, 堂舅表妹, 远房表姐 …
  const SECOND_COUSIN = /^(?:从堂|堂姑表|堂舅表|堂姨表|远房表)(哥|兄|弟|姐|姊|妹|兄弟|姐妹)$/;
  const englishTermFor = term => {
    const second = term.match(SECOND_COUSIN);
    if (second) {
      const [age, gender] = { 哥: ["Older", "male"], 兄: ["Older", "male"], 弟: ["Younger", "male"], 兄弟: ["", "male"],
        姐: ["Older", "female"], 姊: ["Older", "female"], 妹: ["Younger", "female"], 姐妹: ["", "female"] }[second[1]];
      const gloss = `${gender} second cousin${term.startsWith("从堂") ? " (paternal line)" : ""}`;
      return age ? `${age} ${gloss}` : gloss.replace(/^./, letter => letter.toUpperCase());
    }
    return ENGLISH_TERM[term] || englishPathDescription();
  };
  const visitorFact = fact => {
    if (fact.includes("性别")) return { kind: "identity", zh: "你的身份（男或女）", en: "your own identity (male or female)" };
    const sameAs = fact.match(/^([他她])是否是你的(.+)$/);
    if (sameAs) {
      return { kind: "text", zh: fact, en: `whether ${sameAs[1] === "他" ? "he" : "she"} is your ${(ENGLISH_TERM[sameAs[2]] || sameAs[2]).toLowerCase()}` };
    }
    if (fact.includes("长幼") && (fact.includes("配偶") || fact.includes("妻姐"))) {
      return { kind: "text", zh: "TA 与你配偶的长幼", en: "this relative’s age compared with your spouse" };
    }
    if (fact.includes("长幼") && fact.includes("父亲")) return { kind: "text", zh: "TA 与你父亲的长幼", en: "this relative’s age compared with your father" };
    if (fact.includes("还是")) return { kind: "text", zh: "TA 是否就是路径中已出现过的人", en: "whether this person is someone already on the path" };
    if (fact.includes("长幼") && fact.includes("当前人物")) {
      return { kind: "text", zh: "TA 与路径中前一位亲属的长幼", en: "this relative’s age compared with the previous person on the path" };
    }
    if (fact.includes("长幼")) return { kind: "age", zh: "TA 与你的长幼", en: "whether this relative is older or younger than you" };
    return { kind: "text", zh: fact, en: "an additional family detail" };
  };
  const resolveRoute = (route, gender, age) => {
    try {
      return Kinship.resolveKinship(route, {
        egoGender: gender, targetRelativeAge: age,
        mode: "reference", familyAssumption: "traditional-simple",
      });
    } catch (error) {
      if (!["REWRITE_STATE_LIMIT", "PATH_TOO_LONG", "INCONSISTENT_AGE"].includes(error.code)) throw error;
      return { status: error.code === "INCONSISTENT_AGE" ? "conflict" : "unresolved", term: "暂无法确定", candidates: [],
        missingFacts: [], needsTargetAge: false, errorCode: error.code };
    }
  };
  let lastResolution = null;
  const resolveAt = depth => {
    if (!depth) return null;
    const route = path.slice(0, depth);
    const age = relativeAge[depth] || "unknown";
    const key = JSON.stringify([route, egoGender, age]);
    if (lastResolution?.key === key) return lastResolution.result;
    const result = resolveRoute(route, egoGender, age);
    lastResolution = { key, result };
    return result;
  };
  // The identity row stays on the result page once the visitor's gender has
  // mattered, so answering it does not make the question vanish.
  const identityMatters = depth => (resolveRoute(path.slice(0, depth), "unknown", relativeAge[depth] || "unknown").missingFacts || [])
    .some(fact => visitorFact(fact).kind === "identity");
  // A reduplicated syllable or trailing 子 is unstressed: 爸爸 bà ba, 妻子 qī zi.
  const neutralTone = syllable => syllable.normalize("NFD").replace(/[̀́̄̌]/g, "").normalize("NFC");
  const pinyinFor = term => {
    if (PINYIN_WORDS[term]) return PINYIN_WORDS[term];
    const characters = [...term];
    const syllables = characters.map((character, index) => PINYIN[character] &&
      (index && (character === characters[index - 1] || (character === "子" && (index === characters.length - 1 || characters[index + 1] === "的")))
        ? neutralTone(PINYIN[character]) : PINYIN[character]));
    return syllables.every(Boolean) ? syllables.join(" ") : "";
  };
  const onResult = () => resultOpen && (flip?.getCurrentPageIndex() || 0) >= 2;
  const busy = () => selecting || turning;
  const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function paperPage(className, side) {
    const page = node("div", `album-page ${className} album-page-${side}`);
    // Registered crops of the actual album preserve its page stack and binding.
    const image = node("img", "page-paper");
    image.src = "album/open-album.webp";
    image.alt = "";
    image.draggable = false;
    const material = node("div", "page-material");
    material.append(image);
    page.append(material);
    return page;
  }
  function framedPhoto(id) {
    const photo = node("span", "relation-choice-photo-wrap");
    if (id) {
      const image = node("img", "relation-choice-photo");
      image.src = `avatars/${IMAGE[id]}.png`;
      image.alt = "";
      image.draggable = false;
      photo.append(image);
    } else photo.append(bilingualNode("span", "chain-owner-mark", "我", "Me"));
    const frame = node("img", "relation-choice-frame");
    frame.src = "album/frame-01-portrait.webp";
    frame.alt = "";
    frame.draggable = false;
    photo.append(frame);
    return photo;
  }

  // Coordinates use the paper viewport's width, independent of route length.
  // A route of up to four people keeps this size; longer routes fit the page.
  const SHORT_LAYOUT = { width: 100, height: 108 };
  const PHOTO = 22;
  function chainPosition(index) {
    const pair = Math.floor(index / 2);
    return {
      x: index % 2 ? [61, 58, 63][pair % 3] : [11, 17, 12][pair % 3],
      y: 4 + pair * 45 + (index % 2 ? 16 : 0),
      width: PHOTO, angle: [-3, 2, -2, 3, -1, 2][index % 6],
    };
  }
  function chainLayout() {
    const count = path.length + 1;
    if (count <= 4) return { ...SHORT_LAYOUT,
      positions: Array.from({ length: count }, (_, index) => chainPosition(index)) };
    const w = chainViewport.clientWidth || 450, h = chainViewport.clientHeight || 450;
    let best = null;
    for (let columns = 2; columns <= Math.min(5, count); columns += 1) {
      const width = columns * 34 + 4;
      const height = Math.ceil(count / columns) * 47 + 6;
      const score = Math.min((w - 16) / width, (h - 16) / height, w / 100);
      if (!best || score > best.score) best = { columns, width, height, score };
    }
    const positions = Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / best.columns), column = index % best.columns;
      return { x: 8 + (row % 2 ? best.columns - 1 - column : column) * 34,
        y: 5 + row * 47 + [0, 2, -1, 1, 0][column], width: PHOTO, angle: [-3, 2, -2, 3, -1, 2][index % 6] };
    });
    return { ...best, positions };
  }
  function positionPerson(person, position) {
    for (const key of ["x", "y", "width"]) person.style.setProperty(`--chain-${key}`, position[key]);
    person.style.setProperty("--chain-angle", `${position.angle}deg`);
  }
  function personAt(index, position, interactive = true) {
    const person = node(interactive ? "button" : "div", `chain-person${index === 0 ? " is-origin" : ""}`);
    person.dataset.step = String(index);
    person.dataset.identity = index ? path[index - 1] : egoGender;
    if (interactive) {
      person.type = "button";
      const chineseName = index ? labelFor(path[index - 1]) : "我";
      const englishName = index ? englishLabelFor(path[index - 1]) : "Me";
      person.title = index
        ? `从${chineseName}继续选择；拖回右页移除这一步 / Continue from ${englishName}; drag to the right page to remove this step`
        : `从${chineseName}继续选择 / Continue from ${englishName}`;
      person.setAttribute("aria-label", index
        ? `第${index + 1}张照片“${chineseName}”。点击从这里继续；拖回右页移除这一步及后续路径。${englishName}. Click to continue here; drag to the right page to remove this and later steps.`
        : `从第${index + 1}张照片“${chineseName}”继续选择亲属。Continue choosing relatives from ${englishName}.`);
    }
    const id = index ? path[index - 1] : egoGender === "male" ? "husband" : egoGender === "female" ? "wife" : null;
    person.append(framedPhoto(id));
    person.append(bilingualNode("span", `chain-person-name${!index && !id ? " sr-only" : ""}`,
      index ? labelFor(path[index - 1]) : "我", index ? englishLabelFor(path[index - 1]) : "Me"));
    positionPerson(person, position);
    return person;
  }
  function inkCanvas(width, height) {
    const svg = svgNode("svg");
    svg.classList.add("chain-ink");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }

  // Stable pseudo-random variation keeps every connector hand drawn without
  // letting it jump when the album updates.
  function inkNoise(seed, point) {
    const value = Math.sin(seed * 91.731 + point * 37.719) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  }

  function inkStroke(points) {
    if (points.length < 2) return "";
    let stroke = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index];
      const next = points[index + 1];
      stroke += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${((point.x + next.x) / 2).toFixed(2)} ${((point.y + next.y) / 2).toFixed(2)}`;
    }
    const lastGuide = points.at(-2);
    const end = points.at(-1);
    return `${stroke} Q ${lastGuide.x.toFixed(2)} ${lastGuide.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function inkPoints(sx, sy, ex, ey, seed, variation = 0, bend = null) {
    const dx = ex - sx;
    const dy = ey - sy;
    const length = Math.hypot(dx, dy) || 1;
    const tangentX = dx / length;
    const tangentY = dy / length;
    const normalX = -tangentY;
    const normalY = tangentX;
    const sections = Math.max(6, Math.min(10, Math.round(length / 8)));
    const direction = bend ?? (seed % 2 ? 1 : -1);
    // Short strokes between neighbours bow and waver less than long ones.
    const reach = Math.min(1, length / 30);
    const bow = direction * Math.min(5.4 + Math.abs(inkNoise(seed, 0)) * 3.1, length * 0.12) * reach;

    return Array.from({ length: sections + 1 }, (_, point) => {
      const progress = point / sections;
      if (point === 0) return { x: sx, y: sy };
      if (point === sections) return { x: ex, y: ey };
      const envelope = Math.sin(Math.PI * progress);
      const wobble = (inkNoise(seed + variation * 13, point) * 1.35
        + Math.sin(progress * Math.PI * 3 + seed * 0.7) * 0.58) * reach;
      const drag = inkNoise(seed + variation * 29, point + 17) * 0.72 * reach;
      const offset = envelope * (bow + wobble + variation * inkNoise(seed, point + 31) * 0.7 * reach);
      return {
        x: sx + dx * progress + normalX * offset + tangentX * drag,
        y: sy + dy * progress + normalY * offset + tangentY * drag,
      };
    });
  }

  // Connectors run between the edges of two portraits, and below a caption, so
  // the ink never crosses a photo or a name. Photos are 2:3; a caption adds
  // about ten units beneath. Options route a stroke round the outer side of two
  // stacked photos (side: -1 left, 1 right) or over the top of a row (over).
  const CAPTION = 10, INK_GAP = 1.5;
  const photoCentre = box => ({ x: box.x + box.width / 2, y: box.y + box.width * 0.75 });
  function edgePoint(box, toward) {
    const centre = photoCentre(box);
    const dx = toward.x - centre.x, dy = toward.y - centre.y;
    const above = box.width * 0.75 + INK_GAP;
    const below = above + (box.caption === false ? 0 : CAPTION);
    const t = Math.min(dx ? (box.width / 2 + INK_GAP) / Math.abs(dx) : Infinity,
      dy > 0 ? below / dy : dy < 0 ? above / -dy : Infinity);
    return { x: centre.x + dx * t, y: centre.y + dy * t };
  }
  function inkLink(first, second, index, { side = 0, over = false, bend = null } = {}) {
    let start, end;
    if (side) {
      const edge = box => ({ x: box.x + (side > 0 ? box.width + INK_GAP : -INK_GAP), y: photoCentre(box).y });
      start = edge(first); end = edge(second);
      bend = (end.y > start.y) === (side > 0) ? -1 : 1;
    } else if (over) {
      const top = box => ({ x: photoCentre(box).x, y: box.y - INK_GAP });
      start = top(first); end = top(second);
      bend = end.x > start.x ? -1 : 1;
    } else {
      start = edgePoint(first, photoCentre(second));
      end = edgePoint(second, photoCentre(first));
    }
    const [sx, sy, ex, ey] = [start.x, start.y, end.x, end.y];
    const seed = index * 17 + Math.round(sx + sy + ex + ey);
    const link = svgNode("g");
    link.classList.add("ink-link");

    const feather = svgNode("path");
    feather.classList.add("ink-line", "ink-line-feather");
    feather.setAttribute("pathLength", "1");
    feather.setAttribute("d", inkStroke(inkPoints(sx, sy, ex, ey, seed, 1, bend)));

    const line = svgNode("path");
    line.classList.add("ink-line", "ink-line-main");
    line.setAttribute("pathLength", "1");
    line.setAttribute("d", inkStroke(inkPoints(sx, sy, ex, ey, seed, 0, bend)));
    link.append(feather, line);
    return link;
  }

  const exploreLeft = paperPage("album-page-profile", "left");
  const chainViewport = node("div", "chain-viewport");
  chainViewport.setAttribute("aria-label", "已选人物；点击照片可从这一步继续，拖回右页可移除这一步及后续路径。Selected people; click a photo to continue, or drag it to the right page to remove it and later steps.");
  const chain = node("div", "album-chain");
  chainViewport.append(chain);
  const chainShell = node("div", "diagram-shell chain-shell");
  const chainControls = node("div", "diagram-controls");
  chainShell.append(chainViewport, chainControls);
  exploreLeft.append(chainShell);
  // One photo size for the spread: a short route's portraits are drawn at the
  // size of the choice photos, and the choices shrink with them when the left
  // page is short of height. Longer routes shrink to fit and offer zoom.
  let choicePhoto = Infinity;
  const chainView = AlbumRelationshipView.create(chainViewport, chain, chainControls, busy,
    { maxScale: () => choicePhoto / PHOTO });
  // A pencilled first step, shown until the first photo is placed.
  const firstHint = bilingualNode("p", "chain-hint", "点选右页的照片，或拖到这一页",
    "Tap a photo on the right, or drag it here");
  const exploreRight = paperPage("album-page-choices", "right");
  const contextHeading = node("p", "mount-inscription inscribe-heading");
  const grid = node("div", "relation-grid");
  // Page-turn tabs: an inked dog-ear at the page corner beside the label.
  function pageCorner() {
    const corner = svgNode("svg");
    corner.classList.add("page-corner");
    corner.setAttribute("viewBox", "0 0 28 28");
    corner.setAttribute("aria-hidden", "true");
    for (const [className, d] of [
      ["page-corner-flap", "M17.4 25.5 L17.6 17.6 L25.5 17.4 Z"],
      ["page-corner-edge", "M2.5 25.6 C7 25.3 12 25.7 17.4 25.5 L25.5 17.4 C25.7 12 25.3 7 25.6 2.5"],
      ["page-corner-fold", "M17.4 25.5 C17.2 22.6 17.7 19.8 17.6 17.6 C20.2 17.8 22.8 17.3 25.5 17.4"],
    ]) {
      const path = svgNode("path");
      path.classList.add(className);
      path.setAttribute("d", d);
      corner.append(path);
    }
    return corner;
  }
  const revealButton = node("button", "album-reveal album-tab ink-control");
  revealButton.type = "button";
  revealButton.dataset.reveal = "true";
  revealButton.append(bilingualNode("span", "", "揭晓称呼", "Reveal term"), pageCorner());
  prevButton.prepend(pageCorner());
  // A press on a tab is a click, never the start of a paper drag.
  for (const tab of [revealButton, prevButton]) {
    for (const type of ["pointerdown", "mousedown", "touchstart", "touchmove"]) {
      tab.addEventListener(type, event => event.stopPropagation(), { passive: true });
    }
  }
  exploreRight.append(contextHeading, grid, revealButton);
  // Photos fill the grid in reading order, so a hidden spouse leaves no hole.
  for (const id of CHOICES) {
    const choice = node("button", "relation-choice");
    choice.type = "button";
    choice.dataset.relation = id;
    choice.append(framedPhoto(id), bilingualNode("span", "relation-choice-name", labelFor(id), englishLabelFor(id)));
    grid.append(choice);
  }

  function chainLink(positions, index, width) {
    const [first, second] = [positions[index - 1], positions[index]];
    const stacked = Math.abs(first.x - second.x) < first.width && Math.abs(first.y - second.y) > first.width;
    return inkLink(first, second, index, { side: stacked ? (first.x + first.width / 2 < width / 2 ? -1 : 1) : 0 });
  }
  function syncChain(animate = true) {
    const before = animate ? new Map([...chain.querySelectorAll('.chain-person')].map(person => [person, person.getBoundingClientRect()])) : null;
    const { positions, width, height } = chainLayout();
    // "我" has no caption until an identity gives the card a portrait.
    positions[0].caption = egoGender !== "unknown";
    chain.setAttribute("aria-label", `${trailFor()}. ${englishTrailFor()}.`);
    for (const person of chain.querySelectorAll(".chain-person")) {
      const index = Number(person.dataset.step);
      const identity = index ? path[index - 1] : egoGender;
      if (index > path.length || person.dataset.identity !== identity) person.remove();
    }
    const svg = chain.querySelector("svg") || inkCanvas(width, height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const lines = [...svg.querySelectorAll(":scope > .ink-link")];
    lines.slice(path.length).forEach(line => line.remove());
    for (let index = lines.length + 1; index < positions.length; index += 1) {
      const line = chainLink(positions, index, width);
      if (!reducedMotion()) {
        line.classList.add("is-tracing");
        line.addEventListener("animationend", () => line.classList.remove("is-tracing"), { once: true });
      }
      svg.append(line);
    }
    [...svg.querySelectorAll(':scope > .ink-link')].forEach((line, index) => {
      const updated = chainLink(positions, index + 1, width);
      [...line.children].forEach((stroke, part) => stroke.setAttribute('d', updated.children[part].getAttribute('d')));
    });
    if (!svg.parentNode) chain.prepend(svg);
    positions.forEach((position, index) => {
      let person = chain.querySelector(`[data-step="${index}"]`);
      if (!person) { person = personAt(index, position); chain.append(person); }
      positionPerson(person, position);
      person.classList.toggle("is-current", index === cursorDepth);
      person.classList.toggle("is-future", index > cursorDepth);
      person.setAttribute("aria-pressed", String(index === cursorDepth));
    });
    firstHint.remove();
    if (!path.length) chain.append(firstHint);
    chainView.update(width, height, before);
    chainView.select(cursorDepth);
  }
  function syncPhotoSize() {
    const cell = grid.querySelector(".relation-choice:not([hidden])")?.clientWidth;
    const w = chainViewport.clientWidth, h = chainViewport.clientHeight;
    if (!cell || !w || !h) return;
    choicePhoto = Math.min(cell, PHOTO * Math.min((w - 16) / SHORT_LAYOUT.width, (h - 16) / SHORT_LAYOUT.height, w / 100));
    exploreRight.style.setProperty("--choice-photo-width", `${choicePhoto.toFixed(2)}px`);
  }
  function availableChoices(depth) {
    const last = path[depth - 1];
    if (last && BY_ID[last]?.relation === "spouse") return CHOICES.filter(id => BY_ID[id].relation !== "spouse");
    const gender = last ? BY_ID[last]?.gender : egoGender;
    return CHOICES.filter(id => (id !== "husband" || gender !== "male") && (id !== "wife" || gender !== "female"));
  }
  function factsFor(depth, result, includeIdentity = true, onResultPage = !includeIdentity) {
    const facts = node("div", `album-facts${onResultPage ? " result-facts" : ""}`);
    facts.dataset.depth = String(depth);
    const row = (questionChinese, questionEnglish, values, current, action) => {
      const line = node("div", "fact-row");
      line.append(bilingualNode("span", "fact-question", questionChinese, questionEnglish));
      for (const [chinese, english, value] of values) {
        const button = bilingualNode("button", `fact-button ink-control${current === value ? " is-selected" : ""}`, chinese, english);
        button.type = "button";
        button.dataset[action] = value;
        button.setAttribute("aria-pressed", String(current === value));
        button.setAttribute("aria-label", `${questionChinese}：${chinese}. ${questionEnglish.replace(/…$/, "")}: ${english}.`);
        line.append(button);
      }
      facts.append(line);
    };
    if (includeIdentity) row("我是", "I am…", [["暂不指定", "Not specified", "unknown"], ["男", "Male", "male"], ["女", "Female", "female"]], egoGender, "egoGender");
    if (result && result.status !== "unresolved" && (result.needsTargetAge || relativeAge[depth])) {
      row("TA 比我", "Relative to me", [["尚不清楚", "Not sure", "unknown"], ["年长", "Older", "older"], ["年幼", "Younger", "younger"]], relativeAge[depth] || "unknown", "relativeAge");
    }
    return facts;
  }
  function syncChoices() {
    setBilingual(contextHeading, `${contextFor()}的……`, cursorDepth ? `${englishContextFor()}’s…` : "My…");
    contextHeading.setAttribute("aria-label", `接下来选择${contextFor()}的哪位亲属。Next, choose one of ${englishContextFor()}’s relatives.`);
    const allowed = availableChoices(cursorDepth);
    for (const choice of grid.children) {
      const id = choice.dataset.relation;
      choice.hidden = !allowed.includes(id);
      choice.disabled = selecting;
      choice.dataset.depth = String(cursorDepth);
      choice.classList.toggle("is-picked", path[cursorDepth] === id);
      choice.setAttribute("aria-pressed", String(path[cursorDepth] === id));
      choice.setAttribute("aria-label", `选择${contextFor()}的${labelFor(id)}，或拖到左页加入路径。Choose ${englishContextFor()}’s ${englishLabelFor(id).toLowerCase()}, or drag this photo to the left page to add it to the path.`);
      choice.title = `点击或拖到左页加入${labelFor(id)} / Click or drag left to add ${englishLabelFor(id)}`;
    }
    revealButton.hidden = path.length === 0;
    revealButton.disabled = busy();
    exploreLeft.querySelector(".identity-facts")?.remove();
    const identity = factsFor(0, null);
    identity.classList.add("identity-facts");
    identity.setAttribute("role", "group");
    identity.setAttribute("aria-label", "我是 / I am");
    for (const type of ["pointerdown", "mousedown", "touchstart", "touchmove"]) {
      identity.addEventListener(type, event => event.stopPropagation(), { passive: true });
    }
    exploreLeft.append(identity);
  }

  // Generation rows show only selected roles; ambiguous identities stay separate.
  function familyTree() {
    const people = [{ generation: 0, lane: 0 }];
    const occupied = new Set(["0:0"]);
    for (const id of path) {
      const previous = people.at(-1);
      const relation = BY_ID[id].relation;
      const generation = previous.generation + (relation === "parent" ? 1 : relation === "child" ? -1 : 0);
      let lane = previous.lane + (relation === "sibling" || relation === "spouse" ? 1 : 0);
      while (occupied.has(`${generation}:${lane}`)) lane += 1;
      occupied.add(`${generation}:${lane}`);
      people.push({ generation, lane, relation });
    }
    const high = Math.max(...people.map(person => person.generation));
    const low = Math.min(...people.map(person => person.generation));
    const lanes = Math.max(...people.map(person => person.lane)) + 1;
    const width = Math.max(100, 5 + lanes * 45);
    const ROW = 52;
    const height = Math.max(82, (high - low) * ROW + 46);
    const viewport = node("div", "tree-viewport");
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "group");
    viewport.setAttribute("aria-label", "完整关系树；长辈在上，同辈并列。可放大查看。Complete relationship tree; elders above, peers side by side. Zoom in for details.");
    for (const type of ["pointerdown", "mousedown", "touchstart", "touchmove"]) {
      viewport.addEventListener(type, event => event.stopPropagation(), { passive: true });
    }
    const tree = node("div", "family-tree");
    tree.style.setProperty("--canvas-width", width);
    tree.style.setProperty("--canvas-height", height);
    const positions = people.map(person => ({
      x: lanes === 1 ? 40 : 15 + person.lane * 45,
      y: 4 + (high - person.generation) * ROW, width: 20, angle: 0,
    }));
    positions[0].caption = egoGender !== "unknown";
    const svg = inkCanvas(width, height);
    const labels = [];
    for (let index = 1; index < people.length; index += 1) {
      const [first, second] = [positions[index - 1], positions[index]];
      const peers = people[index].relation === "sibling" || people[index].relation === "spouse";
      const sameRow = first.y === second.y;
      // A peer two or more lanes away is reached over the photos between.
      const over = sameRow && Math.abs(first.x - second.x) > 50;
      const line = inkLink(first, second, index, { over, bend: sameRow && !over ? (second.x > first.x ? 1 : -1) : null });
      line.dataset.relation = people[index].relation;
      svg.append(line);
      if (peers && sameRow && !over) {
        const label = bilingualNode("span", "tree-link-label", ...(people[index].relation === "spouse" ? ["夫妻", "Spouses"] : ["手足", "Siblings"]));
        label.style.setProperty("--chain-x", (first.x + second.x) / 2 + first.width / 2);
        label.style.setProperty("--chain-y", first.y + first.width * 0.75);
        labels.push(label);
      }
    }
    tree.append(svg, ...labels);
    people.forEach((person, index) => {
      const portrait = personAt(index, positions[index]);
      portrait.title = `${index ? labelFor(path[index - 1]) : '我'} / Inspect person`;
      portrait.dataset.generation = String(person.generation);
      const chineseName = index ? labelFor(path[index - 1]) : "我";
      const englishName = index ? englishLabelFor(path[index - 1]) : "Me";
      const chineseGeneration = person.generation === 0 ? "与我同辈" : person.generation > 0 ? `比我高${person.generation}辈` : `比我低${-person.generation}辈`;
      const englishGeneration = person.generation === 0 ? "same generation as me" : person.generation > 0 ? `${person.generation} generation${person.generation > 1 ? "s" : ""} above me` : `${-person.generation} generation${person.generation < -1 ? "s" : ""} below me`;
      portrait.setAttribute("aria-label", `${chineseName}，${chineseGeneration}. ${englishName}, ${englishGeneration}.`);
      tree.append(portrait);
    });
    viewport.append(tree);
    const shell = node("div", "diagram-shell tree-shell");
    const review = path.length <= 4
      ? bilingualNode("p", "diagram-route-review", trailFor(), englishTrailFor())
      : node("details", "diagram-route-review");
    if (path.length > 4) {
      review.append(bilingualNode("summary", "", `查看文字路径 · ${path.length} 步`, `Show text path · ${path.length} steps`));
      review.append(bilingualNode("p", "", trailFor(), englishTrailFor()));
    }
    const controls = node("div", "diagram-controls");
    shell.append(review, viewport, controls);
    resultView?.destroy();
    resultView = AlbumRelationshipView.create(viewport, tree, controls, busy, { maxScale: () => choicePhoto / 20 });
    resultView.update(width, height);
    resultView.select(path.length);
    viewport.addEventListener('click', event => {
      event.stopPropagation();
      const person = event.target.closest('.chain-person');
      if (person && !busy()) resultView.select(Number(person.dataset.step));
    });
    return shell;
  }
  function makeResultPages() {
    const left = paperPage("album-page-result-tree", "left");
    left.append(bilingualNode("p", "mount-inscription result-page-heading", "关系脉络", "Relationship path"));
    left.append(familyTree());
    const right = paperPage("album-page-result-term", "right");
    right.append(bilingualNode("p", "mount-inscription result-page-heading", "称呼", "Kinship term"));
    fillResult(right);
    return [left, right];
  }
  // Formal terms are typeset in the album's ink; the spoken forms beneath each
  // are a handwritten blue-black annotation, aligned to the same column.
  function termSheet(allEntries) {
    // Single terms become columns. Descriptions such as 继母的父亲 follow on
    // their own line after "或", unless they are all there is to show.
    const isPhrase = entry => entry.formal.includes("的") || [...entry.formal].length > 5;
    let entries = allEntries.filter(entry => !isPhrase(entry));
    let alternatives = allEntries.filter(isPhrase);
    if (!entries.length) [entries, alternatives] = [alternatives, []];
    const sheet = node("div", "result-terms");
    sheet.style.setProperty("--term-columns", entries.length);
    sheet.dataset.count = String(entries.length);
    const cells = (container, className, values, render) => values.forEach((value, index) => {
      const cell = node("span", className);
      render(cell, value);
      // Hidden separators keep the row readable as one phrase: 伯父 / 叔父.
      if (index < values.length - 1) cell.append(node("span", "sr-only", " / "));
      container.append(cell);
    });
    sheet.append(bilingualNode("span", "term-label term-label-formal", "书面称谓", "On paper"));
    const term = node("h2", "result-term");
    term.tabIndex = -1;
    const zh = node("span", "bilingual-zh");
    zh.lang = "zh-Hans";
    cells(zh, "term-formal", [...entries, ...alternatives], (cell, entry) => {
      cell.textContent = entry.formal;
      cell.classList.toggle("is-phrase", isPhrase(entry));
      cell.classList.toggle("term-alternative", alternatives.includes(entry));
    });
    term.append(zh);
    // Pinyin sits directly under its characters, before the English gloss.
    const pronunciations = entries.map(entry => pinyinFor(entry.formal));
    if (pronunciations.some(Boolean)) {
      const pinyin = node("span", "result-pinyin");
      pinyin.lang = "zh-Latn-pinyin";
      cells(pinyin, "term-cell", pronunciations, (cell, value) => { cell.textContent = value; });
      term.append(pinyin);
    }
    const en = node("span", "bilingual-en", [...entries, ...alternatives].map(entry => englishTermFor(entry.formal)).join(" / "));
    en.lang = "en";
    term.append(en);
    sheet.append(term);
    if (entries.some(entry => entry.spoken.length || entry.byName || entry.ifOlder)) {
      sheet.append(bilingualNode("span", "term-label term-label-spoken", "口语常称", "Spoken"));
      const row = node("p", "result-spoken");
      // Each alternative is quoted on its own so a line never breaks inside a quote.
      const quoted = (cell, values) => values.forEach((value, index) => {
        const word = node("span", "term-spoken-word");
        const words = node("span", "term-spoken-words", value);
        words.lang = "zh-Hans";
        word.append(words);
        if (pinyinFor(value)) word.append(node("span", "term-spoken-pinyin", pinyinFor(value)));
        if (index < values.length - 1) word.append(node("span", "sr-only", "、"));
        cell.append(word);
      });
      // One line per condition: a small caption, then what to say.
      const option = (cell, chinese, english, fill) => {
        const line = node("span", "term-spoken-option");
        line.append(bilingualNode("span", "term-spoken-when", chinese, english));
        fill(line);
        cell.append(line);
      };
      const byName = cell => cell.append(bilingualNode("span", "term-spoken-byname", "直呼名字", "by name"));
      cells(row, "term-spoken", entries, (cell, entry) => {
        if (entry.ifOlder) {
          option(cell, "若年长", "if older", line => quoted(line, entry.ifOlder));
          option(cell, "若年幼", "if younger", byName);
        } else if (entry.spoken.length) quoted(cell, entry.spoken);
        else if (entry.byName) byName(cell);
        else {
          cell.classList.add("is-empty");
          cell.append(node("span", "term-spoken-none", "—"));
          cell.append(node("span", "sr-only", "暂无常用口语称呼记录 / No common spoken form recorded"));
        }
      });
      sheet.append(row);
    }
    return sheet;
  }
  const spokenSummary = entries => entries.map(entry => entry.ifOlder
    ? `若年长：${entry.ifOlder.join("、")}；若年幼：直呼名字`
    : entry.spoken.length ? entry.spoken.join("、") : entry.byName ? "直呼名字" : "").filter(Boolean).join(" / ");
  function fillResult(page) {
    page.querySelector(".result-term-content")?.remove();
    page.querySelector(".album-facts")?.remove();
    const result = resolveAt(path.length);
    const content = node("div", "result-term-content");
    const entries = termEntries(result);
    content.append(termSheet(entries));
    const description = bilingualNode("p", "result-description", path.map(id => BY_ID[id].label).join("的"), englishPathDescription());
    // A described relationship already glosses itself with this same English path.
    description.querySelector(".bilingual-en").hidden = entries.length === 1 && englishTermFor(entries[0].formal) === englishPathDescription();
    content.append(description);
    const needsAge = Boolean(result.needsTargetAge);
    const askIdentity = result.status !== "unresolved" && identityMatters(path.length);
    if (result.status === "ambiguous") {
      // Each fact once, minus the ones answered by the controls below.
      const facts = (result.missingFacts || []).map(visitorFact)
        .filter((fact, index, all) => all.findIndex(other => other.zh === fact.zh) === index)
        .filter(fact => !(fact.kind === "age" && needsAge));
      if (facts.length || !needsAge) {
        content.append(bilingualNode("p", "result-note",
          `还需确认：${facts.map(fact => fact.zh).join("；") || "更多关系细节"}。`,
          `Still to confirm: ${facts.map(fact => fact.en).join("; ") || "more family details"}.`));
      }
    } else if (result.status === "descriptive" && result.resolutionStrategy === "bridge-relative") {
      const { bridge, bridgeAddress } = result.termMetadata;
      const english = englishTermFor(bridge).toLowerCase();
      content.append(bilingualNode("p", "result-note",
        `这类亲属没有专门称谓，通常随${bridge}称呼${bridgeAddress ? `（${bridge}叫TA“${bridgeAddress}”）` : ""}，再按辈分和年龄调整。`,
        `There is no dedicated term. Follow how your ${english} addresses them${bridgeAddress ? ` (“${bridgeAddress}”)` : ""}, then adjust for generation and age.`));
    } else if (result.status === "descriptive" && result.resolutionStrategy === "contextual-affinal") {
      content.append(bilingualNode("p", "result-note", "这类配偶一方的亲属，通常随配偶称呼。", "For your spouse’s relatives, you usually use the same term your spouse does."));
    } else if (result.status === "descriptive") {
      content.append(bilingualNode("p", "result-note", "本相簿尚未收录这段关系的专称，暂以关系类别描述。", "This album does not yet include a specific term for this relationship, so it is described by category."));
    } else if (result.status === "unresolved") {
      content.append(bilingualNode("p", "result-note", "这段路径过长或可能的关系过多。请返回选人，缩短路径后再试。", "This path is too long or has too many possible relationships. Return to choices, shorten it, and try again."));
    } else if (result.status === "conflict") {
      content.append(bilingualNode("p", "result-note", "长幼信息与这段关系不一致。请选择“尚不清楚”后重新确认。", "The age answer conflicts with this relationship. Choose Not sure and check the age again."));
    }
    if (result.status !== "unresolved" && (askIdentity || needsAge || relativeAge[path.length])) {
      content.append(factsFor(path.length, result, askIdentity, true));
    }
    page.append(content);
  }

  function status() {
    const revealed = onResult();
    stage.setAttribute("aria-busy", String(busy()));
    stage.dataset.view = revealed ? "result" : "explore";
    pathLabel.dataset.zh = trailFor();
    pathLabel.textContent = `${trailFor()} / ${englishTrailFor()}`;
    const entries = revealed ? termEntries(resolveAt(path.length)) : [];
    const spoken = spokenSummary(entries);
    relationLabel.textContent = revealed ? `书面称谓：${entries.map(entry => entry.formal).join(" / ")}${spoken ? `；口语常称：${spoken}` : ""}. Kinship term: ${entries.map(entry => englishTermFor(entry.formal)).join(" / ")}.`
      : path.length ? `已加入：${trailFor()}。接下来选择${contextFor()}的亲属。 Added: ${englishTrailFor()}. Next, choose one of ${englishContextFor()}’s relatives.` : "";
    prevButton.disabled = busy() || !revealed;
    prevButton.hidden = !revealed;
    undoButton.disabled = busy() || history.length === 0;
    resetButton.disabled = turning;
    document.querySelector(".album-plaque").classList.toggle("is-turning", turning);
    revealButton.disabled = busy();
    exploreLeft.inert = revealed || turning;
    exploreRight.inert = revealed || turning;
    resultPages.forEach(page => { page.inert = !revealed || turning; });
    mobileChoices.hidden = revealed;
    mobileChoices.replaceChildren(bilingualNode("p", "mobile-choice-title", `${contextFor()}的……`, cursorDepth ? `${englishContextFor()}’s…` : "My…"));
    const mobileGrid = node("div", "mobile-choice-grid");
    for (const id of availableChoices(cursorDepth)) {
      const choice = bilingualNode("button", "mobile-choice", labelFor(id), englishLabelFor(id));
      choice.type = "button";
      choice.dataset.relation = id;
      choice.dataset.depth = String(cursorDepth);
      choice.disabled = busy();
      mobileGrid.append(choice);
    }
    mobileChoices.append(mobileGrid);
  }
  function setBookPages(pageIndex = 0) {
    // Reattaching the leaves must not replay already drawn ink strokes.
    chain.querySelectorAll(".is-tracing").forEach(line => line.classList.remove("is-tracing"));
    flip.updateFromHtml([exploreLeft, exploreRight, ...resultPages].map(AlbumPaper.leafFor));
    flip.turnToPage(pageIndex);
    status();
  }
  function invalidateResult() {
    if (!resultOpen) return;
    resultOpen = false;
    resultView?.destroy(); resultView = null;
    resultPages = [];
    setBookPages();
  }
  function remember() {
    history.push({ path: [...path], cursorDepth, egoGender, relativeAge: { ...relativeAge },
      resultOpen, revealed: onResult(), diagram: chainView.snapshot() });
  }
  function undo() {
    if (busy() || !history.length) return;
    const previous = history.pop();
    const hadFocus = document.activeElement === undoButton;
    if (onResult()) flip.turnToPage(0);
    invalidateResult();
    path = previous.path;
    cursorDepth = previous.cursorDepth;
    egoGender = previous.egoGender;
    relativeAge = previous.relativeAge;
    syncChain(); syncChoices();
    if (previous.resultOpen) {
      resultPages = makeResultPages();
      resultOpen = true;
      setBookPages(previous.revealed ? 2 : 0);
    }
    chainView.restore(previous.diagram);
    status();
    if (hadFocus && undoButton.disabled) {
      const target = onResult() ? resultPages[1].querySelector(".result-term") : chain.querySelector(`[data-step="${cursorDepth}"]`);
      target?.focus({ preventScroll: true });
    }
  }
  function scrollToPerson(person) {
    chainView.select(Number(person.dataset.step), true);
  }
  async function flyPhoto(source, from, target, carriedPhoto = null) {
    if (!source || !from.width || reducedMotion()) return;
    const to = target.getBoundingClientRect();
    if (!to.width) return;
    const sourceWidth = carriedPhoto ? from.width : source.offsetWidth;
    const sourceHeight = carriedPhoto ? from.height : source.offsetHeight;
    const fromAngle = getComputedStyle(source.closest(".relation-choice")).getPropertyValue("--choice-tilt").trim() || "0deg";
    const toAngle = getComputedStyle(target.parentElement).getPropertyValue("--chain-angle").trim() || "0deg";
    const flying = carriedPhoto || source.cloneNode(true);
    flying.classList.remove("outbound-photo");
    flying.classList.add("flying-photo");
    Object.assign(flying.style, {
      left: `${from.left + from.width / 2 - sourceWidth / 2}px`,
      top: `${from.top + from.height / 2 - sourceHeight / 2}px`,
      width: `${sourceWidth}px`, height: `${sourceHeight}px`, transformOrigin: "center",
    });
    flying.setAttribute("aria-hidden", "true");
    target.parentElement.classList.add("is-arriving");
    if (!flying.isConnected) document.body.append(flying);
    const dx = to.left + to.width / 2 - from.left - from.width / 2;
    const dy = to.top + to.height / 2 - from.top - from.height / 2;
    const scale = target.offsetWidth * Number(target.closest('.diagram-canvas')?.dataset.scale || 1) / sourceWidth;
    const animation = flying.animate([
      { transform: `translate(0, 0) rotate(${fromAngle}) scale(1)` },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 28}px) rotate(${toAngle}) scale(${(1 + scale) / 2})`, offset: 0.48 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${toAngle}) scale(${scale})` },
    ], { duration: 540, easing: "cubic-bezier(.22,.65,.25,1)", fill: "forwards" });
    transfer = animation;
    try { await animation.finished; } catch { /* Reset can cancel the transfer. */ }
    finally {
      flying.remove();
      target.parentElement?.classList.remove("is-arriving");
      if (transfer === animation) transfer = null;
    }
  }
  function clearPhotoReturn(gesture) {
    gesture.ghost?.remove();
    gesture.person.classList.remove("is-dragging-photo", "is-erasing-person");
    exploreRight.classList.remove("is-return-ready");
    grid.querySelectorAll(".is-return-target").forEach(choice => choice.classList.remove("is-return-target"));
    chainViewport.classList.remove("is-return-dragging");
    if (chainViewport.hasPointerCapture(gesture.pointerId)) chainViewport.releasePointerCapture(gesture.pointerId);
    if (photoReturn === gesture) photoReturn = null;
  }
  function returnDestination(gesture) {
    const choice = grid.querySelector(`[data-relation="${path[gesture.step - 1]}"]`);
    if (choice && !choice.hidden) {
      const photo = choice.querySelector(".relation-choice-photo-wrap");
      const rect = photo.getBoundingClientRect();
      if (rect.width) return { rect, choice };
    }
    const page = exploreRight.getBoundingClientRect();
    return { rect: { left: page.left + page.width * 0.46, top: page.top + page.height * 0.42,
      width: page.width * 0.08, height: page.height * 0.12 }, choice: null };
  }
  async function settlePhotoReturn(gesture, accepted) {
    const operation = ++revision;
    selecting = true;
    status();
    const destination = accepted ? returnDestination(gesture) : { rect: gesture.origin };
    if (accepted) {
      remember();
      const people = [...chain.querySelectorAll(".chain-person")];
      people.slice(gesture.step).forEach(person => person.classList.add("is-erasing-person"));
      [...chain.querySelectorAll(".ink-link")].slice(gesture.step - 1).forEach(line => {
        line.classList.remove("is-tracing");
        line.classList.add("is-erasing");
      });
    }
    try {
      if (gesture.ghost && !reducedMotion()) {
        const from = gesture.ghost.getBoundingClientRect();
        const to = destination.rect;
        const dx = to.left + to.width / 2 - from.left - from.width / 2;
        const dy = to.top + to.height / 2 - from.top - from.height / 2;
        const scale = to.width / from.width;
        const animation = gesture.ghost.animate([
          { transform: "translate(0, 0) rotate(-3deg) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 20}px) rotate(2deg) scale(${(1 + scale) / 2})`, offset: 0.52 },
          { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${scale})`, opacity: accepted ? 0.82 : 1 },
        ], { duration: accepted ? 420 : 240, easing: "cubic-bezier(.22,.65,.25,1)", fill: "forwards" });
        transfer = animation;
        try { await animation.finished; } catch { /* Reset can cancel the return. */ }
        if (transfer === animation) transfer = null;
      }
      if (operation !== revision) return;
      if (accepted) {
        const depth = gesture.step - 1;
        invalidateResult();
        path = path.slice(0, depth);
        relativeAge = Object.fromEntries(Object.entries(relativeAge).filter(([key]) => Number(key) <= depth));
        cursorDepth = depth;
        syncChain(); syncChoices();
        chainView.select(depth, true);
        chain.querySelector(`[data-step="${depth}"]`)?.focus({ preventScroll: true });
      }
    } finally {
      clearPhotoReturn(gesture);
      if (operation === revision) { selecting = false; syncChoices(); status(); }
    }
  }
  chainViewport.addEventListener("pointerdown", event => {
    // A new press ends the previous gesture's click guard (see relationship-view.js).
    suppressReturnClick = false;
    if (busy() || onResult() || event.button !== 0 || !event.isPrimary) return;
    const person = event.target.closest("button.chain-person");
    const step = Number(person?.dataset.step);
    if (!person || !step) return;
    photoReturn = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      step, person, origin: person.querySelector(".relation-choice-photo-wrap").getBoundingClientRect(),
      ghost: null, active: false };
  });
  chainViewport.addEventListener("pointermove", event => {
    const gesture = photoReturn;
    if (!gesture || gesture.pointerId !== event.pointerId || selecting) return;
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (!gesture.active && Math.hypot(dx, dy) < 7) return;
    if (!gesture.active) {
      gesture.active = true;
      chainViewport.setPointerCapture(event.pointerId);
      const ghost = gesture.person.querySelector(".relation-choice-photo-wrap").cloneNode(true);
      ghost.classList.add("returning-photo");
      Object.assign(ghost.style, { left: `${gesture.origin.left}px`, top: `${gesture.origin.top}px`,
        width: `${gesture.origin.width}px`, height: `${gesture.origin.height}px` });
      ghost.setAttribute("aria-hidden", "true");
      document.body.append(ghost);
      gesture.ghost = ghost;
      gesture.person.classList.add("is-dragging-photo");
      chainViewport.classList.add("is-return-dragging");
    }
    event.preventDefault();
    gesture.ghost.style.left = `${gesture.origin.left + dx}px`;
    gesture.ghost.style.top = `${gesture.origin.top + dy}px`;
    const page = exploreRight.getBoundingClientRect();
    const inside = event.clientX >= page.left && event.clientX <= page.right &&
      event.clientY >= page.top && event.clientY <= page.bottom;
    exploreRight.classList.toggle("is-return-ready", inside);
    grid.querySelectorAll(".is-return-target").forEach(choice => choice.classList.remove("is-return-target"));
    if (inside) returnDestination(gesture).choice?.classList.add("is-return-target");
  });
  chainViewport.addEventListener("pointerup", event => {
    const gesture = photoReturn;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!gesture.active) { clearPhotoReturn(gesture); return; }
    event.preventDefault(); event.stopPropagation();
    suppressReturnClick = true;
    setTimeout(() => { suppressReturnClick = false; }, 0);
    const page = exploreRight.getBoundingClientRect();
    const accepted = event.clientX >= page.left && event.clientX <= page.right &&
      event.clientY >= page.top && event.clientY <= page.bottom;
    settlePhotoReturn(gesture, accepted);
  });
  chainViewport.addEventListener("pointercancel", event => {
    if (photoReturn?.pointerId === event.pointerId) clearPhotoReturn(photoReturn);
  });
  chainViewport.addEventListener("click", event => {
    if (suppressReturnClick) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  function clearPhotoAdd(gesture, keepGhost = false) {
    if (!keepGhost) gesture.ghost?.remove();
    gesture.choice.classList.remove("is-dragging-source");
    exploreLeft.classList.remove("is-add-ready");
    chain.querySelectorAll(".is-add-target").forEach(person => person.classList.remove("is-add-target"));
    if (grid.hasPointerCapture(gesture.pointerId)) grid.releasePointerCapture(gesture.pointerId);
    if (photoAdd === gesture) photoAdd = null;
  }
  async function cancelPhotoAdd(gesture) {
    const operation = ++revision;
    selecting = true;
    status();
    try {
      if (gesture.ghost && !reducedMotion()) {
        const from = gesture.ghost.getBoundingClientRect();
        const to = gesture.origin;
        const dx = to.left + to.width / 2 - from.left - from.width / 2;
        const dy = to.top + to.height / 2 - from.top - from.height / 2;
        const animation = gesture.ghost.animate([
          { transform: "translate(0, 0) rotate(-2deg)" },
          { transform: `translate(${dx}px, ${dy}px) rotate(0deg)` },
        ], { duration: 240, easing: "ease-out", fill: "forwards" });
        transfer = animation;
        try { await animation.finished; } catch { /* Reset can cancel this motion. */ }
        if (transfer === animation) transfer = null;
      }
    } finally {
      clearPhotoAdd(gesture);
      if (operation === revision) { selecting = false; syncChoices(); status(); }
    }
  }
  grid.addEventListener("pointerdown", event => {
    suppressAddClick = false;
    if (busy() || onResult() || event.button !== 0 || !event.isPrimary) return;
    const choice = event.target.closest("button.relation-choice");
    if (!choice || choice.hidden || choice.disabled) return;
    const photo = choice.querySelector(".relation-choice-photo-wrap");
    photoAdd = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      choice, id: choice.dataset.relation, depth: Number(choice.dataset.depth),
      origin: photo.getBoundingClientRect(), ghost: null, active: false };
  });
  grid.addEventListener("pointermove", event => {
    const gesture = photoAdd;
    if (!gesture || gesture.pointerId !== event.pointerId || selecting) return;
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (!gesture.active && Math.hypot(dx, dy) < 7) return;
    if (!gesture.active) {
      gesture.active = true;
      grid.setPointerCapture(event.pointerId);
      const ghost = gesture.choice.querySelector(".relation-choice-photo-wrap").cloneNode(true);
      ghost.classList.add("outbound-photo");
      Object.assign(ghost.style, { left: `${gesture.origin.left}px`, top: `${gesture.origin.top}px`,
        width: `${gesture.origin.width}px`, height: `${gesture.origin.height}px` });
      ghost.setAttribute("aria-hidden", "true");
      document.body.append(ghost);
      gesture.ghost = ghost;
      gesture.choice.classList.add("is-dragging-source");
    }
    event.preventDefault();
    gesture.ghost.style.left = `${gesture.origin.left + dx}px`;
    gesture.ghost.style.top = `${gesture.origin.top + dy}px`;
    const page = exploreLeft.getBoundingClientRect();
    const inside = event.clientX >= page.left && event.clientX <= page.right &&
      event.clientY >= page.top && event.clientY <= page.bottom;
    exploreLeft.classList.toggle("is-add-ready", inside);
    chain.querySelectorAll(".is-add-target").forEach(person => person.classList.remove("is-add-target"));
    if (inside) chain.querySelector(`[data-step="${cursorDepth}"]`)?.classList.add("is-add-target");
  });
  grid.addEventListener("pointerup", event => {
    const gesture = photoAdd;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!gesture.active) { clearPhotoAdd(gesture); return; }
    event.preventDefault(); event.stopPropagation();
    suppressAddClick = true;
    setTimeout(() => { suppressAddClick = false; }, 0);
    const page = exploreLeft.getBoundingClientRect();
    const accepted = event.clientX >= page.left && event.clientX <= page.right &&
      event.clientY >= page.top && event.clientY <= page.bottom;
    if (accepted) {
      const ghost = gesture.ghost;
      clearPhotoAdd(gesture, true);
      selectRelation(gesture.id, gesture.depth, gesture.choice, ghost);
    } else cancelPhotoAdd(gesture);
  });
  grid.addEventListener("pointercancel", event => {
    if (photoAdd?.pointerId === event.pointerId) clearPhotoAdd(photoAdd);
  });
  grid.addEventListener("click", event => {
    if (suppressAddClick) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  for (const type of ["pointerdown", "mousedown", "touchstart", "touchmove"]) {
    grid.addEventListener(type, event => event.stopPropagation(), { passive: true });
  }
  async function selectRelation(id, depth, choice, carriedPhoto = null) {
    if (busy() || onResult() || depth !== cursorDepth || !availableChoices(depth).includes(id)) {
      carriedPhoto?.remove();
      return;
    }
    if (path[depth] === id) {
      carriedPhoto?.remove();
      cursorDepth += 1;
      syncChain(); syncChoices(); status();
      scrollToPerson(chain.querySelector(`[data-step="${cursorDepth}"]`));
      return;
    }
    const operation = ++revision;
    remember();
    selecting = true;
    const source = choice?.querySelector(".relation-choice-photo-wrap") || grid.querySelector(`[data-relation="${id}"] .relation-choice-photo-wrap`);
    const sourceRect = (carriedPhoto || source).getBoundingClientRect();
    invalidateResult();
    path = [...path.slice(0, depth), id];
    relativeAge = Object.fromEntries(Object.entries(relativeAge).filter(([key]) => Number(key) <= depth));
    cursorDepth = depth + 1;
    syncChain();
    if (!reducedMotion()) chain.querySelector(`[data-step="${cursorDepth}"]`).classList.add("is-arriving");
    choice?.classList.add("is-picked", "is-lifting");
    status();
    await nextPaint();
    await chainView.settled();
    if (operation !== revision) { carriedPhoto?.remove(); return; }
    const targetCard = chain.querySelector(`[data-step="${cursorDepth}"]`);
    scrollToPerson(targetCard);
    try { await flyPhoto(source, sourceRect, targetCard.querySelector(".relation-choice-photo-wrap"), carriedPhoto); }
    finally {
      carriedPhoto?.remove();
      targetCard.classList.remove("is-arriving");
      choice?.classList.remove("is-lifting");
      if (operation === revision) {
        selecting = false;
        syncChoices(); status();
        if (document.activeElement === choice && choice.hidden) targetCard.focus({ preventScroll: true });
      }
    }
  }
  function selectStep(depth) {
    if (busy() || onResult() || depth < 0 || depth > path.length) return;
    cursorDepth = depth;
    syncChain(); syncChoices(); status();
    chainView.select(depth);
  }
  function inkResult() {
    const content = resultPages[1]?.querySelector(".result-term-content.is-uninked");
    if (!content) return;
    content.classList.replace("is-uninked", "is-inking");
    setTimeout(() => content.classList.remove("is-inking"), 2200);
  }
  function settleTurn() {
    turning = false;
    chainView.refresh(); resultView?.refresh();
    status();
    if (onResult()) inkResult();
    if (focusAfterTurn === "result" && onResult()) resultPages[1]?.querySelector(".result-term")?.focus({ preventScroll: true });
    if (focusAfterTurn === "explore" && !onResult()) chain.querySelector(`[data-step="${cursorDepth}"]`)?.focus({ preventScroll: true });
    focusAfterTurn = null;
  }
  function turn(direction) {
    if (busy() || !resultOpen || (direction < 0 && !onResult()) || (direction > 0 && onResult())) return;
    turning = true;
    focusAfterTurn = direction > 0 ? "result" : "explore";
    status();
    if (reducedMotion()) {
      flip.turnToPage(direction > 0 ? 2 : 0);
      settleTurn();
    } else if (direction > 0) flip.flipNext("bottom");
    else flip.flipPrev("bottom");
  }
  async function revealResult() {
    if (busy() || !path.length || onResult()) return;
    if (!resultOpen) {
      resultPages = makeResultPages();
      if (!reducedMotion()) resultPages[1].querySelector(".result-term-content").classList.add("is-uninked");
      resultOpen = true;
      setBookPages();
      selecting = true;
      const operation = revision;
      status();
      await nextPaint();
      if (operation !== revision) return;
      selecting = false;
    }
    turn(1);
  }
  function reset() {
    if (turning) return;
    revision += 1;
    transfer?.cancel();
    if (photoReturn) clearPhotoReturn(photoReturn);
    if (photoAdd) clearPhotoAdd(photoAdd);
    grid.querySelectorAll(".is-lifting").forEach(choice => choice.classList.remove("is-lifting"));
    selecting = false;
    path = [];
    cursorDepth = 0;
    egoGender = "unknown";
    relativeAge = {};
    history.length = 0;
    if (onResult()) flip.turnToPage(0);
    invalidateResult();
    syncChain(); syncChoices(); status();
    chainView.overview();
  }

  stage.addEventListener("click", event => {
    const choice = event.target.closest("button[data-relation]");
    if (choice) { selectRelation(choice.dataset.relation, Number(choice.dataset.depth), choice); return; }
    const step = event.target.closest("button.chain-person");
    if (step) { selectStep(Number(step.dataset.step)); return; }
    if (event.target.closest("button[data-reveal]")) { revealResult(); return; }
    const fact = event.target.closest("button.fact-button");
    if (!fact || busy()) return;
    const action = fact.dataset.egoGender ? "egoGender" : "relativeAge";
    const value = fact.dataset[action];
    const currentValue = action === "egoGender" ? egoGender : relativeAge[path.length] || "unknown";
    if (value === currentValue) return;
    remember();
    if (action === "egoGender") {
      egoGender = value;
      if ((value === "male" && path[0] === "husband") || (value === "female" && path[0] === "wife")) {
        if (onResult()) flip.turnToPage(0);
        invalidateResult();
        path = []; cursorDepth = 0; relativeAge = {};
      }
      syncChain(); syncChoices();
      if (resultOpen) {
        resultPages[0].querySelector(".tree-shell").replaceWith(familyTree());
        fillResult(resultPages[1]);
      }
    } else {
      relativeAge[path.length] = value;
      fillResult(resultPages[1]);
    }
    status();
    const scope = onResult() ? resultPages[1] : exploreLeft;
    scope.querySelector(`[data-${action === "egoGender" ? "ego-gender" : "relative-age"}="${value}"]`)?.focus({ preventScroll: true });
  });
  mobileChoices.addEventListener("click", event => {
    const choice = event.target.closest("button[data-relation]");
    if (choice) selectRelation(choice.dataset.relation, Number(choice.dataset.depth), choice);
  });
  for (const type of ["pointerdown", "mousedown", "touchstart", "touchmove"]) {
    chainViewport.addEventListener(type, event => event.stopPropagation(), { passive: true });
  }
  prevButton.addEventListener("click", () => turn(-1));
  resetButton.addEventListener("click", reset);
  undoButton.addEventListener("click", undo);
  window.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    if (event.target.closest("button, input, textarea, select, .tree-viewport")) return;
    event.preventDefault();
    turn(event.key === "ArrowLeft" ? -1 : 1);
  });
  syncChain(); syncChoices();
  const host = node("div", "album-book");
  stage.append(host);
  flip = new PageFlip(host, {
    width: 764.522, height: 829.962, size: "stretch", minWidth: 120, maxWidth: 980,
    minHeight: 160, maxHeight: 1200, drawShadow: true,
    flippingTime: reducedMotion() ? 1 : 1120, maxShadowOpacity: 0.30,
    usePortrait: false, startPage: 0, autoSize: true, showCover: false,
    mobileScrollSupport: true, swipeDistance: 28, useMouseEvents: !reducedMotion(),
    showPageCorners: !reducedMotion(), disableFlipByClick: true,
    clickEventForward: true, startZIndex: 2,
  });
  flip.loadFromHTML([exploreLeft, exploreRight].map(AlbumPaper.leafFor));
  AlbumPaper.register(flip);
  fallback.remove();
  flip.on("flip", status);
  flip.on("changeState", event => {
    if (event.data === "read") settleTurn();
    else if (["flipping", "user_fold"].includes(event.data)) { turning = true; status(); }
  });
  new ResizeObserver(() => { flip.update(); syncPhotoSize(); syncChain(false); status(); }).observe(stage);
  status();

})();
