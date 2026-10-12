import os
import base64
import subprocess
from PIL import Image

# Read base64 assets
logo_path = r"isharp-platform\public\assets\blue-archipelago-logo.png"
icon_path = r"isharp-platform\public\assets\icon-192.png"

with open(logo_path, "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode("utf-8")

with open(icon_path, "rb") as f:
    icon_b64 = base64.b64encode(f.read()).decode("utf-8")

html_content = f"""<!DOCTYPE html>
<html lang="ms">
<head>
<meta charset="UTF-8">
<title>Panduan Pemasangan iSHARP Web App (WAP / PWA)</title>
<style>
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }}

  body {{
    width: 1200px;
    height: 2150px;
    background: linear-gradient(165deg, #05111f 0%, #081d36 35%, #072642 70%, #030f1c 100%);
    color: #f1f5f9;
    padding: 42px 48px;
    position: relative;
    overflow: hidden;
  }}

  /* Background decorative ambient lights */
  .bg-glow-1 {{
    position: absolute;
    width: 850px;
    height: 850px;
    top: -200px;
    left: 180px;
    background: radial-gradient(circle, rgba(2, 132, 199, 0.28) 0%, rgba(2, 132, 199, 0) 70%);
    pointer-events: none;
  }}
  .bg-glow-2 {{
    position: absolute;
    width: 950px;
    height: 950px;
    bottom: -150px;
    right: -150px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0) 70%);
    pointer-events: none;
  }}
  .bg-glow-3 {{
    position: absolute;
    width: 650px;
    height: 650px;
    top: 900px;
    left: -200px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, rgba(14, 165, 233, 0) 70%);
    pointer-events: none;
  }}

  /* HEADER */
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(56, 189, 248, 0.35);
    padding-bottom: 24px;
    margin-bottom: 28px;
    position: relative;
    z-index: 2;
  }}

  .branding-left {{
    display: flex;
    align-items: center;
    gap: 20px;
  }}

  .corp-logo-box {{
    background: #ffffff;
    padding: 10px 18px;
    border-radius: 14px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  }}

  .corp-logo-box img {{
    height: 48px;
    width: auto;
    display: block;
  }}

  .platform-brand {{
    display: flex;
    flex-direction: column;
  }}

  .platform-title {{
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 0.5px;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  .platform-title span {{
    color: #38bdf8;
  }}

  .platform-subtitle {{
    font-size: 14px;
    color: #94a3b8;
    font-weight: 600;
    letter-spacing: 0.5px;
  }}

  .chrome-badge {{
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(15, 23, 42, 0.8);
    border: 1.5px solid rgba(56, 189, 248, 0.45);
    padding: 10px 22px;
    border-radius: 50px;
    backdrop-filter: blur(12px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
  }}

  .chrome-badge svg {{
    width: 34px;
    height: 34px;
  }}

  .chrome-text {{
    display: flex;
    flex-direction: column;
  }}

  .chrome-text .label {{
    font-size: 11px;
    text-transform: uppercase;
    color: #38bdf8;
    font-weight: 800;
    letter-spacing: 1px;
  }}

  .chrome-text .val {{
    font-size: 14.5px;
    font-weight: 800;
    color: #ffffff;
  }}

  /* HERO BANNER */
  .hero {{
    text-align: center;
    margin-bottom: 26px;
    position: relative;
    z-index: 2;
  }}

  .hero-tag {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(90deg, #0284c7, #06b6d4);
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 6px 20px;
    border-radius: 30px;
    margin-bottom: 12px;
    box-shadow: 0 4px 15px rgba(2, 132, 199, 0.45);
  }}

  .hero-h1 {{
    font-size: 42px;
    font-weight: 900;
    line-height: 1.25;
    color: #ffffff;
    margin-bottom: 10px;
    text-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }}

  .hero-h1 .gradient-text {{
    background: linear-gradient(90deg, #38bdf8 0%, #34d399 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}

  .hero-desc {{
    font-size: 17.5px;
    color: #cbd5e1;
    max-width: 980px;
    margin: 0 auto;
    line-height: 1.5;
    font-weight: 500;
  }}

  /* VALUE PROPS RIBBON */
  .value-ribbon {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 30px;
    position: relative;
    z-index: 2;
  }}

  .val-card {{
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(56, 189, 248, 0.28);
    border-radius: 16px;
    padding: 15px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    backdrop-filter: blur(10px);
  }}

  .val-icon {{
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(2, 132, 199, 0.2);
    border: 1px solid rgba(56, 189, 248, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }}

  .val-info .val-title {{
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 2px;
  }}

  .val-info .val-sub {{
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.3;
  }}

  /* MAIN 2 COLUMNS (MOBILE vs DESKTOP) */
  .install-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 26px;
    position: relative;
    z-index: 2;
    margin-bottom: 26px;
  }}

  .platform-card {{
    background: rgba(13, 27, 46, 0.88);
    border: 1.5px solid rgba(56, 189, 248, 0.35);
    border-radius: 24px;
    padding: 26px 22px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }}

  .platform-card.mobile-theme {{
    border-top: 5px solid #0284c7;
  }}

  .platform-card.desktop-theme {{
    border-top: 5px solid #10b981;
  }}

  .card-top-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }}

  .card-title-box {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}

  .device-badge-icon {{
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
  }}

  .mobile-theme .device-badge-icon {{
    background: rgba(2, 132, 199, 0.25);
    border: 1.5px solid #0284c7;
    color: #38bdf8;
  }}

  .desktop-theme .device-badge-icon {{
    background: rgba(16, 185, 129, 0.25);
    border: 1.5px solid #10b981;
    color: #34d399;
  }}

  .card-titles h2 {{
    font-size: 22px;
    font-weight: 800;
    color: #ffffff;
  }}

  .card-titles p {{
    font-size: 13px;
    color: #94a3b8;
    font-weight: 600;
  }}

  .pill-mode {{
    font-size: 11px;
    font-weight: 800;
    padding: 5px 12px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }}

  .mobile-theme .pill-mode {{
    background: rgba(2, 132, 199, 0.2);
    color: #38bdf8;
    border: 1px solid rgba(2, 132, 199, 0.5);
  }}

  .desktop-theme .pill-mode {{
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.5);
  }}

  /* STEP ITEMS */
  .step-list {{
    display: flex;
    flex-direction: column;
    gap: 18px;
    flex-grow: 1;
  }}

  .step-row {{
    display: flex;
    gap: 14px;
    background: rgba(10, 20, 36, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 15px;
    position: relative;
  }}

  .step-num {{
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    font-weight: 900;
    flex-shrink: 0;
  }}

  .mobile-theme .step-num {{
    background: #0284c7;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.5);
  }}

  .desktop-theme .step-num {{
    background: #059669;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
  }}

  .step-content {{
    flex-grow: 1;
  }}

  .step-header-text {{
    font-size: 15.5px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 4px;
    line-height: 1.3;
  }}

  .step-instruction {{
    font-size: 12.8px;
    color: #cbd5e1;
    line-height: 1.45;
    margin-bottom: 8px;
  }}

  .step-instruction strong {{
    color: #f8fafc;
    background: rgba(255,255,255,0.12);
    padding: 1px 6px;
    border-radius: 4px;
  }}

  /* MOCKUP VISUAL COMPONENTS */
  .mockup-box {{
    background: #0f172a;
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 12px;
    margin-top: 6px;
  }}

  /* Mobile address bar mockup */
  .mobile-chrome-bar {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e293b;
    border-radius: 20px;
    padding: 8px 14px;
    border: 1px solid #334155;
  }}

  .url-fake {{
    color: #cbd5e1;
    font-family: monospace;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  .lock-icon {{
    color: #10b981;
    font-size: 11px;
  }}

  .menu-btn-highlight {{
    background: rgba(239, 68, 68, 0.25);
    border: 1.5px solid #ef4444;
    color: #fca5a5;
    font-weight: 900;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  }}

  /* Mockup Dropdown Menu */
  .mobile-menu-list {{
    background: #1e293b;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #334155;
  }}

  .menu-item-fake {{
    padding: 7px 12px;
    color: #94a3b8;
    font-size: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  .menu-item-highlight {{
    background: linear-gradient(90deg, rgba(2, 132, 199, 0.4), rgba(6, 182, 212, 0.4));
    border: 1.5px solid #38bdf8;
    color: #ffffff;
    font-weight: 700;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 6px;
    margin: 4px;
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.45);
  }}

  .menu-item-highlight .left {{
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  .hand-pointer {{
    color: #fbbf24;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }}

  /* Mockup Install Popup Modal */
  .install-modal-mockup {{
    background: #1e293b;
    border-radius: 12px;
    padding: 12px 14px;
    border: 1px solid #475569;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}

  .modal-top {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .app-avatar {{
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }}

  .app-avatar img {{
    width: 32px;
    height: 32px;
  }}

  .modal-text .name {{
    font-size: 13.5px;
    font-weight: 800;
    color: #ffffff;
  }}

  .modal-text .site {{
    font-size: 11px;
    color: #94a3b8;
  }}

  .modal-actions {{
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }}

  .btn-fake-cancel {{
    padding: 6px 14px;
    font-size: 12px;
    color: #94a3b8;
    font-weight: 600;
  }}

  .btn-fake-install {{
    background: #0284c7;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    padding: 6px 16px;
    border-radius: 6px;
    box-shadow: 0 0 10px rgba(2, 132, 199, 0.6);
    border: 1px solid #38bdf8;
  }}

  .btn-fake-install-desktop {{
    background: #059669;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    padding: 6px 16px;
    border-radius: 6px;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
    border: 1px solid #34d399;
  }}

  /* Desktop Omnibox Mockup */
  .desktop-omnibox {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e293b;
    border-radius: 8px;
    padding: 8px 12px;
    border: 1px solid #475569;
  }}

  .desktop-omnibox .url-area {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 12px;
    color: #cbd5e1;
  }}

  .install-omnibox-badge {{
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(16, 185, 129, 0.25);
    border: 1.5px solid #10b981;
    color: #34d399;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 800;
    font-size: 11px;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  }}

  /* SUCCESS OUTCOME BOX */
  .outcome-box {{
    margin-top: 14px;
    background: rgba(16, 185, 129, 0.12);
    border: 1.5px dashed rgba(16, 185, 129, 0.45);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
  }}

  .outcome-icon {{
    font-size: 26px;
    flex-shrink: 0;
  }}

  .outcome-text .ot-bold {{
    font-size: 13.5px;
    font-weight: 800;
    color: #34d399;
    margin-bottom: 2px;
  }}

  .outcome-text .ot-sub {{
    font-size: 11.5px;
    color: #cbd5e1;
  }}

  /* FOOTER & PRO-TIPS */
  .footer-box {{
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 20px;
    padding: 22px 28px;
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}

  .pro-tips-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 16px;
  }}

  .tip-item {{
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }}

  .tip-badge {{
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid #f59e0b;
    color: #fbbf24;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }}

  .tip-text .tt-h {{
    font-size: 13.5px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 2px;
  }}

  .tip-text .tt-d {{
    font-size: 11.8px;
    color: #94a3b8;
    line-height: 1.4;
  }}

  .footer-bottom {{
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  .footer-company {{
    font-size: 13px;
    font-weight: 700;
    color: #e2e8f0;
  }}

  .footer-company span {{
    color: #38bdf8;
  }}

  .footer-support {{
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(2, 132, 199, 0.18);
    border: 1px solid rgba(2, 132, 199, 0.4);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    color: #38bdf8;
    font-weight: 700;
  }}
</style>
</head>
<body>

  <!-- Background Ambience -->
  <div class="bg-glow-1"></div>
  <div class="bg-glow-2"></div>
  <div class="bg-glow-3"></div>

  <!-- HEADER -->
  <header class="header">
    <div class="branding-left">
      <div class="corp-logo-box">
        <img src="data:image/png;base64,{logo_b64}" alt="Blue Archipelago Berhad">
      </div>
      <div class="platform-brand">
        <div class="platform-title">iSHARP <span>AQUACULTURE</span></div>
        <div class="platform-subtitle">Setiu Shrimp Farm • Terengganu Operations</div>
      </div>
    </div>

    <div class="chrome-badge">
      <!-- Google Chrome SVG Icon -->
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#ffffff" />
        <circle cx="12" cy="12" r="4.5" fill="#1a73e8" />
        <path d="M12 2C7.3 2 3.3 5.3 2.3 9.6L6.2 16.3C6.1 14.9 6.7 13.5 7.8 12.6L12 5.3C12 5.3 12 2 12 2Z" fill="#ea4335" />
        <path d="M12 2C16.7 2 20.6 5.2 21.7 9.5L13.8 9.5C12.7 9.5 11.7 10 11.2 10.9L7 18.2C4.1 16.4 2.2 13.4 2.2 10C2.2 5.6 6.6 2 12 2Z" fill="#fbbc04" opacity="0.1" />
        <path d="M21.7 9.5C21.9 10.3 22 11.1 22 12C22 16.7 18.7 20.7 14.4 21.7L10.5 15C11.3 15.6 12.3 15.9 13.4 15.6C14.5 15.3 15.3 14.5 15.7 13.5L21.7 9.5Z" fill="#34a853" />
        <path d="M12 5.3L15.9 12C15.5 12.7 14.9 13.3 14.2 13.6L6.3 13.6C7.4 14.5 8.9 15 10.5 15L14.4 21.7C9.7 21.7 5.7 18.4 4.7 14.1L8.6 7.4C9.5 6.1 10.7 5.3 12 5.3Z" fill="#fbbc04" />
      </svg>
      <div class="chrome-text">
        <span class="label">Pelayar Rasmi / Official Browser</span>
        <span class="val">Google Chrome (Mobile & PC)</span>
      </div>
    </div>
  </header>

  <!-- HERO SECTION -->
  <div class="hero">
    <div class="hero-tag">⚡ Akses Pantas Lapangan / 1-Tap Field Access</div>
    <h1 class="hero-h1">
      Cara Pasang Platform iSHARP Sebagai <span class="gradient-text">Web App (WAP / PWA)</span>
    </h1>
    <p class="hero-desc">
      Pasang sistem iSHARP terus pada skrin telefon pintar dan desktop PC anda. Nikmati akses sepantas kilat, paparan penuh (fullscreen), dan operasi lancar tanpa perlu memuat turun aplikasi berat dari App Store atau Play Store!
    </p>
  </div>

  <!-- VALUE PROPOSITIONS RIBBON -->
  <div class="value-ribbon">
    <div class="val-card">
      <div class="val-icon">⚡</div>
      <div class="val-info">
        <div class="val-title">Pemasangan 5 Saat</div>
        <div class="val-sub">Tanpa melalui Play Store / App Store</div>
      </div>
    </div>
    <div class="val-card">
      <div class="val-icon">📱</div>
      <div class="val-info">
        <div class="val-title">Paparan Penuh</div>
        <div class="val-sub">Bersih tanpa bar carian URL browser</div>
      </div>
    </div>
    <div class="val-card">
      <div class="val-icon">💾</div>
      <div class="val-info">
        <div class="val-title">Sangat Ringan</div>
        <div class="val-sub">Saiz &lt; 2MB, jimat ruang simpanan telefon</div>
      </div>
    </div>
    <div class="val-card">
      <div class="val-icon">🔄</div>
      <div class="val-info">
        <div class="val-title">Sentiasa Terkini</div>
        <div class="val-sub">Auto-kemas kini versi tanpa perlu update manual</div>
      </div>
    </div>
  </div>

  <!-- MAIN 2 COLUMNS: MOBILE vs DESKTOP -->
  <div class="install-grid">

    <!-- COLUMN 1: MOBILE INSTALLATION -->
    <div class="platform-card mobile-theme">
      <div>
        <div class="card-top-header">
          <div class="card-title-box">
            <div class="device-badge-icon">📱</div>
            <div class="card-titles">
              <h2>Telefon Pintar (Mobile)</h2>
              <p>Android Smartphone • Google Chrome</p>
            </div>
          </div>
          <span class="pill-mode">Untuk Pekerja Lapangan</span>
        </div>

        <div class="step-list">

          <!-- Step 1 -->
          <div class="step-row">
            <div class="step-num">01</div>
            <div class="step-content">
              <div class="step-header-text">Buka Laman Web iSHARP di Chrome</div>
              <div class="step-instruction">
                Buka aplikasi <strong>Google Chrome</strong> pada telefon anda dan layari URL portal iSHARP yang diberikan oleh pihak pengurusan ladang.
              </div>
              <div class="mockup-box">
                <div class="mobile-chrome-bar">
                  <div class="url-fake"><span class="lock-icon">🔒</span> https://isharp.bluearchipelago.com</div>
                  <div class="menu-btn-highlight">⋮</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="step-row">
            <div class="step-num">02</div>
            <div class="step-content">
              <div class="step-header-text">Tekan Menu 3-Titik (⋮) di Atas Kanan</div>
              <div class="step-instruction">
                Lihat di penjuru kanan atas pelayar Chrome anda dan tekan simbol <strong>Menu 3-Titik (⋮)</strong> yang dibulatkan merah di atas untuk membuka senarai pilihan.
              </div>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="step-row">
            <div class="step-num">03</div>
            <div class="step-content">
              <div class="step-header-text">Pilih "Install app" / "Pasang aplikasi"</div>
              <div class="step-instruction">
                Cari dan tekan pilihan <strong>"Install app"</strong> atau <strong>"Add to Home screen"</strong> (Tambah ke skrin utama).
              </div>
              <div class="mockup-box">
                <div class="mobile-menu-list">
                  <div class="menu-item-fake"><span>📑</span> Tab baru</div>
                  <div class="menu-item-fake"><span>⭐</span> Penanda buku (Bookmarks)</div>
                  <div class="menu-item-highlight">
                    <div class="left">
                      <span>📲</span> <strong>Install app / Pasang aplikasi</strong>
                    </div>
                    <div class="hand-pointer">👈 TEKAN INI</div>
                  </div>
                  <div class="menu-item-fake"><span>⚙️</span> Tetapan (Settings)</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="step-row">
            <div class="step-num">04</div>
            <div class="step-content">
              <div class="step-header-text">Sahkan & Tekan "Install"</div>
              <div class="step-instruction">
                Tetingkap pengesahan akan dipaparkan. Tekan butang <strong>"Install"</strong> / <strong>"Pasang"</strong>.
              </div>
              <div class="mockup-box">
                <div class="install-modal-mockup">
                  <div class="modal-top">
                    <div class="app-avatar">
                      <img src="data:image/png;base64,{icon_b64}" alt="Icon">
                    </div>
                    <div class="modal-text">
                      <div class="name">iSHARP Field Operations</div>
                      <div class="site">bluearchipelago.com</div>
                    </div>
                  </div>
                  <div class="modal-actions">
                    <span class="btn-fake-cancel">Batal</span>
                    <span class="btn-fake-install">Install (Pasang)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Outcome Mobile -->
      <div class="outcome-box">
        <div class="outcome-icon">✅</div>
        <div class="outcome-text">
          <div class="ot-bold">SELESAI! Ikon Muncul di Skrin Telefon</div>
          <div class="ot-sub">Ikon "Field Ops" sedia ditekan bila-bila masa seperti app biasa.</div>
        </div>
      </div>

    </div>

    <!-- COLUMN 2: DESKTOP INSTALLATION -->
    <div class="platform-card desktop-theme">
      <div>
        <div class="card-top-header">
          <div class="card-title-box">
            <div class="device-badge-icon">💻</div>
            <div class="card-titles">
              <h2>Komputer & Laptop (Desktop)</h2>
              <p>Windows PC & Mac • Google Chrome</p>
            </div>
          </div>
          <span class="pill-mode">Untuk Pengurusan & DBMS</span>
        </div>

        <div class="step-list">

          <!-- Step 1 -->
          <div class="step-row">
            <div class="step-num">01</div>
            <div class="step-content">
              <div class="step-header-text">Buka Laman Web iSHARP di Chrome PC</div>
              <div class="step-instruction">
                Buka <strong>Google Chrome</strong> di komputer pejabat atau laptop anda, kemudian masukkan alamat portal iSHARP.
              </div>
              <div class="mockup-box">
                <div class="desktop-omnibox">
                  <div class="url-area">
                    <span class="lock-icon">🔒</span> https://isharp.bluearchipelago.com
                  </div>
                  <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">
                    [Ready]
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="step-row">
            <div class="step-num">02</div>
            <div class="step-content">
              <div class="step-header-text">Klik Ikon "Install" di Bar Alamat (Omnibox)</div>
              <div class="step-instruction">
                Perhatikan bahagian kanan bar carian alamat URL. Klik pada ikon <strong>Monitor dengan Anak Panah (💻⬇️)</strong>.
              </div>
              <div class="mockup-box">
                <div class="desktop-omnibox">
                  <div class="url-area">
                    <span class="lock-icon">🔒</span> https://isharp.bluearchipelago.com
                  </div>
                  <div class="install-omnibox-badge">
                    <span>💻⬇️</span> <span>Install iSHARP</span> 👈 KLIK SINI
                  </div>
                </div>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
                *Alternatif: Klik <strong>Menu 3-Titik (⋮)</strong> ➔ <strong>"Save and share"</strong> ➔ <strong>"Install iSHARP"</strong>.
              </div>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="step-row">
            <div class="step-num">03</div>
            <div class="step-content">
              <div class="step-header-text">Klik Butang "Install" pada Pop-Up</div>
              <div class="step-instruction">
                Satu tetingkap kecil akan muncul bertanyakan persetujuan pemasangan. Klik butang <strong>"Install"</strong>.
              </div>
              <div class="mockup-box">
                <div class="install-modal-mockup">
                  <div class="modal-top">
                    <div class="app-avatar">
                      <img src="data:image/png;base64,{icon_b64}" alt="Icon">
                    </div>
                    <div class="modal-text">
                      <div class="name">iSHARP Precision Aquaculture</div>
                      <div class="site">Pasang aplikasi ke Windows/Mac?</div>
                    </div>
                  </div>
                  <div class="modal-actions">
                    <span class="btn-fake-cancel">Cancel</span>
                    <span class="btn-fake-install-desktop">Install</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="step-row">
            <div class="step-num">04</div>
            <div class="step-content">
              <div class="step-header-text">Pin ke Taskbar / Desktop Shortcut</div>
              <div class="step-instruction">
                Sistem akan membuka tetingkap berasingan (Dedicated App Window) dan mencipta jalan pintas (shortcut) terus di desktop anda.
              </div>
              <div style="font-size: 11.5px; color: #34d399; font-weight: 700; margin-top: 4px;">
                ⭐ Klik kanan ikon di Taskbar & tekan "Pin to taskbar" untuk capaian segera!
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Outcome Desktop -->
      <div class="outcome-box">
        <div class="outcome-icon">🖥️</div>
        <div class="outcome-text">
          <div class="ot-bold">SELESAI! Dibuka Seperti Software Desktop</div>
          <div class="ot-sub">Boleh di-Pin pada Windows Taskbar untuk capaian pantas harian.</div>
        </div>
      </div>

    </div>

  </div>

  <!-- FOOTER & PRO TIPS -->
  <footer class="footer-box">
    <div class="pro-tips-grid">
      <div class="tip-item">
        <div class="tip-badge">💡</div>
        <div class="tip-text">
          <div class="tt-h">Butang "Install" Tidak Keluar?</div>
          <div class="tt-d">Pastikan anda membuka laman menggunakan <strong>Google Chrome</strong> yang telah dikemas kini dan tunggu sehingga laman siap dimuatkan sepenuhnya (100% loaded).</div>
        </div>
      </div>
      <div class="tip-item">
        <div class="tip-badge">🍎</div>
        <div class="tip-text">
          <div class="tt-h">Pengguna iPhone / iPad (iOS Safari)?</div>
          <div class="tt-d">Buka di pelayar <strong>Safari</strong>, tekan butang <strong>Share (⎋)</strong> di bawah skrin, kemudian pilih <strong>"Add to Home Screen"</strong> (+).</div>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="footer-company">
        © 2026 <strong>Blue Archipelago Berhad</strong> • <span>iSHARP Precision Aquaculture Station</span>
      </div>
      <div class="footer-support">
        <span>📞</span> Sebarang Masalah Hubungi Unit Teknikal & Data iSHARP
      </div>
    </div>
  </footer>

</body>
</html>
"""

temp_html = os.path.join(os.environ["TEMP"], "isharp_pwa_poster.html")
with open(temp_html, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Regenerated HTML at:", temp_html)
