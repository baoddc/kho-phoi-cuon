/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
   ================================================================================ */

// Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
const PUBLIC_PAGES = [
  'home.html',
  '5s-so-do-phoi-cuon.html',
  '5s-so-do-phe-lieu.html',
  'hse.html',
  'xg-nhap.html',
  'xg-xuat.html',
  'xg-ton.html',
  'tole-nhap.html',
  'tole-xuat.html',
  'tole-ton.html',
  'about.html'
];

/**
 * Handle restricted access attempts for guests
 * Shows alert and redirects to login page
 */
/**
 * Shows a premium centered modal for authentication required
 */
function showAuthModal() {
  // 1. Create Modal HTML if not exists
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'custom-modal-backdrop';
    modal.innerHTML = `
      <div class="custom-modal-content">
        <div class="modal-premium-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </div>
        <h3 class="modal-title">Yêu cầu đăng nhập</h3>
        <p class="modal-message">Bạn cần đăng nhập tài khoản để truy cập chức năng này và xem toàn bộ dữ liệu.</p>
        <div class="modal-actions">
          <button id="modal-cancel-btn" class="modal-btn btn-secondary">Quay lại</button>
          <button id="modal-login-btn" class="modal-btn btn-primary">Đăng nhập ngay</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Initial click handlers
    document.getElementById('modal-login-btn').onclick = () => {
      window.location.href = 'index.html';
    };

    document.getElementById('modal-cancel-btn').onclick = () => {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';

      if (!PUBLIC_PAGES.includes(currentPage) && currentPage !== 'index.html') {
        window.location.href = 'home.html';
      } else {
        modal.classList.remove('active');
      }
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        // Only allow closing if we aren't on a restricted page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (PUBLIC_PAGES.includes(currentPage)) {
          modal.classList.remove('active');
        }
      }
    };
  }

  // 2. Inject Premium CSS if not exists
  if (!document.getElementById('auth-modal-style')) {
    const style = document.createElement('style');
    style.id = 'auth-modal-style';
    style.textContent = `
      .custom-modal-backdrop {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center; z-index: 99999;
        opacity: 0; visibility: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 20px;
      }
      .custom-modal-backdrop.active { opacity: 1; visibility: visible; }
      .custom-modal-content {
        background: #1e293b; border: 1px solid rgba(255,255,255,0.1); padding: 3rem 2.5rem;
        border-radius: 24px; width: 100%; max-width: 420px; text-align: center;
        transform: scale(0.9) translateY(20px); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      }
      .custom-modal-backdrop.active .custom-modal-content { transform: scale(1) translateY(0); }
      
      .modal-premium-icon {
        width: 70px; height: 70px; background: rgba(16, 185, 129, 0.1); color: #10b981;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        margin: 0 auto 1.5rem; border: 1px solid rgba(16, 185, 129, 0.2);
      }
      .modal-premium-icon svg { width: 32px; height: 32px; }
      
      .modal-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.75rem; letter-spacing: -0.5px; }
      .modal-message { color: #94a3b8; line-height: 1.6; margin-bottom: 2rem; font-size: 0.95rem; }
      
      .modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .modal-btn {
        padding: 0.85rem; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer;
        transition: all 0.3s ease; border: none;
      }
      .btn-secondary { background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); }
      .btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
      
      .btn-primary { 
        background: linear-gradient(135deg, #10b981, #059669); color: #fff;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
      }
      .btn-primary:hover { 
        transform: translateY(-2px); 
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); 
      }
    `;
    document.head.appendChild(style);
  }

  // 3. Show Modal
  setTimeout(() => modal.classList.add('active'), 10);
}

/**
 * Handle restricted access attempts for guests
 * Shows custom modal and manages flow
 */
function handleRestrictedAccess(e) {
  if (e) e.preventDefault();
  showAuthModal();
}

window.addEventListener('load', () => {
  const currentUser = localStorage.getItem('currentUser');
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  if (!currentUser) {
    // 1. Check if CURRENT page is restricted
    if (!PUBLIC_PAGES.includes(currentPage) && currentPage !== 'index.html') {
      showAuthModal(); // Immediate show on landing
      return;
    }

    // 2. Intercept clicks to OTHER restricted pages
    setTimeout(() => {
      document.querySelectorAll('nav a, .dropdown-menu a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('') && !PUBLIC_PAGES.some(p => href.endsWith(p)) && !href.endsWith('index.html')) {
          link.addEventListener('click', handleRestrictedAccess);
        }
      });
    }, 100);
  }

  // Update UI for both logged-in and guest users
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) {
    usernameEl.textContent = currentUser || 'Khách';
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    if (currentUser) {
      btnLogout.textContent = 'Đăng xuất';
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.replace('index.html');
      });
    } else {
      btnLogout.textContent = 'Đăng nhập';
      btnLogout.className = 'btn-logout bg-success';
      btnLogout.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }
  }
});

/* =============================================================================
   DROPDOWN HIGHLIGHT FEATURE
   JavaScript-based highlight for parent dropdown when hovering on child items
   Provides better compatibility and smoother transitions
   ================================================================================ */

/**
 * Initialize dropdown highlight feature
 * Uses mouseenter/mouseleave for precise hover detection
 */
function initDropdownHighlight() {
  // Only apply on desktop (screen width > 768px)
  if (window.innerWidth <= 768) return;

  // Get all dropdown menus
  const dropdownMenus = document.querySelectorAll('.dropdown-menu');

  dropdownMenus.forEach(menu => {
    // Get the parent dropdown (level 1)
    const parentDropdown = menu.closest('.dropdown');
    if (!parentDropdown) return;

    // Get all direct child list items in this menu
    const listItems = menu.querySelectorAll(':scope > li');

    listItems.forEach(item => {
      // Mouseenter: Add highlight to parent
      item.addEventListener('mouseenter', () => {
        parentDropdown.classList.add('highlighted');

        // Also highlight level 2 parent if exists (for nested submenus)
        const level2Parent = item.closest('.dropdown-submenu');
        if (level2Parent && level2Parent !== parentDropdown) {
          level2Parent.classList.add('highlighted');
        }
      });

      // Mouseleave: Remove highlight from parent
      item.addEventListener('mouseleave', () => {
        parentDropdown.classList.remove('highlighted');

        // Remove highlight from level 2 parent
        const level2Parent = item.closest('.dropdown-submenu');
        if (level2Parent && level2Parent !== parentDropdown) {
          level2Parent.classList.remove('highlighted');
        }
      });
    });
  });
}

/**
 * Handle touch devices - use touchstart for mobile highlight
 */
function initTouchDropdownHighlight() {
  // Only apply on mobile/touch devices
  if (window.innerWidth > 768) return;

  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('touchstart', (e) => {
      const dropdown = toggle.closest('.dropdown');
      if (dropdown) {
        dropdown.classList.toggle('highlighted');
      }
    }, { passive: true });
  });
}

/**
 * Re-initialize highlight on window resize
 * Ensures feature works correctly when switching between mobile/desktop
 */
function handleResizeHighlight() {
  // Remove existing highlight classes on resize
  document.querySelectorAll('.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Re-initialize based on new screen size
  initDropdownHighlight();
  initTouchDropdownHighlight();
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initDropdownHighlight();
  initTouchDropdownHighlight();
  initARIAUpdates();

  // Re-init on resize with debounce
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResizeHighlight, 150);
  });
});

/**
 * Update ARIA attributes for accessibility
 * Handles aria-expanded state changes
 */
function initARIAUpdates() {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (toggle && menu) {
      // Desktop: Update aria-expanded on hover
      if (window.innerWidth > 768) {
        dropdown.addEventListener('mouseenter', () => {
          toggle.setAttribute('aria-expanded', 'true');
        });

        dropdown.addEventListener('mouseleave', () => {
          toggle.setAttribute('aria-expanded', 'false');
        });
      }

      // Mobile: Update aria-expanded on click
      toggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', !isExpanded);
        }
      });
    }
  });
}

/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
   Xử lý menu hamburger và điều hướng trên mobile
   ================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  const dropdown5S = document.getElementById('5SDropdown');
  const xgDropdown = document.getElementById('xgDropdown');
  const toleDropdown = document.getElementById('toleDropdown');

  // Hamburger menu toggle
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      hamburger.classList.toggle('active');
      mainNav.classList.toggle('active');
    });
  }

  // Dropdown click for mobile - 5S
  if (dropdown5S) {
    const dropdownToggle = dropdown5S.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdown5S.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile
  if (xgDropdown) {
    const dropdownToggle = xgDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          xgDropdown.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile - Tole
  if (toleDropdown) {
    const dropdownToggle = toleDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          toleDropdown.classList.toggle('active');
        }
      });
    }
  }

  // Dropdown click for mobile - Phế liệu
  const plDropdown = document.getElementById('plDropdown');
  if (plDropdown) {
    const dropdownToggle = plDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        // Only on mobile
        if (window.innerWidth <= 768) {
          e.preventDefault();
          plDropdown.classList.toggle('active');
        }
      });
    }
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (mainNav && !mainNav.contains(e.target) && !hamburger.contains(e.target)) {
        mainNav.classList.remove('active');
        hamburger.classList.remove('active');
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && mainNav) {
      mainNav.classList.remove('active');
      hamburger.classList.remove('active');
    }
  });
});

// =============================================================================
// DDC VOICE ASSISTANT AUTO LOADER
// Tự động nhúng CSS và JS của trợ lý ảo vào các trang (trừ trang đăng nhập)
// =============================================================================
window.addEventListener('load', () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPage === 'index.html' || currentPage === 'dang_nhap.html') {
    return;
  }

  // 1. Nhúng voice-assistant.css vào head
  if (!document.getElementById('voice-assistant-style')) {
    const link = document.createElement('link');
    link.id = 'voice-assistant-style';
    link.rel = 'stylesheet';
    link.href = 'assets/css/voice-assistant.css';
    document.head.appendChild(link);
  }

  // 2. Nhúng voice-assistant.js vào body
  if (!document.getElementById('voice-assistant-script')) {
    const script = document.createElement('script');
    script.id = 'voice-assistant-script';
    script.src = 'assets/js/voice-assistant.js';
    document.body.appendChild(script);
  }
});


