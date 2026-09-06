/**
 * ResQ Core Client Engine
 * - Role Management & Demo Auth
 * - Bi-Directional WebSocket Pub/Sub
 * - Web Audio Emergency Siren Synthesizer
 * - Dynamic 1-Click Live Simulation Trigger
 * - Toast Notification System
 */

const RESQ = {
  user: null,
  ws: null,
  isSimulating: false,
  audioCtx: null,
  sirenOscillator: null,
  sirenGain: null,
  sirenInterval: null,

  init() {
    this.loadUser();
    this.setupToasts();
    this.setupSimulation();
    this.connectWebSocket();
    this.highlightActiveNav();
  },

  // --- Auth & User State ---
  loadUser() {
    try {
      const stored = localStorage.getItem('resq_user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not parse stored user', e);
    }
  },

  async switchRole(role, targetUrl) {
    try {
      this.toast('Switching Role...', `Switching persona to ${role.replace('_', ' ')}`, 'info');
      const res = await fetch(`/api/v1/auth/demo-login?role=${encodeURIComponent(role)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Demo login failed');
      const data = await res.json();
      this.user = data.user;
      localStorage.setItem('resq_user', JSON.stringify(data.user));
      localStorage.setItem('resq_token', data.access_token);
      document.cookie = `resq_token=${data.access_token}; path=/; max-age=86400; SameSite=Lax`;
      
      // Navigate to target URL
      if (targetUrl) {
        window.location.href = targetUrl;
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      this.toast('Role Switch Error', err.message, 'crimson');
      if (targetUrl) window.location.href = targetUrl;
    }
  },

  highlightActiveNav() {
    const path = window.location.pathname.toLowerCase();
    document.querySelectorAll('.demo-role-btn').forEach(btn => {
      const target = btn.getAttribute('data-path');
      if (target === path || (target === '/' && path === '/')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  // --- Web Audio Siren Synthesizer ---
  playSiren() {
    try {
      if (this.sirenOscillator) return; // already playing
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioCtx = new AudioContext();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();

      let freq = 600;
      let goingUp = true;
      this.sirenInterval = setInterval(() => {
        if (!this.audioCtx) return;
        freq = goingUp ? 880 : 440;
        goingUp = !goingUp;
        osc.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.15);
      }, 400);

      this.sirenOscillator = osc;
      this.sirenGain = gain;
    } catch (e) {
      console.warn('Audio Siren Error', e);
    }
  },

  stopSiren() {
    try {
      if (this.sirenInterval) clearInterval(this.sirenInterval);
      if (this.sirenOscillator) {
        this.sirenOscillator.stop();
        this.sirenOscillator.disconnect();
      }
      if (this.audioCtx) {
        this.audioCtx.close();
      }
    } catch (e) {
      // ignore
    } finally {
      this.sirenOscillator = null;
      this.sirenInterval = null;
      this.audioCtx = null;
    }
  },

  playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  },

  // --- 1-Click Live Simulation Engine ---
  async setupSimulation() {
    const simBtn = document.getElementById('global-sim-btn');
    if (!simBtn) return;

    try {
      const res = await fetch('/api/v1/simulation/status');
      if (res.ok) {
        const data = await res.json();
        this.setSimulationState(data.is_running);
      }
    } catch (e) {
      console.warn('Simulation status check failed', e);
    }

    simBtn.addEventListener('click', () => this.toggleSimulation());
  },

  setSimulationState(running) {
    this.isSimulating = running;
    const simBtn = document.getElementById('global-sim-btn');
    if (!simBtn) return;
    if (running) {
      simBtn.innerHTML = `
        <span class="pulsing-dot emerald" style="width:8px;height:8px;"></span>
        <span>⏹ Stop Simulation</span>
      `;
      simBtn.classList.remove('btn-emerald');
      simBtn.classList.add('btn-danger-outline');
    } else {
      simBtn.innerHTML = `
        <span>▶ 1-Click Live Simulation</span>
      `;
      simBtn.classList.remove('btn-danger-outline');
      simBtn.classList.add('btn-emerald');
    }
  },

  async toggleSimulation() {
    const simBtn = document.getElementById('global-sim-btn');
    if (simBtn) simBtn.disabled = true;

    try {
      if (this.isSimulating) {
        const res = await fetch('/api/v1/simulation/stop', { method: 'POST' });
        if (res.ok) {
          this.setSimulationState(false);
          this.toast('Simulation Stopped', 'Live simulation halted', 'amber');
        }
      } else {
        const res = await fetch('/api/v1/simulation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emergency_type: 'Cardiac emergency',
            severity_level: 'CRITICAL',
            auto_advance_seconds: 2.2,
          }),
        });
        if (res.ok) {
          this.setSimulationState(true);
          this.playChime();
          this.toast('🚀 Live Simulation Launched!', 'Ambulance is driving across Chennai with live GPS updates', 'emerald');
          // If not on citizen page, auto transition or invite
          if (window.location.pathname !== '/citizen') {
            setTimeout(() => {
              window.location.href = '/citizen';
            }, 700);
          }
        } else {
          const err = await res.json();
          this.toast('Simulation Failed', err.detail || 'Could not start', 'crimson');
        }
      }
    } catch (err) {
      this.toast('Simulation Error', err.message, 'crimson');
    } finally {
      if (simBtn) simBtn.disabled = false;
    }
  },

  // --- WebSocket PubSub ---
  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Choose WebSocket endpoint based on role or fallback to dispatcher broad channel
    let wsPath = '/ws/dispatcher';
    if (this.user) {
      if (this.user.role === 'DRIVER' || this.user.role === 'AMBULANCE_DRIVER') {
        wsPath = `/ws/driver/${this.user.id}`;
      } else if (this.user.role === 'HOSPITAL_STAFF' && this.user.hospital_id) {
        wsPath = `/ws/hospital/${this.user.hospital_id}`;
      } else if (this.user.id) {
        wsPath = `/ws/user/${this.user.id}`;
      }
    }

    const wsUrl = `${protocol}//${host}${wsPath}`;
    const statusDot = document.getElementById('ws-status-dot');
    const statusText = document.getElementById('ws-status-text');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (statusDot) statusDot.className = 'pulsing-dot emerald';
        if (statusText) statusText.textContent = 'WS Live';
        // Start ping heartbeat
        this.wsPingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          // not JSON
        }
      };

      this.ws.onclose = () => {
        if (statusDot) statusDot.className = 'pulsing-dot';
        if (statusText) statusText.textContent = 'Reconnecting...';
        if (this.wsPingInterval) clearInterval(this.wsPingInterval);
        setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = () => {
        if (statusDot) statusDot.className = 'pulsing-dot';
      };
    } catch (e) {
      console.warn('WS Init error', e);
    }
  },

  handleServerMessage(msg) {
    // Broadcast event to entire window for specific page listeners
    window.dispatchEvent(new CustomEvent('resq:msg', { detail: msg }));

    if (msg.event === 'SIMULATION_STARTED') {
      this.setSimulationState(true);
    } else if (msg.event === 'SIMULATION_ENDED') {
      this.setSimulationState(false);
      if (msg.data?.status === 'CANCELLED' || msg.data?.message?.toLowerCase().includes('cancel')) {
        this.toast('Simulation Cancelled', 'Emergency response mission was aborted', 'amber');
      } else {
        this.toast('Simulation Complete', 'Emergency lifecycle finished successfully', 'emerald');
        if (window.confetti) {
          window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        }
      }
    } else if (msg.event === 'DISPATCH_REQUEST' || msg.event === 'NEW_DISPATCH_OFFER') {
      this.playSiren();
      this.toast('🚨 EMERGENCY DISPATCH ALERT', `Pickup: ${msg.data?.pickup_address || 'Patient Location'}`, 'crimson');
    }
  },

  // --- Toasts ---
  setupToasts() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  },

  toast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'toast';
    const borderColors = {
      emerald: '#10B981',
      crimson: '#EF4444',
      amber: '#F59E0B',
      info: '#3B82F6',
    };
    const icons = {
      emerald: '✅',
      crimson: '🚨',
      amber: '⚠️',
      info: 'ℹ️',
    };

    el.style.borderLeft = `4px solid ${borderColors[type] || '#3B82F6'}`;
    el.innerHTML = `
      <div style="font-size: 1.3rem;">${icons[type] || 'ℹ️'}</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 0.88rem; color: #FFF;">${title}</div>
        <div style="font-size: 0.78rem; color: #94A3B8;">${message}</div>
      </div>
    `;

    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 4500);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  RESQ.init();
});
