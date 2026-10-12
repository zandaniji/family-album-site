/* Register a planar PageFlip sheet to the asymmetric paper in the album photo.
   Layout stays in its original canvas; folding uses the visible sheet widths. */
(() => {
  "use strict";
  const leaves = new WeakMap();
  const clamp = value => Math.max(0, Math.min(1, value));
  function leafFor(page) {
    if (!leaves.has(page)) {
      const leaf = document.createElement("div");
      leaf.className = "album-leaf";
      leaf.append(page);
      leaves.set(page, leaf);
    }
    return leaves.get(page);
  }
  function register(flip) {
    const leftInset = Number(getComputedStyle(flip.getUI().getDistElement())
      .getPropertyValue("--album-left-paper-inset").trim());
    const controller = flip.getFlipController();
    const render = flip.getRender();
    const baseRect = render.getRect.bind(render);
    const drawFold = controller.do.bind(controller);
    let foldRect = null;
    let drawingStatic = false;
    const inLayout = callback => {
      const previous = drawingStatic;
      drawingStatic = true;
      try { return callback(); } finally { drawingStatic = previous; }
    };
    const widths = direction => {
      const width = baseRect().pageWidth;
      const left = width * (1 - leftInset);
      return direction === 1 ? { source: left, target: width } : { source: width, target: left };
    };
    const surface = page => page?.getElement().querySelector(".album-page");
    const restoreLayout = page => {
      const content = surface(page);
      if (content) {
        content.style.removeProperty("width");
        content.style.removeProperty("left");
        content.style.removeProperty("transform");
      }
    };

    // Keep the spine fixed, even though the two photographed leaves have
    // different apparent widths. Static pages always use their original layout.
    render.getRect = () => drawingStatic || !foldRect ? baseRect() : foldRect;
    controller.getBoundsRect = baseRect;
    render.convertToBook = point => {
      const bounds = baseRect();
      return { x: point.x - bounds.left, y: point.y - bounds.top };
    };
    // Inverse of x = (1 - 2p) * physicalWidth(p). The same mapping handles
    // hover, drag and release, including the unequal widths across the spine.
    render.convertToPage = (point, direction = render.getDirection()) => {
      const bounds = baseRect();
      const { source, target } = widths(direction);
      const distance = (direction === 1 ? -1 : 1) * (point.x - bounds.left - bounds.pageWidth);
      let low = 0, high = 1;
      for (let step = 0; step < 28; step += 1) {
        const progress = (low + high) / 2;
        const x = (1 - 2 * progress) * (source + (target - source) * progress);
        if (x > distance) low = progress; else high = progress;
      }
      return { x: bounds.pageWidth * (1 - low - high), y: point.y - bounds.top };
    };
    controller.do = point => {
      const calculation = controller.getCalculation();
      if (!calculation) return;
      const bounds = baseRect();
      const progress = clamp((bounds.pageWidth - point.x) / (2 * bounds.pageWidth));
      const { source, target } = widths(calculation.getDirection());
      const width = source + (target - source) * progress;
      foldRect = { ...bounds, left: bounds.left + bounds.pageWidth - width, width: 2 * width, pageWidth: width };
      calculation.pageWidth = width;
      calculation.pageHeight = bounds.height;
      drawFold({ x: point.x * width / bounds.pageWidth, y: point.y });
      const page = controller.flippingPage;
      const content = surface(page);
      if (!content) return;
      // The back face is registered to the destination leaf. Scale the whole
      // surface (photos, paper and text together), never just its paper mask.
      const scale = width / target;
      content.style.width = `${bounds.pageWidth}px`;
      content.style.left = `${calculation.getDirection() === 0 ? -bounds.pageWidth * leftInset * scale : 0}px`;
      content.style.transform = `scaleX(${scale})`;
    };

    for (const [method, field] of [["drawLeftPage", "leftPage"], ["drawRightPage", "rightPage"]]) {
      const draw = render[method].bind(render);
      render[method] = () => inLayout(() => { restoreLayout(render[field]); draw(); });
    }
    // The revealed page underneath a fold must keep its resting coordinates.
    // Only its clipping polygon follows the physical fold calculation.
    render.drawBottomPage = () => {
      const page = render.bottomPage;
      if (!page) return;
      const bounds = baseRect();
      const backward = render.getDirection() === 1;
      const pageLeft = bounds.left + (backward ? 0 : bounds.pageWidth);
      const points = page.state.area.filter(Boolean).map(point => {
        const global = render.convertToGlobal(point);
        return `${global.x - pageLeft}px ${global.y - bounds.top}px`;
      });
      inLayout(() => { restoreLayout(page); page.simpleDraw(backward ? 0 : 1); });
      const element = page.getElement();
      element.style.zIndex = String(flip.getSettings().startZIndex + 3);
      element.style.clipPath = `polygon(${points.join(",")})`;
    };

    const cornerPoint = (direction, corner) => {
      const bounds = baseRect();
      const left = direction === 1;
      const content = flip.getPageCollection().getPages().map(surface)
        .find(page => page.classList.contains(left ? "album-page-left" : "album-page-right"));
      const polygon = getComputedStyle(content.querySelector(".page-material")).clipPath;
      const vertices = polygon.slice(polygon.indexOf("(") + 1, -1).split(",");
      const vertex = vertices[corner === "top" ? (left ? 0 : 1) : 4].trim().split(/\s+/);
      const coordinate = (value, size) => parseFloat(value) * (value.endsWith("%") ? size / 100 : 1);
      // Follow the actual irregular paper corner, not the canvas rectangle.
      return { x: bounds.left + (left ? 0 : bounds.pageWidth) + coordinate(vertex[0], bounds.pageWidth) + (left ? 1 : -1),
        y: bounds.top + coordinate(vertex[1], bounds.height) + (corner === "top" ? 1 : -1) };
    };
    controller.isPointOnCorners = point => {
      const bounds = baseRect();
      const spine = bounds.left + bounds.pageWidth;
      const direction = point.x < spine ? 1 : 0;
      const { source } = widths(direction);
      const distance = Math.abs(point.x - spine);
      const y = point.y - bounds.top;
      const radius = Math.min(60, source * 0.18);
      return distance <= source && distance >= source - radius && y > 0 && y < bounds.height &&
        (y < radius || y > bounds.height - radius);
    };
    controller.flip = point => {
      if (flip.getSettings().disableFlipByClick && !controller.isPointOnCorners(point)) return;
      if (controller.getCalculation()) render.finishAnimation();
      if (!controller.start(point)) return;
      const bounds = baseRect();
      const bottom = controller.getCalculation().getCorner() === "bottom";
      const edgeY = bottom ? bounds.height : 0;
      const start = render.convertToPage(point);
      controller.setState("flipping");
      controller.do(start);
      controller.animateFlippingTo(start, { x: -bounds.pageWidth, y: edgeY }, true);
    };
    controller.flipPrev = (corner = "top") => controller.flip(cornerPoint(1, corner));
    controller.flipNext = (corner = "top") => controller.flip(cornerPoint(0, corner));
    controller.fold = point => {
      if (!controller.getCalculation()) {
        // The cover and stacked-paper strip are not draggable page corners.
        if (!controller.isPointOnCorners(flip.mousePosition || point) || !controller.start(flip.mousePosition || point)) return;
      }
      controller.setState("user_fold");
      controller.do(render.convertToPage(point));
    };
    controller.stopMove = () => {
      const calculation = controller.getCalculation();
      if (!calculation) return;
      const bounds = baseRect();
      const position = calculation.getPosition();
      const start = { x: position.x * bounds.pageWidth / calculation.pageWidth, y: position.y };
      const completed = start.x <= 0;
      controller.animateFlippingTo(start, { x: completed ? -bounds.pageWidth : bounds.pageWidth,
        y: calculation.getCorner() === "bottom" ? bounds.height : 0 }, completed);
    };
    controller.showCorner = point => {
      if (!controller.checkState("read", "fold_corner")) return;
      if (controller.isPointOnCorners(point)) {
        if (!controller.getCalculation()) {
          if (!controller.start(point)) return;
          const bounds = baseRect();
          const bottom = controller.getCalculation().getCorner() === "bottom";
          const lift = Math.min(32, bounds.pageWidth * 0.06);
          const start = render.convertToPage(cornerPoint(controller.getCalculation().getDirection(), bottom ? "bottom" : "top"));
          controller.setState("fold_corner");
          controller.do(start);
          controller.animateFlippingTo(start, { x: start.x - lift, y: start.y + (bottom ? -lift : lift) }, false, false);
        } else controller.do(render.convertToPage(point));
      } else if (controller.getCalculation()) {
        render.finishAnimation();
        controller.stopMove();
      }
    };
    flip.on("changeState", event => {
      if (event.data !== "read") return;
      foldRect = null;
      for (const page of flip.getPageCollection().getPages()) restoreLayout(page);
    });
    const updatePages = flip.updateFromHtml.bind(flip);
    flip.updateFromHtml = pages => {
      // A route edit can arrive while a hover corner is still unfolding.
      render.finishAnimation();
      render.setBottomPage(null);
      render.setFlippingPage(null);
      render.clearShadow();
      foldRect = null;
      for (const page of flip.getPageCollection().getPages()) restoreLayout(page);
      controller.reset();
      controller.setState("read");
      updatePages(pages);
    };
  }
  window.AlbumPaper = { leafFor, register };
})();
