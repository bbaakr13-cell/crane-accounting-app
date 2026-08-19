import React from 'react';

export default function AboutPage() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#07101f',
        color: '#ffffff',
        padding: '24px 18px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          margin: '0 auto',
          paddingTop: '35px',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            fontSize: '28px',
            marginBottom: '10px',
          }}
        >
          حقوق التصميم
        </h1>

        <p
          style={{
            textAlign: 'center',
            color: '#94a3b8',
            marginBottom: '30px',
          }}
        >
          معلومات المصمم والتطبيق
        </p>

        <div
          style={{
            background: '#101a2d',
            border: '1px solid #26344c',
            borderRadius: '24px',
            padding: '30px 20px',
            textAlign: 'center',
            boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              width: '90px',
              height: '90px',
              margin: '0 auto 20px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg,#f5a623,#d88600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '42px',
            }}
          >
            🏗️
          </div>

          <h2
            style={{
              fontSize: '26px',
              margin: '8px 0',
              color: '#f5a623',
              direction: 'ltr',
            }}
          >
            BAAKR_ALMASBHI
          </h2>

          <div
            style={{
              width: '70px',
              height: '3px',
              background: '#f5a623',
              margin: '18px auto',
              borderRadius: '10px',
            }}
          />

          <p
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              margin: '15px 0 8px',
            }}
          >
            تصميم وتطوير
          </p>

          <p
            style={{
              fontSize: '17px',
              color: '#cbd5e1',
              marginBottom: '22px',
            }}
          >
            جميع حقوق تصميم التطبيق محفوظة للمصمم
          </p>

          <div
            style={{
              background: '#0a1323',
              borderRadius: '16px',
              padding: '15px 10px',
              border: '1px solid #25334a',
            }}
          >
            <div
              style={{
                color: '#94a3b8',
                fontSize: '14px',
                marginBottom: '7px',
              }}
            >
              البريد الإلكتروني
            </div>

            <div
              style={{
                direction: 'ltr',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 'bold',
                wordBreak: 'break-word',
              }}
            >
              baaakr.almasbhi@gmail.com
            </div>
          </div>

          <p
            style={{
              marginTop: '28px',
              color: '#94a3b8',
              fontSize: '14px',
            }}
          >
            © جميع حقوق التصميم محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}
