/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
================================================================================ */

// Kiểm tra xem đã đăng nhập chưa, nếu chưa thì quay về trang đăng nhập
window.addEventListener('load', () => {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    window.location.href = 'dang_nhap.html';
    return;
  }
  
  // Hiển thị username
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) usernameEl.textContent = currentUser;
  
  // Xử lý nút đăng xuất
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.replace('dang_nhap.html');
    });
  }
});

/* =============================================================================
   HAMBURGER MENU & MOBILE NAVIGATION
   Xử lý menu hamburger và điều hướng trên mobile
================================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
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

  /* =============================================================================
     DROPDOWN LEVEL 2 & 3 HIGHLIGHT
     Highlight parent dropdowns when hovering on submenu items
  ================================================================================ */

  const dropdownSubmenus = document.querySelectorAll('.dropdown-submenu');
  
  dropdownSubmenus.forEach(submenu => {
    submenu.addEventListener('mouseenter', () => {
      // Find parent dropdown (level 1)
      const parentDropdown = submenu.closest('.dropdown');
      if (parentDropdown) {
        parentDropdown.classList.add('highlight-parent');
      }
    });
    
    submenu.addEventListener('mouseleave', () => {
      const parentDropdown = submenu.closest('.dropdown');
      if (parentDropdown) {
        parentDropdown.classList.remove('highlight-parent');
      }
    });
  });

  // Level 3 highlight: when hovering on items inside .dropdown-submenu > .dropdown-menu
  const level3Items = document.querySelectorAll('.dropdown-submenu > .dropdown-menu > li');
  
  level3Items.forEach(item => {
    item.addEventListener('mouseenter', () => {
      // Find parent dropdown-submenu (level 2)
      const parentSubmenu = item.closest('.dropdown-submenu');
      if (parentSubmenu) {
        parentSubmenu.classList.add('highlight-parent');
      }
      
      // Also highlight level 1 dropdown
      const parentDropdown = item.closest('.dropdown');
      if (parentDropdown) {
        parentDropdown.classList.add('highlight-parent');
      }
    });
    
    item.addEventListener('mouseleave', () => {
      const parentSubmenu = item.closest('.dropdown-submenu');
      if (parentSubmenu) {
        parentSubmenu.classList.remove('highlight-parent');
      }
      
      const parentDropdown = item.closest('.dropdown');
      if (parentDropdown) {
        parentDropdown.classList.remove('highlight-parent');
      }
    });
  });
});
