/* =========================================================
   PDFLuxe Premium — PDF Preview Engine
   Page thumbnails + preview rendering
   ========================================================= */

(() => {
  "use strict";

  const PDFJS_VERSION = "4.4.168";

  // Load PDF.js dynamically
  const pdfjsScript = document.createElement("script");
  pdfjsScript.src =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
  pdfjsScript.type = "module";

  document.head.appendChild(pdfjsScript);

  let pdfjsLib = null;
  let currentPDF = null;
  let currentPage = 1;

  const state = {
    pages: [],
    selectedPage: null
  };

  /* ---------------------------------------------------------
     Wait for PDF.js
     --------------------------------------------------------- */

  async function loadPDFJS() {
    if (pdfjsLib) return pdfjsLib;

    try {
      pdfjsLib = await import(
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`
      );

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

      return pdfjsLib;
    } catch (error) {
      console.error(
        "PDFLuxe: Failed to load PDF.js",
        error
      );

      return null;
    }
  }

  /* ---------------------------------------------------------
     Create preview interface
     --------------------------------------------------------- */

  function createPreviewUI() {
    if (document.getElementById("pdfPreviewPanel")) {
      return;
    }

    const style = document.createElement("style");

    style.textContent = `
      /* PDF PREVIEW */

      #pdfPreviewPanel {
        display: none;
        margin-top: 18px;
        border: 1px solid #282830;
        border-radius: 18px;
        overflow: hidden;
        background:
          linear-gradient(
            145deg,
            rgba(255,255,255,0.045),
            rgba(255,255,255,0.012)
          );
        box-shadow: 0 25px 70px rgba(0,0,0,0.32);
      }

      #pdfPreviewPanel.visible {
        display: block;
        animation: pdfPreviewIn .3s ease;
      }

      @keyframes pdfPreviewIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .pdf-preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 17px;
        border-bottom: 1px solid #282830;
      }

      .pdf-preview-title {
        font-family: "Space Grotesk", sans-serif;
        font-size: 15px;
        font-weight: 700;
      }

      .pdf-preview-count {
        color: #9696a3;
        font-size: 11px;
      }

      .pdf-preview-body {
        display: grid;
        grid-template-columns: 150px 1fr;
        min-height: 390px;
      }

      .pdf-thumbnails {
        padding: 13px;
        border-right: 1px solid #282830;
        background: rgba(0,0,0,0.12);
        overflow-y: auto;
        max-height: 520px;
      }

      .pdf-thumbnail {
        position: relative;
        width: 100%;
        margin-bottom: 11px;
        padding: 5px;
        border: 1px solid #282830;
        border-radius: 9px;
        background: #0d0d12;
        cursor: pointer;
        transition: .2s ease;
      }

      .pdf-thumbnail:hover {
        border-color: #555560;
        transform: translateY(-1px);
      }

      .pdf-thumbnail.active {
        border-color: #f4c76b;
        box-shadow:
          0 0 0 1px rgba(244,199,107,.18),
          0 8px 25px rgba(244,199,107,.08);
      }

      .pdf-thumbnail canvas {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 5px;
        background: white;
      }

      .pdf-thumbnail-number {
        display: block;
        text-align: center;
        color: #9696a3;
        font-size: 10px;
        font-weight: 700;
        padding-top: 5px;
      }

      .pdf-preview-main {
        display: grid;
        place-items: center;
        padding: 22px;
        background:
          radial-gradient(
            circle at center,
            rgba(244,199,107,.045),
            transparent 60%
          );
        overflow: auto;
      }

      #pdfPreviewCanvas {
        display: block;
        max-width: 100%;
        height: auto;
        background: white;
        border-radius: 5px;
        box-shadow:
          0 20px 60px rgba(0,0,0,.5);
      }

      .pdf-preview-empty {
        color: #777783;
        text-align: center;
        font-size: 12px;
      }

      .pdf-preview-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .pdf-preview-action {
        border: 1px solid #282830;
        background: #17171d;
        color: #fafafa;
        border-radius: 9px;
        padding: 8px 11px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: .2s ease;
      }

      .pdf-preview-action:hover {
        border-color: #f4c76b;
        color: #f4c76b;
      }

      @media (max-width: 650px) {

        .pdf-preview-body {
          grid-template-columns: 1fr;
        }

        .pdf-thumbnails {
          display: flex;
          gap: 9px;
          overflow-x: auto;
          overflow-y: hidden;
          max-height: none;
          border-right: 0;
          border-bottom: 1px solid #282830;
        }

        .pdf-thumbnail {
          flex: 0 0 82px;
          margin-bottom: 0;
        }

        .pdf-preview-main {
          min-height: 330px;
          padding: 16px;
        }

      }
    `;

    document.head.appendChild(style);

    const panel = document.createElement("div");

    panel.id = "pdfPreviewPanel";

    panel.innerHTML = `
      <div class="pdf-preview-head">
        <div>
          <div class="pdf-preview-title">
            Document preview
          </div>

          <div
            class="pdf-preview-count"
            id="pdfPreviewCount"
          >
            0 pages
          </div>
        </div>
      </div>

      <div class="pdf-preview-body">

        <div
          class="pdf-thumbnails"
          id="pdfThumbnails"
        ></div>

        <div class="pdf-preview-main">

          <div>

            <canvas
              id="pdfPreviewCanvas"
            ></canvas>

            <div
              class="pdf-preview-empty"
              id="pdfPreviewEmpty"
              style="display:none;"
            >
              Select a page to preview
            </div>

            <div class="pdf-preview-actions">

              <button
                class="pdf-preview-action"
                id="pdfPrevPage"
              >
                ← Previous
              </button>

              <button
                class="pdf-preview-action"
                id="pdfNextPage"
              >
                Next →
              </button>

            </div>

          </div>

        </div>

      </div>
    `;

    const workspacePanel =
      document.querySelector(".panel");

    if (workspacePanel) {
      workspacePanel.appendChild(panel);
    }

    document
      .getElementById("pdfPrevPage")
      .addEventListener(
        "click",
        () => changePage(-1)
      );

    document
      .getElementById("pdfNextPage")
      .addEventListener(
        "click",
        () => changePage(1)
      );
  }

  /* ---------------------------------------------------------
     Render thumbnails
     --------------------------------------------------------- */

  async function renderThumbnails(pdf) {
    const thumbnails =
      document.getElementById("pdfThumbnails");

    thumbnails.innerHTML = "";

    state.pages = [];

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {

      const page =
        await pdf.getPage(pageNumber);

      const viewport =
        page.getViewport({
          scale: 0.22
        });

      const canvas =
        document.createElement("canvas");

      const context =
        canvas.getContext("2d");

      canvas.width =
        viewport.width;

      canvas.height =
        viewport.height;

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      const wrapper =
        document.createElement("div");

      wrapper.className =
        "pdf-thumbnail";

      wrapper.dataset.page =
        pageNumber;

      wrapper.innerHTML = `
        <span class="pdf-thumbnail-number">
          Page ${pageNumber}
        </span>
      `;

      wrapper.prepend(canvas);

      wrapper.addEventListener(
        "click",
        () => selectPage(pageNumber)
      );

      thumbnails.appendChild(wrapper);

      state.pages.push(pageNumber);
    }

    document
      .getElementById("pdfPreviewCount")
      .textContent =
      `${pdf.numPages} ${
        pdf.numPages === 1
          ? "page"
          : "pages"
      }`;

    selectPage(1);
  }

  /* ---------------------------------------------------------
     Preview selected page
     --------------------------------------------------------- */

  async function selectPage(pageNumber) {
    if (!currentPDF) return;

    if (
      pageNumber < 1 ||
      pageNumber > currentPDF.numPages
    ) {
      return;
    }

    currentPage = pageNumber;
    state.selectedPage = pageNumber;

    document
      .querySelectorAll(".pdf-thumbnail")
      .forEach(item => {

        item.classList.toggle(
          "active",
          Number(item.dataset.page) ===
            pageNumber
        );

      });

    const page =
      await currentPDF.getPage(pageNumber);

    const canvas =
      document.getElementById(
        "pdfPreviewCanvas"
      );

    const context =
      canvas.getContext("2d");

    const container =
      document.querySelector(
        ".pdf-preview-main"
      );

    const availableWidth =
      Math.max(
        280,
        (container?.clientWidth || 600) - 40
      );

    const originalViewport =
      page.getViewport({
        scale: 1
      });

    const scale =
      Math.min(
        1.35,
        availableWidth /
          originalViewport.width
      );

    const viewport =
      page.getViewport({
        scale
      });

    canvas.width =
      viewport.width;

    canvas.height =
      viewport.height;

    await page.render({
      canvasContext: context,
      viewport
    }).promise;
  }

  /* ---------------------------------------------------------
     Previous / Next
     --------------------------------------------------------- */

  function changePage(amount) {
    if (!currentPDF) return;

    const next =
      currentPage + amount;

    if (
      next >= 1 &&
      next <= currentPDF.numPages
    ) {
      selectPage(next);
    }
  }

  /* ---------------------------------------------------------
     Open PDF
     --------------------------------------------------------- */

  async function openPDF(file) {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return;
    }

    const library =
      await loadPDFJS();

    if (!library) {
      console.error(
        "PDFLuxe: PDF.js unavailable."
      );

      return;
    }

    try {

      createPreviewUI();

      const buffer =
        await file.arrayBuffer();

      currentPDF =
        await library.getDocument({
          data: buffer
        }).promise;

      const panel =
        document.getElementById(
          "pdfPreviewPanel"
        );

      panel.classList.add("visible");

      await renderThumbnails(
        currentPDF
      );

    } catch (error) {

      console.error(
        "PDFLuxe: Preview failed",
        error
      );

    }
  }

  /* ---------------------------------------------------------
     Public API
     --------------------------------------------------------- */

  window.PDFLuxePreview = {
    open: openPDF,

    clear: () => {

      currentPDF = null;
      currentPage = 1;

      state.pages = [];
      state.selectedPage = null;

      const panel =
        document.getElementById(
          "pdfPreviewPanel"
        );

      if (panel) {
        panel.classList.remove(
          "visible"
        );
      }

    },

    getCurrentPage: () =>
      state.selectedPage,

    getPageCount: () =>
      currentPDF?.numPages || 0
  };

  /* ---------------------------------------------------------
     Auto-create preview UI
     --------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      createPreviewUI
    );

  } else {

    createPreviewUI();

  }

})();
