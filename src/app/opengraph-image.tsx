import { ImageResponse } from 'next/og';

export const alt = 'TRUNGTAMMMO.COM';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: 48,
          background:
            'radial-gradient(circle at top left, rgba(37,99,235,0.28), transparent 32%), radial-gradient(circle at bottom right, rgba(16,185,129,0.18), transparent 28%), linear-gradient(135deg, #071120 0%, #0f172a 52%, #111827 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 28,
            borderRadius: 32,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.06))',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 18px',
                borderRadius: 999,
                background: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(96,165,250,0.22)',
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 4,
                textTransform: 'uppercase',
              }}
            >
              TRUNGTAMMMO
            </div>
            <div
              style={{
                display: 'flex',
                padding: '12px 18px',
                borderRadius: 999,
                background: 'rgba(16,185,129,0.14)',
                border: '1px solid rgba(16,185,129,0.22)',
                color: '#6ee7b7',
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              MMO Platform
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 76,
                lineHeight: 1.02,
                fontWeight: 900,
                letterSpacing: -3,
                textTransform: 'uppercase',
              }}
            >
              MMO đa dịch vụ, giao diện sắc hơn và luồng vận hành ổn định.
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 26,
                maxWidth: 780,
                fontSize: 30,
                lineHeight: 1.45,
                color: '#cbd5e1',
              }}
            >
              SMM, Auto MXH, tài nguyên số, forum MMO, nạp tiền và cụm quản trị cho vận hành hằng ngày.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18 }}>
            {['SMM', 'Auto MXH', 'Resources', 'Forum MMO'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  padding: '14px 20px',
                  borderRadius: 18,
                  background: 'rgba(15,23,42,0.72)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  color: '#e2e8f0',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 1,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
