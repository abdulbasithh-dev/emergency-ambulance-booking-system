/**
 * ResQ Leaflet Map Engine
 * Top-Down 3D Vehicle SVGs with Strobe Lights, Dynamic Waypoint Polyline & Live GPS Animation
 */

const RESQ_MAP = {
  // Tile layer configurations
  tiles: {
    modern: {
      name: 'Modern Clean',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
      attribution: '&copy; Esri &copy; OpenStreetMap contributors',
    },
    dark: {
      name: 'Tactical Dark',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 16,
      attribution: '&copy; Esri, HERE, DeLorme',
    },
    osm: {
      name: 'Standard OSM',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    },
  },

  init(containerId, options = {}) {
    const lat = options.center ? options.center[0] : 12.8235;
    const lng = options.center ? options.center[1] : 80.0445;
    const zoom = options.zoom || 15;

    const map = L.map(containerId, {
      zoomControl: false,
    }).setView([lat, lng], zoom);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Tile Layer
    const activeTileKey = options.tile || 'modern';
    const tileConfig = this.tiles[activeTileKey] || this.tiles.modern;
    let currentTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    // Map style selector overlay button
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'map-style-toggle-bar';
    toggleContainer.innerHTML = `
      <button class="map-style-btn active" data-style="modern">☀️ Clean</button>
      <button class="map-style-btn" data-style="dark">🌙 Dark</button>
      <button class="map-style-btn" data-style="osm">🗺️ OSM</button>
    `;
    const mapEl = document.getElementById(containerId);
    if (mapEl) {
      mapEl.style.position = 'relative';
      mapEl.appendChild(toggleContainer);

      toggleContainer.querySelectorAll('.map-style-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const style = btn.getAttribute('data-style');
          toggleContainer.querySelectorAll('.map-style-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          if (this.tiles[style]) {
            map.removeLayer(currentTileLayer);
            currentTileLayer = L.tileLayer(this.tiles[style].url, {
              attribution: this.tiles[style].attribution,
              maxZoom: this.tiles[style].maxZoom,
            }).addTo(map);
          }
        });
      });
    }

    return map;
  },

  // --- Top-Down 3D Ambulance Icon ---
  createAmbulanceIcon(ambulance = {}, isAssigned = false) {
    const heading = ambulance.heading ?? ambulance.current_heading ?? 0;
    const vehicleNumber = ambulance.vehicle_number || 'TN-09-EM-1001';
    const borderColor = isAssigned ? '#EF4444' : '#B45309';
    const sirenHalo = isAssigned ? '<div class="ambulance-siren-halo"></div>' : '';

    const html = `
      <div class="topdown-vehicle-marker" style="position: relative; width: 64px; height: 96px; display: flex; align-items: center; justify-content: center;">
        ${sirenHalo}
        <div class="vehicle-rotate-box" style="transform: rotate(${heading}deg); width: 44px; height: 82px; position: relative; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
          <svg width="44" height="82" viewBox="0 0 44 82" style="position: absolute; top: 0; left: 0; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.55)); pointer-events: none;">
            <ellipse cx="22" cy="43" rx="17" ry="34" fill="rgba(0,0,0,0.45)" />
          </svg>
          <svg width="44" height="82" viewBox="0 0 44 82" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 2;">
            <defs>
              <linearGradient id="bodyGrad-${ambulance.id || 'amb'}" x1="0%" y1="0%" x2="100%" y2="100%">
                ${isAssigned ? `
                  <stop offset="0%" stop-color="#FFFFFF"/>
                  <stop offset="50%" stop-color="#F8FAFC"/>
                  <stop offset="100%" stop-color="#E2E8F0"/>
                ` : `
                  <stop offset="0%" stop-color="#FEF08A"/>
                  <stop offset="35%" stop-color="#FBBF24"/>
                  <stop offset="70%" stop-color="#F59E0B"/>
                  <stop offset="100%" stop-color="#D97706"/>
                `}
              </linearGradient>
            </defs>
            <rect x="2" y="15" width="4" height="12" rx="2" fill="#0F172A" />
            <rect x="38" y="15" width="4" height="12" rx="2" fill="#0F172A" />
            <rect x="2" y="55" width="4" height="12" rx="2" fill="#0F172A" />
            <rect x="38" y="55" width="4" height="12" rx="2" fill="#0F172A" />
            <path d="M 12 4 C 18 2, 26 2, 32 4 C 38 7, 40 14, 40 24 L 40 64 C 40 73, 36 78, 30 79 C 25 80, 19 80, 14 79 C 8 78, 4 73, 4 64 L 4 24 C 4 14, 6 7, 12 4 Z"
                  fill="url(#bodyGrad-${ambulance.id || 'amb'})"
                  stroke="${borderColor}"
                  stroke-width="1.2" />
            <path d="M6 7 Q11 6 11 11 Q6 10 6 7 Z" fill="#FEF08A" />
            <path d="M38 7 Q33 6 33 11 Q38 10 38 7 Z" fill="#FEF08A" />
            <path d="M8 18 Q22 14 36 18 L34 30 Q22 28 10 30 Z" fill="#1E293B" stroke="#0F172A" stroke-width="0.8" />
            <rect x="10" y="32" width="24" height="42" rx="3" fill="#FFFFFF" stroke="rgba(0,0,0,0.15)" stroke-width="0.6" />
            <!-- Emergency Red Cross on Roof -->
            <rect x="19.5" y="44" width="5" height="16" rx="1.5" fill="#EF4444" />
            <rect x="14" y="49.5" width="16" height="5" rx="1.5" fill="#EF4444" />
            <!-- Dual Alternating Strobes -->
            <rect x="13" y="24" width="7" height="4" rx="1.5" class="ambulance-strobe-red" />
            <rect x="24" y="24" width="7" height="4" rx="1.5" class="ambulance-strobe-blue" />
          </svg>
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-topdown-ambulance-marker',
      html: html,
      iconSize: [64, 96],
      iconAnchor: [32, 48],
      popupAnchor: [0, -32],
    });
  },

  // --- Pickup Radar Pin ---
  createPickupIcon(label = 'Patient SOS Location') {
    const html = `
      <div style="position: relative; width: 180px; height: 80px; display: flex; align-items: center; justify-content: center;">
        <div class="pickup-radar-ring ring-1"></div>
        <div class="pickup-radar-ring ring-2"></div>
        <div class="pickup-address-card" style="
          position: absolute;
          top: 0px;
          left: 50%;
          transform: translateX(-50%);
          background: #FFFFFF;
          color: #0F172A;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          border: 1px solid rgba(0, 0, 0, 0.08);
        ">
          <span style="color: #059669; font-size: 13px;">📍</span>
          <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${label}</span>
        </div>
        <div style="
          position: absolute;
          top: 26px;
          left: 50%;
          transform: translateX(-50%);
          width: 2.5px;
          height: 20px;
          background: #0F172A;
          border-radius: 2px;
        "></div>
        <div style="
          position: absolute;
          top: 48px;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 4px solid #10B981;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></div>
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-modern-pickup-marker',
      html: html,
      iconSize: [180, 80],
      iconAnchor: [90, 59],
      popupAnchor: [0, -60],
    });
  },

  // --- Modern Hospital Icon ---
  createHospitalIcon(hospital = {}, isSelected = false) {
    const color = isSelected ? '#3B82F6' : '#10B981';
    const name = (hospital.name || 'Trauma Center').split(' ')[0];

    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 80px; height: 64px;">
        <div style="
          background: #0F172A;
          border: 2px solid ${color};
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px ${color}60;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <div style="
          background: #FFFFFF;
          color: #0F172A;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 3px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          white-space: nowrap;
        ">
          ${name} ER
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-modern-hospital-marker',
      html: html,
      iconSize: [80, 64],
      iconAnchor: [40, 20],
      popupAnchor: [0, -22],
    });
  },
};
