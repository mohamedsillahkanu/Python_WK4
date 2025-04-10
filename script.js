// JavaScript for sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            sidebarToggle.textContent = 'Close';
        } else {
            sidebarToggle.textContent = 'Menu';
        }
    });
    
    // Toggle submenu
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const link = item.querySelector('a');
        link.addEventListener('click', function(e) {
            // Only toggle if clicking on the main menu item, not submenu items
            if (e.target === link) {
                e.preventDefault();
                item.classList.toggle('active');
            }
        });
    });
    
    // Close sidebar when clicking on a link in mobile view
    const sidebarLinks = document.querySelectorAll('.sidebar a');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    if (isMobile) {
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function() {
                sidebar.classList.remove('active');
                sidebarToggle.textContent = 'Menu';
            });
        });
    }
});
