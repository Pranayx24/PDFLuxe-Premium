(() => {
  "use strict";

  /*
   * =========================================================
   * PDFLUXE PREMIUM — PDF PREVIEW ENGINE
   * =========================================================
   *
   * Requires:
   *   - PDF.js loaded as window.pdfjsLib
   *   - index.html preview elements
   *
   * Public API:
   *   PDFLuxePreview.open(file)
   *   PDFLuxePreview.load(file)
   *   PDFLuxePreview.clear()
   *   PDFLuxePreview.next()
   *   PDFLuxePreview.previous()
   *   PDFLuxePreview.goToPage(number)
   */

  let pdfDocument = null;
  let currentFile = null;
  let currentPage = 1;
  let totalPages = 0;

  let renderToken = 0;
  let thumbnailToken = 0;

  let initialized = false;
  let keyboardHandlerAttached = false;

  const $ = selector =>
    document.querySelector(selector);

  /* ---------------------------------------------------------
     ELEMENTS
  --------------------------------------------------------- */

  function getElements() {

    return {

      preview:
        $("#documentPreview"),

      canvas:
        $("#previewCanvas"),

      loading:
        $("#previewLoading"),

      fileName:
        $("#previewFileName"),

      pageCount:
        $("#previewPageCount"),

      currentPage:
        $("#previewCurrentPage"),

      prev:
        $("#previewPrev"),

      next:
        $("#previewNext"),

      prevBottom:
        $("#previewPrevBottom"),

      nextBottom:
        $("#previewNextBottom"),

      thumbnails:
        $("#previewThumbnails"),

      pageContainer:
        document.querySelector(
          ".preview-page"
        )

    };

  }

  /* ---------------------------------------------------------
     PDF.JS CHECK
  --------------------------------------------------------- */

  function pdfJsAvailable() {

    return (
      window.pdfjsLib &&
      typeof window.pdfjsLib.getDocument ===
        "function"
    );

  }

  /* ---------------------------------------------------------
     PREVIEW VISIBILITY
  --------------------------------------------------------- */

  function showPreview() {

    const elements =
      getElements();

    if (!elements.preview) {
      return;
    }

    elements.preview.hidden =
      false;

  }

  function hidePreview() {

    const elements =
      getElements();

    if (!elements.preview) {
      return;
    }

    elements.preview.hidden =
      true;

  }

  /* ---------------------------------------------------------
     RESET STATE
  --------------------------------------------------------- */

  function resetState() {

    renderToken++;

    thumbnailToken++;

    pdfDocument = null;

    currentFile = null;

    currentPage = 1;

    totalPages = 0;

  }

  /* ---------------------------------------------------------
     CLEAR CANVAS
  --------------------------------------------------------- */

  function clearCanvas() {

    const elements =
      getElements();

    if (!elements.canvas) {
      return;
    }

    const canvas =
      elements.canvas;

    const context =
      canvas.getContext(
        "2d"
      );

    if (context) {

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

    }

    canvas.width = 0;
    canvas.height = 0;

    canvas.style.width = "";
    canvas.style.height = "";

  }

  /* ---------------------------------------------------------
     CLEAR PREVIEW
  --------------------------------------------------------- */

  function clearPreview() {

    resetState();

    hidePreview();

    clearCanvas();

    const elements =
      getElements();

    if (elements.fileName) {

      elements.fileName.textContent =
        "";

    }

    if (elements.pageCount) {

      elements.pageCount.textContent =
        "";

    }

    if (elements.currentPage) {

      elements.currentPage.textContent =
        "";

    }

    if (elements.loading) {

      elements.loading.textContent =
        "";

      elements.loading.style.display =
        "none";

    }

    if (elements.thumbnails) {

      elements.thumbnails.innerHTML =
        "";

    }

  }

  /* ---------------------------------------------------------
     LOADING STATE
  --------------------------------------------------------- */

  function setLoading(
    message = "Loading PDF…"
  ) {

    const elements =
      getElements();

    if (!elements.loading) {
      return;
    }

    elements.loading.textContent =
      message;

    elements.loading.style.display =
      "block";

  }

  function hideLoading() {

    const elements =
      getElements();

    if (!elements.loading) {
      return;
    }

    elements.loading.style.display =
      "none";

  }

  /* ---------------------------------------------------------
     CONTROL STATE
  --------------------------------------------------------- */

  function updateControls() {

    const elements =
      getElements();

    if (!elements.preview) {
      return;
    }

    const hasPDF =
      Boolean(
        pdfDocument &&
        totalPages
      );

    if (elements.pageCount) {

      elements.pageCount.textContent =
        hasPDF
          ? `${totalPages} page${
              totalPages === 1
                ? ""
                : "s"
            }`
          : "";

    }

    if (elements.currentPage) {

      elements.currentPage.textContent =
        hasPDF
          ? `Page ${currentPage} of ${totalPages}`
          : "";

    }

    const atFirst =
      !hasPDF ||
      currentPage <= 1;

    const atLast =
      !hasPDF ||
      currentPage >= totalPages;

    [
      elements.prev,
      elements.prevBottom
    ].forEach(button => {

      if (button) {
        button.disabled =
          atFirst;
      }

    });

    [
      elements.next,
      elements.nextBottom
    ].forEach(button => {

      if (button) {
        button.disabled =
          atLast;
      }

    });

    if (elements.thumbnails) {

      elements.thumbnails
        .querySelectorAll(
          ".preview-thumbnail"
        )
        .forEach(
          (
            thumbnail,
            index
          ) => {

            thumbnail.classList.toggle(
              "active",
              index + 1 ===
                currentPage
            );

          }
        );

    }

  }

  /* ---------------------------------------------------------
     PAGE DIMENSIONS
  --------------------------------------------------------- */

  function getRenderScale(
    viewport
  ) {

    const elements =
      getElements();

    const container =
      elements.pageContainer ||
      elements.preview;

    if (!container) {

      return 1.2;

    }

    const availableWidth =
      Math.max(
        240,
        container.clientWidth - 24
      );

    const fitScale =
      availableWidth /
      viewport.width;

    return Math.min(
      1.6,
      Math.max(
        0.6,
        fitScale
      )
    );

  }

  /* ---------------------------------------------------------
     RENDER CURRENT PAGE
  --------------------------------------------------------- */

  async function renderPage(
    pageNumber
  ) {

    if (
      !pdfDocument ||
      !totalPages
    ) {
      return;
    }

    if (
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      return;
    }

    const elements =
      getElements();

    if (!elements.canvas) {
      return;
    }

    const token =
      ++renderToken;

    currentPage =
      pageNumber;

    setLoading(
      "Rendering page…"
    );

    updateControls();

    try {

      const page =
        await pdfDocument.getPage(
          pageNumber
        );

      if (
        token !== renderToken
      ) {
        return;
      }

      const baseViewport =
        page.getViewport({
          scale: 1
        });

      const scale =
        getRenderScale(
          baseViewport
        );

      const viewport =
        page.getViewport({
          scale
        });

      const canvas =
        elements.canvas;

      const context =
        canvas.getContext(
          "2d",
          {
            alpha: false
          }
        );

      if (!context) {
        throw new Error(
          "Canvas rendering is unavailable."
        );
      }

      /*
       * Retina / high-DPI support.
       */

      const devicePixelRatio =
        Math.min(
          window.devicePixelRatio ||
            1,
          2
        );

      canvas.width =
        Math.floor(
          viewport.width *
            devicePixelRatio
        );

      canvas.height =
        Math.floor(
          viewport.height *
            devicePixelRatio
        );

      canvas.style.width =
        `${Math.floor(
          viewport.width
        )}px`;

      canvas.style.height =
        `${Math.floor(
          viewport.height
        )}px`;

      context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
      );

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        viewport.width,
        viewport.height
      );

      await page.render({
        canvasContext:
          context,
        viewport
      }).promise;

      if (
        token !== renderToken
      ) {
        return;
      }

      hideLoading();

      updateControls();

    } catch (error) {

      if (
        token !== renderToken
      ) {
        return;
      }

      console.error(
        "PDFLuxe page render error:",
        error
      );

      setLoading(
        "Unable to render this page."
      );

    }

  }

  /* ---------------------------------------------------------
     THUMBNAILS
  --------------------------------------------------------- */

  async function createThumbnails() {

    if (
      !pdfDocument ||
      !totalPages
    ) {
      return;
    }

    const elements =
      getElements();

    if (!elements.thumbnails) {
      return;
    }

    const token =
      ++thumbnailToken;

    elements.thumbnails.innerHTML =
      "";

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber++
    ) {

      if (
        token !== thumbnailToken
      ) {
        return;
      }

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "preview-thumbnail";

      button.dataset.page =
        String(
          pageNumber
        );

      button.setAttribute(
        "aria-label",
        `Preview page ${pageNumber}`
      );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.setAttribute(
        "aria-hidden",
        "true"
      );

      button.appendChild(
        canvas
      );

      button.addEventListener(
        "click",
        () => {

          goToPage(
            pageNumber
          );

        }
      );

      elements.thumbnails
        .appendChild(
          button
        );

      try {

        const page =
          await pdfDocument.getPage(
            pageNumber
          );

        if (
          token !== thumbnailToken
        ) {
          return;
        }

        const viewport =
          page.getViewport({
            scale: 0.18
          });

        const ratio =
          Math.min(
            window.devicePixelRatio ||
              1,
            2
          );

        canvas.width =
          Math.floor(
            viewport.width *
              ratio
          );

        canvas.height =
          Math.floor(
            viewport.height *
              ratio
          );

        canvas.style.width =
          `${viewport.width}px`;

        canvas.style.height =
          `${viewport.height}px`;

        const context =
          canvas.getContext(
            "2d"
          );

        if (!context) {
          continue;
        }

        context.setTransform(
          ratio,
          0,
          0,
          ratio,
          0,
          0
        );

        await page.render({
          canvasContext:
            context,
          viewport
        }).promise;

      } catch (error) {

        console.warn(
          `Thumbnail ${pageNumber} failed:`,
          error
        );

      }

    }

    updateControls();

  }

  /* ---------------------------------------------------------
     LOAD PDF
  --------------------------------------------------------- */

  async function loadPreview(
    file
  ) {

    if (!file) {
      clearPreview();
      return;
    }

    const isPDF =
      file.type ===
        "application/pdf" ||
      file.name
        ?.toLowerCase()
        .endsWith(".pdf");

    if (!isPDF) {

      if (
        typeof window.PDFLuxe
          ?.showToast ===
        "function"
      ) {

        window.PDFLuxe.showToast(
          "Please choose a PDF file."
        );

      }

      return;

    }

    if (!pdfJsAvailable()) {

      console.error(
        "PDFLuxe: PDF.js is not loaded."
      );

      const elements =
        getElements();

      if (elements.loading) {

        elements.loading.textContent =
          "PDF preview engine unavailable.";

        elements.loading.style.display =
          "block";

      }

      return;

    }

    const elements =
      getElements();

    if (!elements.preview) {

      console.warn(
        "PDFLuxe: #documentPreview not found."
      );

      return;

    }

    /*
     * Cancel previous render work.
     */

    renderToken++;

    thumbnailToken++;

    pdfDocument = null;

    currentFile =
      file;

    currentPage =
      1;

    totalPages =
      0;

    showPreview();

    setLoading(
      "Loading PDF…"
    );

    if (elements.fileName) {

      elements.fileName.textContent =
        file.name;

    }

    if (elements.pageCount) {

      elements.pageCount.textContent =
        "Loading…";

    }

    if (elements.currentPage) {

      elements.currentPage.textContent =
        "Loading…";

    }

    if (elements.thumbnails) {

      elements.thumbnails.innerHTML =
        "";

    }

    clearCanvas();

    try {

      const arrayBuffer =
        await file.arrayBuffer();

      const loadingTask =
        window.pdfjsLib.getDocument({
          data:
            new Uint8Array(
              arrayBuffer
            )
        });

      const documentProxy =
        await loadingTask.promise;

      /*
       * Make sure another PDF wasn't
       * selected while this one loaded.
       */

      if (
        currentFile !== file
      ) {

        try {
          await documentProxy.destroy();
        } catch (_) {}

        return;

      }

      pdfDocument =
        documentProxy;

      totalPages =
        pdfDocument.numPages;

      if (
        !totalPages
      ) {

        throw new Error(
          "PDF contains no pages."
        );

      }

      currentPage =
        1;

      updateControls();

      await renderPage(
        1
      );

      /*
       * Create thumbnails after
       * the main page is visible.
       */

      await createThumbnails();

    } catch (error) {

      console.error(
        "PDFLuxe preview error:",
        error
      );

      pdfDocument =
        null;

      totalPages =
        0;

      if (elements.loading) {

        elements.loading.textContent =
          "Unable to preview this PDF.";

        elements.loading.style.display =
          "block";

      }

      if (elements.pageCount) {

        elements.pageCount.textContent =
          "Preview unavailable";

      }

      if (elements.currentPage) {

        elements.currentPage.textContent =
          "";

      }

      if (
        typeof window.PDFLuxe
          ?.showToast ===
        "function"
      ) {

        window.PDFLuxe.showToast(
          "PDF preview could not be loaded."
        );

      }

    }

  }

  /* ---------------------------------------------------------
     PAGE NAVIGATION
  --------------------------------------------------------- */

  function goToPage(
    pageNumber
  ) {

    if (
      !pdfDocument ||
      !totalPages
    ) {
      return;
    }

    const target =
      Number(
        pageNumber
      );

    if (
      !Number.isFinite(
        target
      )
    ) {
      return;
    }

    const page =
      Math.min(
        totalPages,
        Math.max(
          1,
          Math.floor(
            target
          )
        )
      );

    currentPage =
      page;

    renderPage(
      currentPage
    );

    updateControls();

  }

  function previousPage() {

    if (
      !pdfDocument ||
      currentPage <= 1
    ) {
      return;
    }

    goToPage(
      currentPage - 1
    );

  }

  function nextPage() {

    if (
      !pdfDocument ||
      currentPage >= totalPages
    ) {
      return;
    }

    goToPage(
      currentPage + 1
    );

  }

  /* ---------------------------------------------------------
     BUTTONS
  --------------------------------------------------------- */

  function hookButtons() {

    const elements =
      getElements();

    if (elements.prev) {

      elements.prev.addEventListener(
        "click",
        previousPage
      );

    }

    if (elements.next) {

      elements.next.addEventListener(
        "click",
        nextPage
      );

    }

    if (elements.prevBottom) {

      elements.prevBottom.addEventListener(
        "click",
        previousPage
      );

    }

    if (elements.nextBottom) {

      elements.nextBottom.addEventListener(
        "click",
        nextPage
      );

    }

  }

  /* ---------------------------------------------------------
     KEYBOARD NAVIGATION
  --------------------------------------------------------- */

  function hookKeyboard() {

    if (
      keyboardHandlerAttached
    ) {
      return;
    }

    keyboardHandlerAttached =
      true;

    document.addEventListener(
      "keydown",
      event => {

        if (
          !pdfDocument
        ) {
          return;
        }

        const elements =
          getElements();

        if (
          !elements.preview ||
          elements.preview.hidden
        ) {
          return;
        }

        /*
         * Don't hijack keyboard controls
         * while typing into an input.
         */

        const active =
          document.activeElement;

        const tag =
          active?.tagName;

        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT"
        ) {
          return;
        }

        if (
          event.key ===
          "ArrowLeft"
        ) {

          event.preventDefault();

          previousPage();

        }

        if (
          event.key ===
          "ArrowRight"
        ) {

          event.preventDefault();

          nextPage();

        }

        if (
          event.key ===
          "Home"
        ) {

          event.preventDefault();

          goToPage(
            1
          );

        }

        if (
          event.key ===
          "End"
        ) {

          event.preventDefault();

          goToPage(
            totalPages
          );

        }

      }
    );

  }

  /* ---------------------------------------------------------
     RESPONSIVE RERENDER
  --------------------------------------------------------- */

  function hookResize() {

    let timer = null;

    window.addEventListener(
      "resize",
      () => {

        clearTimeout(
          timer
        );

        timer =
          setTimeout(
            () => {

              if (
                pdfDocument &&
                currentPage
              ) {

                renderPage(
                  currentPage
                );

              }

            },
            180
          );

      }
    );

  }

  /* ---------------------------------------------------------
     FILE INPUT FALLBACK
  --------------------------------------------------------- */

  function hookFileInput() {

    const fileInput =
      $("#fileInput");

    if (!fileInput) {
      return;
    }

    fileInput.addEventListener(
      "change",
      event => {

        const file =
          event.target
            ?.files?.[0];

        if (file) {

          loadPreview(
            file
          );

        }

      }
    );

  }

  /* ---------------------------------------------------------
     INITIALIZATION
  --------------------------------------------------------- */

  function initialize() {

    if (initialized) {
      return;
    }

    initialized =
      true;

    const elements =
      getElements();

    if (!elements.preview) {

      console.warn(
        "PDFLuxe: Preview UI not found. Preview engine waiting for #documentPreview."
      );

      return;

    }

    hidePreview();

    hookButtons();

    hookKeyboard();

    hookResize();

    /*
     * This fallback allows the preview
     * to work even if app.js is changed.
     */

    hookFileInput();

  }

  /* ---------------------------------------------------------
     PUBLIC API
  --------------------------------------------------------- */

  window.PDFLuxePreview = {

    open:
      loadPreview,

    load:
      loadPreview,

    clear:
      clearPreview,

    next:
      nextPage,

    previous:
      previousPage,

    goToPage,

    getCurrentPage:
      () =>
        currentPage,

    getTotalPages:
      () =>
        totalPages,

    getCurrentFile:
      () =>
        currentFile

  };

  /* ---------------------------------------------------------
     START
  --------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );

  } else {

    initialize();

  }

})();
