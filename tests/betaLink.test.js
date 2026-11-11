/**
 * The TestFlight public beta link: every page offers it, it points at the real join URL, and it opens safely in a
 * new tab. Static check on the HTML files (no network).
 */
const fs = require('fs');
const path = require('path');

const BETA_URL = 'https://testflight.apple.com/join/UJWrMbk2';
const PAGES = ['index.html', 'gallery.html', 'whats-new.html'];

function betaLinks(page) {
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    return [...document.querySelectorAll('a[data-beta-link]')];
}

describe.each(PAGES)('%s', (page) => {
    test('offers the beta link', () => {
        expect(betaLinks(page).length).toBeGreaterThan(0);
    });

    test('every beta link goes to the TestFlight join page and opens safely', () => {
        for (const a of betaLinks(page)) {
            expect(a.getAttribute('href')).toBe(BETA_URL);
            expect(a.getAttribute('target')).toBe('_blank');
            expect(a.getAttribute('rel')).toContain('noopener');
            expect(a.textContent.trim().length).toBeGreaterThan(0);
        }
    });
});

test('the home hero leads with the beta, not "Coming Soon"', () => {
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const hero = document.querySelector('.platforms');
    expect(hero.querySelector('a.beta-cta[data-beta-link]')).not.toBeNull();
    expect(hero.textContent).not.toMatch(/Coming Soon/);
});
