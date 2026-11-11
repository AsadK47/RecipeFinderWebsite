/**
 * Tests for recipefinder-site.js
 *
 * Unit tests  → validateEmail
 * Integration → Notify form (submit, input events, blur events, hidden fields, timers)
 *               Cookie consent
 *               Theme toggle
 */

// ── mock global.fetch before the module is loaded ──────────────────────────
global.fetch = jest.fn();

// Suppress console.error so expected error-path logs don't pollute test output
jest.spyOn(console, 'error').mockImplementation(() => {});

const { validateEmail, initNotifyForm, initCookieConsent, initThemeToggle } =
    require('../recipefinder-site.js');

// Flush all pending microtasks / macrotasks so async handlers finish
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// ── DOM setup helpers ───────────────────────────────────────────────────────

function setupNotifyDOM() {
    document.body.innerHTML = `
        <form id="notifyForm" action="https://api.web3forms.com/submit" method="POST">
            <input type="hidden" name="access_key" value="test-key">
            <input type="text"   name="botcheck"   id="botcheck"    value="" style="display:none" tabindex="-1" autocomplete="off">
            <input type="hidden" name="message"    id="messageInput">
            <input type="email"  name="email"      id="emailInput"  placeholder="Enter your email" required>
            <input type="hidden" name="replyto"    id="replytoInput">
            <button type="submit">Notify me</button>
        </form>
        <p class="form-message" id="formMessage"></p>
    `;
    initNotifyForm();
}

function setupCookieDOM({ priorConsent = null, bannerHidden = false } = {}) {
    localStorage.clear();
    if (priorConsent) localStorage.setItem('cookieConsent', priorConsent);
    document.body.innerHTML = `
        <div id="cookieConsent"${bannerHidden ? ' class="hidden"' : ''}>
            <button id="acceptCookies">Accept</button>
            <button id="rejectCookies">Reject</button>
        </div>
    `;
    initCookieConsent();
}

function setupThemeDOM({ savedTheme = null, systemPrefersDark = false } = {}) {
    localStorage.clear();
    if (savedTheme) localStorage.setItem('theme', savedTheme);
    document.body.innerHTML = `
        <button id="themeToggle">
            <span class="theme-icon"></span>
        </button>
    `;
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: query.includes('dark') && systemPrefersDark,
            media:   query,
            addEventListener:    jest.fn(),
            removeEventListener: jest.fn(),
        })),
    });
    initThemeToggle();
}

// ═══════════════════════════════════════════════════════════════════════════
// Unit tests – validateEmail
// ═══════════════════════════════════════════════════════════════════════════

describe('validateEmail', () => {
    test('accepts a valid .com address', () => {
        expect(validateEmail('user@example.com')).toBe(true);
    });

    test('accepts a valid .org address', () => {
        expect(validateEmail('user@example.org')).toBe(true);
    });

    test('accepts a valid .co.uk address', () => {
        expect(validateEmail('user@example.co.uk')).toBe(true);
    });

    test('accepts a valid .io address', () => {
        expect(validateEmail('hello@startup.io')).toBe(true);
    });

    test('accepts an address with a subdomain', () => {
        expect(validateEmail('user@mail.example.com')).toBe(true);
    });

    test('accepts an uppercase email address', () => {
        expect(validateEmail('USER@EXAMPLE.COM')).toBe(true);
    });

    test('trims surrounding whitespace before validating', () => {
        expect(validateEmail('  user@example.com  ')).toBe(true);
    });

    test('rejects an address with no @ symbol', () => {
        expect(validateEmail('notanemail')).toBe(false);
    });

    test('rejects an address with nothing after @', () => {
        expect(validateEmail('user@')).toBe(false);
    });

    test('rejects an address with no TLD (no dot in domain)', () => {
        expect(validateEmail('user@example')).toBe(false);
    });

    test('rejects an address containing consecutive dots', () => {
        expect(validateEmail('user..name@example.com')).toBe(false);
    });

    test('rejects an address longer than 254 characters', () => {
        const longLocal = 'a'.repeat(249);
        const longEmail = `${longLocal}@b.com`; // 249 + 6 = 255 chars > 254
        expect(longEmail.length).toBeGreaterThan(254);
        expect(validateEmail(longEmail)).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(validateEmail('')).toBe(false);
    });

    test('rejects a single-character TLD not in the allow-list', () => {
        expect(validateEmail('user@example.x')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration tests – Waitlist signup form
// ═══════════════════════════════════════════════════════════════════════════

describe('Waitlist signup form', () => {
    let form, emailInput, formMessage, button;

    beforeEach(() => {
        setupNotifyDOM();
        form        = document.getElementById('notifyForm');
        emailInput  = document.getElementById('emailInput');
        formMessage = document.getElementById('formMessage');
        button      = form.querySelector('button');
        global.fetch.mockClear();
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    // ── Submit: invalid email ────────────────────────────────────────────

    test('does not call fetch when the email is invalid', () => {
        emailInput.value = 'bad-email';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('shows a validation error message when the email is invalid', () => {
        emailInput.value = 'bad-email';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(formMessage.textContent).toMatch(/valid email/i);
        expect(formMessage.style.color).toBe('rgb(239, 68, 68)');
    });

    // ── Submit: honeypot / bot protection ────────────────────────────────

    test('does not call fetch when the honeypot field is filled', () => {
        emailInput.value = 'user@example.com';
        document.querySelector('[name="botcheck"]').value = 'I am a bot';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('shows a silent success message when the honeypot is filled', () => {
        emailInput.value = 'user@example.com';
        document.querySelector('[name="botcheck"]').value = 'spam';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(formMessage.textContent).toMatch(/welcome/i);
    });

    // ── Submit: successful API call ───────────────────────────────────────

    test('calls the Web3Forms endpoint with POST on a valid submission', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.web3forms.com/submit',
            expect.objectContaining({ method: 'POST' })
        );
    });

    test('sends the Accept: application/json header', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        const [, options] = global.fetch.mock.calls[0];
        expect(options.headers).toEqual(expect.objectContaining({ Accept: 'application/json' }));
    });

    test('shows a success message when the API responds with success', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(formMessage.textContent).toMatch(/success/i);
        expect(formMessage.style.color).toBe('rgb(16, 185, 129)');
    });

    test('resets the form after a successful submission', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(emailInput.value).toBe('');
    });

    test('re-enables the button and input after a successful submission', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(button.disabled).toBe(false);
        expect(emailInput.disabled).toBe(false);
    });

    test('clears the success message automatically after 8 seconds', async () => {
        jest.useFakeTimers();
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Drain the promise chain; microtasks run fine under fake timers
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(formMessage.textContent).toMatch(/success/i);

        jest.advanceTimersByTime(8000);

        expect(formMessage.textContent).toBe('');
        jest.useRealTimers();
    });

    // ── Submit: API errors ────────────────────────────────────────────────

    test('shows an error message when the API returns a non-success response', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({
            ok:   false,
            json: async () => ({ success: false, message: 'Submission failed' }),
        });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(formMessage.textContent).toMatch(/oops/i);
        expect(formMessage.style.color).toBe('rgb(239, 68, 68)');
    });

    test('shows an error message on a network error', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockRejectedValueOnce(new Error('Network unavailable'));

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(formMessage.textContent).toMatch(/oops/i);
        expect(formMessage.style.color).toBe('rgb(239, 68, 68)');
    });

    test('re-enables the button and input after an API error', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(button.disabled).toBe(false);
        expect(emailInput.disabled).toBe(false);
    });

    // ── Submit: loading / in-flight state ─────────────────────────────────

    test('disables the button and input while the API call is in-flight', async () => {
        emailInput.value = 'user@example.com';

        let resolveRequest;
        global.fetch.mockReturnValueOnce(
            new Promise(resolve => { resolveRequest = resolve; })
        );

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(button.disabled).toBe(true);
        expect(emailInput.disabled).toBe(true);

        resolveRequest({ ok: true, json: async () => ({ success: true }) });
        await flushPromises();
    });

    test('shows a loading message on the button while the request is in-flight', async () => {
        emailInput.value = 'user@example.com';

        let resolveRequest;
        global.fetch.mockReturnValueOnce(
            new Promise(resolve => { resolveRequest = resolve; })
        );

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(button.innerHTML).toMatch(/Adding you to the list/i);

        resolveRequest({ ok: true, json: async () => ({ success: true }) });
        await flushPromises();
    });

    // ── Submit: hidden fields populated ──────────────────────────────────

    test('sets the replyto hidden field to the submitted email', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        // replyto is assigned synchronously before the first await in the handler
        expect(form.querySelector('[name="replyto"]').value).toBe('user@example.com');

        await flushPromises();
    });

    test('sets the message hidden field to contain the submitted email', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(form.querySelector('[name="message"]').value).toContain('user@example.com');

        await flushPromises();
    });

    // ── input event: real-time validation ────────────────────────────────

    test('turns the input border green when a valid email is typed', () => {
        emailInput.value = 'user@example.com';
        emailInput.dispatchEvent(new Event('input'));

        expect(emailInput.style.borderColor).toBe('#10b981');
    });

    test('turns the input border red when an invalid email with @ is typed', () => {
        emailInput.value = 'user@bad';
        emailInput.dispatchEvent(new Event('input'));

        expect(emailInput.style.borderColor).toBe('#ef4444');
    });

    test('shows an inline error when the partial email contains @', () => {
        emailInput.value = 'user@bad';
        emailInput.dispatchEvent(new Event('input'));

        expect(formMessage.textContent).toMatch(/valid email/i);
    });

    test('does not show an inline error when typing before the @ character', () => {
        emailInput.value = 'justname';
        emailInput.dispatchEvent(new Event('input'));

        expect(formMessage.textContent).toBe('');
        expect(emailInput.style.borderColor).toBe('#ef4444');
    });

    test('resets the border and message when the email field is cleared', () => {
        emailInput.value = 'user@bad';
        emailInput.dispatchEvent(new Event('input'));

        emailInput.value = '';
        emailInput.dispatchEvent(new Event('input'));

        expect(emailInput.style.borderColor).toBe('rgba(255, 255, 255, 0.3)');
        expect(formMessage.textContent).toBe('');
    });

    // ── blur event: deferred validation ──────────────────────────────────

    test('shows an error on blur when the email is invalid', () => {
        emailInput.value = 'bademail';
        emailInput.dispatchEvent(new Event('blur'));

        expect(formMessage.textContent).toMatch(/valid email/i);
        expect(emailInput.style.borderColor).toBe('#ef4444');
    });

    test('resets the border and message on blur when the field is empty', () => {
        // prime the field with an error first
        emailInput.value = 'bademail';
        emailInput.dispatchEvent(new Event('blur'));

        emailInput.value = '';
        emailInput.dispatchEvent(new Event('blur'));

        expect(emailInput.style.borderColor).toBe('rgba(255, 255, 255, 0.3)');
        expect(formMessage.textContent).toBe('');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration tests – Cookie consent
// ═══════════════════════════════════════════════════════════════════════════

describe('Cookie consent', () => {
    afterEach(() => {
        localStorage.clear();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('accept button stores "accepted" consent in localStorage', () => {
        setupCookieDOM();
        document.getElementById('acceptCookies').click();

        expect(localStorage.getItem('cookieConsent')).toBe('accepted');
    });

    test('accept button hides the cookie banner', () => {
        setupCookieDOM();
        const banner = document.getElementById('cookieConsent');
        document.getElementById('acceptCookies').click();

        expect(banner.classList.contains('hidden')).toBe(true);
    });

    test('reject button stores "rejected" consent in localStorage', () => {
        setupCookieDOM();
        document.getElementById('rejectCookies').click();

        expect(localStorage.getItem('cookieConsent')).toBe('rejected');
    });

    test('reject button hides the cookie banner', () => {
        setupCookieDOM();
        const banner = document.getElementById('cookieConsent');
        document.getElementById('rejectCookies').click();

        expect(banner.classList.contains('hidden')).toBe(true);
    });

    test('reject button removes any saved theme preference', () => {
        setupCookieDOM(); // localStorage.clear() is called inside
        localStorage.setItem('theme', 'dark'); // set after setup to avoid being wiped
        document.getElementById('rejectCookies').click();

        expect(localStorage.getItem('theme')).toBeNull();
    });

    test('shows the cookie banner after 2 seconds when no consent is stored', () => {
        jest.useFakeTimers();
        setupCookieDOM({ bannerHidden: true });
        const banner = document.getElementById('cookieConsent');

        expect(banner.classList.contains('hidden')).toBe(true);
        jest.advanceTimersByTime(2000);
        expect(banner.classList.contains('hidden')).toBe(false);
    });

    test('does not show the banner when consent is already stored', () => {
        jest.useFakeTimers();
        setupCookieDOM({ priorConsent: 'accepted', bannerHidden: true });
        const banner = document.getElementById('cookieConsent');

        jest.advanceTimersByTime(2000);
        expect(banner.classList.contains('hidden')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration tests – Theme toggle
// ═══════════════════════════════════════════════════════════════════════════

describe('Theme toggle', () => {
    afterEach(() => {
        localStorage.clear();
        jest.clearAllTimers();
    });

    test('applies the saved dark theme from localStorage on init', () => {
        setupThemeDOM({ savedTheme: 'dark' });

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('applies the saved light theme from localStorage on init', () => {
        setupThemeDOM({ savedTheme: 'light' });

        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('defaults to dark when the system prefers dark and no theme is saved', () => {
        setupThemeDOM({ systemPrefersDark: true });

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('defaults to light when the system prefers light and no theme is saved', () => {
        setupThemeDOM({ systemPrefersDark: false });

        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('toggles from dark to light on click', () => {
        setupThemeDOM({ savedTheme: 'dark' });
        document.getElementById('themeToggle').click();

        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('toggles from light to dark on click', () => {
        setupThemeDOM({ savedTheme: 'light' });
        document.getElementById('themeToggle').click();

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('saves the new theme to localStorage when cookie consent is accepted', () => {
        setupThemeDOM({ savedTheme: 'dark' });
        localStorage.setItem('cookieConsent', 'accepted');
        document.getElementById('themeToggle').click();

        expect(localStorage.getItem('theme')).toBe('light');
    });

    test('does not update localStorage when cookie consent is not accepted', () => {
        setupThemeDOM({ systemPrefersDark: false }); // no savedTheme → theme key absent
        document.getElementById('themeToggle').click();

        expect(localStorage.getItem('theme')).toBeNull();
    });

    test('shows ☀️ icon when the theme is dark', () => {
        setupThemeDOM({ savedTheme: 'dark' });

        expect(document.querySelector('.theme-icon').textContent).toBe('☀️');
    });

    test('shows 🌙 icon when the theme is light', () => {
        setupThemeDOM({ savedTheme: 'light' });

        expect(document.querySelector('.theme-icon').textContent).toBe('🌙');
    });
});
