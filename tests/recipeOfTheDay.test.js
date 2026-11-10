const { dayNumber, recipeOfTheDay, formatMinutes, initRecipeOfTheDay } = require('../recipefinder-site.js');

const list = [{ name: 'A', minutes: 20, category: 'Main', ingredients: 5 },
              { name: 'B', minutes: 90, category: 'Dessert', ingredients: 8, cuisine: 'Korean' },
              { name: 'C', minutes: 60, category: 'Side', ingredients: 3 }];

test('dayNumber counts local calendar days', () => {
    expect(dayNumber(new Date(1970, 0, 1, 23, 59))).toBe(0);
    expect(dayNumber(new Date(1970, 0, 2, 0, 1))).toBe(1);
});

test('same pick all day, next pick the next day, wraps round', () => {
    const morning = new Date(2026, 10, 10, 7), night = new Date(2026, 10, 10, 23);
    expect(recipeOfTheDay(list, morning)).toBe(recipeOfTheDay(list, night));
    const picks = [0, 1, 2, 3].map(d => recipeOfTheDay(list, new Date(2026, 10, 10 + d)).name);
    expect(new Set(picks.slice(0, 3)).size).toBe(3);
    expect(picks[3]).toBe(picks[0]);
});

test('empty or bad lists give null', () => {
    expect(recipeOfTheDay([], new Date())).toBeNull();
    expect(recipeOfTheDay(null, new Date())).toBeNull();
});

test.each([[20, '20 min'], [60, '1 hr'], [90, '1 hr 30 min'], [0, '']])('formatMinutes(%p)', (m, out) => {
    expect(formatMinutes(m)).toBe(out);
});

describe('initRecipeOfTheDay', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div data-rotd data-src="x.json">
            <span data-rotd-name>Fallback</span><span data-rotd-time></span>
            <span data-rotd-kind></span><span data-rotd-count></span></div>`;
    });
    const text = s => document.querySelector(s).textContent;

    test('fills in the day\'s recipe, cuisine before category', async () => {
        const date = new Date(2026, 10, 10);
        const pick = recipeOfTheDay(list, date);
        await initRecipeOfTheDay(document, () => Promise.resolve({ ok: true, json: () => list }), date);
        expect(text('[data-rotd-name]')).toBe(pick.name);
        expect(text('[data-rotd-kind]')).toBe(pick.cuisine || pick.category);
        expect(text('[data-rotd-count]')).toBe(`${pick.ingredients} ingredients`);
    });

    test('keeps the fallback when loading fails', async () => {
        await initRecipeOfTheDay(document, () => Promise.reject(new Error('offline')), new Date());
        expect(text('[data-rotd-name]')).toBe('Fallback');
    });
});

describe('whenNearView', () => {
    const { whenNearView } = require('../recipefinder-site.js');
    test('waits for the element to come near, then runs once', () => {
        let observer;
        const win = { IntersectionObserver: class {
            constructor(cb) { this.cb = cb; observer = this; }
            observe() {} disconnect() { this.done = true; }
        } };
        const fn = jest.fn();
        whenNearView(document.createElement('div'), fn, win);
        expect(fn).not.toHaveBeenCalled();
        observer.cb([{ isIntersecting: true }]);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(observer.done).toBe(true);
    });
    test('runs straight away without IntersectionObserver', () => {
        const fn = jest.fn();
        whenNearView(document.createElement('div'), fn, {});
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
