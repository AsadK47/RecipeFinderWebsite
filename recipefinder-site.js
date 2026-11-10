// ============================================
// RecipeFinder Website JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initNotifyForm();
    initScrollAnimations();
    initCookieConsent();
    initSmoothScroll();
});

// ============================================
// Theme Toggle
// ============================================

function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const root = document.documentElement;
    
    // Check for saved theme preference, otherwise respect system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let currentTheme;
    if (savedTheme) {
        currentTheme = savedTheme;
    } else {
        currentTheme = systemPrefersDark ? 'dark' : 'light';
    }
    
    root.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme, themeIcon);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        root.setAttribute('data-theme', newTheme);
        
        // Only save to localStorage if cookies accepted
        const cookieConsent = localStorage.getItem('cookieConsent');
        if (cookieConsent === 'accepted') {
            localStorage.setItem('theme', newTheme);
        }
        
        updateThemeIcon(newTheme, themeIcon);
        
        // Add a subtle animation
        themeToggle.style.transform = 'translateY(-50%) rotate(360deg)';
        setTimeout(() => {
            themeToggle.style.transform = 'translateY(-50%)';
        }, 300);
    });
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            root.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme, themeIcon);
        }
    });
}

function updateThemeIcon(theme, iconElement) {
    iconElement.textContent = theme === 'dark' ? '☀️' : '🌙';
    iconElement.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}

// ============================================
// Email Validation (module-level for testability)
// ============================================

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validTLDs = ['com', 'co.uk', 'uk', 'org', 'net', 'edu', 'gov', 'io', 'app', 'dev', 'me', 'us'];

function validateEmail(email) {
    email = email.trim();

    // Basic format check
    if (!emailRegex.test(email)) {
        return false;
    }

    // Prevent obviously malformed emails
    if (email.includes('..') || email.length > 254) {
        return false;
    }

    // Check for valid TLD
    const tld = email.split('.').pop().toLowerCase();
    if (!validTLDs.includes(tld) && tld.length < 2) {
        return false;
    }

    return true;
}

// ============================================
// Notify Form
// ============================================

function initNotifyForm() {
    const form = document.getElementById('notifyForm');
    if (!form) return; // only the home page has the sign-up form
    const message = document.getElementById('formMessage');
    const button = form.querySelector('button');
    const input = form.querySelector('input[type="email"]');

    // Real-time validation on input
    input.addEventListener('input', () => {
        const email = input.value.trim();
        
        if (email.length === 0) {
            // Empty input - reset to neutral state
            input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            message.textContent = '';
            return;
        }
        
        if (validateEmail(email)) {
            // Valid email - green border
            input.style.borderColor = '#10b981';
            message.textContent = '';
        } else {
            // Invalid email - red border
            input.style.borderColor = '#ef4444';
            if (email.includes('@')) {
                message.textContent = '⚠ Please enter a valid email address';
            } else {
                message.textContent = '';
            }
            message.style.color = '#ef4444';
        }
    });
    
    // Validation on blur (when user clicks away)
    input.addEventListener('blur', () => {
        const email = input.value.trim();
        
        if (email.length > 0 && !validateEmail(email)) {
            input.style.borderColor = '#ef4444';
            message.textContent = '⚠ Please enter a valid email address';
            message.style.color = '#ef4444';
        } else if (email.length === 0) {
            input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            message.textContent = '';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = input.value.trim();
        
        // Validate email before submission
        if (!validateEmail(email)) {
            message.textContent = '⚠ Please enter a valid email address';
            message.style.color = '#ef4444';
            input.style.borderColor = '#ef4444';
            input.focus();
            return;
        }
        
        // Check honeypot (if filled, it's a bot)
        const botcheck = form.querySelector('[name="botcheck"]');
        if (botcheck && botcheck.value !== '') {
            // Silently fail for bots
            message.textContent = '✓ Welcome to the community! We\'ll see you on launch day.';
            message.style.color = 'var(--text-primary)';
            form.reset();
            return;
        }
        
        // Set reply_to to the user's email so you can easily respond
        const replytoInput = form.querySelector('[name="replyto"]');
        if (replytoInput) {
            replytoInput.value = email;
        }
        
        // Set message field with the email for visibility in notification
        const messageInput = form.querySelector('[name="message"]');
        if (messageInput) {
            messageInput.value = `New waitlist signup!\n\nEmail: ${email}\n\nSigned up on: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}`;
        }
        
        // Disable button and show loading state
        button.disabled = true;
        const originalButtonText = button.textContent;
        button.innerHTML = '<span style="display: inline-block; animation: pulse 1.5s ease-in-out infinite;">⏳</span> Adding you to the list...';
        message.textContent = '';
        input.disabled = true;
        
        try {
            // Create FormData and ensure proper formatting
            const formData = new FormData(form);
            
            // Submit to Web3Forms with proper headers
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                message.textContent = '🎉 Success! You\'re on the list. We\'ll email you when RecipeFinder launches!';
                message.style.color = '#10b981';
                message.style.fontWeight = '600';
                input.style.borderColor = '#10b981';
                form.reset();
                
                // Clear message after 8 seconds
                setTimeout(() => {
                    message.textContent = '';
                    input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }, 8000);
            } else {
                // Handle specific error messages
                let errorMessage = '⚠ Oops! Something went wrong. Please try again.';
                
                if (data.message && data.message.includes('spam')) {
                    errorMessage = '⚠ Please wait a moment and try again.';
                }
                
                throw new Error(data.message || 'Form submission failed');
            }
            
            // Reset button
            button.disabled = false;
            button.textContent = originalButtonText;
            input.disabled = false;
            
        } catch (error) {
            message.textContent = '⚠ Oops! Something went wrong. Please try again.';
            message.style.color = '#ef4444';
            message.style.fontWeight = '600';
            button.disabled = false;
            button.textContent = originalButtonText;
            input.disabled = false;
            
            console.error('Subscription error:', error);
        }
    });
}

// ============================================
// Scroll Animations
// ============================================

function initScrollAnimations() {
    // Progressive enhancement: content is visible by default (no JS, no
    // IntersectionObserver, or reduced motion). Only when we can animate do
    // we opt in via .reveal-ready, and anything already on screen shows at once.
    const targets = document.querySelectorAll('.feature, .step, .notify-section');
    if (!targets.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
    document.documentElement.classList.add('reveal-ready');
}

// ============================================
// Logo Interaction (Optional Easter Egg)
// ============================================

const logo = document.querySelector('.logo');
if (logo) {
    logo.addEventListener('click', () => {
        logo.style.transform = 'scale(0.95)';
        setTimeout(() => {
            logo.style.transform = 'scale(1)';
        }, 200);
    });
}

// ============================================
// Theme Switcher (Future Enhancement)
// ============================================

// You can add theme switching functionality here
// to showcase all 8 themes from your app

const themes = {
    teal: {
        start: 'rgb(20, 184, 166)',
        middle: 'rgb(59, 130, 246)',
        end: 'rgb(96, 165, 250)'
    },
    purple: {
        start: 'rgb(131, 58, 180)',
        middle: 'rgb(88, 86, 214)',
        end: 'rgb(64, 224, 208)'
    },
    red: {
        start: 'rgb(139, 0, 0)',
        middle: 'rgb(178, 34, 34)',
        end: 'rgb(230, 81, 0)'
    },
    // Add other themes as needed
};

function switchTheme(themeName) {
    const theme = themes[themeName];
    if (theme) {
        document.documentElement.style.setProperty('--teal-start', theme.start);
        document.documentElement.style.setProperty('--teal-middle', theme.middle);
        document.documentElement.style.setProperty('--teal-end', theme.end);
    }
}

// ============================================
// Performance Optimization
// ============================================

// Add any performance optimizations here as needed

// ============================================
// Cookie Consent
// ============================================

function initCookieConsent() {
    const cookieBanner = document.getElementById('cookieConsent');
    const acceptButton = document.getElementById('acceptCookies');
    const rejectButton = document.getElementById('rejectCookies');
    if (!cookieBanner || !acceptButton || !rejectButton) return; // legal pages have no banner
    
    // Check if user has made a choice
    const cookieChoice = localStorage.getItem('cookieConsent');
    
    if (!cookieChoice) {
        // Show banner after 2 seconds
        setTimeout(() => {
            cookieBanner.classList.remove('hidden');
        }, 2000);
    }
    
    acceptButton.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'accepted');
        cookieBanner.classList.add('hidden');
    });
    
    rejectButton.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'rejected');
        cookieBanner.classList.add('hidden');
        
        // Clear any existing theme preference
        localStorage.removeItem('theme');
    });
}

// ============================================
// Smooth Scroll for Navigation Links
// ============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            
            // Skip empty or just # links
            if (!href || href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const bannerHeight = document.querySelector('.coming-soon-banner').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - bannerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ============================================
// Screenshot Carousel
// ============================================

function initScreenshotCarousel() {
    const screenImages = document.querySelectorAll('.screen-img');
    
    screenImages.forEach(img => {
        const screensData = img.getAttribute('data-screens');
        if (!screensData) return;
        
        try {
            const screens = JSON.parse(screensData);
            if (screens.length <= 1) return;
            
            let currentIndex = 0;
            
            // Auto-rotate screenshots every 4 seconds
            setInterval(() => {
                currentIndex = (currentIndex + 1) % screens.length;
                
                // Fade out
                img.style.opacity = '0';
                
                setTimeout(() => {
                    img.src = screens[currentIndex];
                    // Fade in
                    img.style.opacity = '1';
                }, 300);
                
            }, 4000);
            
            // Add CSS transition for smooth fade
            img.style.transition = 'opacity 0.3s ease-in-out';
            
        } catch (e) {
            console.error('Error parsing screens data:', e);
        }
    });
}

// ============================================
// Swipe Gestures for Mobile
// ============================================

function initSwipeGestures() {
    const iphoneTrio = document.querySelector('.iphone-trio');
    if (!iphoneTrio || window.innerWidth > 968) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    let currentPhoneIndex = 0;
    const phones = document.querySelectorAll('.iphone-container');
    
    iphoneTrio.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    iphoneTrio.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) < swipeThreshold) return;
        
        if (diff > 0 && currentPhoneIndex < phones.length - 1) {
            // Swipe left - next phone
            currentPhoneIndex++;
        } else if (diff < 0 && currentPhoneIndex > 0) {
            // Swipe right - previous phone
            currentPhoneIndex--;
        }
        
        // Scroll to the phone
        phones[currentPhoneIndex].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'center'
        });
    }
}


// ============================================
// Test Exports (no-op in browser)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateEmail, initNotifyForm, initCookieConsent, initThemeToggle };
}
