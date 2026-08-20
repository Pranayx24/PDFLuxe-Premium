(() => {
  "use strict";

  let pdfDocument = null;
  let currentPage = 1;
  let totalPages = 0;
  let currentFile = null;
  let renderToken = 0;

  const $ = (selector) =>
    document.querySelector(selector);

  function getElements() {
    return {
      preview: $("#documentPreview"),
      canvas: $("#previewCanvas"),
      loading: $("#previewLoading"),
      fileName: $("#previewFileName"),
      pageCount: $("#previewPageCount"),
      currentPage: $("#previewCurrentPage"),
      prev: $("#previewPrev"),
      next: $("#previewNext"),
      prevBottom: $("#previewPrevBottom"),
      nextBottom: $("#previewNextBottom"),
      thumbnails: $("#previewThumbnails")
    };
  }

  function hidePreview() {
    const elements = getElements();

    if (!elements.preview) return;

    elements.preview.hidden = true;

    pdfDocument = null;
    currentFile = null;
    currentPage = 1;
    totalPages = 0;
  }

  function showPreview() {
    const elements = getElements();

    if (!elements.preview) return;

    elements.preview.hidden = false;
  }

  function updateControls() {
    const elements = getElements();

    if (!elements.preview) return;

    elements.currentPage.textContent =
      `Page ${currentPage} of ${totalPages}`;

    elements.pageCount.textContent =
      `${totalPages} page${totalPages === 1 ? "" : "s"}`;

    const atFirst =
      currentPage <= 1;

    const atLast =
      currentPage >= totalPages;

    elements.prev.disabled = atFirst;
    elements.prevBottom.disabled = atFirst;

    elements.next.disabled = atLast;
    elements.nextBottom.disabled = atLast;

    elements.loading.style.display =
      "none";

    document
      .querySelectorAll(".preview-thumbnail")
      .forEach((thumbnail, index) => {
        thumbnail.classList.toggle(
          "active",
          index + 1 === currentPage
        );
      });
  }

  async function renderPage(pageNumber) {
    if (!pdfDocument) return;

    const elements = getElements();

    if (!elements.canvas) return;

    const token = ++renderToken;

    elements.loading.style.display =
      "block";

    const page =
      await pdfDocument.getPage(
        pageNumber
      );

    if (token !== renderToken) return;

    const viewport =
      page.getViewport({
        scale: 1.5
      });

    const canvas =
      elements.canvas;

    const context =
      canvas.getContext("2d");

    const containerWidth =
      elements.preview
        .querySelector(".preview-page")
        .clientWidth;

    const scale =
      Math.min(
        1.5,
        Math.max(
          0.6,
          (containerWidth - 20) /
            viewport.width
        )
      );

    const scaledViewport =
      page.getViewport({
        scale
      });

    canvas.width =
      Math.floor(
        scaledViewport.width
      );

    canvas.height =
      Math.floor(
        scaledViewport.height
      );

    canvas.style.width =
      `${scaledViewport.width}px`;

    canvas.style.height =
      `${scaledViewport.height}px`;

    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise;

    if (token !== renderToken) return;

    elements.loading.style.display =
      "none";

    updateControls();
  }

  async function createThumbnails() {
    const elements = getElements();

    if (!elements.thumbnails) return;

    elements.thumbnails.innerHTML = "";

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber++
    ) {

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "preview-thumbnail";

      button.setAttribute(
        "aria-label",
        `Preview page ${pageNumber}`
      );

      const thumbnailCanvas =
        document.createElement("canvas");

      button.appendChild(
        thumbnailCanvas
      );

      button.addEventListener(
        "click",
        () => {
          currentPage =
            pageNumber;

          renderPage(
            currentPage
          );
        }
      );

      elements.thumbnails.appendChild(
        button
      );

      try {

        const page =
          await pdfDocument.getPage(
            pageNumber
          );

        const viewport =
          page.getViewport({
            scale: 0.18
          });

        thumbnailCanvas.width =
          viewport.width;

        thumbnailCanvas.height =
          viewport.height;

        await page.render({
          canvasContext:
            thumbnailCanvas.getContext(
              "2d"
            ),
          viewport
        }).promise;

      } catch (error) {

        console.error(
          "Thumbnail error:",
          error
        );

      }
    }

    updateControls();
  }

  async function loadPreview(file) {
    if (!file) {
      hidePreview();
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return;
    }

    const elements = getElements();

    if (!elements.preview) {
      console.warn(
        "PDFLuxe preview elements not found."
      );
      return;
    }

    currentFile = file;

    currentPage = 1;

    totalPages = 0;

    pdfDocument = null;

    showPreview();

    elements.fileName.textContent =
      file.name;

    elements.pageCount.textContent =
      "Loading…";

    elements.currentPage.textContent =
      "Loading…";

    elements.loading.style.display =
      "block";

    elements.thumbnails.innerHTML =
      "";

    try {

      const arrayBuffer =
        await file.arrayBuffer();

      const loadingTask =
        window.pdfjsLib.getDocument({
          data: new Uint8Array(
            arrayBuffer
          )
        });

      pdfDocument =
        await loadingTask.promise;

      totalPages =
        pdfDocument.numPages;

      if (!totalPages) {
        throw new Error(
          "PDF contains no pages."
        );
      }

      updateControls();

      await renderPage(1);

      await createThumbnails();

    } catch (error) {

      console.error(
        "PDF preview error:",
        error
      );

      elements.loading.textContent =
        "Unable to preview this PDF.";

      elements.pageCount.textContent =
        "Preview unavailable";

      elements.currentPage.textContent =
        "";

      showToast(
        "PDF preview could not be loaded."
      );
    }
  }

  function previousPage() {
    if (
      !pdfDocument ||
      currentPage <= 1
    ) {
      return;
    }

    currentPage--;

    renderPage(
      currentPage
    );
  }

  function nextPage() {
    if (
      !pdfDocument ||
      currentPage >= totalPages
    ) {
      return;
    }

    currentPage++;

    renderPage(
      currentPage
    );
  }

  function clearPreview() {
    hidePreview();

    const elements =
      getElements();

    if (!elements.canvas) return;

    const context =
      elements.canvas.getContext(
        "2d"
      );

    context.clearRect(
      0,
      0,
      elements.canvas.width,
      elements.canvas.height
    );

    elements.thumbnails.innerHTML =
      "";
  }

  function watchFileList() {
    const fileList =
      $("#fileList");

    if (!fileList) return;

    const observer =
      new MutationObserver(() => {

        const files =
          window.__pdfLuxeSelectedFiles ||
          [];

        if (
          files.length === 0
        ) {
          clearPreview();
        }

      });

    observer.observe(
      fileList,
      {
        childList: true,
        subtree: true
      }
    );
  }

  function hookIntoFileInput() {
    const fileInput =
      $("#fileInput");

    if (!fileInput) return;

    fileInput.addEventListener(
      "change",
      () => {

        const file =
          fileInput.files?.[0];

        if (file) {
          loadPreview(file);
        }

      }
    );
  }

  function hookButtons() {
    const elements =
      getElements();

    if (
      !elements.prev ||
      !elements.next
    ) {
      return;
    }

    elements.prev.addEventListener(
      "click",
      previousPage
    );

    elements.next.addEventListener(
      "click",
      nextPage
    );

    elements.prevBottom.addEventListener(
      "click",
      previousPage
    );

    elements.nextBottom.addEventListener(
      "click",
      nextPage
    );

    document.addEventListener(
      "keydown",
      event => {

        if (
          !pdfDocument ||
          elements.preview.hidden
        ) {
          return;
        }

        if (
          event.key === "ArrowLeft"
        ) {
          previousPage();
        }

        if (
          event.key === "ArrowRight"
        ) {
          nextPage();
        }

      }
    );
  }

  function initialize() {
    const elements =
      getElements();

    if (!elements.preview) {
      return;
    }

    hidePreview();

    hookButtons();

    hookIntoFileInput();

    watchFileList();
  }

  /*
   * Public API
   */

  window.PDFLuxePreview = {
    load: loadPreview,
    clear: clearPreview,
    next: nextPage,
    previous: previousPage
  };

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );

  } else {

    initialize();

  }

})();
