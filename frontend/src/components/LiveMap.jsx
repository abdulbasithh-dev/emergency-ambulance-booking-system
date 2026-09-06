import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  createTopDownAmbulanceIcon,
  createModernPickupIcon,
  createModernHospitalIcon,
} from './VehicleIcon';

// Modern Map Tile Configurations (Rapido / Uber Navigation & Tactical Modes, 100% watermark-free)
const MAP_TILES = {
  modern: {
    name: 'Modern Clean',
    icon: '☀️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
  dark: {
    name: 'Tactical Dark',
    icon: '🌙',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; HERE, DeLorme, MapmyIndia',
    subdomains: 'abc',
    maxZoom: 16,
  },
  osm: {
    name: 'Standard OSM',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
    maxZoom: 19,
  },
};

// Map controller helper component for smooth camera updates
const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom(), { animate: true, duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
};

export const LiveMap = ({
  center = [12.8235, 80.0445], // Default Potheri, SRM Campus area (matching user's attached photo)
  zoom = 15,
  ambulances = [],
  hospitals = [],
  emergency = null,
  assignedAmbulance = null,
  assignedHospital = null,
  routeCoordinates = [],
  height = '100%',
  onMarkerClick = null,
  showNearbyRadar = true,
}) => {
  const [mapStyle, setMapStyle] = useState('modern'); // Default to modern clean (Rapido style)
  const [activeCenter, setActiveCenter] = useState(center);

  const emLat = emergency?.pickup_lat ?? emergency?.pickup_latitude;
  const emLng = emergency?.pickup_lng ?? emergency?.pickup_longitude;
  const hospLat = assignedHospital?.latitude;
  const hospLng = assignedHospital?.longitude;

  const isAtScene = emergency?.status === 'ARRIVED_AT_PICKUP' || emergency?.status === 'ARRIVED_AT_SCENE';
  const isAtHosp = emergency?.status === 'ARRIVED_AT_HOSPITAL';

  const rawAmbLat = assignedAmbulance?.current_lat ?? assignedAmbulance?.current_latitude;
  const rawAmbLng = assignedAmbulance?.current_lng ?? assignedAmbulance?.current_longitude;

  const ambLat = isAtScene && emLat ? emLat : (isAtHosp && hospLat ? hospLat : rawAmbLat);
  const ambLng = isAtScene && emLng ? emLng : (isAtHosp && hospLng ? hospLng : rawAmbLng);

  const effLat = isAtScene && emLat ? emLat : (ambLat ?? emLat ?? (center ? center[0] : 12.8235));
  const effLng = isAtScene && emLng ? emLng : (ambLng ?? emLng ?? (center ? center[1] : 80.0445));

  // Sync internal active center only when coordinates actually change
  useEffect(() => {
    setActiveCenter((prev) => {
      if (prev && prev[0] === effLat && prev[1] === effLng) return prev;
      return [effLat, effLng];
    });
  }, [effLat, effLng]);

  // ---------------------------------------------------------------------------
  // Nearby Ambulances Cruising / Roaming Animation Engine (Rapido / Uber Radar)
  // ---------------------------------------------------------------------------
  // Simulates 3-4 nearby ambulances stationed along local streets around the citizen,
  // continuously cruising with smooth rotation and movement along road angles.
  const [nearbyFleet, setNearbyFleet] = useState([]);

  // Coarse key so nearby vehicles don't reset unless user moves significantly
  const coarseKey = `${Math.round(effLat * 80)}_${Math.round(effLng * 80)}`;

  useEffect(() => {
    const cLat = effLat;
    const cLng = effLng;

    // Seed 3-4 realistic nearby ambulances spaced along road corridors
    const initialNearby = [
      {
        id: 'nearby-1',
        vehicle_number: 'TN-09-EM-1002',
        vehicle_type: 'ALS',
        model_info: 'Tata Winger ALS ICU',
        current_lat: cLat + 0.0058,
        current_lng: cLng - 0.0035,
        heading: 38,
        speed_kmh: 42,
        eta_display: '2 min away',
        availability_status: 'AVAILABLE',
      },
      {
        id: 'nearby-2',
        vehicle_number: 'TN-11-EM-2045',
        vehicle_type: 'ALS',
        model_info: 'Force Traveller Trauma Unit',
        current_lat: cLat - 0.0042,
        current_lng: cLng + 0.0048,
        heading: 215,
        speed_kmh: 38,
        eta_display: '4 min away',
        availability_status: 'AVAILABLE',
      },
      {
        id: 'nearby-3',
        vehicle_number: 'TN-04-EM-3118',
        vehicle_type: 'BLS',
        model_info: 'Mahindra Bolero Emergency Rescue',
        current_lat: cLat + 0.0028,
        current_lng: cLng + 0.0062,
        heading: 140,
        speed_kmh: 40,
        eta_display: '5 min away',
        availability_status: 'AVAILABLE',
      },
    ];

    setNearbyFleet(initialNearby);

    // Subtle continuous road cruising animation loop (updates every 2 seconds)
    const cruiseInterval = setInterval(() => {
      setNearbyFleet((prevFleet) =>
        prevFleet.map((amb) => {
          const rad = ((amb.heading - 90) * Math.PI) / 180;
          // Step approx 18-25 meters in direction of heading
          const step = 0.00018 + (Math.random() * 0.00008);
          let newLat = amb.current_lat + Math.cos(rad) * step;
          let newLng = amb.current_lng + Math.sin(rad) * step;
          let newHeading = amb.heading;

          // Boundary turn check: keep cruising within ~1.8 km of center
          const distFromCenter = Math.hypot(newLat - cLat, newLng - cLng);
          if (distFromCenter > 0.012) {
            // Turn back towards center area with slight randomized road curve
            const angleToCenter = (Math.atan2(cLng - newLng, cLat - newLat) * 180) / Math.PI;
            newHeading = (angleToCenter + 360 + (Math.random() * 20 - 10)) % 360;
          } else if (Math.random() < 0.25) {
            // Occasional gentle street curve (e.g. 15 to 30 deg turn)
            newHeading = (amb.heading + (Math.random() > 0.5 ? 25 : -25) + 360) % 360;
          }

          return {
            ...amb,
            current_lat: newLat,
            current_lng: newLng,
            heading: Math.round(newHeading),
          };
        })
      );
    }, 2000);

    return () => clearInterval(cruiseInterval);
  }, [coarseKey]);

  const effectiveCenter = useMemo(() => [effLat, effLng], [effLat, effLng]);

  // Combine passed ambulances with nearby radar fleet (avoiding duplicates)
  const combinedAmbulances = useMemo(() => {
    const list = [...ambulances];
    const existingIds = new Set(list.map((a) => a.id));

    // If assigned ambulance isn't in list yet, include it
    if (assignedAmbulance && !existingIds.has(assignedAmbulance.id)) {
      list.push(assignedAmbulance);
      existingIds.add(assignedAmbulance.id);
    }

    // Include nearby cruising ambulances if radar is active
    if (showNearbyRadar) {
      for (const nb of nearbyFleet) {
        if (!existingIds.has(nb.id)) {
          list.push(nb);
        }
      }
    }

    return list;
  }, [ambulances, assignedAmbulance, nearbyFleet, showNearbyRadar]);

  // Build dual-layer route polyline points (Google Maps / Rapido style)
  const effectiveRoute = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length > 1) {
      return routeCoordinates;
    }
    if (isAtScene && emLat && emLng && hospLat && hospLng) {
      return [
        [emLat, emLng],
        [hospLat, hospLng],
      ];
    }
    if (ambLat && ambLng && emLat && emLng) {
      return [
        [ambLat, ambLng],
        [emLat, emLng],
        ...(hospLat && hospLng ? [[hospLat, hospLng]] : []),
      ];
    }
    return [];
  }, [routeCoordinates, isAtScene, emLat, emLng, hospLat, hospLng, ambLat, ambLng]);

  const tileConfig = MAP_TILES[mapStyle] || MAP_TILES.modern;

  return (
    <div style={{ width: '100%', height, position: 'relative', overflow: 'hidden', borderRadius: 'inherit' }}>
      {/* Floating Modern Map Style Selector (Matching Modern Navigation UI) */}
      <div className="map-style-toggle-bar">
        {Object.entries(MAP_TILES).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setMapStyle(key)}
            className={`map-style-btn ${mapStyle === key ? 'active' : ''}`}
            title={`Switch to ${cfg.name}`}
          >
            <span>{cfg.icon}</span>
            <span>{cfg.name}</span>
          </button>
        ))}

        <button
          onClick={() => setActiveCenter([effectiveCenter[0], effectiveCenter[1]])}
          className="map-style-btn"
          style={{ marginLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '8px' }}
          title="Recenter on pickup location"
        >
          <span>🎯</span>
          <span>Recenter</span>
        </button>
      </div>

      <MapContainer
        center={effectiveCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <MapController center={activeCenter} zoom={zoom} />

        {/* Crisp Modern Vector Map Tiles */}
        <TileLayer
          key={mapStyle}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          subdomains={tileConfig.subdomains || 'abc'}
          maxZoom={tileConfig.maxZoom}
        />

        {/* Dual-Layer Navigation Route Polyline (Matching Rapido / Uber screenshot) */}
        {effectiveRoute.length > 1 && (
          <>
            {/* Outer Dark Casing Polyline */}
            <Polyline
              positions={effectiveRoute}
              pathOptions={{
                color: '#0F172A',
                weight: 8,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Inner Electric Cyan / Emerald High-Vis Nav Polyline */}
            <Polyline
              positions={effectiveRoute}
              pathOptions={{
                color: '#06B6D4',
                weight: 4.5,
                opacity: 1.0,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}

        {/* Active Emergency (Citizen Pickup Beacon Marker - Matching Screenshot) */}
        {emergency && emLat && emLng && (
          <>
            {/* Soft Green Coverage Radar Circle */}
            <Circle
              center={[emLat, emLng]}
              radius={350}
              pathOptions={{
                color: '#10B981',
                fillColor: '#10B981',
                fillOpacity: 0.08,
                weight: 1.2,
                dashArray: '4, 6',
              }}
            />

            {/* Modern Pickup Indicator Pin with Floating Address Card */}
            <Marker
              position={[emLat, emLng]}
              icon={createModernPickupIcon(emergency.pickup_address || '41, Potheri, SRM Campus')}
            >
              <Popup>
                <div style={{ padding: '8px', minWidth: '180px' }}>
                  <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                    📍 Patient Pickup Location
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#CBD5E1', marginBottom: '4px' }}>
                    <strong>Address:</strong> {emergency.pickup_address || '41, Potheri, SRM Campus, Chennai'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                    <strong>Emergency:</strong> {emergency.emergency_type ? emergency.emergency_type.replace(/_/g, ' ') : 'Medical'}<br />
                    <strong>Priority:</strong> <span style={{ color: '#EF4444', fontWeight: 700 }}>{emergency.priority || emergency.severity_level || 'CRITICAL'}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Top-Down 3D Ambulances (Live Assigned + Roaming Nearby Radar Fleet) */}
        {combinedAmbulances.map((amb) => {
          const isAssigned = assignedAmbulance?.id === amb.id;
          let lat = amb.current_lat ?? amb.current_latitude;
          let lng = amb.current_lng ?? amb.current_longitude;

          // If assigned and reached destination, snap directly
          if (isAssigned && isAtScene && emLat && emLng) {
            lat = emLat;
            lng = emLng;
          } else if (isAssigned && isAtHosp && hospLat && hospLng) {
            lat = hospLat;
            lng = hospLng;
          }

          if (!lat || !lng) return null;

          const ambStatus = isAssigned && isAtScene
            ? 'ARRIVED ON SCENE'
            : isAssigned
            ? 'EN ROUTE TO SCENE'
            : amb.availability_status || amb.status || 'AVAILABLE';

          const ambType = amb.vehicle_type || amb.ambulance_type || 'ALS';
          const driver = amb.driver_name || amb.driver?.full_name || 'Assigned Specialist';

          return (
            <Marker
              key={amb.id || amb.vehicle_number}
              position={[lat, lng]}
              icon={createTopDownAmbulanceIcon(amb, isAssigned)}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick('ambulance', amb),
              }}
            >
              <Popup>
                <div style={{ padding: '8px', minWidth: '190px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isAssigned ? '#EF4444' : '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🚑</span>
                    <span>{amb.vehicle_number}</span>
                    <span style={{ fontSize: '0.75rem', padding: '1px 5px', borderRadius: '4px', background: isAssigned ? '#EF444425' : '#F59E0B25' }}>
                      {ambType}
                    </span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.5 }}>
                    <strong>Status:</strong> <span style={{ color: isAssigned ? '#EF4444' : '#10B981', fontWeight: 600 }}>{ambStatus.replace(/_/g, ' ')}</span><br />
                    <strong>Equipment:</strong> {amb.model_info || 'Force Traveller ALS ICU'}<br />
                    <strong>Driver:</strong> {driver}<br />
                    <strong>Speed:</strong> {amb.speed_kmh || amb.speed || 40} km/h
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Hospitals */}
        {hospitals.map((hosp) => {
          if (!hosp.latitude || !hosp.longitude) return null;
          const isSelected = assignedHospital?.id === hosp.id;
          const deptStatus = hosp.emergency_department_status || hosp.emergency_dept_status || 'NORMAL';
          return (
            <Marker
              key={hosp.id}
              position={[hosp.latitude, hosp.longitude]}
              icon={createModernHospitalIcon(hosp, isSelected)}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick('hospital', hosp),
              }}
            >
              <Popup>
                <div style={{ padding: '8px', minWidth: '180px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#38BDF8' }}>
                    🏥 {hosp.name}
                  </div>
                  <div style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.5 }}>
                    <strong>ICU Beds:</strong> <span style={{ color: '#10B981' }}>{hosp.icu_beds_available ?? 0}</span> / {hosp.icu_beds_total ?? 10}<br />
                    <strong>General Beds:</strong> {hosp.general_beds_available ?? 0} / {hosp.general_beds_total ?? 50}<br />
                    <strong>ER Status:</strong> {deptStatus}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
