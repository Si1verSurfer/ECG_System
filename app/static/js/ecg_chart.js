/**
 * Returns Plotly layout options for the current theme (light/dark).
 */
function getEcgChartThemeLayout() {
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

/**
 * Plot 12-lead ECG in Plotly subplots: 12 rows x 1 col, shared x-axis (time in seconds).
 * Respects current data-theme (light/dark) for colors.
 * @param {string} containerId - DOM id of the div to render into
 * @param {number[][]} signal - Array of 12 arrays (one per lead)
 * @param {string[]} leadNames - Labels for each lead
 * @param {number} samplingRate - Hz (e.g. 100 or 500)
 */
function renderEcgChart(containerId, signal, leadNames, samplingRate) {
  if (!signal || signal.length === 0) return;
  var rate = samplingRate || 500;
  var names = leadNames || ["I", "II", "III", "AVL", "AVR", "AVF", "V1", "V2", "V3", "V4", "V5", "V6"];
  var nLeads = Math.min(12, signal.length, names.length);
  var isDark = document.documentElement.getAttribute("data-theme") === "dark";
  var neutralColors = isDark
    ? ["#94a3b8", "#64748b", "#78716c", "#a8a29e", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#334155", "#0ea5e9", "#06b6d4", "#0891b2"]
    : ["#475569", "#64748b", "#78716c", "#57534e", "#44403c", "#3f3f46", "#27272a", "#1c1917", "#0f172a", "#0c4a6e", "#155e75", "#164e63"];
  var traces = [];
  var layout = { title: { text: "" }, showlegend: false, margin: { t: 20, b: 36, l: 44, r: 24 } };

  for (var i = 0; i < nLeads; i++) {
    var n = signal[i].length;
    var time = [];
    for (var t = 0; t < n; t++) time.push(t / rate);
    var yax = i === 0 ? "y" : "y" + (i + 1);
    traces.push({
      x: time,
      y: signal[i],
      type: "scatter",
      mode: "lines",
      name: names[i] || "L" + (i + 1),
      line: { width: 1, color: neutralColors[i] || "#475569" },
      xaxis: "x",
      yaxis: yax,
    });
    var domainStart = (nLeads - 1 - i) / nLeads;
    var domainEnd = (nLeads - i) / nLeads;
    layout["yaxis" + (i === 0 ? "" : (i + 1))] = {
      domain: [domainStart, domainEnd],
      title: names[i] || "",
      titlefont: { size: 10 },
      anchor: "x",
      showticklabels: true,
    };
  }
  layout.xaxis = {
    domain: [0, 1],
    anchor: "y",
    title: "Time (s)",
    side: "bottom",
  };
  var themeLayout = getEcgChartThemeLayout();
  for (var k in themeLayout) layout[k] = themeLayout[k];
  var config = { responsive: true, scrollZoom: true };
  Plotly.newPlot(containerId, traces, layout, config);
}
