import os
import base64
import subprocess
from PIL import Image

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
    background: #f8fafc;
    color: #0f172a;
    padding: 30px 36px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }}

  /* Top Unified Header */
  .top-banner {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 16px 24px;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  .brand-group {{
    display: flex;
    align-items: center;
    gap: 16px;
  }}

  .brand-group img {{
    height: 44px;
    width: auto;
    display: block;
  }}

  .brand-divider {{
    width: 1px;
    height: 38px;
    background: #cbd5e1;
  }}

  .brand-titles .main {{
    font-size: 21px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.3px;
    line-height: 1.15;
  }}

  .brand-titles .main span {{
    color: #0284c7;
  }}

  .brand-titles .sub {{
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
  }}

  .chrome-badge {{
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 50px;
    padding: 6px 16px;
  }}

  .chrome-badge svg {{
    width: 26px;
    height: 26px;
  }}

  .chrome-badge-text .tag {{
    font-size: 9.5px;
    font-weight: 800;
    color: #0284c7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }}

  .chrome-badge-text .name {{
    font-size: 13px;
    font-weight: 800;
    color: #1e293b;
    line-height: 1.2;
  }}

  /* Sleek Integrated Hero Card */
  .hero-card {{
    background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
    border: 1px solid #bae6fd;
    border-radius: 16px;
    padding: 18px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 14px rgba(2, 132, 199, 0.05);
  }}

  .hero-left {{
    display: flex;
    flex-direction: column;
    gap: 4px;
  }}

  .hero-tag-row {{
    display: flex;
    align-items: center;
    gap: 10px;
  }}

  .setup-pill {{
    background: #0284c7;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 3px 10px;
    border-radius: 20px;
  }}

  .hero-h1 {{
    font-size: 26px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.4px;
  }}

  .hero-h1 span {{
    color: #0284c7;
  }}

  .hero-desc {{
    font-size: 13.5px;
    color: #475569;
    font-weight: 500;
  }}

  .hero-pills {{
    display: flex;
    gap: 10px;
  }}

  .h-pill {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 30px;
    padding: 7px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: #1e293b;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
  }}

  /* 2-Column Grid */
  .guide-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }}

  .guide-card {{
    background: #ffffff;
    border-radius: 18px;
    padding: 18px;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }}

  .guide-card.mobile {{
    border-top: 5px solid #0284c7;
  }}

  .guide-card.desktop {{
    border-top: 5px solid #059669;
  }}

  /* Card Head */
  .card-head {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
  }}

  .head-title-box {{
    display: flex;
    align-items: center;
    gap: 10px;
  }}

  .head-icon {{
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }}

  .mobile .head-icon {{
    background: #e0f2fe;
    color: #0284c7;
  }}

  .desktop .head-icon {{
    background: #d1fae5;
    color: #059669;
  }}

  .head-text h2 {{
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }}

  .head-text p {{
    font-size: 11.5px;
    color: #64748b;
    font-weight: 600;
  }}

  .role-pill {{
    font-size: 10.5px;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 20px;
    text-transform: uppercase;
  }}

  .mobile .role-pill {{
    background: #e0f2fe;
    color: #0284c7;
  }}

  .desktop .role-pill {{
    background: #d1fae5;
    color: #059669;
  }}

  /* Steps List */
  .steps-list {{
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}

  .step-box {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 12px;
  }}

  .step-title-row {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }}

  .step-badge {{
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: #ffffff;
    font-weight: 900;
    font-size: 12.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}

  .mobile .step-badge {{
    background: #0284c7;
  }}

  .desktop .step-badge {{
    background: #059669;
  }}

  .step-title-text {{
    font-size: 14.5px;
    font-weight: 800;
    color: #0f172a;
  }}

  .step-title-text span {{
    color: #0284c7;
  }}

  .desktop .step-title-text span {{
    color: #059669;
  }}

  /* UI MOCKUPS (CLEAN & COMPACT) */
  .mock-wrap {{
    border-radius: 8px;
    overflow: hidden;
  }}

  /* Mobile address bar */
  .mock-mobile-bar {{
    background: #1e293b;
    border-radius: 18px;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #ffffff;
  }}

  .mock-mobile-bar .url {{
    font-size: 11.5px;
    color: #cbd5e1;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  .dots-indicator {{
    background: #ef4444;
    color: #ffffff;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
  }}

  /* Menu list mockup */
  .mock-menu-card {{
    background: #2b2d30;
    color: #e3e3e3;
    border-radius: 10px;
    padding: 4px;
    font-size: 12px;
  }}

  .mock-menu-dim {{
    padding: 4px 8px;
    color: #9aa0a6;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }}

  .mock-menu-active {{
    background: #0284c7;
    color: #ffffff;
    font-weight: 800;
    padding: 7px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 2px 0;
  }}

  .mock-menu-active .label-wrap {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
  }}

  .tap-tag {{
    background: #facc15;
    color: #0f172a;
    font-size: 10px;
    font-weight: 900;
    padding: 2px 6px;
    border-radius: 3px;
  }}

  /* Bottom sheet modal */
  .mock-sheet-card {{
    background: #202124;
    color: #ffffff;
    border-radius: 10px;
    padding: 8px 10px;
  }}

  .sheet-header-txt {{
    font-size: 11px;
    font-weight: 700;
    color: #cbd5e1;
    margin-bottom: 6px;
  }}

  .sheet-opt-box {{
    background: rgba(2, 132, 199, 0.25);
    border: 1px solid #38bdf8;
    border-radius: 7px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}

  .opt-left-wrap {{
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  .opt-icon-sq {{
    width: 26px;
    height: 26px;
    background: #ffffff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }}

  .opt-icon-sq img {{
    width: 20px;
    height: 20px;
  }}

  .opt-text-block .opt-h {{
    font-size: 12px;
    font-weight: 800;
    color: #ffffff;
  }}

  .opt-text-block .opt-s {{
    font-size: 10px;
    color: #94a3b8;
  }}

  /* Desktop Omnibox */
  .mock-desktop-bar {{
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  .mock-desktop-bar .url {{
    font-family: monospace;
    font-size: 11.5px;
    color: #334155;
    display: flex;
    align-items: center;
    gap: 5px;
  }}

  .desktop-btn-inst {{
    background: #059669;
    color: #ffffff;
    font-size: 10.5px;
    font-weight: 800;
    padding: 4px 9px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    gap: 5px;
  }}

  /* Desktop Modal */
  .mock-desktop-dialog {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    padding: 10px 12px;
  }}

  .dialog-top-row {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }}

  .dialog-txt-block .d-h {{
    font-size: 12px;
    font-weight: 800;
    color: #0f172a;
  }}

  .dialog-txt-block .d-p {{
    font-size: 10.5px;
    color: #64748b;
  }}

  .dialog-btn-row {{
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }}

  .d-btn-c {{
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    background: #ffffff;
  }}

  .d-btn-i {{
    padding: 4px 14px;
    font-size: 11px;
    font-weight: 800;
    color: #ffffff;
    border-radius: 5px;
    background: #059669;
    border: 1px solid #047857;
  }}

  /* Outcome Banners */
  .outcome-box {{
    border-radius: 10px;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f0fdf4;
    border: 1px solid #86efac;
  }}

  .outcome-box .icon {{
    font-size: 20px;
  }}

  .outcome-box .bold-txt {{
    font-size: 13px;
    font-weight: 800;
    color: #166534;
  }}

  .outcome-box .sub-txt {{
    font-size: 11px;
    color: #15803d;
  }}

  /* Footer */
  .footer-row {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  .footer-left {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #475569;
    font-weight: 600;
  }}

  .footer-left strong {{
    color: #0f172a;
  }}

  .footer-right {{
    font-size: 11.5px;
    font-weight: 700;
    color: #0284c7;
    background: #e0f2fe;
    padding: 4px 12px;
    border-radius: 20px;
  }}
</style>
</head>
<body>

  <!-- Top Branding Header -->
  <header class="top-banner">
    <div class="brand-group">
      <img src="data:image/png;base64,{logo_b64}" alt="Blue Archipelago Berhad">
      <div class="brand-divider"></div>
      <div class="brand-titles">
        <div class="main">iSHARP <span>AQUACULTURE</span></div>
        <div class="sub">Setiu Shrimp Farm • Precision Platform</div>
      </div>
    </div>

    <div class="chrome-badge">
      <!-- Google Chrome SVG -->
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#ffffff" />
        <circle cx="12" cy="12" r="4.5" fill="#1a73e8" />
        <path d="M12 2C7.3 2 3.3 5.3 2.3 9.6L6.2 16.3C6.1 14.9 6.7 13.5 7.8 12.6L12 5.3C12 5.3 12 2 12 2Z" fill="#ea4335" />
        <path d="M12 2C16.7 2 20.6 5.2 21.7 9.5L13.8 9.5C12.7 9.5 11.7 10 11.2 10.9L7 18.2C4.1 16.4 2.2 13.4 2.2 10C2.2 5.6 6.6 2 12 2Z" fill="#fbbc04" opacity="0.1" />
        <path d="M21.7 9.5C21.9 10.3 22 11.1 22 12C22 16.7 18.7 20.7 14.4 21.7L10.5 15C11.3 15.6 12.3 15.9 13.4 15.6C14.5 15.3 15.3 14.5 15.7 13.5L21.7 9.5Z" fill="#34a853" />
        <path d="M12 5.3L15.9 12C15.5 12.7 14.9 13.3 14.2 13.6L6.3 13.6C7.4 14.5 8.9 15 10.5 15L14.4 21.7C9.7 21.7 5.7 18.4 4.7 14.1L8.6 7.4C9.5 6.1 10.7 5.3 12 5.3Z" fill="#fbbc04" />
      </svg>
      <div class="chrome-badge-text">
        <div class="tag">Browser</div>
        <div class="name">Google Chrome</div>
      </div>
    </div>
  </header>

  <!-- Compact Hero Card (Unified with Benefits) -->
  <div class="hero-card">
    <div class="hero-left">
      <div class="hero-tag-row">
        <span class="setup-pill">⚡ Quick Guide</span>
        <h1 class="hero-h1">Install iSHARP as a <span>Web App</span></h1>
      </div>
      <p class="hero-desc">Instant 1-tap launch on your device — no App Store or Play Store download required</p>
    </div>
    <div class="hero-pills">
      <div class="h-pill"><span>⚡</span> 1-Tap Launch</div>
      <div class="h-pill"><span>📱</span> Fullscreen View</div>
      <div class="h-pill"><span>💾</span> Lightweight (&lt; 2 MB)</div>
    </div>
  </div>

  <!-- 2-Column Guide Grid -->
  <main class="guide-grid">

    <!-- Mobile Card -->
    <div class="guide-card mobile">
      <div class="card-head">
        <div class="head-title-box">
          <div class="head-icon">📱</div>
          <div class="head-text">
            <h2>Mobile (Android)</h2>
            <p>For Field Operators & Pond Loggers</p>
          </div>
        </div>
        <span class="role-pill">Phone</span>
      </div>

      <div class="steps-list">
        <!-- Step 1 -->
        <div class="step-box">
          <div class="step-title-row">
            <div class="step-badge">1</div>
            <div class="step-title-text">Tap the <span>3-Dots Menu (⋮)</span></div>
          </div>
          <div class="mock-wrap">
            <div class="mock-mobile-bar">
              <div class="url">🔒 ...-platform.netlify.app</div>
              <div class="dots-indicator">⋮</div>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="step-box">
          <div class="step-title-row">
            <div class="step-badge">2</div>
            <div class="step-title-text">Tap <span>"Install and create shortcut"</span></div>
          </div>
          <div class="mock-wrap">
            <div class="mock-menu-card">
              <div class="mock-menu-dim"><span>⭐</span> Bookmarks</div>
              <div class="mock-menu-active">
                <div class="label-wrap">
                  <span>📲</span>
                  <span>Install and create shortcut</span>
                </div>
                <span class="tap-tag">TAP HERE</span>
              </div>
              <div class="mock-menu-dim"><span>⚙️</span> Settings</div>
            </div>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="step-box">
          <div class="step-title-row">
            <div class="step-badge">3</div>
            <div class="step-title-text">Select <span>"Install app"</span></div>
          </div>
          <div class="mock-wrap">
            <div class="mock-sheet-card">
              <div class="sheet-header-txt">Install and create shortcut</div>
              <div class="sheet-opt-box">
                <div class="opt-left-wrap">
                  <div class="opt-icon-sq">
                    <img src="data:image/png;base64,{icon_b64}" alt="iSHARP Icon">
                  </div>
                  <div class="opt-text-block">
                    <div class="opt-h">Install app</div>
                    <div class="opt-s">Standalone full-screen app</div>
                  </div>
                </div>
                <span style="color: #38bdf8; font-weight: 800; font-size: 13px;">➔</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="outcome-box">
        <span class="icon">✅</span>
        <div>
          <div class="bold-txt">Done! Added to Home Screen</div>
          <div class="sub-txt">Tap the iSHARP icon anytime for direct pond logging.</div>
        </div>
      </div>
    </div>

    <!-- Desktop Card -->
    <div class="guide-card desktop">
      <div class="card-head">
        <div class="head-title-box">
          <div class="head-icon">💻</div>
          <div class="head-text">
            <h2>Desktop & Laptop</h2>
            <p>For Management & DBMS Workstations</p>
          </div>
        </div>
        <span class="role-pill">PC / Mac</span>
      </div>

      <div class="steps-list">
        <!-- Step 1 -->
        <div class="step-box">
          <div class="step-title-row">
            <div class="step-badge">1</div>
            <div class="step-title-text">Open Portal in <span>Google Chrome</span></div>
          </div>
          <div class="mock-wrap">
            <div class="mock-desktop-bar">
              <div class="url">🔒 https://isharp.bluearchipelago.com</div>
              <div style="font-size: 10.5px; color: #64748b; font-weight: 700;">[Ready]</div>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="step-box">
          <div class="step-title-row">
            <div class="step-badge">2</div>
            <div class="step-title-text">Click <span>Install Icon (💻⬇️)</span> in URL Bar</div>
          </div>
          <div class="mock-wrap">
            <div class="mock-desktop-bar">
              <div class="url">🔒 ...-platform.netlify.app</div>
              <div class="desktop-btn-inst">
                <span>💻⬇️</span>
                <span>Install app</span>
              </div>
            </div>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px; padding-left: 2px;">
            *Or click Menu (⋮) ➔ <strong>Save and share</strong> ➔ <strong>Install iSHARP</strong>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="step-box">
          <div class="step-title-row">
            <div class="step-badge">3</div>
            <div class="step-title-text">Click <span>"Install"</span> on Prompt</div>
          </div>
          <div class="mock-wrap">
            <div class="mock-desktop-dialog">
              <div class="dialog-top-row">
                <div class="opt-icon-sq" style="border: 1px solid #cbd5e1;">
                  <img src="data:image/png;base64,{icon_b64}" alt="iSHARP Icon">
                </div>
                <div class="dialog-txt-block">
                  <div class="d-h">Install app?</div>
                  <div class="d-p">iSHARP Precision Aquaculture</div>
                </div>
              </div>
              <div class="dialog-btn-row">
                <span class="d-btn-c">Cancel</span>
                <span class="d-btn-i">Install</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="outcome-box">
        <span class="icon">🖥️</span>
        <div>
          <div class="bold-txt">Done! Opens in Dedicated Window</div>
          <div class="sub-txt">Right-click icon on Taskbar and click "Pin to taskbar".</div>
        </div>
      </div>
    </div>

  </main>

  <!-- Clean Slim Footer -->
  <footer class="footer-row">
    <div class="footer-left">
      <span>💡</span>
      <span><strong>Can't see the install button?</strong> Ensure you are using Google Chrome and the page has finished loading.</span>
    </div>
    <div class="footer-right">
      Blue Archipelago Berhad • Farm IT Support
    </div>
  </footer>

</body>
</html>
"""

temp_html = os.path.join(os.environ["TEMP"], "isharp_pwa_poster_clean.html")
with open(temp_html, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Generated Clean Integrated HTML at:", temp_html)
