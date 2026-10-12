/* A fitted paper diagram. Coordinates and photo sizes remain in world units;
   the view handles fit, zoom, bounded panning, and resize independently.
   maxScale caps the fitted scale, so a portrait is never drawn larger than the
   album's photo size; zoom is offered only when the fit had to shrink it. */
(() => {
  "use strict";
  function create(viewport, canvas, controls, isBusy, { maxScale = () => Infinity } = {}) {
    canvas.classList.add("diagram-canvas");
    viewport.classList.add("diagram-viewport");
    viewport.tabIndex = 0;
    let width = 100, height = 108, zoom = 1, fit = 1, x = 0, y = 0;
    let selected = 0, drag = null, suppressClick = false, lastSize = "";
    const animations = new Set();
    const info = document.createElement("span");
    info.className = "diagram-selection";
    info.setAttribute("aria-live", "polite");
    // Outside the controls, which hide when zooming would not help.
    controls.before(info);
    const buttons = {};
    for (const [action, label, english, text] of [
      ["out", "缩小", "Zoom out", "−"], ["fit", "全览", "View all", "全览"], ["in", "放大", "Zoom in", "+"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.diagramAction = action;
      button.setAttribute("aria-label", `${label} / ${english}`);
      button.title = `${label} / ${english}`;
      button.className = "ink-control";
      // The label sits in .bilingual-zh so it takes the shared ink underline.
      const glyph = document.createElement("span");
      glyph.className = "bilingual-zh";
      glyph.textContent = text;
      button.append(glyph);
      if (action === "fit") {
        const caption = document.createElement("small");
        caption.textContent = english;
        button.append(caption);
      }
      controls.append(button);
      buttons[action] = button;
      button.addEventListener("click", () => {
        if (isBusy()) return;
        if (action === "fit") setZoom(1);
        else setZoom(zoom * (action === "in" ? 1.6 : 1 / 1.6));
      });
    }
    const scale = () => fit * zoom;
    const maxZoom = () => Math.max(3, 90 / (22 * fit));
    // Zoom helps only once fitting has shrunk the photos below 80% of full size.
    const fullScale = () => Math.min(viewport.clientWidth / 100, maxScale());
    const zoomable = () => fit < fullScale() * 0.8;
    function draw() {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      if (!w || !h) return;
      const sw = width * scale(), sh = height * scale();
      x = sw <= w ? (w - sw) / 2 : Math.max(w - sw - 8, Math.min(8, x));
      y = sh <= h ? (h - sh) / 2 : Math.max(h - sh - 8, Math.min(8, y));
      canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale()})`;
      canvas.dataset.scale = String(scale());
      viewport.dataset.zoom = String(zoom);
      viewport.classList.toggle("is-zoomed", zoom > 1.001);
      buttons.out.disabled = zoom <= 1.001;
      buttons.in.disabled = zoom >= maxZoom() - 0.001;
      buttons.fit.setAttribute("aria-pressed", String(zoom <= 1.001));
      controls.hidden = zoom <= 1.001 && !zoomable();
    }
    function focusSelected() {
      if (zoom <= 1.001) return;
      const person = canvas.querySelector(`[data-step="${selected}"]`);
      if (!person) return;
      x = viewport.clientWidth / 2 - (person.offsetLeft + person.offsetWidth / 2) * scale();
      y = viewport.clientHeight / 2 - (person.offsetTop + person.offsetHeight / 2) * scale();
      draw();
    }
    function setZoom(next) {
      const old = scale();
      const w = viewport.clientWidth, h = viewport.clientHeight;
      const fromOverview = zoom <= 1.001;
      if (fromOverview && next > 1 && !zoomable()) return;
      zoom = Math.max(1, Math.min(maxZoom(), next));
      x = w / 2 - (w / 2 - x) * scale() / old;
      y = h / 2 - (h / 2 - y) * scale() / old;
      draw();
      if (fromOverview && zoom > 1) focusSelected();
    }
    function resize() {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      if (!w || !h) return;
      const size = `${w}:${h}`;
      if (size === lastSize) return;
      lastSize = size;
      fit = Math.min((w - 16) / width, (h - 16) / height, w / 100, maxScale());
      draw();
      focusSelected();
    }
    function select(index, center = false) {
      selected = index;
      const person = canvas.querySelector(`[data-step="${index}"]`);
      const zh = person?.querySelector('.chain-person-name .bilingual-zh')?.textContent || "我";
      const en = person?.querySelector('.chain-person-name .bilingual-en')?.textContent || "Me";
      info.replaceChildren();
      const name = document.createElement("span"), translation = document.createElement("small");
      // Read aloud only (the readout is visually hidden): the name, not a step number.
      name.textContent = zh;
      translation.textContent = en;
      info.append(name, translation);
      canvas.querySelectorAll(".chain-person").forEach(node => node.classList.toggle("is-inspected", Number(node.dataset.step) === index));
      if (center) focusSelected();
    }
    function update(nextWidth, nextHeight, before = null) {
      width = nextWidth; height = nextHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      lastSize = "";
      resize();
      select(selected);
      if (!before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      for (const [person, old] of before) {
        if (!person.isConnected || !old.width) continue;
        const rect = person.getBoundingClientRect();
        if (!rect.width) continue;
        const dx = (old.x - rect.x) / scale(), dy = (old.y - rect.y) / scale();
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(old.width - rect.width) < 0.5) continue;
        const angle = person.style.getPropertyValue("--chain-angle");
        const animation = person.animate([
          { transform: `translate(${dx}px, ${dy}px) rotate(${angle}) scale(${old.width / rect.width})` },
          { transform: `rotate(${angle})` },
        ], { duration: 220, easing: "ease-out" });
        animations.add(animation);
        animation.finished.catch(() => {}).finally(() => animations.delete(animation));
      }
    }
    for (const target of [viewport, controls]) {
      for (const type of ["pointerdown", "mousedown", "touchstart", "touchmove"]) {
        target.addEventListener(type, event => event.stopPropagation(), { passive: true });
      }
    }
    controls.addEventListener("click", event => event.stopPropagation());
    viewport.addEventListener("pointerdown", event => {
      // Every click follows its own press, so a new press ends the last pan's
      // click guard even when a throttled timer has not cleared it yet.
      suppressClick = false;
      // A portrait has its own return-to-page gesture, even while zoomed.
      if (zoom <= 1.001 || isBusy() || event.button !== 0 || event.target.closest("button.chain-person")) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: x, top: y, moved: false };
    });
    viewport.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-panning");
      event.preventDefault();
      x = drag.left + dx; y = drag.top + dy;
      draw();
    });
    const endDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      suppressClick = drag.moved;
      drag = null;
      viewport.classList.remove("is-panning");
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      setTimeout(() => { suppressClick = false; }, 0);
    };
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("click", event => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    viewport.addEventListener("wheel", event => {
      event.preventDefault();
      if (zoom <= 1.001 || isBusy()) return;
      x -= event.deltaX; y -= event.deltaY;
      draw();
    }, { passive: false });
    viewport.addEventListener("keydown", event => {
      if (isBusy()) return;
      const directions = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] };
      if (directions[event.key]) {
        event.preventDefault(); event.stopPropagation();
        if (zoom > 1) { x += directions[event.key][0]; y += directions[event.key][1]; draw(); }
      } else if (["+", "=", "-", "Home"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        setZoom(event.key === "Home" ? 1 : zoom * (event.key === "-" ? 1 / 1.6 : 1.6));
      }
    });
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return {
      update, select, refresh: resize,
      snapshot: () => ({ zoom, x, y }),
      restore: state => { zoom = state?.zoom || 1; x = state?.x || 0; y = state?.y || 0; lastSize = ""; resize(); },
      overview: () => setZoom(1),
      settled: () => Promise.all([...animations].map(animation => animation.finished.catch(() => {}))),
      destroy: () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); },
    };
  }
  window.AlbumRelationshipView = { create };
})();
