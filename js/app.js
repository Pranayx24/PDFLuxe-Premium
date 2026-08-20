(() => {
  "use strict";

  /*
   * =========================================================
   * PDFLUXE PREMIUM — APPLICATION ENGINE
   * =========================================================
   */

  if (!window.PDFLib) {
    console.error(
      "PDFLuxe: PDF-Lib was not loaded."
    );
    return;
  }

  const {
    PDFDocument,
    rgb,
    degrees,
    StandardFonts
  } = window.PDFLib;

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */

  let selectedFiles = [];
  let currentTool = "merge";
  let isProcessing = false;

  /* ---------------------------------------------------------
     TOOL CONFIGURATION
  --------------------------------------------------------- */

  const toolConfig = {

    merge: {
      title: "Merge PDF",
      description:
        "Combine multiple PDFs into one polished document.",
      dropTitle:
        "Drop PDFs here",
      hint:
        "or click to browse · multiple files supported",
      action:
        "Merge & download",
      multiple:
        true
    },

    split: {
      title: "Split PDF",
      description:
        "Extract selected pages into a new PDF.",
      dropTitle:
        "Choose a PDF",
      hint:
        "one PDF at a time",
      action:
        "Extract & download",
      multiple:
        false
    },

    compress: {
      title: "Compress PDF",
      description:
        "Create an optimized copy of your PDF.",
      dropTitle:
        "Choose a PDF",
      hint:
        "one PDF at a time",
      action:
        "Optimize & download",
      multiple:
        false
    },

    watermark: {
      title: "Watermark PDF",
      description:
        "Add a refined text watermark to every page.",
      dropTitle:
        "Choose a PDF",
      hint:
        "one PDF at a time",
      action:
        "Apply watermark",
      multiple:
        false
    },

    numbers: {
      title: "Page numbers",
      description:
        "Add professional pagination to your document.",
      dropTitle:
        "Choose a PDF",
      hint:
        "one PDF at a time",
      action:
        "Add page numbers",
      multiple:
        false
    },

    rotate: {
      title: "Rotate PDF",
      description:
        "Rotate every page 90° clockwise.",
      dropTitle:
        "Choose a PDF",
      hint:
        "one PDF at a time",
      action:
        "Rotate & download",
      multiple:
        false
    }

  };

  /* ---------------------------------------------------------
     HELPERS
  --------------------------------------------------------- */

  const $ = selector =>
    document.querySelector(selector);

  const $$ = selector =>
    [...document.querySelectorAll(selector)];

  function getElement(id) {
    return document.getElementById(id);
  }

  function scrollToSection(id) {
    const element =
      getElement(id);

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function showToast(message) {

    const toast =
      getElement("toast");

    if (!toast) return;

    toast.textContent =
      message;

    toast.classList.add(
      "show"
    );

    clearTimeout(
      window.__pdfLuxeToastTimer
    );

    window.__pdfLuxeToastTimer =
      setTimeout(() => {

        toast.classList.remove(
          "show"
        );

      }, 2600);

  }

  function escapeHtml(value) {

    return String(value)

      .replaceAll(
        "&",
        "&amp;"
      )

      .replaceAll(
        "<",
        "&lt;"
      )

      .replaceAll(
        ">",
        "&gt;"
      )

      .replaceAll(
        '"',
        "&quot;"
      )

      .replaceAll(
        "'",
        "&#039;"
      );

  }

  function formatFileSize(bytes) {

    if (!bytes) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB"
    ];

    let size = bytes;
    let index = 0;

    while (
      size >= 1024 &&
      index < units.length - 1
    ) {

      size /= 1024;
      index++;

    }

    return `${size.toFixed(
      index === 0 ? 0 : 2
    )} ${units[index]}`;

  }

  function isPDF(file) {

    if (!file) {
      return false;
    }

    return (
      file.type === "application/pdf" ||
      file.name
        .toLowerCase()
        .endsWith(".pdf")
    );

  }

  /* ---------------------------------------------------------
     PREVIEW CONNECTION
  --------------------------------------------------------- */

  function clearPreview() {

    if (
      window.PDFLuxePreview &&
      typeof PDFLuxePreview.clear ===
        "function"
    ) {

      PDFLuxePreview.clear();

    }

  }

  function syncPreview() {

    if (
      !window.PDFLuxePreview ||
      typeof PDFLuxePreview.open !==
        "function"
    ) {
      return;
    }

    if (!selectedFiles.length) {

      clearPreview();

      return;
    }

    try {

      PDFLuxePreview.open(
        selectedFiles[0]
      );

    } catch (error) {

      console.warn(
        "PDFLuxe preview error:",
        error
      );

    }

  }

  /* ---------------------------------------------------------
     FILE RENDERING
  --------------------------------------------------------- */

  function renderFiles() {

    const list =
      getElement("fileList");

    if (!list) {
      return;
    }

    list.innerHTML = "";

    if (!selectedFiles.length) {
      return;
    }

    selectedFiles.forEach(
      (file, index) => {

        const item =
          document.createElement(
            "div"
          );

        item.className =
          "file";

        item.innerHTML = `

          <span
            class="file-name"
            title="${escapeHtml(
              file.name
            )}"
          >
            ${escapeHtml(
              file.name
            )}
          </span>

          <span class="file-size">

            ${formatFileSize(
              file.size
            )}

            <button
              class="remove-file"
              type="button"
              data-remove-file="${index}"
              title="Remove file"
              aria-label="Remove ${escapeHtml(
                file.name
              )}"
            >
              ×
            </button>

          </span>

        `;

        list.appendChild(
          item
        );

      }
    );

  }

  function updateStatus(
    customMessage = null
  ) {

    const status =
      getElement("status");

    if (!status) {
      return;
    }

    if (customMessage) {

      status.textContent =
        customMessage;

      return;
    }

    if (!selectedFiles.length) {

      status.textContent =
        "Your files stay in this browser. Nothing is uploaded.";

      return;
    }

    const count =
      selectedFiles.length;

    status.textContent =
      `${count} PDF${
        count === 1 ? "" : "s"
      } ready.`;

  }

  function removeFile(index) {

    if (
      index < 0 ||
      index >= selectedFiles.length
    ) {
      return;
    }

    selectedFiles.splice(
      index,
      1
    );

    renderFiles();
    updateStatus();

    syncPreview();

  }

  /* ---------------------------------------------------------
     TOOL MANAGEMENT
  --------------------------------------------------------- */

  function updateToolUI(tool) {

    const config =
      toolConfig[tool];

    if (!config) {
      return;
    }

    const title =
      getElement("toolTitle");

    const description =
      getElement(
        "toolDescription"
      );

    const dropTitle =
      getElement("dropTitle");

    const dropHint =
      getElement("dropHint");

    const actionButton =
      getElement(
        "actionButton"
      );

    const fileInput =
      getElement(
        "fileInput"
      );

    const extraControls =
      getElement(
        "extraControls"
      );

    if (title) {
      title.textContent =
        config.title;
    }

    if (description) {
      description.textContent =
        config.description;
    }

    if (dropTitle) {
      dropTitle.textContent =
        config.dropTitle;
    }

    if (dropHint) {
      dropHint.textContent =
        config.hint;
    }

    if (actionButton) {
      actionButton.textContent =
        config.action;
    }

    if (fileInput) {
      fileInput.multiple =
        config.multiple;
    }

    if (extraControls) {

      extraControls.innerHTML =
        "";

      if (tool === "split") {

        extraControls.innerHTML = `

          <input
            class="field"
            id="pageRange"
            type="text"
            placeholder="Pages e.g. 1,3-5"
            inputmode="text"
            autocomplete="off"
            aria-label="Page range"
          />

        `;

      }

      if (tool === "watermark") {

        extraControls.innerHTML = `

          <input
            class="field"
            id="watermarkText"
            type="text"
            value="PDFLuxe Premium"
            placeholder="Watermark text"
            maxlength="100"
            autocomplete="off"
            aria-label="Watermark text"
          />

        `;

      }

    }

  }

  function setTool(tool) {

    if (!toolConfig[tool]) {
      return;
    }

    currentTool =
      tool;

    selectedFiles = [];

    clearPreview();

    renderFiles();

    updateToolUI(
      tool
    );

    updateStatus();

    updateActiveTool(
      tool
    );

  }

  function updateActiveTool(tool) {

    $$(".tool")
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.tool ===
            tool
        );

      });

  }

  /* ---------------------------------------------------------
     FILE INPUT
  --------------------------------------------------------- */

  function addFiles(fileList) {

    if (!fileList) {
      return;
    }

    const incoming =
      [...fileList];

    const pdfs =
      incoming.filter(
        isPDF
      );

    if (!pdfs.length) {

      showToast(
        "Please choose PDF files."
      );

      return;
    }

    if (
      currentTool ===
      "merge"
    ) {

      selectedFiles =
        pdfs;

    } else {

      selectedFiles =
        [pdfs[0]];

      if (
        pdfs.length > 1
      ) {

        showToast(
          "This tool uses one PDF at a time."
        );

      }

    }

    renderFiles();

    updateStatus();

    syncPreview();

  }

  /* ---------------------------------------------------------
     PDF LOADING
  --------------------------------------------------------- */

  async function loadPDF(file) {

    if (!file) {
      throw new Error(
        "No PDF selected."
      );
    }

    const bytes =
      await file.arrayBuffer();

    return PDFDocument.load(
      bytes
    );

  }

  /* ---------------------------------------------------------
     DOWNLOAD
  --------------------------------------------------------- */

  function downloadPDF(
    bytes,
    filename
  ) {

    const blob =
      new Blob(
        [bytes],
        {
          type:
            "application/pdf"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      filename;

    anchor.style.display =
      "none";

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      1500
    );

  }

  /* ---------------------------------------------------------
     MERGE
  --------------------------------------------------------- */

  async function mergePDFs() {

    if (
      selectedFiles.length <
      2
    ) {

      showToast(
        "Add at least two PDFs."
      );

      return;

    }

    updateStatus(
      "Merging your PDFs…"
    );

    const output =
      await PDFDocument.create();

    for (
      const file of
      selectedFiles
    ) {

      const source =
        await loadPDF(
          file
        );

      const pages =
        await output.copyPages(
          source,
          source.getPageIndices()
        );

      pages.forEach(
        page =>
          output.addPage(
            page
          )
      );

    }

    const bytes =
      await output.save({
        useObjectStreams:
          true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-merged.pdf"
    );

    showToast(
      "Merged PDF ready ✓"
    );

    updateStatus(
      "Merged PDF downloaded successfully."
    );

  }

  /* ---------------------------------------------------------
     PAGE RANGE PARSER
  --------------------------------------------------------- */

  function parsePageNumbers(
    value,
    totalPages
  ) {

    const pages = [];

    if (
      !value ||
      !totalPages
    ) {
      return pages;
    }

    value
      .split(",")
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean)
      .forEach(item => {

        if (
          item.includes("-")
        ) {

          const parts =
            item
              .split("-")
              .map(
                Number
              );

          if (
            parts.length !==
            2
          ) {
            return;
          }

          let start =
            parts[0];

          let end =
            parts[1];

          if (
            !Number.isFinite(
              start
            ) ||
            !Number.isFinite(
              end
            )
          ) {
            return;
          }

          if (
            start > end
          ) {

            [
              start,
              end
            ] = [
              end,
              start
            ];

          }

          for (
            let page =
              start;
            page <= end;
            page++
          ) {

            if (
              page >= 1 &&
              page <= totalPages
            ) {

              pages.push(
                page - 1
              );

            }

          }

        } else {

          const page =
            Number(item);

          if (
            Number.isFinite(
              page
            ) &&
            page >= 1 &&
            page <= totalPages
          ) {

            pages.push(
              page - 1
            );

          }

        }

      });

    return [
      ...new Set(
        pages
      )
    ];

  }

  /* ---------------------------------------------------------
     SPLIT
  --------------------------------------------------------- */

  async function splitPDF() {

    if (
      !selectedFiles.length
    ) {

      showToast(
        "Choose a PDF first."
      );

      return;

    }

    updateStatus(
      "Preparing selected pages…"
    );

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const input =
      getElement(
        "pageRange"
      );

    const value =
      input?.value.trim() ||
      "1";

    const indexes =
      parsePageNumbers(
        value,
        source.getPageCount()
      );

    if (!indexes.length) {

      showToast(
        "Enter valid page numbers."
      );

      updateStatus();

      return;

    }

    const output =
      await PDFDocument.create();

    const pages =
      await output.copyPages(
        source,
        indexes
      );

    pages.forEach(
      page =>
        output.addPage(
          page
        )
    );

    const bytes =
      await output.save({
        useObjectStreams:
          true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-split.pdf"
    );

    showToast(
      "Pages extracted ✓"
    );

    updateStatus(
      "Split PDF downloaded successfully."
    );

  }

  /* ---------------------------------------------------------
     COMPRESS / OPTIMIZE
     --------------------------------------------------------- */

  async function compressPDF() {

    if (
      !selectedFiles.length
    ) {

      showToast(
        "Choose a PDF first."
      );

      return;

    }

    updateStatus(
      "Optimizing your PDF…"
    );

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    /*
     * pdf-lib does not perform true image
     * recompression. This saves the document
     * using object streams to reduce structural
     * overhead where possible.
     */

    const bytes =
      await source.save({
        useObjectStreams:
          true,
        addDefaultPage:
          false
      });

    downloadPDF(
      bytes,
      "PDFLuxe-optimized.pdf"
    );

    showToast(
      "Optimized PDF ready ✓"
    );

    updateStatus(
      "Optimized PDF downloaded successfully."
    );

  }

  /* ---------------------------------------------------------
     WATERMARK
  --------------------------------------------------------- */

  async function watermarkPDF() {

    if (
      !selectedFiles.length
    ) {

      showToast(
        "Choose a PDF first."
      );

      return;

    }

    updateStatus(
      "Applying watermark…"
    );

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const font =
      await source.embedFont(
        StandardFonts.HelveticaBold
      );

    const input =
      getElement(
        "watermarkText"
      );

    const text =
      input?.value.trim() ||
      "PDFLuxe Premium";

    source
      .getPages()
      .forEach(page => {

        const {
          width,
          height
        } =
          page.getSize();

        const textWidth =
          font.widthOfTextAtSize(
            text,
            25
          );

        page.drawText(
          text,
          {

            x:
              (width -
                textWidth) /
              2,

            y:
              height / 2,

            size:
              25,

            font,

            color:
              rgb(
                0.75,
                0.55,
                0.2
              ),

            opacity:
              0.2,

            rotate:
              degrees(35)

          }
        );

      });

    const bytes =
      await source.save({
        useObjectStreams:
          true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-watermarked.pdf"
    );

    showToast(
      "Watermark applied ✓"
    );

    updateStatus(
      "Watermarked PDF downloaded successfully."
    );

  }

  /* ---------------------------------------------------------
     PAGE NUMBERS
  --------------------------------------------------------- */

  async function numberPDF() {

    if (
      !selectedFiles.length
    ) {

      showToast(
        "Choose a PDF first."
      );

      return;

    }

    updateStatus(
      "Adding page numbers…"
    );

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const font =
      await source.embedFont(
        StandardFonts.Helvetica
      );

    source
      .getPages()
      .forEach(
        (page, index) => {

          const {
            width
          } =
            page.getSize();

          const number =
            String(
              index + 1
            );

          const textWidth =
            font.widthOfTextAtSize(
              number,
              10
            );

          page.drawText(
            number,
            {

              x:
                (width -
                  textWidth) /
                2,

              y:
                18,

              size:
                10,

              font,

              color:
                rgb(
                  0.4,
                  0.4,
                  0.45
                )

            }
          );

        }
      );

    const bytes =
      await source.save({
        useObjectStreams:
          true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-numbered.pdf"
    );

    showToast(
      "Page numbers added ✓"
    );

    updateStatus(
      "Numbered PDF downloaded successfully."
    );

  }

  /* ---------------------------------------------------------
     ROTATE
  --------------------------------------------------------- */

  async function rotatePDF() {

    if (
      !selectedFiles.length
    ) {

      showToast(
        "Choose a PDF first."
      );

      return;

    }

    updateStatus(
      "Rotating pages…"
    );

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    source
      .getPages()
      .forEach(page => {

        const current =
          page
            .getRotation()
            .angle;

        page.setRotation(
          degrees(
            (
              current +
              90
            ) %
              360
          )
        );

      });

    const bytes =
      await source.save({
        useObjectStreams:
          true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-rotated.pdf"
    );

    showToast(
      "PDF rotated ✓"
    );

    updateStatus(
      "Rotated PDF downloaded successfully."
    );

  }

  /* ---------------------------------------------------------
     RUN CURRENT TOOL
  --------------------------------------------------------- */

  async function runCurrentTool() {

    if (isProcessing) {
      return;
    }

    isProcessing =
      true;

    const actionButton =
      getElement(
        "actionButton"
      );

    const originalText =
      actionButton
        ?.textContent;

    if (actionButton) {

      actionButton.disabled =
        true;

      actionButton.style.opacity =
        "0.65";

      actionButton.style.cursor =
        "wait";

      actionButton.textContent =
        "Processing…";

    }

    try {

      switch (
        currentTool
      ) {

        case "merge":
          await mergePDFs();
          break;

        case "split":
          await splitPDF();
          break;

        case "compress":
          await compressPDF();
          break;

        case "watermark":
          await watermarkPDF();
          break;

        case "numbers":
          await numberPDF();
          break;

        case "rotate":
          await rotatePDF();
          break;

        default:
          throw new Error(
            "Unknown PDF tool."
          );

      }

    } catch (error) {

      console.error(
        "PDFLuxe processing error:",
        error
      );

      showToast(
        "Something went wrong. Try another PDF."
      );

      updateStatus();

    } finally {

      isProcessing =
        false;

      if (actionButton) {

        actionButton.disabled =
          false;

        actionButton.style.opacity =
          "";

        actionButton.style.cursor =
          "";

        actionButton.textContent =
          originalText ||
          toolConfig[
            currentTool
          ].action;

      }

    }

  }

  /* ---------------------------------------------------------
     CLEAR WORKSPACE
  --------------------------------------------------------- */

  function clearWorkspace() {

    selectedFiles = [];

    const fileInput =
      getElement(
        "fileInput"
      );

    if (fileInput) {
      fileInput.value = "";
    }

    renderFiles();

    updateStatus();

    clearPreview();

    showToast(
      "Workspace cleared"
    );

  }

  /* ---------------------------------------------------------
     TOOL BUTTONS
  --------------------------------------------------------- */

  function initializeToolButtons() {

    $$(".tool")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            setTool(
              button.dataset.tool
            );

          }
        );

      });

  }

  /* ---------------------------------------------------------
     TOOL CARDS
  --------------------------------------------------------- */

  function initializeToolCards() {

    $$(".tool-card[data-jump]")
      .forEach(card => {

        card.addEventListener(
          "click",
          () => {

            const tool =
              card.dataset.jump;

            scrollToSection(
              "workspace"
            );

            setTimeout(
              () => {

                setTool(
                  tool
                );

              },
              300
            );

          }
        );

      });

  }

  /* ---------------------------------------------------------
     FILE LIST EVENTS
  --------------------------------------------------------- */

  function initializeFileList() {

    const fileList =
      getElement(
        "fileList"
      );

    if (!fileList) {
      return;
    }

    fileList.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-remove-file]"
          );

        if (!button) {
          return;
        }

        const index =
          Number(
            button.dataset
              .removeFile
          );

        removeFile(
          index
        );

      }
    );

  }

  /* ---------------------------------------------------------
     DROP ZONE
  --------------------------------------------------------- */

  function initializeDropZone() {

    const dropZone =
      getElement(
        "dropZone"
      );

    const fileInput =
      getElement(
        "fileInput"
      );

    if (
      !dropZone ||
      !fileInput
    ) {
      return;
    }

    dropZone.addEventListener(
      "click",
      event => {

        if (
          event.target.closest(
            "input"
          )
        ) {
          return;
        }

        fileInput.click();

      }
    );

    fileInput.addEventListener(
      "change",
      event => {

        addFiles(
          event.target.files
        );

        fileInput.value =
          "";

      }
    );

    [
      "dragenter",
      "dragover"
    ].forEach(
      eventName => {

        dropZone.addEventListener(
          eventName,
          event => {

            event.preventDefault();
            event.stopPropagation();

            dropZone.classList.add(
              "dragging"
            );

          }
        );

      }
    );

    [
      "dragleave",
      "drop"
    ].forEach(
      eventName => {

        dropZone.addEventListener(
          eventName,
          event => {

            event.preventDefault();
            event.stopPropagation();

            dropZone.classList.remove(
              "dragging"
            );

          }
        );

      }
    );

    dropZone.addEventListener(
      "drop",
      event => {

        const files =
          event
            .dataTransfer
            ?.files;

        if (files) {
          addFiles(
            files
          );
        }

      }
    );

  }

  /* ---------------------------------------------------------
     CLEAR BUTTON
  --------------------------------------------------------- */

  function initializeClearButton() {

    const button =
      getElement(
        "clearButton"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      clearWorkspace
    );

  }

  /* ---------------------------------------------------------
     ACTION BUTTON
  --------------------------------------------------------- */

  function initializeActionButton() {

    const button =
      getElement(
        "actionButton"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      runCurrentTool
    );

  }

  /* ---------------------------------------------------------
     KEYBOARD SHORTCUTS
  --------------------------------------------------------- */

  function initializeKeyboard() {

    document.addEventListener(
      "keydown",
      event => {

        if (
          (
            event.metaKey ||
            event.ctrlKey
          ) &&
          event.key === "Enter"
        ) {

          event.preventDefault();

          runCurrentTool();

        }

        if (
          event.key === "Escape" &&
          isProcessing
        ) {
          return;
        }

      }
    );

  }

  /* ---------------------------------------------------------
     PUBLIC API
  --------------------------------------------------------- */

  window.PDFLuxe = {

    setTool,

    scrollToSection,

    showToast,

    clearWorkspace,

    addFiles,

    getSelectedFiles: () =>
      [...selectedFiles],

    getCurrentTool: () =>
      currentTool

  };

  /* ---------------------------------------------------------
     INITIALIZATION
  --------------------------------------------------------- */

  function initialize() {

    const dropZone =
      getElement(
        "dropZone"
      );

    const fileInput =
      getElement(
        "fileInput"
      );

    if (
      !dropZone ||
      !fileInput
    ) {

      console.warn(
        "PDFLuxe: Workspace elements not found."
      );

      return;

    }

    initializeToolButtons();

    initializeToolCards();

    initializeFileList();

    initializeDropZone();

    initializeClearButton();

    initializeActionButton();

    initializeKeyboard();

    setTool(
      "merge"
    );

    console.log(
      "PDFLuxe Premium application engine loaded ✓"
    );

  }

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
