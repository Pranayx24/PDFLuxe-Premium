(() => {
  "use strict";

  const {
    PDFDocument,
    rgb,
    degrees,
    StandardFonts
  } = PDFLib;

  let selectedFiles = [];
  let currentTool = "merge";

  const toolConfig = {
    merge: {
      title: "Merge PDF",
      description:
        "Combine multiple PDFs into one polished document.",
      dropTitle: "Drop PDFs here",
      hint: "or click to browse · multiple files supported",
      action: "Merge & download"
    },

    split: {
      title: "Split PDF",
      description:
        "Extract selected pages into a new PDF.",
      dropTitle: "Choose a PDF",
      hint: "one PDF at a time",
      action: "Extract & download"
    },

    compress: {
      title: "Compress PDF",
      description:
        "Create an optimized copy of your PDF.",
      dropTitle: "Choose a PDF",
      hint: "one PDF at a time",
      action: "Optimize & download"
    },

    watermark: {
      title: "Watermark PDF",
      description:
        "Add a refined text watermark to every page.",
      dropTitle: "Choose a PDF",
      hint: "one PDF at a time",
      action: "Apply watermark"
    },

    numbers: {
      title: "Page numbers",
      description:
        "Add professional pagination to your document.",
      dropTitle: "Choose a PDF",
      hint: "one PDF at a time",
      action: "Add page numbers"
    },

    rotate: {
      title: "Rotate PDF",
      description:
        "Rotate every page 90° clockwise.",
      dropTitle: "Choose a PDF",
      hint: "one PDF at a time",
      action: "Rotate & download"
    }
  };

  const $ = selector =>
    document.querySelector(selector);

  function scrollToSection(id) {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth"
      });
  }

  function showToast(message) {
    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.__pdfLuxeToastTimer);

    window.__pdfLuxeToastTimer =
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2500);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderFiles() {
    const list = $("#fileList");

    if (!list) return;

    list.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      const item =
        document.createElement("div");

      item.className = "file";

      item.innerHTML = `
        <span class="file-name">
          ${escapeHtml(file.name)}
        </span>

        <span class="file-size">
          ${(file.size / 1024 / 1024).toFixed(2)} MB

          <button
            class="remove-file"
            data-remove-file="${index}"
            title="Remove"
            type="button"
          >
            ×
          </button>
        </span>
      `;

      list.appendChild(item);
    });
  }

  /*
   * ---------------------------------------------------------
   * PDF PREVIEW CONNECTION
   * ---------------------------------------------------------
   */

  function syncPreview() {
    if (!window.PDFLuxePreview) {
      return;
    }

    if (!selectedFiles.length) {
      PDFLuxePreview.clear();
      return;
    }

    PDFLuxePreview.open(
      selectedFiles[0]
    );
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);

    renderFiles();
    updateStatus();

    syncPreview();
  }

  function updateStatus() {
    const status = $("#status");

    if (!status) return;

    if (!selectedFiles.length) {
      status.textContent =
        "Your files stay in this browser. Nothing is uploaded.";

      return;
    }

    status.textContent =
      `${selectedFiles.length} file${
        selectedFiles.length === 1 ? "" : "s"
      } ready.`;
  }

  function setTool(tool) {
    if (!toolConfig[tool]) return;

    currentTool = tool;
    selectedFiles = [];

    if (window.PDFLuxePreview) {
      PDFLuxePreview.clear();
    }

    renderFiles();

    const config =
      toolConfig[tool];

    $("#toolTitle").textContent =
      config.title;

    $("#toolDescription").textContent =
      config.description;

    $("#dropTitle").textContent =
      config.dropTitle;

    $("#dropHint").textContent =
      config.hint;

    $("#actionButton").textContent =
      config.action;

    $("#extraControls").innerHTML = "";

    $("#fileInput").multiple =
      tool === "merge";

    if (tool === "split") {
      $("#extraControls").innerHTML = `
        <input
          class="field"
          id="pageRange"
          placeholder="Pages e.g. 1,3-5"
          inputmode="text"
          autocomplete="off"
        />
      `;
    }

    if (tool === "watermark") {
      $("#extraControls").innerHTML = `
        <input
          class="field"
          id="watermarkText"
          value="PDFLuxe Premium"
          placeholder="Watermark text"
          maxlength="100"
          autocomplete="off"
        />
      `;
    }

    updateStatus();
  }

  function addFiles(files) {
    const pdfs =
      [...files].filter(
        file =>
          file.type === "application/pdf" ||
          file.name
            .toLowerCase()
            .endsWith(".pdf")
      );

    if (!pdfs.length) {
      showToast("Please choose PDF files.");
      return;
    }

    if (currentTool !== "merge") {
      selectedFiles = [pdfs[0]];

      if (pdfs.length > 1) {
        showToast(
          "This tool uses one PDF at a time."
        );
      }
    } else {
      selectedFiles = pdfs;
    }

    renderFiles();
    updateStatus();

    /*
     * Automatically open the first PDF
     * in the premium page preview.
     */
    syncPreview();
  }

  function downloadPDF(bytes, filename) {
    const blob = new Blob(
      [bytes],
      {
        type: "application/pdf"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }

  async function loadPDF(file) {
    return PDFDocument.load(
      await file.arrayBuffer()
    );
  }

  async function mergePDFs() {
    if (selectedFiles.length < 2) {
      showToast("Add at least two PDFs.");
      return;
    }

    const output =
      await PDFDocument.create();

    for (const file of selectedFiles) {
      const source =
        await loadPDF(file);

      const pages =
        await output.copyPages(
          source,
          source.getPageIndices()
        );

      pages.forEach(page =>
        output.addPage(page)
      );
    }

    const bytes =
      await output.save({
        useObjectStreams: true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-merged.pdf"
    );

    showToast(
      "Merged PDF ready ✓"
    );
  }

  function parsePageNumbers(
    value,
    totalPages
  ) {
    const pages = [];

    value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => {
        if (item.includes("-")) {
          const [start, end] =
            item
              .split("-")
              .map(Number);

          const first =
            Math.min(start, end);

          const last =
            Math.max(start, end);

          for (
            let page = first;
            page <= last;
            page++
          ) {
            if (
              page >= 1 &&
              page <= totalPages
            ) {
              pages.push(page - 1);
            }
          }
        } else {
          const page =
            Number(item);

          if (
            page >= 1 &&
            page <= totalPages
          ) {
            pages.push(page - 1);
          }
        }
      });

    return [...new Set(pages)];
  }

  async function splitPDF() {
    if (!selectedFiles.length) {
      showToast("Choose a PDF first.");
      return;
    }

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const value =
      $("#pageRange")?.value.trim() ||
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
      return;
    }

    const output =
      await PDFDocument.create();

    const pages =
      await output.copyPages(
        source,
        indexes
      );

    pages.forEach(page =>
      output.addPage(page)
    );

    const bytes =
      await output.save({
        useObjectStreams: true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-split.pdf"
    );

    showToast(
      "Pages extracted ✓"
    );
  }

  async function compressPDF() {
    if (!selectedFiles.length) {
      showToast("Choose a PDF first.");
      return;
    }

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const bytes =
      await source.save({
        useObjectStreams: true,
        addDefaultPage: false
      });

    downloadPDF(
      bytes,
      "PDFLuxe-optimized.pdf"
    );

    showToast(
      "Optimized PDF ready ✓"
    );
  }

  async function watermarkPDF() {
    if (!selectedFiles.length) {
      showToast("Choose a PDF first.");
      return;
    }

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const font =
      await source.embedFont(
        StandardFonts.HelveticaBold
      );

    const text =
      $("#watermarkText")?.value.trim() ||
      "PDFLuxe Premium";

    source.getPages().forEach(page => {
      const size =
        page.getSize();

      page.drawText(
        text,
        {
          x:
            size.width / 2 - 70,

          y:
            size.height / 2,

          size: 25,

          font,

          color:
            rgb(
              0.75,
              0.55,
              0.2
            ),

          opacity: 0.2,

          rotate:
            degrees(35)
        }
      );
    });

    const bytes =
      await source.save({
        useObjectStreams: true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-watermarked.pdf"
    );

    showToast(
      "Watermark applied ✓"
    );
  }

  async function numberPDF() {
    if (!selectedFiles.length) {
      showToast("Choose a PDF first.");
      return;
    }

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    const font =
      await source.embedFont(
        StandardFonts.Helvetica
      );

    source.getPages().forEach(
      (page, index) => {
        const size =
          page.getSize();

        page.drawText(
          String(index + 1),
          {
            x:
              size.width / 2 - 4,

            y: 18,

            size: 10,

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
        useObjectStreams: true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-numbered.pdf"
    );

    showToast(
      "Page numbers added ✓"
    );
  }

  async function rotatePDF() {
    if (!selectedFiles.length) {
      showToast("Choose a PDF first.");
      return;
    }

    const source =
      await loadPDF(
        selectedFiles[0]
      );

    source
      .getPages()
      .forEach(page => {
        const current =
          page.getRotation().angle;

        page.setRotation(
          degrees(
            (current + 90) % 360
          )
        );
      });

    const bytes =
      await source.save({
        useObjectStreams: true
      });

    downloadPDF(
      bytes,
      "PDFLuxe-rotated.pdf"
    );

    showToast(
      "PDF rotated ✓"
    );
  }

  async function runCurrentTool() {
    try {
      const actionButton =
        $("#actionButton");

      if (actionButton) {
        actionButton.disabled = true;
        actionButton.style.opacity = "0.65";
      }

      if (currentTool === "merge") {
        await mergePDFs();
      }

      else if (currentTool === "split") {
        await splitPDF();
      }

      else if (currentTool === "compress") {
        await compressPDF();
      }

      else if (currentTool === "watermark") {
        await watermarkPDF();
      }

      else if (currentTool === "numbers") {
        await numberPDF();
      }

      else if (currentTool === "rotate") {
        await rotatePDF();
      }

    } catch (error) {
      console.error(
        "PDFLuxe processing error:",
        error
      );

      showToast(
        "Something went wrong. Try another PDF."
      );

    } finally {
      const actionButton =
        $("#actionButton");

      if (actionButton) {
        actionButton.disabled = false;
        actionButton.style.opacity = "";
      }
    }
  }

  function initialize() {
    const dropZone =
      $("#dropZone");

    const fileInput =
      $("#fileInput");

    if (!dropZone || !fileInput) {
      return;
    }

    document
      .querySelectorAll(".tool")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(".tool")
              .forEach(item =>
                item.classList.remove(
                  "active"
                )
              );

            button.classList.add(
              "active"
            );

            setTool(
              button.dataset.tool
            );
          }
        );
      });

    document
      .querySelectorAll(
        ".tool-card[data-jump]"
      )
      .forEach(card => {
        card.addEventListener(
          "click",
          () => {
            scrollToSection(
              "workspace"
            );

            setTimeout(() => {
              const target =
                document.querySelector(
                  `.tool[data-tool="${card.dataset.jump}"]`
                );

              target?.click();
            }, 350);
          }
        );
      });

    $("#fileList")
      ?.addEventListener(
        "click",
        event => {
          const button =
            event.target.closest(
              "[data-remove-file]"
            );

          if (!button) return;

          removeFile(
            Number(
              button.dataset.removeFile
            )
          );
        }
      );

    dropZone.addEventListener(
      "click",
      () => fileInput.click()
    );

    fileInput.addEventListener(
      "change",
      event => {
        addFiles(
          event.target.files
        );

        fileInput.value = "";
      }
    );

    ["dragenter", "dragover"]
      .forEach(eventName => {
        dropZone.addEventListener(
          eventName,
          event => {
            event.preventDefault();

            dropZone.classList.add(
              "dragging"
            );
          }
        );
      });

    ["dragleave", "drop"]
      .forEach(eventName => {
        dropZone.addEventListener(
          eventName,
          event => {
            event.preventDefault();

            dropZone.classList.remove(
              "dragging"
            );
          }
        );
      });

    dropZone.addEventListener(
      "drop",
      event => {
        addFiles(
          event.dataTransfer.files
        );
      }
    );

    $("#clearButton")
      ?.addEventListener(
        "click",
        () => {
          selectedFiles = [];

          renderFiles();
          updateStatus();

          if (window.PDFLuxePreview) {
            PDFLuxePreview.clear();
          }

          showToast(
            "Workspace cleared"
          );
        }
      );

    $("#actionButton")
      ?.addEventListener(
        "click",
        runCurrentTool
      );

    setTool("merge");
  }

  window.PDFLuxe = {
    setTool,
    scrollToSection,
    showToast
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
