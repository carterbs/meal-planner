import { renderHook } from '@testing-library/react';
import useAutoScroll from './useAutoScroll';

describe('useAutoScroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ref creation and return', () => {
    it('should return a ref object', () => {
      const { result } = renderHook(() => useAutoScroll());

      expect(result.current).toHaveProperty('current');
      expect(result.current.current).toBeNull();
    });

    it('should return the same ref object on re-renders with same deps', () => {
      const dep = 'test';
      const { result, rerender } = renderHook(({ d }) => useAutoScroll(d), {
        initialProps: { d: dep },
      });

      const firstRef = result.current;
      rerender({ d: dep });

      expect(result.current).toBe(firstRef);
    });
  });

  describe('auto-scroll functionality', () => {
    let mockElement: HTMLDivElement;

    beforeEach(() => {
      mockElement = {
        scrollTop: 0,
        scrollHeight: 200,
      } as HTMLDivElement;
    });

    it('should scroll to bottom when element exists and deps change', () => {
      let dep = 'initial';
      const { result, rerender } = renderHook(({ d }) => useAutoScroll(d), {
        initialProps: { d: dep },
      });

      // Assign mock element to ref
      (result.current as { current: HTMLDivElement | null }).current = mockElement;

      // Change deps to trigger useEffect
      dep = 'changed';
      rerender({ d: dep });

      expect(mockElement.scrollTop).toBe(200);
    });

    it('should not scroll when element does not exist', () => {
      let dep = 'initial';
      const { result, rerender } = renderHook(({ d }) => useAutoScroll(d), {
        initialProps: { d: dep },
      });

      // Keep ref.current as null
      expect(result.current.current).toBeNull();

      // Change deps to trigger useEffect
      dep = 'changed';
      rerender({ d: dep });

      // Should not throw error and element should remain null
      expect(result.current.current).toBeNull();
    });

    it('should handle multiple dependency changes', () => {
      let dep = 1;
      const { result, rerender } = renderHook(({ d }) => useAutoScroll(d), {
        initialProps: { d: dep },
      });

      // Assign mock element to ref
      (result.current as { current: HTMLDivElement | null }).current = mockElement;

      // First change
      Object.defineProperty(mockElement, 'scrollHeight', { value: 300, configurable: true });
      dep = 2;
      rerender({ d: dep });
      expect(mockElement.scrollTop).toBe(300);

      // Second change
      Object.defineProperty(mockElement, 'scrollHeight', { value: 400, configurable: true });
      dep = 3;
      rerender({ d: dep });
      expect(mockElement.scrollTop).toBe(400);

      // Third change
      Object.defineProperty(mockElement, 'scrollHeight', { value: 500, configurable: true });
      dep = 4;
      rerender({ d: dep });
      expect(mockElement.scrollTop).toBe(500);
    });

    it('should not scroll when deps remain the same', () => {
      const dep = 'constant';
      const { result, rerender } = renderHook(({ d }) => useAutoScroll(d), {
        initialProps: { d: dep },
      });

      // Assign mock element to ref
      (result.current as { current: HTMLDivElement | null }).current = mockElement;
      mockElement.scrollTop = 100; // Set initial scroll position

      // Re-render without changing deps
      rerender({ d: dep });

      // scrollTop should remain unchanged since useEffect didn't run
      expect(mockElement.scrollTop).toBe(100);
    });

    it('should handle empty dependency', () => {
      const { result } = renderHook(() => useAutoScroll());

      // With no dep, useEffect runs once on mount when element is null
      // Assign mock element to ref after mount
      (result.current as { current: HTMLDivElement | null }).current = mockElement;

      // Since dep is undefined, useEffect won't run again
      // scrollTop should remain at initial value
      expect(mockElement.scrollTop).toBe(0);

      // But the hook should still work correctly - ref should be properly typed
      expect(result.current.current).toBe(mockElement);
    });

    it('should handle element being set after initial render', () => {
      let dep = 'test';
      const { result, rerender } = renderHook(({ d }) => useAutoScroll(d), {
        initialProps: { d: dep },
      });

      // Initially no element
      expect(result.current.current).toBeNull();

      // Change dep but still no element
      dep = 'changed';
      rerender({ d: dep });

      // Now set the element
      (result.current as { current: HTMLDivElement | null }).current = mockElement;

      // Change dep again to trigger scroll
      dep = 'final';
      rerender({ d: dep });

      expect(mockElement.scrollTop).toBe(200);
    });
  });

  describe('TypeScript generics', () => {
    it('should work with different HTML element types', () => {
      const { result: divResult } = renderHook(() =>
        useAutoScroll<HTMLDivElement>(),
      );
      const { result: spanResult } = renderHook(() =>
        useAutoScroll<HTMLSpanElement>(),
      );
      const { result: pResult } = renderHook(() =>
        useAutoScroll<HTMLParagraphElement>(),
      );

      expect(divResult.current).toHaveProperty('current');
      expect(spanResult.current).toHaveProperty('current');
      expect(pResult.current).toHaveProperty('current');
    });
  });
});
