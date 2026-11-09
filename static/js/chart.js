/**
 * Chart.js Historical Trend Visualizer
 * Plots PM2.5 (ug/m3) and Temperature (C) time-series data
 */

export class TrendsChart {
  constructor(canvasId = "trendsChart") {
    this.canvasId = canvasId;
    this.chart = null;
    this.initChart();
  }

  initChart() {
    const ctx = document.getElementById(this.canvasId);
    if (!ctx || !window.Chart) {
      console.warn("Chart.js or canvas element not available");
      return;
    }

    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const gridColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.06)";
    const textColor = isLight ? "#6b7280" : "#9ca3af";

    this.chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "PM2.5 (µg/m³)",
            data: [],
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            yAxisID: "yPM",
            pointRadius: 1,
            pointHoverRadius: 5
          },
          {
            label: "Temp (°C)",
            data: [],
            borderColor: "#f97316",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0.35,
            fill: false,
            yAxisID: "yTemp",
            pointRadius: 1,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: textColor,
              font: { size: 10, weight: 600 }
            }
          },
          tooltip: {
            backgroundColor: "rgba(17, 24, 39, 0.9)",
            titleColor: "#ffffff",
            bodyColor: "#f3f4f6",
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 11, weight: 700 },
            bodyFont: { size: 11 }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 9 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6
            }
          },
          yPM: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "PM2.5 (µg/m³)",
              color: "#38bdf8",
              font: { size: 9, weight: 600 }
            },
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 9 } }
          },
          yTemp: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Temp (°C)",
              color: "#f97316",
              font: { size: 9, weight: 600 }
            },
            grid: { drawOnChartArea: false },
            ticks: { color: textColor, font: { size: 9 } }
          }
        }
      }
    });
  }

  updateData(historyReadings) {
    if (!this.chart || !historyReadings || !historyReadings.length) return;

    // Extract formatted time labels (HH:MM or MM/DD HH:MM)
    const labels = historyReadings.map((r) => {
      if (!r.timestamp) return "";
      const parts = r.timestamp.split(" ");
      return parts.length > 1 ? parts[1].substring(0, 5) : r.timestamp;
    });

    const pm25Data = historyReadings.map((r) => r.pm25 || 0);
    const tempData = historyReadings.map((r) => r.temp || 0);

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = pm25Data;
    this.chart.data.datasets[1].data = tempData;
    this.chart.update("none"); // update without layout flicker
  }

  refreshTheme() {
    if (!this.chart) return;
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const gridColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.06)";
    const textColor = isLight ? "#6b7280" : "#9ca3af";

    this.chart.options.scales.x.grid.color = gridColor;
    this.chart.options.scales.yPM.grid.color = gridColor;
    this.chart.options.scales.x.ticks.color = textColor;
    this.chart.options.scales.yPM.ticks.color = textColor;
    this.chart.options.scales.yTemp.ticks.color = textColor;
    this.chart.options.plugins.legend.labels.color = textColor;
    this.chart.update();
  }
}
