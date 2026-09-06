import L from 'leaflet';

/**
 * Creates an authentic top-down 3D-styled Ambulance / Emergency Vehicle marker
 * matching modern navigation & ride-hailing interfaces (Rapido / Uber style).
 */
export const createTopDownAmbulanceIcon = (ambulance, isAssigned = false) => {
  const heading = ambulance.heading ?? ambulance.current_heading ?? 0;
  const isAvailable = (ambulance.availability_status || ambulance.status || 'AVAILABLE') === 'AVAILABLE';
  const vehicleNumber = ambulance.vehicle_number || 'TN-09-EM-1001';
  const vehicleType = ambulance.vehicle_type || ambulance.ambulance_type || 'ALS';
  const etaText = ambulance.eta_display || (isAssigned ? 'RESPONDING' : '3 min away');

  // Color scheme:
  // Available nearby ambulances have the high-vis golden amber body seen in the photo
  // Assigned ambulances have an active emergency white/amber body with red/blue strobes and glowing halo
  const bodyGradient = isAssigned
    ? 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 50%, #E2E8F0 100%)'
    : 'linear-gradient(180deg, #FDE047 0%, #F59E0B 45%, #D97706 100%)';
  
  const borderColor = isAssigned ? '#EF4444' : '#B45309';
  const sirenHalo = isAssigned
    ? `<div class="ambulance-siren-halo"></div>`
    : '';

  const statusBadgeColor = isAssigned ? '#EF4444' : '#10B981';

  const html = `
    <div class="topdown-vehicle-marker" style="position: relative; width: 64px; height: 96px; display: flex; align-items: center; justify-content: center;">
      ${sirenHalo}
      
      <!-- Rotating Vehicle Body Container -->
      <div class="vehicle-rotate-box" style="transform: rotate(${heading}deg); width: 44px; height: 82px; position: relative; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
        
        <!-- Soft Ground Drop Shadow -->
        <svg width="44" height="82" viewBox="0 0 44 82" style="position: absolute; top: 0; left: 0; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.55)); pointer-events: none;">
          <!-- Chassis Shadow -->
          <ellipse cx="22" cy="43" rx="17" ry="34" fill="rgba(0,0,0,0.45)" />
        </svg>

        <!-- Top-Down 3D Vector Vehicle -->
        <svg width="44" height="82" viewBox="0 0 44 82" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 2;">
          <defs>
            <!-- Metallic Body Gradient -->
            <linearGradient id="bodyGrad-${ambulance.id || 'def'}-${isAssigned ? 'asg' : 'nb'}" x1="0%" y1="0%" x2="100%" y2="100%">
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

            <!-- Windshield Glass Specular -->
            <linearGradient id="windshieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#0F172A"/>
              <stop offset="60%" stop-color="#1E293B"/>
              <stop offset="100%" stop-color="#334155"/>
            </linearGradient>

            <!-- Roof Equipment Shading -->
            <linearGradient id="roofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#F8FAFC"/>
              <stop offset="100%" stop-color="#CBD5E1"/>
            </linearGradient>
          </defs>

          <!-- 4 Wheels / Tires peeking out -->
          <rect x="2" y="15" width="4" height="12" rx="2" fill="#0F172A" />
          <rect x="38" y="15" width="4" height="12" rx="2" fill="#0F172A" />
          <rect x="2" y="55" width="4" height="12" rx="2" fill="#0F172A" />
          <rect x="38" y="55" width="4" height="12" rx="2" fill="#0F172A" />

          <!-- Side Mirrors (Curved left & right) -->
          <path d="M4 25 L0 27 A2 2 0 0 0 0 31 L4 30 Z" fill="${isAssigned ? '#FFFFFF' : '#D97706'}" stroke="#0F172A" stroke-width="0.75" />
          <path d="M40 25 L44 27 A2 2 0 0 1 44 31 L40 30 Z" fill="${isAssigned ? '#FFFFFF' : '#D97706'}" stroke="#0F172A" stroke-width="0.75" />

          <!-- Main Vehicle Body Outline -->
          <path d="M 12 4 C 18 2, 26 2, 32 4 C 38 7, 40 14, 40 24 L 40 64 C 40 73, 36 78, 30 79 C 25 80, 19 80, 14 79 C 8 78, 4 73, 4 64 L 4 24 C 4 14, 6 7, 12 4 Z"
                fill="url(#bodyGrad-${ambulance.id || 'def'}-${isAssigned ? 'asg' : 'nb'})"
                stroke="${borderColor}"
                stroke-width="1.2" />

          <!-- Front Headlights (Xenon Glow) -->
          <path d="M6 7 Q11 6 11 11 Q6 10 6 7 Z" fill="#FEF08A" />
          <path d="M38 7 Q33 6 33 11 Q38 10 38 7 Z" fill="#FEF08A" />

          <!-- Front Hood Character Lines -->
          <path d="M12 9 L15 17 M32 9 L29 17" stroke="rgba(0,0,0,0.18)" stroke-width="1" stroke-linecap="round" />

          <!-- Curved Front Windshield Glass -->
          <path d="M8 18 Q22 14 36 18 L34 30 Q22 28 10 30 Z"
                fill="url(#windshieldGrad)"
                stroke="#0F172A"
                stroke-width="0.8" />
          <!-- Specular reflection streak on glass -->
          <path d="M12 20 Q22 17 32 20" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" />

          <!-- Roof Section (Emergency Medical Unit) -->
          <rect x="8.5" y="32" width="27" height="30" rx="3" fill="url(#roofGrad)" stroke="rgba(0,0,0,0.15)" stroke-width="0.8" />

          <!-- Red Medical Cross on Roof -->
          <rect x="19.5" y="37" width="5" height="15" rx="1" fill="#EF4444" />
          <rect x="14.5" y="42" width="15" height="5" rx="1" fill="#EF4444" />

          <!-- Dual Strobe Emergency Lightbar (flashes red/blue) -->
          <rect x="11" y="27" width="22" height="5" rx="2.5" fill="#0F172A" />
          <circle cx="15.5" cy="29.5" r="2.2" class="ambulance-strobe-red" fill="#EF4444" />
          <circle cx="28.5" cy="29.5" r="2.2" class="ambulance-strobe-blue" fill="#38BDF8" />
          <rect x="20.5" y="28" width="3" height="3" rx="0.5" fill="#FFFFFF" opacity="0.9" />

          <!-- Rear Windshield Glass -->
          <path d="M9 64 Q22 63 35 64 L34 72 Q22 73 10 72 Z"
                fill="url(#windshieldGrad)"
                stroke="#0F172A"
                stroke-width="0.8" />

          <!-- Rear Taillights -->
          <rect x="6" y="76" width="6" height="2.5" rx="1" fill="#EF4444" />
          <rect x="32" y="76" width="6" height="2.5" rx="1" fill="#EF4444" />
        </svg>
      </div>

      <!-- Floating Vehicle Callout Badge (Always horizontal & legible) -->
      <div class="vehicle-callout-pill" style="
        position: absolute;
        bottom: 0px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(13, 19, 34, 0.92);
        color: #F8FAFC;
        font-family: var(--font-heading, sans-serif);
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 9999px;
        border: 1px solid ${isAssigned ? '#EF4444' : 'rgba(255,255,255,0.2)'};
        white-space: nowrap;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        gap: 4px;
        z-index: 10;
        pointer-events: none;
      ">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusBadgeColor}; display: inline-block;"></span>
        <span>${isAssigned ? 'ALS ICU' : vehicleNumber.split('-').slice(-2).join('-')}</span>
        ${!isAssigned ? `<span style="color: #94A3B8; font-weight: 500;">&bull; 3m</span>` : ''}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-topdown-ambulance-marker',
    html,
    iconSize: [64, 96],
    iconAnchor: [32, 48],
    popupAnchor: [0, -38],
  });
};

/**
 * Creates the modern pickup location pin matching the user's photo:
 * - Green ring with white center dot
 * - Vertical indicator drop stem
 * - Floating address pill card with edit pencil ("41, Potheri, S... ✎")
 * - Expanding radar pulse wave
 */
export const createModernPickupIcon = (rawAddress = '41, Potheri, SRM Campus', onClick = null) => {
  const address = typeof rawAddress === 'string' && rawAddress ? rawAddress : '41, Potheri, SRM Campus';
  const shortAddress = address.length > 24 ? `${address.slice(0, 22)}...` : address;

  const html = `
    <div class="modern-pickup-container" style="position: relative; width: 180px; height: 80px; pointer-events: auto;">
      <!-- Pulse radar waves expanding outward -->
      <div class="pickup-radar-ring ring-1"></div>
      <div class="pickup-radar-ring ring-2"></div>

      <!-- Floating Address Pill Card (Rapido/Uber style) -->
      <div class="pickup-address-card" style="
        position: absolute;
        top: 0px;
        left: 50%;
        transform: translateX(-50%);
        background: #FFFFFF;
        color: #0F172A;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 700;
        padding: 5px 12px 5px 10px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        border: 1px solid rgba(0, 0, 0, 0.08);
      ">
        <span style="color: #059669; font-size: 14px;">📍</span>
        <span style="color: #0F172A; max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${shortAddress}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      </div>

      <!-- Vertical stem connecting card to ground target -->
      <div style="
        position: absolute;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        width: 2.5px;
        height: 18px;
        background: #0F172A;
        border-radius: 2px;
      "></div>

      <!-- Green ground target ring with white center (matching screenshot) -->
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
    html,
    iconSize: [180, 80],
    iconAnchor: [90, 59], // Anchored right at the center of the ground target ring
    popupAnchor: [0, -60],
  });
};

/**
 * Creates modern hospital destination marker
 */
export const createModernHospitalIcon = (hospital, isSelected = false) => {
  const color = isSelected ? '#3B82F6' : '#10B981';
  const name = (hospital.name || 'Hospital').split(' ')[0];

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
    html,
    iconSize: [80, 64],
    iconAnchor: [40, 20],
    popupAnchor: [0, -22],
  });
};
