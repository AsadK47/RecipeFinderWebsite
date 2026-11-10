const { nextTabIndex, initFeatureTour } = require('../recipefinder-site.js');

describe('nextTabIndex', () => {
    test('arrows move and wrap', () => {
        expect(nextTabIndex(0, 'ArrowRight', 4)).toBe(1);
        expect(nextTabIndex(3, 'ArrowRight', 4)).toBe(0);
        expect(nextTabIndex(0, 'ArrowLeft', 4)).toBe(3);
        expect(nextTabIndex(2, 'ArrowUp', 4)).toBe(1);
        expect(nextTabIndex(2, 'ArrowDown', 4)).toBe(3);
    });
    test('Home and End jump to the ends', () => {
        expect(nextTabIndex(2, 'Home', 4)).toBe(0);
        expect(nextTabIndex(1, 'End', 4)).toBe(3);
    });
    test('other keys and empty lists are ignored', () => {
        expect(nextTabIndex(1, 'a', 4)).toBeNull();
        expect(nextTabIndex(0, 'ArrowRight', 0)).toBeNull();
    });
});

describe('initFeatureTour', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div data-tour>
                <div role="tablist" hidden>
                    <button role="tab" id="t1" aria-controls="p1">A</button>
                    <button role="tab" id="t2" aria-controls="p2">B</button>
                    <button role="tab" id="t3" aria-controls="p3">C</button>
                </div>
                <div id="p1" role="tabpanel">1</div>
                <div id="p2" role="tabpanel">2</div>
                <div id="p3" role="tabpanel">3</div>
            </div>`;
        initFeatureTour();
    });
    const tab = id => document.getElementById(id);

    test('shows the tablist and only the first panel', () => {
        expect(document.querySelector('[role="tablist"]').hidden).toBe(false);
        expect(tab('t1').getAttribute('aria-selected')).toBe('true');
        expect(tab('p1').hidden).toBe(false);
        expect(tab('p2').hidden).toBe(true);
        expect(tab('p3').hidden).toBe(true);
        expect(tab('t1').tabIndex).toBe(0);
        expect(tab('t2').tabIndex).toBe(-1);
    });

    test('click selects a tab', () => {
        tab('t2').click();
        expect(tab('t2').getAttribute('aria-selected')).toBe('true');
        expect(tab('t1').getAttribute('aria-selected')).toBe('false');
        expect(tab('p2').hidden).toBe(false);
        expect(tab('p1').hidden).toBe(true);
    });

    test('arrow keys move selection and focus', () => {
        tab('t1').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(tab('t3').getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement).toBe(tab('t3'));
        expect(tab('p3').hidden).toBe(false);
    });

    test('without tour markup it does nothing', () => {
        document.body.innerHTML = '<p>no tour</p>';
        expect(() => initFeatureTour()).not.toThrow();
    });
});
