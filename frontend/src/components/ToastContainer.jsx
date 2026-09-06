import React from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useWebSocket();

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const isCrimson = toast.type === 'crimson';
        const isEmerald = toast.type === 'emerald';
        const isAmber = toast.type === 'amber';

        const borderColor = isCrimson ? '#EF4444' : isEmerald ? '#10B981' : isAmber ? '#F59E0B' : '#06B6D4';
        const Icon = isCrimson ? AlertCircle : isEmerald ? CheckCircle2 : Info;
        const iconColor = borderColor;

        return (
          <div
            key={toast.id}
            className="toast"
            style={{
              borderLeft: `4px solid ${borderColor}`,
            }}
          >
            <Icon size={20} color={iconColor} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFF' }}>{toast.title}</div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px', wordBreak: 'break-word' }}>
                {typeof toast.message === 'object' && toast.message !== null
                  ? Array.isArray(toast.message)
                    ? toast.message.map((m) => (typeof m === 'object' && m !== null ? m.msg || JSON.stringify(m) : String(m))).join(', ')
                    : toast.message.message || toast.message.detail || toast.message.msg || JSON.stringify(toast.message)
                  : String(toast.message ?? '')}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
