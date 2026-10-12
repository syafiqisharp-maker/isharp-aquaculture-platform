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
<html lang="en">
<head>
<meta charset="UTF-8">
<title>How to Install iSHARP as Web App</title>
<style>
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }}

  body {{
    width: 1200px;
    height: 1280px;
    background: linear-gradient(180deg, #f0f7ff 0%, #e6f2fc 45%, #edf6fd 100%);
    color: #0f172a;
    padding: 32px 42px;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}

  /* Soft decorative accents */
  .water-ring-1 {{
    position: absolute;
    width: 700px;
    height: 700px;
    top: -150px;
    right: -100px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(14, 165, 233, 0) 70%);
    pointer-events: none;
  }}
  .water-ring-2 {{
    position: absolute;
    width: 800px;
    height: 800px;
    bottom: -100px;
    left: -150px;
    background: radial-gradient(circle, rgba(2, 132, 199, 0.1) 0%, rgba(2, 132, 199, 0) 70%);
    pointer-events: none;
  }}

  /* HEADER */
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 14px 24px;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
    position: relative;
    z-index: 2;
  }}

  .branding-left {{
    display: flex;
    align-items: center;
    gap: 16px;
  }}

  .branding-left img {{
    height: 44px;
    width: auto;
    display: block;
  }}

  .brand-text {{
    display: flex;
    flex-direction: column;
  }}

  .brand-text .title {{
    font-size: 22px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.3px;
  }}

  .brand-text .title span {{
    color: #0284c7;
  }}

  .brand-text .sub {{
    font-size: 12.5px;
    color: #64748b;
    font-weight: 600;
  }}

  .chrome-pill {{
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f8fafc;
    border: 1.5px solid #cbd5e1;
    border-radius: 50px;
    padding: 7px 18px;
  }}

  .chrome-pill svg {{
    width: 28px;
    height: 28px;
  }}

  .chrome-pill-text .top {{
    font-size: 10.5px;
    text-transform: uppercase;
    font-weight: 800;
    color: #0284c7;
    letter-spacing: 0.5px;
  }}

  .chrome-pill-text .bottom {{
    font-size: 13px;
    font-weight: 800;
    color: #1e293b;
  }}

  /* HERO - SHORT & PUNCHY */
  .hero {{
    text-align: center;
    margin: 8px 0 2px 0;
    position: relative;
    z-index: 2;
  }}

  .badge-tag {{
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
    font-size: 11.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 4px 14px;
    border-radius: 30px;
    margin-bottom: 4px;
  }}

  .hero h1 {{
    font-size: 38px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 3px;
  }}

  .hero h1 span {{
    color: #0284c7;
  }}

  .hero p {{
    font-size: 16px;
    color: #475569;
    font-weight: 600;
  }}

  /* 3 BENEFIT PILLS */
  .benefits-bar {{
    display: flex;
    justify-content: center;
    gap: 14px;
    margin: 6px 0 10px 0;
    position: relative;
    z-index: 2;
  }}

  .ben-pill {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 50px;
    padding: 7px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 700;
    color: #1e293b;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  }}

  .ben-pill .icon {{
    font-size: 16px;
  }}

  /* 2-COLUMN MAIN CARDS */
  .guide-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    position: relative;
    z-index: 2;
    margin: 4px 0;
  }}

  .guide-card {{
    background: #ffffff;
    border-radius: 20px;
    padding: 20px 20px 18px 20px;
    box-shadow: 0 8px 25px rgba(15, 23, 42, 0.06);
    border: 1.5px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }}

  .guide-card.mobile {{
    border-top: 5px solid #0284c7;
  }}

  .guide-card.desktop {{
    border-top: 5px solid #059669;
  }}

  /* Card Headings */
  .card-head {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1.5px solid #f1f5f9;
  }}

  .card-head-left {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .card-head-icon {{
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }}

  .mobile .card-head-icon {{
    background: #e0f2fe;
    color: #0284c7;
  }}

  .desktop .card-head-icon {{
    background: #d1fae5;
    color: #059669;
  }}

  .card-head-title h2 {{
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
  }}

  .card-head-title p {{
    font-size: 12.5px;
    color: #64748b;
    font-weight: 600;
  }}

  .device-tag {{
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 20px;
    text-transform: uppercase;
  }}

  .mobile .device-tag {{
    background: #e0f2fe;
    color: #0284c7;
  }}

  .desktop .device-tag {{
    background: #d1fae5;
    color: #059669;
  }}

  /* STEPS */
  .steps-box {{
    display: flex;
    flex-direction: column;
    gap: 12px;
  }}

  .step-item {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 12px 14px;
  }}

  .step-header {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }}

  .step-circle {{
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #ffffff;
    font-weight: 900;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}

  .mobile .step-circle {{
    background: #0284c7;
  }}

  .desktop .step-circle {{
    background: #059669;
  }}

  .step-title {{
    font-size: 15.5px;
    font-weight: 800;
    color: #0f172a;
  }}

  .step-title span {{
    color: #0284c7;
  }}

  .desktop .step-title span {{
    color: #059669;
  }}

  /* REALISTIC UI MOCKUPS (MATCHING USER SCREENSHOT) */
  .ui-mock {{
    margin-top: 5px;
    border-radius: 10px;
    overflow: hidden;
  }}

  /* Mobile Chrome Bar Mockup */
  .mobile-bar {{
    background: #1e293b;
    border-radius: 20px;
    padding: 7px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #ffffff;
  }}

  .mobile-bar .url {{
    font-size: 12px;
    color: #cbd5e1;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  .three-dots-badge {{
    background: #ef4444;
    color: #ffffff;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 15px;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
  }}

  /* Menu List Mockup (Exact match to user's screenshot) */
  .menu-mock-card {{
    background: #2b2d30;
    color: #e3e3e3;
    border-radius: 12px;
    padding: 5px;
    font-size: 12.5px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
  }}

  .menu-row-dim {{
    padding: 5px 10px;
    color: #9aa0a6;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11.5px;
  }}

  .menu-row-active {{
    background: #0284c7;
    color: #ffffff;
    font-weight: 800;
    padding: 8px 10px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.45);
    margin: 2px 0;
  }}

  .menu-row-active .label-wrap {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }}

  .tap-pill {{
    background: #facc15;
    color: #0f172a;
    font-size: 10.5px;
    font-weight: 900;
    padding: 3px 7px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }}

  /* Bottom sheet modal mockup (matching user's screenshot 2) */
  .sheet-modal-mock {{
    background: #202124;
    color: #ffffff;
    border-radius: 12px;
    padding: 10px 12px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }}

  .sheet-title {{
    font-size: 12px;
    font-weight: 800;
    color: #f1f5f9;
    margin-bottom: 8px;
    padding-left: 2px;
  }}

  .sheet-option-highlight {{
    background: rgba(2, 132, 199, 0.25);
    border: 1.5px solid #38bdf8;
    border-radius: 8px;
    padding: 7px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}

  .sheet-opt-left {{
    display: flex;
    align-items: center;
    gap: 10px;
  }}

  .sheet-app-icon {{
    width: 28px;
    height: 28px;
    background: #ffffff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }}

  .sheet-app-icon img {{
    width: 22px;
    height: 22px;
  }}

  .sheet-text .opt-h {{
    font-size: 12.5px;
    font-weight: 800;
    color: #ffffff;
  }}

  .sheet-text .opt-s {{
    font-size: 10.5px;
    color: #94a3b8;
  }}

  .arrow-tap {{
    font-size: 14px;
    color: #38bdf8;
    font-weight: 900;
  }}

  /* Desktop Address Bar Mockup */
  .desktop-omnibox-mock {{
    background: #f1f5f9;
    border: 1.5px solid #cbd5e1;
    border-radius: 8px;
    padding: 7px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  .desktop-omnibox-mock .url {{
    font-family: monospace;
    font-size: 12px;
    color: #334155;
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  .desktop-install-btn {{
    background: #059669;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 6px rgba(5, 150, 105, 0.4);
  }}

  /* Desktop Dialog Mockup */
  .desktop-dialog-mock {{
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  }}

  .dialog-top {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }}

  .dialog-info .d-title {{
    font-size: 13px;
    font-weight: 800;
    color: #0f172a;
  }}

  .dialog-info .d-sub {{
    font-size: 11px;
    color: #64748b;
  }}

  .dialog-buttons {{
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }}

  .d-btn-cancel {{
    padding: 5px 12px;
    font-size: 11.5px;
    font-weight: 700;
    color: #64748b;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
  }}

  .d-btn-install {{
    padding: 5px 16px;
    font-size: 11.5px;
    font-weight: 800;
    color: #ffffff;
    border-radius: 6px;
    background: #059669;
    border: 1px solid #047857;
    box-shadow: 0 2px 6px rgba(5, 150, 105, 0.4);
  }}

  /* SUCCESS OUTCOMES */
  .outcome-banner {{
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .mobile .outcome-banner {{
    background: #f0fdf4;
    border: 1.5px solid #86efac;
  }}

  .desktop .outcome-banner {{
    background: #f0fdf4;
    border: 1.5px solid #86efac;
  }}

  .outcome-banner .chk {{
    font-size: 22px;
  }}

  .outcome-banner .ot-main {{
    font-size: 13.5px;
    font-weight: 800;
    color: #166534;
  }}

  .outcome-banner .ot-desc {{
    font-size: 11.5px;
    color: #15803d;
  }}

  /* FOOTER */
  .footer {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 12px 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 2;
    box-shadow: 0 3px 12px rgba(0,0,0,0.03);
    margin-top: 4px;
  }}

  .footer-tip {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #475569;
    font-weight: 600;
  }}

  .footer-tip strong {{
    color: #0f172a;
  }}

  .footer-tag {{
    font-size: 12px;
    font-weight: 700;
    color: #0284c7;
    background: #e0f2fe;
    padding: 5px 14px;
    border-radius: 20px;
  }}
</style>
</head>
<body>

  <div class="water-ring-1"></div>
  <div class="water-ring-2"></div>

  <!-- HEADER -->
  <header class="header">
    <div class="branding-left">
      <img src="data:image/png;base64,{logo_b64}" alt="Blue Archipelago Berhad">
      <div class="brand-text">
        <div class="title">iSHARP <span>AQUACULTURE</span></div>
        <div class="sub">Setiu Shrimp Farm • Precision Platform</div>
      </div>
    </div>

    <div class="chrome-pill">
      <!-- Google Chrome SVG Icon -->
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#ffffff" />
        <circle cx="12" cy="12" r="4.5" fill="#1a73e8" />
        <path d="M12 2C7.3 2 3.3 5.3 2.3 9.6L6.2 16.3C6.1 14.9 6.7 13.5 7.8 12.6L12 5.3C12 5.3 12 2 12 2Z" fill="#ea4335" />
        <path d="M12 2C16.7 2 20.6 5.2 21.7 9.5L13.8 9.5C12.7 9.5 11.7 10 11.2 10.9L7 18.2C4.1 16.4 2.2 13.4 2.2 10C2.2 5.6 6.6 2 12 2Z" fill="#fbbc04" opacity="0.1" />
        <path d="M21.7 9.5C21.9 10.3 22 11.1 22 12C22 16.7 18.7 20.7 14.4 21.7L10.5 15C11.3 15.6 12.3 15.9 13.4 15.6C14.5 15.3 15.3 14.5 15.7 13.5L21.7 9.5Z" fill="#34a853" />
        <path d="M12 5.3L15.9 12C15.5 12.7 14.9 13.3 14.2 13.6L6.3 13.6C7.4 14.5 8.9 15 10.5 15L14.4 21.7C9.7 21.7 5.7 18.4 4.7 14.1L8.6 7.4C9.5 6.1 10.7 5.3 12 5.3Z" fill="#fbbc04" />
      </svg>
      <div class="chrome-pill-text">
        <div class="top">Browser</div>
        <div class="bottom">Google Chrome</div>
      </div>
    </div>
  </header>

  <!-- HERO -->
  <div class="hero">
    <div class="badge-tag">⚡ Quick Setup Guide</div>
    <h1>Install iSHARP as a <span>Web App</span></h1>
    <p>1-tap instant access without downloading from App Store or Play Store</p>
  </div>

  <!-- 3 VALUE PILLS -->
  <div class="benefits-bar">
    <div class="ben-pill">
      <span class="icon">⚡</span>
      <span>1-Tap Instant Launch</span>
    </div>
    <div class="ben-pill">
      <span class="icon">📱</span>
      <span>Fullscreen (No URL Bar)</span>
    </div>
    <div class="ben-pill">
      <span class="icon">💾</span>
      <span>Lightweight (&lt; 2 MB)</span>
    </div>
  </div>

  <!-- 2 MAIN CARDS -->
  <div class="guide-grid">

    <!-- MOBILE CARD -->
    <div class="guide-card mobile">
      <div class="card-head">
        <div class="card-head-left">
          <div class="card-head-icon">📱</div>
          <div class="card-head-title">
            <h2>Mobile (Android)</h2>
            <p>For Field Operators</p>
          </div>
        </div>
        <span class="device-tag">Phone</span>
      </div>

      <div class="steps-box">

        <!-- Step 1 -->
        <div class="step-item">
          <div class="step-header">
            <div class="step-circle">1</div>
            <div class="step-title">Tap the <span>3-Dots Menu (⋮)</span></div>
          </div>
          <div class="ui-mock">
            <div class="mobile-bar">
              <div class="url">🔒 ...-platform.netlify.app</div>
              <div class="three-dots-badge">⋮</div>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="step-item">
          <div class="step-header">
            <div class="step-circle">2</div>
            <div class="step-title">Tap <span>"Install and create shortcut"</span></div>
          </div>
          <div class="ui-mock">
            <div class="menu-mock-card">
              <div class="menu-row-dim"><span>⭐</span> Bookmarks</div>
              <div class="menu-row-dim"><span>🔗</span> Share...</div>
              <div class="menu-row-active">
                <div class="label-wrap">
                  <span>📲</span>
                  <span>Install and create shortcut</span>
                </div>
                <span class="tap-pill">TAP HERE</span>
              </div>
              <div class="menu-row-dim"><span>⚙️</span> Settings</div>
            </div>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="step-item">
          <div class="step-header">
            <div class="step-circle">3</div>
            <div class="step-title">Select <span>"Install app"</span></div>
          </div>
          <div class="ui-mock">
            <div class="sheet-modal-mock">
              <div class="sheet-title">Install and create shortcut</div>
              <div class="sheet-option-highlight">
                <div class="sheet-opt-left">
                  <div class="sheet-app-icon">
                    <img src="data:image/png;base64,{icon_b64}" alt="iSHARP Icon">
                  </div>
                  <div class="sheet-text">
                    <div class="opt-h">Install app</div>
                    <div class="opt-s">Standalone full-screen app</div>
                  </div>
                </div>
                <span class="arrow-tap">➔</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Outcome Mobile -->
      <div class="outcome-banner">
        <div class="chk">✅</div>
        <div>
          <div class="ot-main">Done! Added to Home Screen</div>
          <div class="ot-desc">Tap the iSHARP icon anytime for instant pond logging.</div>
        </div>
      </div>

    </div>

    <!-- DESKTOP CARD -->
    <div class="guide-card desktop">
      <div class="card-head">
        <div class="card-head-left">
          <div class="card-head-icon">💻</div>
          <div class="card-head-title">
            <h2>Desktop & Laptop</h2>
            <p>For Management & DBMS</p>
          </div>
        </div>
        <span class="device-tag">PC / Mac</span>
      </div>

      <div class="steps-box">

        <!-- Step 1 -->
        <div class="step-item">
          <div class="step-header">
            <div class="step-circle">1</div>
            <div class="step-title">Open Portal in <span>Google Chrome</span></div>
          </div>
          <div class="ui-mock">
            <div class="desktop-omnibox-mock">
              <div class="url">🔒 https://isharp.bluearchipelago.com</div>
              <div style="font-size: 11.5px; color: #64748b; font-weight: 600;">[Ready]</div>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="step-item">
          <div class="step-header">
            <div class="step-circle">2</div>
            <div class="step-title">Click <span>Install Icon (💻⬇️)</span> in URL Bar</div>
          </div>
          <div class="ui-mock">
            <div class="desktop-omnibox-mock">
              <div class="url">🔒 ...-platform.netlify.app</div>
              <div class="desktop-install-btn">
                <span>💻⬇️</span>
                <span>Install app</span>
              </div>
            </div>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 5px; padding-left: 2px;">
            *Or click Menu (⋮) ➔ <strong>Save and share</strong> ➔ <strong>Install iSHARP</strong>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="step-item">
          <div class="step-header">
            <div class="step-circle">3</div>
            <div class="step-title">Click <span>"Install"</span> on Prompt</div>
          </div>
          <div class="ui-mock">
            <div class="desktop-dialog-mock">
              <div class="dialog-top">
                <div class="sheet-app-icon" style="border: 1px solid #cbd5e1;">
                  <img src="data:image/png;base64,{icon_b64}" alt="iSHARP Icon">
                </div>
                <div class="dialog-info">
                  <div class="d-title">Install app?</div>
                  <div class="d-sub">iSHARP Precision Aquaculture</div>
                </div>
              </div>
              <div class="dialog-buttons">
                <span class="d-btn-cancel">Cancel</span>
                <span class="d-btn-install">Install</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Outcome Desktop -->
      <div class="outcome-banner">
        <div class="chk">🖥️</div>
        <div>
          <div class="ot-main">Done! Opens in Dedicated Window</div>
          <div class="ot-desc">Right-click icon on Taskbar and click "Pin to taskbar".</div>
        </div>
      </div>

    </div>

  </div>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="footer-tip">
      <span>💡</span>
      <span><strong>Can't see the install button?</strong> Make sure you are using Google Chrome and the page has finished loading.</span>
    </div>
    <div class="footer-tag">
      Blue Archipelago Berhad • Farm IT Support
    </div>
  </footer>

</body>
</html>
"""

temp_html = os.path.join(os.environ["TEMP"], "isharp_pwa_poster_light.html")
with open(temp_html, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Updated Light Theme HTML (tight fit) at:", temp_html)
