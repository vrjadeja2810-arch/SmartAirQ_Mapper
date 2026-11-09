/**
 * Leaflet Map Manager with AoE Heatmap Zone and Geolocation Fallback
 */

export class AirQualityMap {
  constructor(containerId = "map") {
    this.containerId = containerId;
    this.map = null;
    this.baseTileLayer = null;
    this.aoeCircle = null;
    this.centerMarker = null;
    this.currentCoords = { lat: 20.5937, lng: 78.9629 }; // Default fallback (India central)
    this.isUsingHardwareGps = false;
    this.browserCoords = null;
    this.initMap();
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
    }).setView([this.currentCoords.lat, this.currentCoords.lng], 15);

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(this.map);

    // Initial default Carto tile layer
    this.setCartoConfig({ cartoMapStyle: "voyager" });
  }

  /**
   * Configure Carto Basemap with optional private API key and style preset
   */
  setCartoConfig(config = {}) {
    if (!this.map) return;
    const key = config.cartoApiKey ? config.cartoApiKey.trim() : "";
    const style = config.cartoMapStyle || "voyager";

    let tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png`;
    if (key) {
      tileUrl += `?api_key=${encodeURIComponent(key)}`;
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
  }

  /**
   * Update map position based on telemetry and Geolocation Fallback Rule:
   * IF lat and lng != 0.0: Plot AoE at hardware coordinates
   * IF lat and lng == 0.0: Trigger navigator.geolocation.getCurrentPosition()
   */
  async updateTelemetryLocation(reading, colorHex = "#10b981") {
    if (!this.map) return;

    let targetLat = parseFloat(reading.lat || 0.0);
    let targetLng = parseFloat(reading.lng || 0.0);

    // Check if hardware coordinates are valid
    if (targetLat !== 0.0 && targetLng !== 0.0 && !isNaN(targetLat) && !isNaN(targetLng)) {
      this.isUsingHardwareGps = true;
      this.currentCoords = { lat: targetLat, lng: targetLng };
      this.renderAoEZone(targetLat, targetLng, reading, colorHex, "Hardware GPS");
    } else {
      // 3.1 Geolocation Fallback
      this.isUsingHardwareGps = false;
      const coords = await this.resolveBrowserLocation();
      this.currentCoords = coords;
      this.renderAoEZone(coords.lat, coords.lng, reading, colorHex, "Browser Geolocation Fallback");
    }

    return {
      coords: this.currentCoords,
      isHardwareGps: this.isUsingHardwareGps
    };
  }

  resolveBrowserLocation() {
    return new Promise((resolve) => {
      if (this.browserCoords) {
        return resolve(this.browserCoords);
      }

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.browserCoords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            };
            resolve(this.browserCoords);
          },
          (err) => {
            console.warn("Geolocation fallback denied or failed:", err.message);
            // Default center if browser denies permission
            const fallback = { lat: 23.0225, lng: 72.5714 }; // Default Ahmedabad coordinate
            resolve(fallback);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        resolve({ lat: 23.0225, lng: 72.5714 });
      }
    });
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
        <div class="popup-row"><span>Coordinates:</span> <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span></div>
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
        box-shadow: 0 0 10px ${colorHex};
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

    // Smoothly pan map to new coordinates
    this.map.panTo([lat, lng], { animate: true, duration: 0.8 });
  }

  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}
