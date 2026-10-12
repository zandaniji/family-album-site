// Run with `node qa-browser.mjs`. Uses the installed Chrome and no npm packages.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const mime = {
  ".css": "text/css", ".html": "text/html", ".js": "text/javascript",
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const target = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (target !== root && !target.startsWith(root + sep)) throw new Error("Invalid path");
    let bytes = await readFile(target);
    // Capture the instance in the test page without adding a debug API to the app.
    if (pathname === "/paper-turn.js") bytes = Buffer.concat([bytes, Buffer.from(`
      const registerPaper = AlbumPaper.register;
      AlbumPaper.register = flip => { window.__albumFlip = flip; registerPaper(flip); };
    `)]);
    res.writeHead(200, { "content-type": mime[extname(target)] || "application/octet-stream" });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});

let chrome;
let profile;
let socket;
try {
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const site = `http://127.0.0.1:${server.address().port}/`;
  profile = await mkdtemp(join(tmpdir(), "album-qa-"));
  chrome = spawn(chromePath, [
    "--headless=new", "--no-first-run", "--disable-gpu", "--disable-extensions",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let debugPort;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      debugPort = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
      break;
    } catch { await wait(100); }
  }
  assert.ok(debugPort, "Chrome did not start its debug port");
  const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const tab = tabs.find((item) => item.type === "page");
  assert.ok(tab, "No Chrome page target");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let nextId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.exceptionThrown") runtimeErrors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    if (!data.id) return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    data.error ? request.reject(new Error(data.error.message)) : request.resolve(data.result);
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };

  await command("Page.enable");
  await command("Runtime.enable");
  const waitFor = async (expression, timeout = 4500) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await wait(60);
    }
    throw Error(`Timed out: ${expression}`);
  };
  const ready = () => waitFor("document.querySelector('#album-stage')?.getAttribute('aria-busy') === 'false'");
  const mouseClick = async selector => {
    await waitFor(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(item => {
      const box = item.getBoundingClientRect();
      return box.width && box.height && !item.closest('[inert]') && !item.hidden;
    })`);
    const point = await evaluate(`(() => {
      const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => {
        const box = item.getBoundingClientRect();
        return box.width && box.height && !item.closest('[inert]') && !item.hidden;
      });
      if (!element) throw Error('No visible target');
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await command("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
  };
  const choose = async id => {
    await mouseClick(`.album-page-choices .relation-choice[data-relation="${id}"]`);
    await ready();
  };
  const dragPhoto = async (sourceSelector, destination, shotPrefix = null) => {
    const points = await evaluate(`(() => {
      const source = document.querySelector(${JSON.stringify(sourceSelector)}).getBoundingClientRect();
      const target = document.querySelector(${JSON.stringify(destination)}).getBoundingClientRect();
      return { from: { x: source.left + source.width / 2, y: source.top + source.height / 2 },
        to: { x: target.left + target.width / 2, y: target.top + target.height / 2 } };
    })()`);
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...points.from });
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...points.from, button: 'left', buttons: 1, clickCount: 1 });
    for (let part = 1; part <= 6; part += 1) {
      await command('Input.dispatchMouseEvent', { type: 'mouseMoved',
        x: points.from.x + (points.to.x - points.from.x) * part / 6,
        y: points.from.y + (points.to.y - points.from.y) * part / 6, button: 'left', buttons: 1 });
      if (part === 5 && shotPrefix) await screenshot(`${shotPrefix}-drag.png`);
    }
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.to, button: 'left', buttons: 0, clickCount: 1 });
    if (shotPrefix) { await wait(170); await screenshot(`${shotPrefix}-erase.png`); }
    await ready();
  };
  const dragPathPhoto = (step, destination, shotPrefix = null) =>
    dragPhoto(`.album-page-profile .chain-person[data-step="${step}"] .relation-choice-photo-wrap`, destination, shotPrefix);
  const dragChoicePhoto = (id, destination, shotPrefix = null) =>
    dragPhoto(`.album-page-choices .relation-choice[data-relation="${id}"] .relation-choice-photo-wrap`, destination, shotPrefix);
  const screenshot = async name => {
    if (!process.argv.includes("--screenshot-desktop")) return;
    const shot = await command("Page.captureScreenshot", { format: "png" });
    await writeFile(join(root, name), Buffer.from(shot.data, "base64"));
  };
  const route = () => evaluate("document.querySelector('#album-path').dataset.zh");
  const heading = () => evaluate("document.querySelector('.inscribe-heading .bilingual-zh').textContent");
  const englishHeading = () => evaluate("document.querySelector('.inscribe-heading .bilingual-en').textContent");
  const captureStable = () => evaluate(`(() => {
    window.__stablePhotos = [...document.querySelectorAll('.album-page-profile .chain-person')].map(element => ({
      element, rect: element.getBoundingClientRect().toJSON()
    }));
    return window.__stablePhotos.length;
  })()`);
  const assertStable = async () => {
    const stable = await evaluate(`window.__stablePhotos.every(({element, rect}) => {
      const current = element.getBoundingClientRect();
      return element.isConnected && ['x', 'y', 'width', 'height'].every(key => Math.abs(current[key] - rect[key]) < 0.8);
    })`);
    assert.equal(stable, true, "An existing photo moved, resized, or was replaced");
  };
  for (const [width, height] of process.argv.includes("--mobile-only") ? [] : [[1440, 900], [1024, 768]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await command("Page.navigate", { url: site });
    await waitFor("document.querySelector('.chain-person') && document.querySelector('.relation-choice')");
    await evaluate("Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 4000))])");
    await wait(300);
    await ready();
    assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth"), false);
    assert.equal(await evaluate("document.documentElement.scrollHeight > innerHeight"), false);
    assert.equal(await evaluate("document.querySelector('.album-nav #album-prev')"), null, "The unexplained outer left arrow must be removed");
    assert.equal(await evaluate("document.querySelector('#album-prev').hidden"), true);
    assert.equal(await evaluate("document.querySelector('#album-undo').disabled"), true);
    assert.equal(await evaluate(`(() => {
      const style = getComputedStyle(document.querySelector('#album-reset'));
      return style.borderTopWidth === '0px' && style.backgroundColor === 'rgba(0, 0, 0, 0)' &&
        style.backgroundImage === 'none' && style.boxShadow === 'none';
    })()`), true, "Start over must be an unboxed ink annotation");
    assert.equal(await evaluate(`[...document.querySelectorAll('.identity-facts .fact-button, #album-reset')].every(button => {
      const box = button.getBoundingClientRect();
      return box.width >= 44 && box.height >= 44;
    })`), true, "Desktop controls need usable hit targets");
    assert.equal(await evaluate(`(() => {
      const facts = document.querySelector('.album-page-profile .identity-facts').getBoundingClientRect();
      const portrait = document.querySelector('.album-page-profile .is-origin').getBoundingClientRect();
      return facts.bottom <= portrait.top && !document.querySelector('.album-page-choices [data-ego-gender]');
    })()`), true, "Identity choices must be above the origin portrait on the left page");
    assert.equal(await evaluate(`[...document.querySelectorAll('.identity-facts .fact-button')].every(button => {
      const style = getComputedStyle(button);
      return style.borderTopWidth === '0px' && style.backgroundColor === 'rgba(0, 0, 0, 0)';
    })`), true, "Identity choices must not have boxes, including the selected option");
    assert.equal(await heading(), "我的……");
    assert.equal(await englishHeading(), "My…");
    assert.equal(await evaluate("document.querySelector('.is-origin .chain-owner-mark .bilingual-zh')?.textContent"), "我");
    assert.equal(await evaluate("document.querySelector('.is-origin .chain-owner-mark .bilingual-en')?.textContent"), "Me");
    assert.equal(await evaluate("document.querySelector('.is-origin img.relation-choice-photo')"), null);
    assert.equal(await evaluate("document.querySelector('.relation-choice[data-relation=\"father\"] .bilingual-en').textContent"), "Father");
    assert.equal(await evaluate(`(() => {
      const origin = document.querySelector('.album-page-profile .is-origin .relation-choice-photo-wrap').getBoundingClientRect();
      const choices = [...document.querySelectorAll('.album-page-choices .relation-choice:not([hidden])')];
      return choices.every(choice => {
        const photo = choice.querySelector('.relation-choice-photo-wrap').getBoundingClientRect();
        return photo.width >= 60 && origin.width >= 55;
      });
    })()`), true, "Short-route and choice portraits should remain readable");
    assert.equal(await evaluate(`(() => {
      const choiceSize = parseFloat(getComputedStyle(document.querySelector('.album-page-choices .relation-choice')).fontSize);
      const chainSize = parseFloat(getComputedStyle(document.querySelector('.chain-person-name')).fontSize);
      return choiceSize >= chainSize;
    })()`), true, "Relationship labels should be at least as large as the left-page labels");
    assert.equal(await evaluate("[...document.querySelectorAll('.relation-choice')].every(choice => choice.querySelector('.bilingual-zh') && choice.querySelector('.bilingual-en'))"), true);
    assert.equal(await evaluate("[...document.querySelectorAll('.identity-facts .fact-button')].every(button => button.querySelector('.bilingual-zh') && button.querySelector('.bilingual-en'))"), true);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.relation-choice[data-relation=\"father\"] .relation-choice-photo-wrap'), '::after').content"), "none");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.chain-person.is-current .chain-person-name')).textDecorationLine"), "none");

    if (width === 1440) {
      await mouseClick('.identity-facts [data-ego-gender="male"]');
      assert.match(await evaluate("document.querySelector('.is-origin .relation-choice-photo').getAttribute('src')"), /husband/);
      assert.equal(await evaluate("document.querySelector('.relation-choice[data-relation=\"husband\"]').hidden"), true);
      await mouseClick('.identity-facts [data-ego-gender="female"]');
      assert.match(await evaluate("document.querySelector('.is-origin .relation-choice-photo').getAttribute('src')"), /wife/);
      assert.equal(await evaluate("document.activeElement.dataset.egoGender"), "female", "Identity changes must preserve keyboard focus");
      await screenshot('qa-identity-female-1440.png');
      await mouseClick('.identity-facts [data-ego-gender="unknown"]');
    }
    await screenshot(`qa-continuity-empty-${width}.png`);
    await captureStable();
    await evaluate("window.__originalChoice = document.querySelector('.relation-choice[data-relation=\"father\"]')");
    await mouseClick('.relation-choice[data-relation="father"]');
    if (width === 1440) {
      await waitFor("document.querySelector('.flying-photo') !== null", 1000);
      assert.equal(await evaluate("window.__originalChoice.classList.contains('is-picked')"), true);
      await screenshot("qa-continuity-flight-1440.png");
    }
    await ready();
    await assertStable();
    assert.equal(await heading(), "爸爸的……");
    assert.equal(await englishHeading(), "Father’s…");
    assert.equal(await route(), "我 → 爸爸");
    await mouseClick("#album-undo");
    assert.equal(await route(), "我", "Undo must remove the last selected avatar");
    await choose("father");
    assert.equal(await evaluate(`(() => {
      const paths = [...document.querySelectorAll('.album-page-profile .ink-link:first-of-type .ink-line')];
      return paths.length === 2 && new Set(paths.map(path => path.getAttribute('d'))).size === 2;
    })()`), true, "Each relationship connector needs two distinct hand-inked strokes");
    assert.equal(await evaluate("document.querySelector('#album-count')"), null, "The page count is clutter and must stay removed");
    assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term').length"), 0);
    assert.equal(await evaluate("window.__originalChoice === document.querySelector('.relation-choice[data-relation=\"father\"]')"), true);
    await captureStable();
    await choose("older_sister");
    await assertStable();
    assert.equal(await heading(), "姐姐的……");
    assert.equal(await englishHeading(), "Older sister’s…");
    await captureStable();
    await choose("son");
    await assertStable();
    assert.equal(await route(), "我 → 爸爸 → 姐姐 → 儿子");
    assert.equal(await evaluate("document.querySelectorAll('.album-page').length"), 2);
    assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .chain-person').length"), 4);
    await screenshot(`qa-continuity-explore-${width}.png`);

    // Dragging a copied portrait back removes its path link; Undo restores it.
    await dragPathPhoto(3, '.album-page-choices .relation-choice[data-relation="son"] .relation-choice-photo-wrap', width === 1440 ? 'qa-photo-return' : null);
    assert.equal(await route(), '我 → 爸爸 → 姐姐');
    assert.equal(await evaluate("document.querySelector('.album-page-choices .relation-choice[data-relation=\"son\"]').disabled"), false,
      'Returning a photo must re-enable its right-page choice');
    assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .ink-link').length"), 2);
    assert.equal(await evaluate("document.querySelector('.album-page-choices .relation-choice[data-relation=\"son\"] .relation-choice-photo-wrap').isConnected"), true);
    assert.equal(await evaluate("window.__albumFlip.getState()"), 'read');
    await mouseClick('#album-undo');
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子');
    await dragPathPhoto(2, '.album-page-choices .relation-choice[data-relation="older_sister"] .relation-choice-photo-wrap');
    assert.equal(await route(), '我 → 爸爸', 'Returning an earlier photo must erase the later branch');
    assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .ink-link').length"), 1);
    await mouseClick('#album-undo');
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子');
    assert.equal(await evaluate("document.querySelector('.album-page-profile .chain-shell .diagram-controls').hidden"), true,
      "Zoom must not be offered while the whole route is drawn at full size");
    await dragPathPhoto(3, '.album-page-profile .identity-facts');
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子', 'A drop on the left page must cancel the return');
    await dragPathPhoto(3, '.album-page-choices .relation-choice[data-relation="son"] .relation-choice-photo-wrap');
    await choose('son');
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子', 'Clicking a returned photo must add it again');
    await dragPathPhoto(3, '.album-page-choices .relation-choice[data-relation="son"] .relation-choice-photo-wrap');
    await dragChoicePhoto('son', '.album-page-profile .chain-viewport', width === 1440 ? 'qa-photo-readd' : null);
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子', 'Dragging a returned photo left must add it again');
    assert.equal(await evaluate("document.querySelector('.album-page-choices .relation-choice[data-relation=\"son\"] .relation-choice-photo-wrap').isConnected"), true,
      'The right-page source photo must remain after a drag');
    await dragChoicePhoto('son', '.album-page-choices .inscribe-heading');
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子', 'Releasing a right-page photo outside the left page must cancel');
    await captureStable();

    // Revisiting a photo is reversible; the remaining branch survives until replaced.
    await mouseClick('.album-page-profile [data-step="1"]');
    assert.equal(await heading(), "爸爸的……");
    assert.equal(await route(), "我 → 爸爸 → 姐姐 → 儿子");
    assert.equal(await evaluate("document.querySelectorAll('.chain-person.is-future').length"), 2);
    assert.equal(await evaluate("document.querySelector('.relation-choice[data-relation=\"older_sister\"]').getAttribute('aria-pressed')"), "true");
    await choose("older_sister");
    assert.equal(await route(), "我 → 爸爸 → 姐姐 → 儿子");
    await mouseClick('.album-page-profile [data-step="3"]');
    await evaluate(`(() => {
      window.__turnFrames = [];
      window.__watchTurn = true;
      const sample = () => {
        const rect = document.querySelector('.album-object').getBoundingClientRect();
        window.__turnFrames.push({ x: rect.x, width: rect.width, overflow: document.documentElement.scrollHeight > innerHeight });
        if (window.__watchTurn) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    })()`);
    await mouseClick(".album-reveal");
    if (width === 1440 && process.argv.includes("--screenshot-desktop")) {
      await wait(160);
      await screenshot("qa-paper-turn-early-1440.png");
      await wait(160);
      await screenshot("qa-paper-turn-middle-1440.png");
      await wait(160);
      await screenshot("qa-paper-turn-late-1440.png");
    }
    await ready();
    assert.equal(await evaluate(`(() => {
      window.__watchTurn = false;
      const first = window.__turnFrames[0];
      return window.__turnFrames.every(frame => !frame.overflow && Math.abs(frame.x - first.x) < 1 && Math.abs(frame.width - first.width) < 1);
    })()`), true, "Turning paper must not create a scrollbar or shift the album");
    assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "result");
    assert.equal(await evaluate("document.querySelector('#album-prev').hidden"), false, "Back to choices must show on the result spread");
    const result = await evaluate(`(() => {
      const photos = [...document.querySelectorAll('.family-tree .chain-person')].map(person => {
        const box = person.getBoundingClientRect();
        return { generation: Number(person.dataset.generation), x: box.x, y: box.y };
      });
      return {
        term: document.querySelector('.result-term .bilingual-zh').textContent,
        englishTerm: document.querySelector('.result-term .bilingual-en').textContent,
        pinyin: document.querySelector('.result-pinyin')?.textContent,
        description: document.querySelector('.result-description .bilingual-zh').textContent,
        englishDescription: document.querySelector('.result-description .bilingual-en').textContent,
        englishHeading: document.querySelector('.album-page-result-term .result-page-heading .bilingual-en').textContent,
        photos, pageHeight: document.documentElement.scrollHeight,
        resetBottom: document.querySelector('#album-reset').getBoundingClientRect().bottom
      };
    })()`);
    assert.match(result.term, /表兄.*表弟/);
    assert.match(result.englishTerm, /Older male cousin.*Younger male cousin/);
    assert.match(result.pinyin, /biǎo/);
    assert.equal(result.description, "父亲的姐姐的儿子");
    assert.equal(result.englishDescription, "Father’s older sister’s son");
    assert.equal(result.englishHeading, "Kinship term");
    assert.deepEqual(result.photos.map(person => person.generation), [0, 1, 1, 0]);
    assert.ok(Math.abs(result.photos[1].y - result.photos[2].y) < 1, "Father and his sister must share a generation row");
    assert.ok(Math.abs(result.photos[0].y - result.photos[3].y) < 1, "Cousins must share a generation row");
    assert.ok(result.photos[1].y < result.photos[0].y, "Parents must sit above children");
    assert.ok(result.resetBottom <= height);
    await screenshot(`qa-continuity-result-${width}.png`);
    assert.equal(await evaluate(`(() => {
      const content = document.querySelector('.result-term-content');
      const facts = content.querySelector('.result-facts');
      return facts && !content.querySelector('[data-ego-gender]') && content.scrollHeight <= content.clientHeight + 1 &&
        [...facts.querySelectorAll('button')].every(button => button.getBoundingClientRect().height >= 44);
    })()`), true, "Age question must be beside the result and fit the page");
    await mouseClick('.album-page-result-term [data-relative-age="older"]');
    assert.equal(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), "表兄");
    assert.equal(await evaluate("document.querySelector('.result-term .bilingual-en').textContent"), "Older male cousin");
    await mouseClick("#album-undo");
    assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "result");
    assert.match(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), /表兄.*表弟/, "Undo must restore the unanswered age question");
    await mouseClick('.album-page-result-term [data-relative-age="older"]');
    await evaluate(`(() => {
      const flip = window.__albumFlip;
      const controller = flip.getFlipController();
      const render = flip.getRender();
      const bounds = controller.getBoundsRect();
      const material = document.querySelector('.album-page-result-tree .page-material');
      const polygon = getComputedStyle(material).clipPath;
      const vertex = polygon.slice(polygon.indexOf('(') + 1, -1).split(',')[4].trim().split(/\\s+/);
      const coordinate = (value, size) => parseFloat(value) * (value.endsWith('%') ? size / 100 : 1);
      window.__reverseOrigin = {
        x: bounds.left + coordinate(vertex[0], bounds.pageWidth),
        y: bounds.top + coordinate(vertex[1], bounds.height),
        outerEdge: bounds.left + bounds.pageWidth * Number(getComputedStyle(material).getPropertyValue('--album-left-paper-inset'))
      };
      window.__reverseFrames = [];
      const draw = controller.do;
      controller.do = point => {
        draw(point);
        const calc = controller.getCalculation();
        if (calc?.getDirection() === 1) window.__reverseFrames.push({
          corner: render.convertToGlobal(calc.getPosition()),
          shadow: render.convertToGlobal(calc.getShadowStartPoint()),
          width: calc.pageWidth,
          spine: render.getRect().left + render.getRect().pageWidth
        });
      };
    })()`);
    await mouseClick("#album-prev");
    const lift = await evaluate("({ expected: window.__reverseOrigin, first: window.__reverseFrames[0] })");
    assert.ok(Math.abs(lift.first.corner.x - lift.expected.x) < 2, "The actual fold corner must start at the visible left paper edge, not the canvas edge");
    assert.ok(Math.abs(lift.first.corner.y - lift.expected.y) < 2, "Reverse turn must lift at the bottom paper corner");
    assert.ok(lift.first.shadow.x >= lift.expected.outerEdge - 2, "Fold shadow must start on the same physical paper");
    if (width === 1440) {
      assert.equal(await evaluate("document.querySelector('.album-plaque').classList.contains('is-turning')"), true);
      await screenshot("qa-reverse-turn-early-1440.png");
      await wait(260);
      await screenshot("qa-reverse-turn-middle-1440.png");
      await wait(260);
      await screenshot("qa-reverse-turn-late-1440.png");
    }
    await ready();
    assert.equal(await evaluate("window.__reverseFrames.every(frame => Math.abs(frame.spine - window.__reverseFrames[0].spine) < 0.01)"), true, "The spine must remain fixed throughout the turn");
    assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "explore");
    await assertStable();
    if (width === 1440) {
      assert.equal(await evaluate("document.querySelectorAll('.album-chain .is-tracing').length"), 0, "Returning to the route must not redraw its ink");
      await evaluate("document.activeElement.blur()");
      await command("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
      await ready();
      assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "result");
      const paper = await evaluate("document.querySelector('#album-stage').getBoundingClientRect().toJSON()");
      const inset = await evaluate("Number(getComputedStyle(document.querySelector('#album-stage')).getPropertyValue('--album-left-paper-inset'))");
      const start = { x: paper.left + paper.width / 2 * inset + 12, y: paper.bottom - 12 };
      await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: paper.left + 2, y: start.y });
      await wait(180);
      assert.equal(await evaluate("window.__albumFlip.getState()"), "read", "Hovering the cover/stack outside the visible paper must not lift a corner");
      await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...start });
      await wait(220);
      assert.equal(await evaluate("window.__albumFlip.getState()"), "fold_corner", "The visible paper corner should respond to hover");
      await screenshot("qa-reverse-hover-1440.png");
      await command("Input.dispatchMouseEvent", { type: "mousePressed", ...start, button: "left", buttons: 1, clickCount: 1 });
      const partial = { x: start.x + 100, y: start.y - 25 };
      await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...partial, button: "left", buttons: 1 });
      const dragCorner = await evaluate(`(() => {
        const flip = window.__albumFlip;
        const corner = flip.getRender().convertToGlobal(flip.getFlipController().getCalculation().getPosition());
        const block = flip.getUI().getDistElement().getBoundingClientRect();
        return { x: corner.x + block.left, y: corner.y + block.top };
      })()`);
      assert.ok(Math.hypot(dragCorner.x - partial.x, dragCorner.y - partial.y) < 2, "The physical fold corner must follow the pointer");
      await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...partial, button: "left", buttons: 0, clickCount: 1 });
      await ready();
      assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "result", "Releasing before the spine should settle on the current result page");
      await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...start });
      await command("Input.dispatchMouseEvent", { type: "mousePressed", ...start, button: "left", buttons: 1, clickCount: 1 });
      for (let step = 1; step <= 12; step += 1) {
        await command("Input.dispatchMouseEvent", {
          type: "mouseMoved", x: start.x + (paper.width - 90) * step / 12,
          y: start.y - 80 * Math.sin(Math.PI * step / 24), button: "left", buttons: 1,
        });
        await wait(16);
      }
      await command("Input.dispatchMouseEvent", {
        type: "mouseReleased", x: paper.right - 78, y: start.y - 80, button: "left", buttons: 0, clickCount: 1,
      });
      await ready();
      assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "explore", "Dragging the left corner must return to exploration");
      await assertStable();
      console.log("Keyboard navigation, physical paper origin, hover, cancelled/completed drag, persistent ink: passed");
    }

    // Returning a photo after visiting the result removes stale result pages.
    await dragPathPhoto(3, '.album-page-choices .relation-choice[data-relation="son"] .relation-choice-photo-wrap');
    assert.equal(await route(), '我 → 爸爸 → 姐姐');
    assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term').length"), 0);
    await mouseClick('#album-undo');
    assert.equal(await route(), '我 → 爸爸 → 姐姐 → 儿子');
    assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term').length"), 1, "Undo must restore the result spread");

    // Replace a branch after revealing, and ensure its age answer is discarded.
    await mouseClick('.album-page-profile [data-step="2"]');
    await captureStable();
    await choose("daughter");
    // The replaced final card is deliberately new; ancestors are retained.
    assert.equal(await evaluate("window.__stablePhotos.slice(0,3).every(({element}) => element.isConnected)"), true);
    assert.equal(await route(), "我 → 爸爸 → 姐姐 → 女儿");
    assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term').length"), 0);
    await mouseClick("#album-undo");
    assert.equal(await route(), "我 → 爸爸 → 姐姐 → 儿子", "Undo must restore the entire replaced branch");
    assert.equal(await heading(), "姐姐的……", "Undo must restore the branch cursor");
    await mouseClick(".album-reveal");
    await ready();
    assert.equal(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), "表兄", "Undo must restore the branch's age answer");
    await mouseClick("#album-prev");
    await ready();
    await choose("daughter");
    await mouseClick(".album-reveal");
    await ready();
    assert.match(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), /表姐.*表妹/);
    assert.match(await evaluate("document.querySelector('.result-term .bilingual-en').textContent"), /Older female cousin.*Younger female cousin/);
    await mouseClick("#album-reset");
    await ready();
    assert.equal(await route(), "我");
    assert.equal(await evaluate("document.querySelectorAll('.album-page').length"), 2);
    assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .chain-person').length"), 1);
    assert.equal(await evaluate("document.querySelector('#album-undo').disabled"), true, "Start over must clear undo history");
    // An identity change can clear an incompatible spouse; undo restores both.
    await choose("wife");
    await mouseClick('.identity-facts [data-ego-gender="female"]');
    assert.equal(await route(), "我");
    await mouseClick("#album-undo");
    assert.equal(await route(), "我 → 妻子");
    assert.equal(await evaluate("document.querySelector('.identity-facts [data-ego-gender=unknown]').getAttribute('aria-pressed')"), "true");
    await mouseClick("#album-undo");
    assert.equal(await route(), "我");
    assert.equal(await evaluate("document.querySelector('#album-undo').disabled"), true);
    assert.equal(await evaluate("document.activeElement.dataset.step"), "0", "Exhausting undo must keep keyboard focus usable");
    console.log(`${width}x${height}: stable photographs, context, reveal, generation rows, branch replacement, age reset: passed`);

    if (width === 1440) {
      // Reset during a flying photo must cancel the pending selection completely.
      await mouseClick('.relation-choice[data-relation="mother"]');
      await waitFor("document.querySelector('.flying-photo') !== null", 1000);
      assert.equal(await evaluate("document.querySelector('#album-undo').disabled"), true, "Undo must wait for a flying photo to settle");
      await mouseClick("#album-reset");
      await wait(700);
      assert.equal(await route(), "我");
      assert.equal(await evaluate("document.querySelectorAll('.flying-photo, .is-lifting').length"), 0);
      // A rapid second click cannot append a relation under an outdated heading.
      await mouseClick('.relation-choice[data-relation="father"]');
      await evaluate("document.querySelector('.relation-choice[data-relation=\"son\"]').click()");
      await ready();
      assert.equal(await route(), "我 → 爸爸");
      await mouseClick("#album-reset");
    }
  }

  // The complete route fits by default; zoom and pan are deliberate actions.
  if (!process.argv.includes("--mobile-only")) {
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await command("Page.navigate", { url: site });
  await waitFor("document.querySelector('.chain-person') !== null");
  await ready();
  // Measure only after the album has laid out its first photo.
  await waitFor("document.querySelector('.chain-person').getBoundingClientRect().width > 0");
  const originalWidth = await evaluate("document.querySelector('.chain-person').getBoundingClientRect().width");
  for (let index = 0; index < 11; index += 1) await choose("father");
  const longRoute = await evaluate(`(() => {
    const viewport = document.querySelector('.chain-viewport').getBoundingClientRect();
    const last = document.querySelector('.chain-person[data-step="11"]').getBoundingClientRect();
    return {
      width: document.querySelector('.chain-person').getBoundingClientRect().width,
      scroll: document.querySelector('.chain-viewport').scrollTop,
      lastVisible: last.top >= viewport.top && last.bottom <= viewport.bottom + 1,
      nodes: document.querySelectorAll('.album-page-profile .chain-person').length,
      pageHeight: document.documentElement.scrollHeight,
      flying: document.querySelectorAll('.flying-photo').length
    };
  })()`);
  assert.ok(longRoute.width < originalWidth, `Long routes should adapt to the available paper (${longRoute.width} vs ${originalWidth})`);
  assert.equal(longRoute.nodes, 12);
  assert.equal(longRoute.lastVisible, true);
  assert.equal(longRoute.scroll, 0);
  assert.equal(longRoute.flying, 0);
  assert.equal(longRoute.pageHeight, 768);
  const allVisible = selector => evaluate(`(() => {
    const view = document.querySelector(${JSON.stringify(selector)});
    const bounds = view.getBoundingClientRect();
    return [...view.querySelectorAll('.chain-person')].every(person => {
      const box = person.getBoundingClientRect();
      return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 && box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1;
    });
  })()`);
  assert.equal(await allVisible('.chain-viewport'), true, "Every person must be visible in the default overview");
  await screenshot('qa-overview-eight-1024.png');
  const ancestor = await evaluate("document.querySelector('.chain-person[data-step=\"0\"]').getBoundingClientRect().width");
  await mouseClick('.chain-shell [data-diagram-action="in"]');
  assert.ok(await evaluate("Number(document.querySelector('.chain-viewport').dataset.zoom)") > 1);
  assert.ok(await evaluate("document.querySelector('.chain-person[data-step=\"0\"]').getBoundingClientRect().width") > ancestor);
  await dragPathPhoto(11, '.album-page-choices .relation-choice[data-relation="father"] .relation-choice-photo-wrap');
  assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .chain-person').length"), 11, "A zoomed portrait must still drag back");
  await mouseClick('#album-undo');
  assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .chain-person').length"), 12);
  assert.ok(await evaluate("Number(document.querySelector('.chain-viewport').dataset.zoom)") > 1, "Undo must restore the zoomed diagram");
  // Background or occluded tabs throttle timers to about once a second. A pan's
  // click guard must not outlive it and swallow the next click on a photo.
  await evaluate("(() => { window.__realSetTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...rest) => window.__realSetTimeout(fn, Math.max(ms || 0, 1000), ...rest); })()");
  const beforePan = await evaluate("document.querySelector('.album-chain').style.transform");
  const pan = await evaluate(`(() => {
    const view = document.querySelector('.chain-viewport');
    const box = view.getBoundingClientRect();
    for (const yf of [0.12, 0.28, 0.5, 0.72, 0.88]) for (const xf of [0.12, 0.28, 0.5, 0.72, 0.88]) {
      const x = box.left + box.width * xf, y = box.top + box.height * yf;
      const hit = document.elementFromPoint(x, y);
      if (view.contains(hit) && !hit.closest('button.chain-person')) return { x, y };
    }
    throw Error('No clear diagram area for panning');
  })()`);
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pan });
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...pan, button: 'left', buttons: 1, clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pan.x + 60, y: pan.y + 70, button: 'left', buttons: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pan.x + 60, y: pan.y + 70, button: 'left', buttons: 0, clickCount: 1 });
  assert.notEqual(await evaluate("document.querySelector('.album-chain').style.transform"), beforePan);
  assert.equal(await evaluate("window.__albumFlip.getState()"), 'read', "Panning the diagram must not fold paper");
  assert.equal(await heading(), '爸爸的……');
  await screenshot('qa-overview-zoom-1024.png');
  await mouseClick('.chain-shell [data-diagram-action="fit"]');
  assert.equal(await allVisible('.chain-viewport'), true);
  await mouseClick('.album-page-profile [data-step="2"]');
  await choose('daughter');
  assert.equal(await route(), '我 → 爸爸 → 爸爸 → 女儿', 'A photo click right after panning must not be swallowed');
  await evaluate("window.setTimeout = window.__realSetTimeout");
  await mouseClick('#album-undo');
  assert.equal(await allVisible('.chain-viewport'), true);
  assert.equal(await evaluate("document.querySelectorAll('.album-page-profile .chain-person').length"), 12);
  await mouseClick(".album-reveal");
  await ready();
  assert.equal(await evaluate("document.querySelectorAll('.family-tree .chain-person').length"), 12);
  assert.equal(await allVisible('.tree-viewport'), true, "The full generation tree must fit without scrolling");
  await screenshot('qa-overview-tree-1024.png');
  await mouseClick('.tree-shell [data-diagram-action="in"]');
  assert.ok(await evaluate("Number(document.querySelector('.tree-viewport').dataset.zoom)") > 1);
  await mouseClick('.tree-shell [data-diagram-action="fit"]');
  assert.equal(await allVisible('.tree-viewport'), true);
  assert.match(await evaluate("document.querySelector('.result-term .bilingual-en').textContent"), /^Father’s father’s/);
  assert.match(await evaluate("document.querySelector('.result-description .bilingual-en').textContent"), /^Father’s father’s/);
  await mouseClick("#album-prev");
  await ready();
  assert.equal(await route(), `我${" → 爸爸".repeat(11)}`);
  await mouseClick('.album-page-profile [data-step="11"]');
  for (let index = 11; index < 19; index += 1) await choose(index % 2 ? 'older_sister' : 'son');
  assert.equal(await allVisible('.chain-viewport'), true, "Twenty people must fit the overview");
  await screenshot('qa-overview-twenty-1024.png');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  assert.equal(await allVisible('.chain-viewport'), true, "Overview must refit on resize");
  await screenshot('qa-overview-twenty-1440.png');
  await mouseClick('.album-reveal');
  await ready();
  assert.equal(await allVisible('.tree-viewport'), true, "Wide generation trees must fit too");
  await screenshot('qa-overview-wide-tree-1440.png');
  await mouseClick('.tree-shell summary');
  await wait(200);
  assert.equal(await allVisible('.tree-viewport'), true, "Opening the written route should refit the tree");
  await mouseClick("#album-reset");
  assert.equal(await evaluate("document.querySelector('.chain-viewport').scrollTop"), 0);
  console.log("Overview, zoom, pan, branch/Undo, 12/20 people, tall/wide trees, resize, text route, reduced motion: passed");

  // Relationship correctness: age belongs to the endpoint, not an inner pair.
  await mouseClick('#album-reset'); await ready();
  await mouseClick('.identity-facts [data-ego-gender="male"]');
  for (const id of ['father', 'father', 'son', 'son']) await choose(id);
  await mouseClick('.album-reveal'); await ready();
  assert.match(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), /我.*哥哥.*堂兄/);
  await mouseClick('[data-relative-age="older"]');
  assert.equal(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), '哥哥 / 堂兄');
  assert.match(await evaluate("document.querySelector('.result-term .bilingual-en').textContent"), /Older brother.*Older male paternal cousin/);
  assert.ok(await evaluate("document.querySelector('.result-note')?.textContent.includes('还需确认')"));
  assert.match(await evaluate("document.querySelector('.result-note .bilingual-en').textContent"), /someone already on the path/);
  await mouseClick('#album-undo'); await ready();
  assert.match(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), /我.*哥哥.*堂兄/);
  await mouseClick('[data-relative-age="younger"]');
  assert.equal(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), '弟弟 / 堂弟');
  await screenshot('qa-kinship-age-candidates.png');

  for (const [path, termPattern] of [
    [['father', 'father', 'son'], /父亲.*伯父.*叔父/],
    [['wife', 'father', 'son'], /大舅子.*小舅子/],
  ]) {
    await mouseClick('#album-reset'); await ready();
    await mouseClick('.identity-facts [data-ego-gender="male"]');
    for (const id of path) await choose(id);
    await mouseClick('.album-reveal'); await ready();
    assert.match(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), termPattern);
    assert.equal(await evaluate("document.querySelectorAll('.result-facts [data-relative-age]').length"), 0,
      'Do not ask relative-to-me age when the needed comparison is with a parent or spouse');
    assert.ok(await evaluate("document.querySelector('.result-note') !== null"));
    if (path[0] === 'wife') {
      assert.match(await evaluate("document.querySelector('.result-note .bilingual-en').textContent"), /your spouse/);
    }
  }

  // Duplicate rewrite orders must not prevent an ordinary ten-step reveal.
  await mouseClick('#album-reset'); await ready();
  await mouseClick('.identity-facts [data-ego-gender="male"]');
  for (let index = 0; index < 10; index++) await choose(index % 2 ? 'younger_brother' : 'older_brother');
  await mouseClick('.album-reveal'); await ready();
  assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), 'result');
  assert.match(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), /我/);
  // A genuinely larger state space must render a recoverable message.
  await mouseClick('#album-prev'); await ready();
  await choose('older_brother'); await choose('younger_brother');
  await mouseClick('.album-reveal'); await ready();
  assert.equal(await evaluate("document.querySelector('.result-term .bilingual-zh').textContent"), '暂无法确定');
  assert.match(await evaluate("document.querySelector('.result-note .bilingual-zh').textContent"), /缩短路径/);
  assert.equal(await evaluate("document.querySelectorAll('.result-facts [data-relative-age]').length"), 0);
  await screenshot('qa-kinship-limit-recovery.png');
  await mouseClick('#album-prev'); await ready();
  await mouseClick('#album-reset'); await ready();
  assert.equal(await route(), '我');
  console.log('Kinship endpoint age, remaining ambiguity, in-law age scope, ten-step reveal and limit recovery: passed');

  const text = selector => evaluate(`[...document.querySelectorAll(${JSON.stringify(`.album-page-result-term ${selector}`)})].map(item => item.textContent).join(' | ')`);
  const resultFits = () => evaluate(`(() => {
    const content = document.querySelector('.album-page-result-term .result-term-content');
    return content.scrollHeight <= content.clientHeight + 1;
  })()`);
  const reveal = async (identity, path) => {
    await mouseClick('#album-reset'); await ready();
    if (identity) await mouseClick(`.identity-facts [data-ego-gender="${identity}"]`);
    for (const id of path) await choose(id);
    await mouseClick('.album-reveal'); await ready();
  };
  // Written term headlines; spoken forms sit beneath it, each with pinyin.
  await reveal('male', ['father', 'older_brother']);
  assert.equal(await text('.result-term .bilingual-zh'), '伯父');
  assert.equal(await text('.result-pinyin'), 'bó fù');
  assert.equal(await text('.term-spoken-words'), '伯伯 | 大伯');
  assert.equal(await text('.term-spoken-pinyin'), 'bó bo | dà bó');
  assert.match(await evaluate("document.querySelector('#album-relation').textContent"), /书面称谓：伯父；口语常称：伯伯、大伯/);
  // In-laws read the same way for both identities.
  await reveal('female', ['husband', 'father']);
  assert.equal(await text('.result-term .bilingual-zh'), '公公');
  assert.equal(await text('.term-spoken-words'), '爸爸');
  await reveal('male', ['father', 'mother', 'father']);
  assert.equal(await text('.result-term .bilingual-zh'), '曾外祖父');
  assert.equal(await text('.result-term .bilingual-en'), 'Father’s maternal grandfather');
  // Unset identity: ask for it on the result page, and keep the row once answered.
  await reveal(null, ['son', 'mother']);
  assert.match(await text('.result-note .bilingual-zh'), /你的身份/);
  assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term .result-facts [data-ego-gender]').length"), 3);
  await mouseClick('.album-page-result-term [data-ego-gender="male"]'); await ready();
  assert.equal(await text('.result-term .bilingual-zh'), '妻子');
  assert.equal(await evaluate("document.querySelector('.album-page-result-term [data-ego-gender=\"male\"]').getAttribute('aria-pressed')"), 'true');
  assert.equal(await evaluate("document.activeElement?.dataset.egoGender"), 'male', 'Focus stays on the chosen identity');
  // The age question and an unrelated missing fact appear together and fit.
  await command('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  await reveal('male', ['father', 'wife', 'older_brother', 'son']);
  assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term [data-relative-age]').length"), 3);
  assert.match(await text('.result-note .bilingual-zh'), /她是否是你的母亲/);
  assert.equal(await text('.term-alternative'), '继母的哥哥的儿子');
  assert.equal(await resultFits(), true, 'Note and age question must fit at 1024×768');
  // No dedicated term: follow the connecting relative, then adjust for age.
  await reveal('male', ['older_brother', 'wife', 'older_brother']);
  assert.equal(await text('.result-term .bilingual-zh'), '嫂子的哥哥');
  assert.match(await text('.result-note .bilingual-zh'), /随嫂子称呼（嫂子叫TA“哥哥”）/);
  assert.equal(await text('.term-spoken-when .bilingual-zh'), '若年长 | 若年幼');
  assert.equal(await evaluate("document.querySelector('.album-page-result-term .result-description .bilingual-en').hidden"), true,
    'A described term already carries the English path');
  assert.equal(await resultFits(), true);
  await screenshot('qa-kinship-bridge-1024.png');
  await mouseClick('.album-page-result-term [data-relative-age="older"]');
  assert.equal(await text('.term-spoken-words'), '哥 | 大哥');
  assert.equal(await text('.term-spoken-byname'), '');
  await mouseClick('.album-page-result-term [data-relative-age="younger"]');
  assert.equal(await text('.term-spoken-words'), '');
  assert.match(await text('.term-spoken-byname'), /直呼名字/);
  await reveal('male', ['son', 'wife', 'older_brother']);
  assert.equal(await text('.result-term .bilingual-zh'), '儿媳的哥哥');
  assert.match(await text('.term-spoken-byname'), /直呼名字/);
  assert.equal(await evaluate("document.querySelectorAll('.album-page-result-term [data-relative-age]').length"), 0,
    'A younger-generation in-law needs no age question');
  await reveal('male', ['wife', 'father', 'older_brother']);
  assert.match(await text('.result-note .bilingual-zh'), /随配偶称呼/);
  await mouseClick('#album-prev'); await ready();
  await mouseClick('#album-reset'); await ready();
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  console.log('Written and spoken terms, result-page identity, specific notes, connecting-relative advice: passed');
  await command("Emulation.setEmulatedMedia", { features: [] });
  }

  if (!process.argv.includes("--desktop-only")) {
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await command("Page.navigate", { url: site });
    await waitFor("document.querySelectorAll('.mobile-choice').length === 10");
    assert.equal(await evaluate("document.querySelector('.mobile-choice[data-relation=\"mother\"] .bilingual-en').textContent"), "Mother");
    assert.equal(await evaluate("document.querySelector('.mobile-choice-title .bilingual-en').textContent"), "My…");
    await evaluate("document.querySelector('.mobile-choice[data-relation=\"mother\"]').click()");
    await ready();
    assert.equal(await route(), "我 → 妈妈");
    assert.equal(await evaluate("document.querySelector('.mobile-choice-title .bilingual-en').textContent"), "Mother’s…");
    assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth"), false);
    await mouseClick("#album-undo");
    assert.equal(await route(), "我", "Mobile undo must remove the selected avatar");
    await evaluate("document.querySelector('.mobile-choice[data-relation=mother]').click()");
    await ready();
    await evaluate("document.querySelector('.album-reveal').click()");
    await ready();
    assert.equal(await evaluate(`[...document.querySelectorAll('.album-plaque button:not([hidden])')].every(button => {
      const box = button.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth && box.height >= 44;
    })`), true, "Mobile return/undo/restart must fit and have usable hit targets");
    await mouseClick("#album-prev");
    await ready();
    assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "explore");
    await evaluate("document.querySelector('.album-reveal').click()");
    await ready();
    const mobilePaper = await evaluate("document.querySelector('#album-stage').getBoundingClientRect().toJSON()");
    const touchStart = { x: mobilePaper.left + mobilePaper.width * 0.055 + 5, y: mobilePaper.bottom - 8 };
    await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...touchStart, id: 1 }] });
    for (let step = 1; step <= 8; step += 1) {
      await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{
        x: touchStart.x + mobilePaper.width * 0.72 * step / 8, y: touchStart.y - 12, id: 1
      }] });
      await wait(16);
    }
    await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await ready();
    assert.equal(await evaluate("document.querySelector('#album-stage').dataset.view"), "explore", "Touch dragging from the visible left edge must return to choices");
    if (process.argv.includes("--screenshot")) {
      const shot = await command("Page.captureScreenshot", { format: "png" });
      await writeFile(join(root, "qa-continuity-mobile-390.png"), Buffer.from(shot.data, "base64"));
    }
    console.log("390px retained picker and overflow smoke: passed");
  }
  assert.deepEqual(runtimeErrors, [], "Uncaught browser errors");
} finally {
  socket?.close();
  chrome?.kill();
  server.close();
  if (profile) {
    await wait(250);
    const tempRoot = resolve(tmpdir());
    const testProfile = resolve(profile);
    assert.ok(testProfile.startsWith(tempRoot + sep) &&
      testProfile.slice(tempRoot.length + 1).startsWith("album-qa-"),
    "Refusing to remove a profile outside the test temp directory");
    await rm(testProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
