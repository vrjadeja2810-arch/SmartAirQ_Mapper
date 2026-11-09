/**
 * Leaflet Map Manager with AoE Heatmap Zone and Live Device GPS Tracking
 */

export class AirQualityMap {
  constructor(containerId = "map") {
    this.containerId = containerId;
    this.map = null;
    this.baseTileLayer = null;
    this.aoeCircle = null;
    this.centerMarker = null;
    this.deviceLiveCoords = null;
    this.currentCoords = { lat: 20.5937, lng: 78.9629 }; // Temporary initial center
    this.isUsingHardwareGps = false;
    this.latestReading = null;
    this.latestColorHex = "#10b981";
    this.hasInitialCentered = false;

    // Clear any previous static location override
    try {
      localStorage.removeItem("smartairq-custom-location");
    } catch (e) {}

    this.initMap();
    this.startLiveDeviceTracking();
  }

  initMap() {
    if (!window.L) {
      console.error("Leaflet library not found on window.L");
      return;
    }

    // Initialize Leaflet map
    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: true
    }).setView([this.currentCoords.lat, this.currentCoords.lng], 14);

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(this.map);

    // Initial default Carto tile layer
    this.setCartoConfig({ cartoMapStyle: "voyager" });
  }

  /**
   * Continuous high-accuracy device live GPS tracking
   */
  startLiveDeviceTracking() {
    if ("geolocation" in navigator) {
      // 1. Immediate fresh request
      navigator.geolocation.getCurrentPosition(
        (pos) => this.handleDeviceLocationSuccess(pos),
        (err) => console.warn("Live device geolocation error:", err.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );

      // 2. Watch position continuously as user/device moves
      navigator.geolocation.watchPosition(
        (pos) => this.handleDeviceLocationSuccess(pos),
        (err) => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    } else {
      console.warn("Geolocation API is not supported by this browser.");
    }
  }

  /**
   * Force fresh location poll on demand (e.g., when clicking "Refresh Location" button)
   */
  requestFreshDeviceLocation() {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        return resolve(this.currentCoords);
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.handleDeviceLocationSuccess(pos);
          resolve(this.deviceLiveCoords);
        },
        (err) => {
          console.warn("Manual location refresh failed:", err.message);
          resolve(this.deviceLiveCoords || this.currentCoords);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    });
  }

  handleDeviceLocationSuccess(pos) {
    const accuracy = Math.round(pos.coords.accuracy || 0);
    this.deviceLiveCoords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: accuracy,
      label: `📍 Device Live GPS (±${accuracy}m)`
    };

    // If hardware sensor GPS is 0,0, actively track device position
    if (!this.isUsingHardwareGps) {
      this.currentCoords = this.deviceLiveCoords;
      if (this.latestReading) {
        this.renderAoEZone(
          this.deviceLiveCoords.lat,
          this.deviceLiveCoords.lng,
          this.latestReading,
          this.latestColorHex,
          this.deviceLiveCoords.label
        );
      } else if (!this.hasInitialCentered && this.map) {
        this.map.setView([this.deviceLiveCoords.lat, this.deviceLiveCoords.lng], 15);
        this.hasInitialCentered = true;
      }
    }
  }

  /**
   * Configure Carto Basemap with Carto API key (?key=...) and style preset
   */
  setCartoConfig(config = {}) {
    if (!this.map) return;
    const key = config.cartoApiKey ? config.cartoApiKey.trim() : "";
    const style = config.cartoMapStyle || "voyager";

    // Carto raster tile format: https://{s}.basemaps.cartocdn.com/rastertiles/{style}/{z}/{x}/{y}.png?key=...
    let tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png`;
    if (key) {
      tileUrl += `?key=${encodeURIComponent(key)}`;
    }

    const options = {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    };

    if (this.baseTileLayer) {
      this.map.removeLayer(this.baseTileLayer);
    }
    this.baseTileLayer = L.tileLayer(tileUrl, options).addTo(this.map);

    // Reliable fallback: if Carto encounters any tile error, fallback to OpenStreetMap so map is never blank
    let fallbackDone = false;
    this.baseTileLayer.on("tileerror", () => {
      if (!fallbackDone) {
        fallbackDone = true;
        console.warn("Carto tile error detected, falling back to OpenStreetMap tiles.");
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);
      }
    });

    if (this.aoeCircle) this.aoeCircle.bringToFront();
  }

  /**
   * Update map position based on telemetry and Geolocation Fallback Rule:
   * IF lat and lng != 0.0: Plot AoE at hardware coordinates
   * IF lat and lng == 0.0: Plot AoE dynamically at laptop/device's live GPS coordinates
   */
  async updateTelemetryLocation(reading, colorHex = "#10b981") {
    if (!this.map) return;
    this.latestReading = reading;
    this.latestColorHex = colorHex;

    let targetLat = parseFloat(reading.lat || 0.0);
    let targetLng = parseFloat(reading.lng || 0.0);

    // Check if hardware coordinates are valid
    if (targetLat !== 0.0 && targetLng !== 0.0 && !isNaN(targetLat) && !isNaN(targetLng)) {
      this.isUsingHardwareGps = true;
      this.currentCoords = { lat: targetLat, lng: targetLng, label: "🛰️ Hardware GPS" };
      this.renderAoEZone(targetLat, targetLng, reading, colorHex, "🛰️ Hardware GPS");
    } else {
      // 3.1 Geolocation Fallback: dynamically resolve device's live coordinates
      this.isUsingHardwareGps = false;
      const coords = this.deviceLiveCoords || (await this.requestFreshDeviceLocation());
      this.currentCoords = coords;
      const sourceLabel = coords.label || "📍 Device Live GPS";
      this.renderAoEZone(coords.lat, coords.lng, reading, colorHex, sourceLabel);
    }

    return {
      coords: this.currentCoords,
      isHardwareGps: this.isUsingHardwareGps,
      label: this.currentCoords.label
    };
  }

  /**
   * 3.2 Area of Effect (AoE) Heatmap Radius:
   * Polygon circle with default radius of 100 meters, fill opacity 40%
   */
  renderAoEZone(lat, lng, reading, colorHex, sourceLabel) {
    const radiusMeters = 100;
    const aqi = reading.aqi || 0;
    const pm25 = reading.pm25 || 0;
    const pm10 = reading.pm10 || 0;
    const temp = reading.temp || 0;
    const humidity = reading.humidity || 0;
    const nodeId = reading.node_id || "node_1";
    const timestamp = reading.timestamp || "Live";

    // Popup content with telemetry
    const popupContent = `
      <div class="popup-telemetry">
        <div class="popup-node-title">📡 ${nodeId}</div>
        <div class="popup-row"><span>Source:</span> <span>${sourceLabel}</span></div>
        <div class="popup-row"><span>Coordinates:</span> <span>${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>
        <div class="popup-row"><span>AQI Index:</span> <span style="color:${colorHex}; font-weight:700;">${aqi}</span></div>
        <div class="popup-row"><span>PM2.5:</span> <span>${pm25} µg/m³</span></div>
        <div class="popup-row"><span>PM10:</span> <span>${pm10} µg/m³</span></div>
        <div class="popup-row"><span>Temperature:</span> <span>${temp} °C</span></div>
        <div class="popup-row"><span>Humidity:</span> <span>${humidity} %</span></div>
        <div class="popup-row"><span>Time:</span> <span>${timestamp}</span></div>
      </div>
    `;

    // Update or create AoE Circle (100m radius, 40% fill opacity)
    if (this.aoeCircle) {
      this.aoeCircle.setLatLng([lat, lng]);
      this.aoeCircle.setStyle({
        color: colorHex,
        fillColor: colorHex,
        fillOpacity: 0.40,
        weight: 2
      });
      this.aoeCircle.setPopupContent(popupContent);
    } else {
      this.aoeCircle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: colorHex,
        weight: 2,
        fillColor: colorHex,
        fillOpacity: 0.40
      }).addTo(this.map);
      this.aoeCircle.bindPopup(popupContent);
    }

    // Center icon pin / pulse
    const centerIcon = L.divIcon({
      className: "center-pulse-marker",
      html: `<div style="
        width: 14px;
        height: 14px;
        background-color: ${colorHex};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 12px ${colorHex};
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    if (this.centerMarker) {
      this.centerMarker.setLatLng([lat, lng]);
      this.centerMarker.setIcon(centerIcon);
    } else {
      this.centerMarker = L.marker([lat, lng], { icon: centerIcon }).addTo(this.map);
    }

    // Pan map to new live coordinates
    if (!this.hasInitialCentered) {
      this.map.setView([lat, lng], 15);
      this.hasInitialCentered = true;
    } else {
      this.map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }

  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}
