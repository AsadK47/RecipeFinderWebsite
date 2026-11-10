const { launchConfetti } = require('../recipefinder-site.js');

const win = reduced => ({
    matchMedia: q => ({ matches: reduced && q.includes('reduce') }),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
});

beforeEach(() => { document.body.innerHTML = ''; jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

test('adds a decorative layer of pieces, then cleans up', () => {
    expect(launchConfetti(document, win(false), 12)).toBe(12);
    const layer = document.querySelector('.confetti');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.children.length).toBe(12);
    jest.advanceTimersByTime(2600);
    expect(document.querySelector('.confetti')).toBeNull();
});

test('reduced motion: no confetti', () => {
    expect(launchConfetti(document, win(true), 12)).toBe(0);
    expect(document.querySelector('.confetti')).toBeNull();
});
