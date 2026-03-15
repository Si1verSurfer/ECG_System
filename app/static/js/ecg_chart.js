/**
 * Plot 12-lead ECG in Plotly subplots: 12 rows x 1 col, shared x-axis (time in seconds).
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
  var traces = [];
  var layout = { title: { text: "" }, showlegend: false, margin: { t: 20, b: 36, l: 44, r: 24 } };
  var neutralColors = ["#475569", "#64748b", "#78716c", "#57534e", "#44403c", "#3f3f46", "#27272a", "#1c1917", "#0f172a", "#0c4a6e", "#155e75", "#164e63"];

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
  var config = { responsive: true, scrollZoom: true };
  Plotly.newPlot(containerId, traces, layout, config);
}
