import { ImageResponse } from 'next/og';

export const alt = 'TRUNGTAMMMO.VN';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: 52,
          background:
            'radial-gradient(circle at top right, rgba(59,130,246,0.22), transparent 30%), radial-gradient(circle at bottom left, rgba(168,85,247,0.18), transparent 26%), linear-gradient(135deg, #0b1120 0%, #0f172a 48%, #111827 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            borderRadius: 36,
            padding: 40,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.05))',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '12px 18px',
              borderRadius: 999,
              background: 'rgba(30,41,59,0.72)',
              border: '1px solid rgba(59,130,246,0.24)',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            TRUNGTAMMMO.VN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 72,
                lineHeight: 1.04,
                fontWeight: 900,
                letterSpacing: -2.5,
                textTransform: 'uppercase',
              }}
            >
              MMO platform đa module, bám dữ liệu thật và vận hành kiểu product.
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                lineHeight: 1.42,
                color: '#cbd5e1',
                maxWidth: 840,
              }}
            >
              Gồm SMM, Auto MXH, tài nguyên số, forum MMO, nạp tiền, seller và admin panel đồng bộ.
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
