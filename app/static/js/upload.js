(function () {
  var THEME_KEY = "ecg-theme";
  function getTheme() {
    var s = localStorage.getItem(THEME_KEY);
    if (s === "dark" || s === "light") return s;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }
  function setTheme(theme) {
    var next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }
  setTheme(getTheme());
  var themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  var uploadZone = document.getElementById("uploadZone");
  var fileInput = document.getElementById("fileInput");
  var modelSelect = document.getElementById("modelSelect");
  var rateSelect = document.getElementById("rateSelect");
  var submitBtn = document.getElementById("submitBtn");
  var chartSection = document.getElementById("chartSection");
  var resultsSection = document.getElementById("resultsSection");
  var ecgChartDiv = document.getElementById("ecgChartDiv");
  var predictionBars = document.getElementById("predictionBars");
  var loadingOverlay = document.getElementById("loadingOverlay");
  var toast = document.getElementById("toast");

  var selectedFile = null;

  function showToast(message, isError) {
    toast.textContent = message;
    toast.className = "toast" + (isError ? " error" : "");
    toast.classList.add("visible");
    setTimeout(function () {
      toast.classList.remove("visible");
    }, 4000);
  }

  function setLoading(visible) {
    if (visible) loadingOverlay.classList.add("visible");
    else loadingOverlay.classList.remove("visible");
    submitBtn.disabled = visible;
  }

  function renderProbabilityBars(probabilities) {
    var order = ["NORM", "MI", "STTC", "CD", "HYP"];
    var html = "";
    order.forEach(function (label) {
      var p = (probabilities[label] != null ? probabilities[label] : 0);
      var pct = Math.round(p * 100);
      var barClass = "success";
      if (pct < 40) barClass = "absent";
      else if (pct < 70) barClass = "warning";
      html +=
        '<div class="pred-row">' +
        '<span class="pred-label">' + label + "</span>" +
        '<div class="pred-bar-wrap">' +
        '<div class="pred-bar ' + barClass + '" style="width:' + pct + '%"></div>' +
        "</div>" +
        '<span class="pred-pct">' + pct + "%</span>" +
        "</div>";
    });
    predictionBars.innerHTML = html;
  }

  uploadZone.addEventListener("click", function () {
    fileInput.click();
  });
  uploadZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });
  uploadZone.addEventListener("dragleave", function () {
    uploadZone.classList.remove("drag-over");
  });
  uploadZone.addEventListener("drop", function (e) {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) handleFile(files[0]);
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files.length) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    var ext = (file.name || "").toLowerCase();
    if (!/\.(dat|csv|npy)$/.test(ext)) {
      showToast("Please choose a .dat, .csv, or .npy file.", true);
      return;
    }
    selectedFile = file;
    submitBtn.disabled = false;
  }

  submitBtn.addEventListener("click", function () {
    if (!selectedFile) return;
    setLoading(true);
    chartSection.style.display = "none";
    resultsSection.style.display = "none";

    var formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("model", modelSelect.value);
    formData.append("sampling_rate", rateSelect.value);

    fetch("/api/predict", {
      method: "POST",
      body: formData,
    })
      .then(function (res) {
        if (!res.ok) {
          var msg = "Request failed.";
          if (res.status === 422) msg = "Invalid ECG file. Expected shape (N, 12).";
          else if (res.status === 404) msg = "Selected model not available.";
          else if (res.status === 500) msg = "Server error. Please try again.";
          return res.json().then(function (body) {
            var d = body && body.detail;
            if (res.status === 422 && typeof d === "string" && (d.indexOf("shape") >= 0 || d.indexOf("Invalid") >= 0)) msg = d;
            else if (res.status === 422 && typeof d === "string") msg = d;
            else if (d && typeof d === "string") msg = d;
            else if (Array.isArray(d) && d[0] && d[0].msg) msg = d[0].msg;
            throw new Error(msg);
          }).catch(function (e) {
            if (e instanceof Error && e.message) throw e;
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        var signal = data.signal || [];
        var leadNames = data.lead_names || [];
        var rate = parseInt(rateSelect.value, 10) || 500;
        if (signal.length > 0 && ecgChartDiv) {
          chartSection.style.display = "block";
          if (typeof renderEcgChart === "function") {
            renderEcgChart("ecgChartDiv", signal, leadNames, rate);
          }
        }
        if (data.probabilities) {
          resultsSection.style.display = "block";
          renderProbabilityBars(data.probabilities);
        }
      })
      .catch(function (err) {
        showToast(err.message || "Server error. Please try again.", true);
      })
      .finally(function () {
        setLoading(false);
      });
  });

  // Populate model dropdown from API if desired (optional)
  fetch("/api/models")
    .then(function (r) { return r.json(); })
    .then(function (names) {
      if (Array.isArray(names) && names.length > 0 && modelSelect) {
        var opts = modelSelect.querySelectorAll("option");
        if (opts.length <= 1) {
          modelSelect.innerHTML = "";
          names.forEach(function (n) {
            var opt = document.createElement("option");
            opt.value = n;
            opt.textContent = n.charAt(0).toUpperCase() + n.slice(1).replace(/_/g, "+");
            modelSelect.appendChild(opt);
          });
        }
      }
    })
    .catch(function () {});
})();
