/**
 * Tests for the waitlist signup form in recipefinder-site.js
 *
 * Unit tests  → validateEmail (no DOM needed)
 * Integration → form submission: validation gates, honeypot, API call,
 *               success/error UI, loading state, button re-enable
 */

// ── mock global.fetch before the module is loaded ──────────────────────────
global.fetch = jest.fn();

// Suppress console.error so expected error-path logs don't pollute test output
jest.spyOn(console, 'error').mockImplementation(() => {});

const { validateEmail, initNotifyForm } = require('../recipefinder-site.js');

// Flush all pending microtasks / macrotasks so async handlers finish
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Minimal DOM that mirrors the form in index.html
function setupDOM() {
    document.body.innerHTML = `
        <form id="notifyForm" action="https://api.web3forms.com/submit" method="POST">
            <input type="hidden" name="access_key" value="test-key">
            <input type="text"   name="botcheck"   id="botcheck"    value="" style="display:none" tabindex="-1" autocomplete="off">
            <input type="hidden" name="message"    id="messageInput">
            <input type="email"  name="email"      id="emailInput"  placeholder="Enter your email" required>
            <input type="hidden" name="replyto"    id="replytoInput">
            <button type="submit">Notify Me</button>
        </form>
        <p class="form-message" id="formMessage"></p>
    `;
    initNotifyForm();
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
        // 'x' has length 1 and is not in validTLDs
        expect(validateEmail('user@example.x')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration tests – form submission & Web3Forms API call
// ═══════════════════════════════════════════════════════════════════════════

describe('Waitlist signup form', () => {
    let form, emailInput, formMessage, button;

    beforeEach(() => {
        setupDOM();
        form        = document.getElementById('notifyForm');
        emailInput  = document.getElementById('emailInput');
        formMessage = document.getElementById('formMessage');
        button      = form.querySelector('button');
        global.fetch.mockClear();
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    // ── Invalid email ────────────────────────────────────────────────────

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

    // ── Honeypot / bot protection ────────────────────────────────────────

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

    // ── Successful API submission ─────────────────────────────────────────

    test('calls the Web3Forms endpoint with POST on a valid submission', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => ({ success: true }),
        });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.web3forms.com/submit',
            expect.objectContaining({ method: 'POST' })
        );
    });

    test('sends the Accept: application/json header', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => ({ success: true }),
        });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        const [, options] = global.fetch.mock.calls[0];
        expect(options.headers).toEqual(
            expect.objectContaining({ Accept: 'application/json' })
        );
    });

    test('shows a success message when the API responds with success', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => ({ success: true }),
        });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(formMessage.textContent).toMatch(/success/i);
        expect(formMessage.style.color).toBe('rgb(16, 185, 129)');
    });

    test('re-enables the button and input after a successful submission', async () => {
        emailInput.value = 'user@example.com';
        global.fetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => ({ success: true }),
        });

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();

        expect(button.disabled).toBe(false);
        expect(emailInput.disabled).toBe(false);
    });

    // ── Failed API response ───────────────────────────────────────────────

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

    // ── Loading / in-flight state ─────────────────────────────────────────

    test('disables the button and input while the API call is in-flight', async () => {
        emailInput.value = 'user@example.com';

        let resolveRequest;
        global.fetch.mockReturnValueOnce(
            new Promise(resolve => { resolveRequest = resolve; })
        );

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Fetch is still pending – controls must be locked
        expect(button.disabled).toBe(true);
        expect(emailInput.disabled).toBe(true);

        // Resolve so the test doesn't leak
        resolveRequest({ ok: true, json: async () => ({ success: true }) });
        await flushPromises();
    });
});
