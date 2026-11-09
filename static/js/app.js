/**
 * Main Application Controller
 * Coordinates Data Polling, UI Synchronization, Map Rendering, and Metrics
 */

import { calculateEnvironmentalScore } from "./scoring.js";
import { AirQualityMap } from "./map.js";
import { TrendsChart } from "./chart.js";

class SmartAirQApp {
  constructor() {
    // Dynamically resolves to current origin, or falls back to server IP 10.49.96.26:5000
    this.apiBaseUrl = window.location.origin.includes("5000")
      ? window.location.origin
      : (window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
          ? `http://${window.location.hostname}:5000`
          : "http://10.49.96.26:5000");

    this.mapManager = null;
    this.chartManager = null;
    this.pollIntervalMs = 3000;
    this.timer = null;
    this.lastPacketTime = null;
    this.isServerOnline = false;

    this.dom = {
      statusDot: document.getElementById("statusDot"),
      statusText: document.getElementById("statusText"),
      lastPacketText: document.getElementById("lastPacketText"),
      globalScoreCircle: document.getElementById("globalScoreCircle"),
      globalScoreStatus: document.getElementById("globalScoreStatus"),
      advisoryCard: document.getElementById("advisoryCard"),
      advisoryTitle: document.getElementById("advisoryTitle"),
      advisoryText: document.getElementById("advisoryText"),
      advisoryIcon: document.getElementById("advisoryIcon"),
      pm25Value: document.getElementById("pm25Value"),
      pm10Value: document.getElementById("pm10Value"),
      tempValue: document.getElementById("tempValue"),
      humidityValue: document.getElementById("humidityValue"),
      comfortFill: document.getElementById("comfortFill"),
      comfortLabel: document.getElementById("comfortLabel"),
      heatIndexText: document.getElementById("heatIndexText"),
      climatePenaltyBadge: document.getElementById("climatePenaltyBadge"),
      geoSourceChip: document.getElementById("geoSourceChip"),
      activeNodeChip: document.getElementById("activeNodeChip"),
      sensorTimestampChip: document.getElementById("sensorTimestampChip"),
      btnSetJamnagar: document.getElementById("btnSetJamnagar"),
      btnClickPin: document.getElementById("btnClickPin"),
      themeToggle: document.getElementById("themeToggle"),
      btnExport: document.getElementById("btnExport")
    };

    this.init();
  }

  async init() {
    this.initTheme();
    this.mapManager = new AirQualityMap("map");
    this.chartManager = new TrendsChart("trendsChart");
    this.bindEvents();

    // Fetch server client config (Carto API Key, basemap style)
    await this.fetchConfig();

    // Initial fetch and start loop
    await this.fetchTelemetry();
    this.startPolling();
    this.startClockTicker();
  }

  async fetchConfig() {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/config`, { cache: "no-store" });
      if (res.ok) {
        const config = await res.json();
        if (config.cartoApiKey || config.cartoMapStyle) {
          this.mapManager.setCartoConfig(config);
        }
      }
    } catch (e) {
      console.info("Using default open Carto basemap tiles");
    }
  }

  bindEvents() {
    // Theme Switcher
    if (this.dom.themeToggle) {
      this.dom.themeToggle.addEventListener("click", () => this.toggleTheme());
    }

    // CSV Export button direct link
    if (this.dom.btnExport) {
      this.dom.btnExport.href = `${this.apiBaseUrl}/api/export-csv`;
    }

    // Set to Jamnagar button
    if (this.dom.btnSetJamnagar) {
      this.dom.btnSetJamnagar.addEventListener("click", () => {
        if (this.mapManager) {
          this.mapManager.setJamnagarLocation();
          if (this.dom.geoSourceChip) {
            this.dom.geoSourceChip.textContent = "📍 Jamnagar, Gujarat";
          }
        }
      });
    }

    // Click Map to Relocate button
    if (this.dom.btnClickPin) {
      this.dom.btnClickPin.addEventListener("click", () => {
        if (this.mapManager) {
          this.dom.btnClickPin.classList.add("active");
          this.dom.btnClickPin.textContent = "👆 Click anywhere on map...";
          this.mapManager.enableClickToLocate((loc) => {
            this.dom.btnClickPin.classList.remove("active");
            this.dom.btnClickPin.textContent = "📍 Click Map to Relocate";
            if (this.dom.geoSourceChip) {
              this.dom.geoSourceChip.textContent = `📍 Pinned (${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)})`;
            }
          });
        }
      });
    }

    // Window resize handler for map and chart
    window.addEventListener("resize", () => {
      if (this.mapManager) this.mapManager.invalidateSize();
    });
  }

  startPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.fetchTelemetry(), this.pollIntervalMs);
  }

  startClockTicker() {
    // Ticker to update "Last packet: X seconds ago" with exact sensor reading time
    setInterval(() => {
      if (!this.lastSensorTimestamp) {
        if (this.dom.lastPacketText) this.dom.lastPacketText.textContent = "Awaiting data...";
        return;
      }
      const elapsedSeconds = this.lastPacketTime
        ? Math.floor((Date.now() - this.lastPacketTime) / 1000)
        : 0;

      if (this.dom.lastPacketText) {
        const timePart = this.lastSensorTimestamp.includes(" ")
          ? this.lastSensorTimestamp.split(" ")[1]
          : this.lastSensorTimestamp;
        if (elapsedSeconds < 4) {
          this.dom.lastPacketText.textContent = `${timePart} (Just now)`;
        } else if (elapsedSeconds < 60) {
          this.dom.lastPacketText.textContent = `${timePart} (${elapsedSeconds}s ago)`;
        } else {
          const minutes = Math.floor(elapsedSeconds / 60);
          this.dom.lastPacketText.textContent = `${timePart} (${minutes}m ago)`;
        }
      }
    }, 1000);
  }

  async fetchTelemetry() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/map-data?limit=40`, {
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data = await response.json();

      this.setServerStatus(true);
      if (data.latest) {
        this.lastPacketTime = Date.now();
        await this.renderDashboard(data.latest, data.history || []);
      }
    } catch (err) {
      console.warn("Failed fetching map data:", err.message);
      this.setServerStatus(false);
    }
  }

  setServerStatus(isOnline) {
    this.isServerOnline = isOnline;
    if (!this.dom.statusDot) return;

    if (isOnline) {
      this.dom.statusDot.className = "status-dot online";
      if (this.dom.statusText) this.dom.statusText.textContent = "Server Online";
    } else {
      this.dom.statusDot.className = "status-dot offline";
      if (this.dom.statusText) this.dom.statusText.textContent = "Server Offline";
    }
  }

  async renderDashboard(latest, history) {
    const aqi = latest.aqi || 0;
    const temp = latest.temp || 0.0;
    const humidity = latest.humidity || 0.0;
    const pm25 = latest.pm25 || 0;
    const pm10 = latest.pm10 || 0;
    const nodeId = latest.node_id || "ESP32_Node";
    const sensorTimestamp = latest.timestamp || "Live";

    this.lastSensorTimestamp = sensorTimestamp;
    if (this.dom.sensorTimestampChip) {
      this.dom.sensorTimestampChip.textContent = sensorTimestamp;
    }

    // 1. Calculate Score & Climate Modifier
    const scoring = calculateEnvironmentalScore(aqi, temp, humidity);

    // 2. Update Header Environmental Score Badge
    if (this.dom.globalScoreCircle) {
      this.dom.globalScoreCircle.textContent = scoring.score;
      this.dom.globalScoreCircle.style.backgroundColor = scoring.color;
      this.dom.globalScoreCircle.style.boxShadow = `0 0 16px ${scoring.aqiColorHex}66`;
    }
    if (this.dom.globalScoreStatus) {
      this.dom.globalScoreStatus.textContent = `${scoring.category} (${scoring.score}/10)`;
    }

    // 3. Update Health Advisory Card
    if (this.dom.advisoryCard) {
      this.dom.advisoryCard.style.borderLeftColor = scoring.aqiColorHex;
      this.dom.advisoryCard.style.background = `linear-gradient(135deg, ${scoring.aqiColorHex}15, transparent)`;
    }
    if (this.dom.advisoryTitle) {
      this.dom.advisoryTitle.textContent = scoring.advisoryTitle;
      this.dom.advisoryTitle.style.color = scoring.aqiColorHex;
    }
    if (this.dom.advisoryText) {
      this.dom.advisoryText.textContent = scoring.advisoryText;
    }

    // 4. Update Live Metrics Grid
    if (this.dom.pm25Value) this.dom.pm25Value.textContent = pm25;
    if (this.dom.pm10Value) this.dom.pm10Value.textContent = pm10;
    if (this.dom.tempValue) this.dom.tempValue.textContent = temp.toFixed(1);
    if (this.dom.humidityValue) this.dom.humidityValue.textContent = humidity.toFixed(1);

    // 5. Update Climate & Comfort View
    if (this.dom.comfortFill) {
      this.dom.comfortFill.style.width = `${scoring.climateAssessment.percent}%`;
    }
    if (this.dom.comfortLabel) {
      this.dom.comfortLabel.textContent = scoring.climateAssessment.label;
    }
    if (this.dom.heatIndexText) {
      this.dom.heatIndexText.textContent = `${scoring.climateAssessment.heatIndex} °C`;
    }
    if (this.dom.climatePenaltyBadge) {
      if (scoring.penaltyApplied) {
        this.dom.climatePenaltyBadge.style.display = "block";
        this.dom.climatePenaltyBadge.textContent = "⚠️ Climate Penalty Applied (-1 score: High heat & humidity)";
      } else {
        this.dom.climatePenaltyBadge.style.display = "none";
      }
    }

    // 6. Update Active Node Chip
    if (this.dom.activeNodeChip) {
      this.dom.activeNodeChip.textContent = `Node: ${nodeId}`;
    }

    // 7. Update Map with AoE Zone & Geolocation Fallback
    if (this.mapManager) {
      const geoResult = await this.mapManager.updateTelemetryLocation(latest, scoring.aqiColorHex);
      if (this.dom.geoSourceChip && geoResult) {
        this.dom.geoSourceChip.textContent = geoResult.isHardwareGps
          ? "🛰️ Hardware GPS"
          : (geoResult.label || "📍 Jamnagar Fallback");
      }
    }

    // 8. Update Historical Trends Chart
    if (this.chartManager && history.length) {
      this.chartManager.updateData(history);
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem("smartairq-theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("smartairq-theme", next);
    if (this.chartManager) this.chartManager.refreshTheme();
  }
}

// Bootstrap application on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.appInstance = new SmartAirQApp();
});
