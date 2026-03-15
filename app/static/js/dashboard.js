(function () {
  var summaryCards = document.getElementById("summaryCards");
  var bestAuc = document.getElementById("bestAuc");
  var bestF1 = document.getElementById("bestF1");
  var bestHamming = document.getElementById("bestHamming");
  var bestSubset = document.getElementById("bestSubset");
  var modelTabs = document.getElementById("modelTabs");
  var perClassAucChart = document.getElementById("perClassAucChart");
  var comparisonChart = document.getElementById("comparisonChart");
  var confusionGrid = document.getElementById("confusionGrid");
  var loadingOverlay = document.getElementById("loadingOverlay");

  var metricsData = {};
  var selectedModel = "resnet";
  var labelOrder = ["NORM", "MI", "STTC", "CD", "HYP"];

  function applyChartTheme() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var update = {
      template: isDark ? "plotly_dark" : "plotly_white",
      paper_bgcolor: isDark ? "#1f2937" : "#ffffff",
      plot_bgcolor: isDark ? "#1f2937" : "#ffffff",
      font: { color: isDark ? "#e5e7eb" : "#111827" },
      xaxis: { color: isDark ? "#e5e7eb" : "#111827" },
      yaxis: { color: isDark ? "#e5e7eb" : "#111827" },
    };
    [perClassAucChart, comparisonChart].forEach(function (el) {
      if (el && el.querySelector && el.querySelector(".plotly")) Plotly.relayout(el, update);
    });
    if (confusionGrid) confusionGrid.querySelectorAll(".dashboard-chart").forEach(function (el) {
      if (el && el.querySelector && el.querySelector(".plotly")) Plotly.relayout(el, update);
    });
  }
  function chartLayoutTheme() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      template: isDark ? "plotly_dark" : "plotly_white",
      paper_bgcolor: isDark ? "#1f2937" : "#ffffff",
      plot_bgcolor: isDark ? "#1f2937" : "#ffffff",
      font: { color: isDark ? "#e5e7eb" : "#111827" },
      xaxis: { color: isDark ? "#e5e7eb" : "#111827" },
      yaxis: { color: isDark ? "#e5e7eb" : "#111827" },
    };
  }

  // Update all Plotly charts when theme changes (theme.js dispatches ecg-theme-change)
  window.addEventListener("ecg-theme-change", applyChartTheme);

  function setLoading(visible) {
    if (visible) {
      loadingOverlay.classList.add("visible");
      loadingOverlay.setAttribute("aria-hidden", "false");
    } else {
      loadingOverlay.classList.remove("visible");
      loadingOverlay.setAttribute("aria-hidden", "true");
    }
  }

  function bestValue(key, higherIsBetter) {
    var best = null;
    Object.keys(metricsData).forEach(function (model) {
      var v = metricsData[model][key];
      if (v == null) return;
      if (best === null) best = v;
      else if (higherIsBetter && v > best) best = v;
      else if (!higherIsBetter && v < best) best = v;
    });
    return best;
  }

  function renderSummaryCards() {
    var auc = bestValue("macro_auc", true);
    var f1 = bestValue("macro_f1", true);
    var hamming = bestValue("hamming_loss", false);
    var subset = bestValue("subset_accuracy", true);
    bestAuc.textContent = auc != null ? (Math.round(auc * 1000) / 1000).toFixed(3) : "—";
    bestF1.textContent = f1 != null ? (Math.round(f1 * 1000) / 1000).toFixed(3) : "—";
    bestHamming.textContent = hamming != null ? (Math.round(hamming * 1000) / 1000).toFixed(3) : "—";
    bestSubset.textContent = subset != null ? (Math.round(subset * 1000) / 1000).toFixed(3) : "—";
  }

  function renderTabs() {
    var models = Object.keys(metricsData);
    if (models.length === 0) models = ["resnet", "cnn", "cnn_lstm", "transformer"];
    modelTabs.innerHTML = "";
    modelTabs.setAttribute("role", "tablist");
    modelTabs.setAttribute("aria-label", "Select model");
    models.forEach(function (m, idx) {
      var btn = document.createElement("button");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", m === selectedModel ? "true" : "false");
      btn.setAttribute("tabindex", m === selectedModel ? 0 : -1);
      btn.id = "tab-" + m;
      btn.textContent = m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, "+");
      btn.dataset.model = m;
      btn.classList.toggle("active", m === selectedModel);
      btn.addEventListener("click", function () {
        selectedModel = m;
        document.querySelectorAll(".model-tabs button").forEach(function (b) {
          var isActive = b.dataset.model === selectedModel;
          b.classList.toggle("active", isActive);
          b.setAttribute("aria-selected", isActive ? "true" : "false");
          b.setAttribute("tabindex", isActive ? 0 : -1);
        });
        renderPerClassAuc();
        renderConfusionMatrices();
      });
      modelTabs.appendChild(btn);
    });
  }

  function renderPerClassAuc() {
    var m = metricsData[selectedModel];
    if (!m || !m.per_class_auc) {
      Plotly.purge(perClassAucChart);
      return;
    }
    var pc = m.per_class_auc;
    var x = labelOrder.filter(function (l) { return pc[l] != null; });
    var y = x.map(function (l) { return pc[l]; });
    if (x.length === 0) {
      x = Object.keys(pc);
      y = Object.values(pc);
    }
    var trace = { x: x, y: y, type: "bar", marker: { color: "#2563eb" } };
    var layout = Object.assign({
      margin: { t: 24, b: 40, l: 44, r: 24 },
      xaxis: { title: "Class" },
      yaxis: { title: "AUC", range: [0, 1.05] },
    }, chartLayoutTheme());
    Plotly.newPlot(perClassAucChart, [trace], layout, { responsive: true });
  }

  function renderComparisonChart() {
    var models = Object.keys(metricsData);
    if (models.length === 0) return;
    var aucs = models.map(function (m) { return metricsData[m].macro_auc; });
    var f1s = models.map(function (m) { return metricsData[m].macro_f1; });
    var trace1 = { x: models, y: aucs, type: "bar", name: "Macro AUC", marker: { color: "#2563eb" } };
    var trace2 = { x: models, y: f1s, type: "bar", name: "Macro F1", marker: { color: "#16a34a" } };
    var layout = Object.assign({
      barmode: "group",
      margin: { t: 24, b: 60, l: 44, r: 24 },
      xaxis: { title: "Model", tickangle: -20 },
      yaxis: { title: "Score", range: [0, 1.05] },
      legend: { x: 1, y: 1, xanchor: "right" },
    }, chartLayoutTheme());
    Plotly.newPlot(comparisonChart, [trace1, trace2], layout, { responsive: true });
  }

  function renderConfusionMatrices() {
    var m = metricsData[selectedModel];
    confusionGrid.innerHTML = "";
    if (!m || !m.confusion_matrices) return;
    var cms = m.confusion_matrices;
    var labels = Object.keys(cms);
    if (labels.length === 0) return;
    var fragment = document.createDocumentFragment();
    var divs = [];
    labels.forEach(function (label) {
      var matrix = cms[label];
      var z = (matrix && matrix.z) ? matrix.z : (Array.isArray(matrix) ? matrix : null);
      if (!z || !z.length) return;
      var x = (matrix && matrix.x) ? matrix.x : ["Neg", "Pos"];
      var y = (matrix && matrix.y) ? matrix.y : ["Pos", "Neg"];
      if (z.length === 2 && z[0].length === 2 && !matrix.x) {
        x = ["0", "1"];
        y = ["1", "0"];
      }
      var div = document.createElement("div");
      div.className = "dashboard-chart";
      fragment.appendChild(div);
      divs.push({ el: div, label: label, z: z, x: x, y: y });
    });
    confusionGrid.appendChild(fragment);
    divs.forEach(function (item) {
      var trace = { z: item.z, x: item.x, y: item.y, type: "heatmap", colorscale: "Blues" };
      var layout = Object.assign({ title: item.label, margin: { t: 32, b: 32, l: 44, r: 24 } }, chartLayoutTheme());
      Plotly.newPlot(item.el, [trace], layout, { responsive: true });
    });
  }

  setLoading(true);
  fetch("/api/dashboard")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      metricsData = data || {};
      var models = Object.keys(metricsData);
      if (models.length > 0 && !metricsData[selectedModel]) selectedModel = models[0];
      requestAnimationFrame(function () {
        renderSummaryCards();
        renderTabs();
        renderPerClassAuc();
        renderComparisonChart();
        renderConfusionMatrices();
      });
    })
    .catch(function () {
      metricsData = {};
      requestAnimationFrame(function () {
        renderSummaryCards();
        renderTabs();
      });
    })
    .finally(function () {
      setLoading(false);
    });
})();
