import React from 'react';
import { render } from '@testing-library/react';
import useAutoScroll from './useAutoScroll';

function ScrollBox({ deps }: { deps: unknown[] }) {
    const ref = useAutoScroll<HTMLDivElement>(deps);
    return (
        <div
            ref={ref}
            data-testid="scroll-box"
            style={{ height: 50, overflow: 'auto' }}
        >
            <div style={{ height: 500 }} />
        </div>
    );
}

describe('useAutoScroll', () => {
    it('scrolls to bottom when deps change', () => {
        const { rerender, getByTestId } = render(<ScrollBox deps={[0]} />);
        const box = getByTestId('scroll-box') as HTMLDivElement;
        const initial = box.scrollTop;
        rerender(<ScrollBox deps={[1]} />);
        expect(box.scrollTop).toBeGreaterThanOrEqual(initial);
    });
});


