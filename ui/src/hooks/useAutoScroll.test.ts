import { renderHook } from '@testing-library/react';
import useAutoScroll from './useAutoScroll';

describe('useAutoScroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ref creation and return', () => {
    it('should return a ref object', () => {
      const { result } = renderHook(() => useAutoScroll([]));

      expect(result.current).toHaveProperty('current');
      expect(result.current.current).toBeNull();
    });

    it('should return the same ref object on re-renders with same deps', () => {
      const deps = ['test'];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      const firstRef = result.current;
      rerender();

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
      let deps = ['initial'];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      // Assign mock element to ref
      result.current.current = mockElement;

      // Change deps to trigger useEffect
      deps = ['changed'];
      rerender();

      expect(mockElement.scrollTop).toBe(200);
    });

    it('should not scroll when element does not exist', () => {
      let deps = ['initial'];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      // Keep ref.current as null
      expect(result.current.current).toBeNull();

      // Change deps to trigger useEffect
      deps = ['changed'];
      rerender();

      // Should not throw error and element should remain null
      expect(result.current.current).toBeNull();
    });

    it('should handle multiple dependency changes', () => {
      let deps = [1];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      // Assign mock element to ref
      result.current.current = mockElement;

      // First change
      mockElement.scrollHeight = 300;
      deps = [2];
      rerender();
      expect(mockElement.scrollTop).toBe(300);

      // Second change
      mockElement.scrollHeight = 400;
      deps = [3];
      rerender();
      expect(mockElement.scrollTop).toBe(400);

      // Third change
      mockElement.scrollHeight = 500;
      deps = [4];
      rerender();
      expect(mockElement.scrollTop).toBe(500);
    });

    it('should not scroll when deps remain the same', () => {
      const deps = ['constant'];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      // Assign mock element to ref
      result.current.current = mockElement;
      mockElement.scrollTop = 100; // Set initial scroll position

      // Re-render without changing deps
      rerender();

      // scrollTop should remain unchanged since useEffect didn't run
      expect(mockElement.scrollTop).toBe(100);
    });

    it('should handle complex object dependencies', () => {
      let deps = [{ messages: ['hello'] }];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      // Assign mock element to ref
      result.current.current = mockElement;

      // Change deps with new object reference
      deps = [{ messages: ['hello', 'world'] }];
      rerender();

      expect(mockElement.scrollTop).toBe(200);
    });

    it('should handle empty dependencies array', () => {
      const { result } = renderHook(() => useAutoScroll([]));

      // With empty deps, useEffect runs once on mount when element is null
      // Assign mock element to ref after mount
      result.current.current = mockElement;

      // Since deps is empty [], useEffect won't run again
      // scrollTop should remain at initial value
      expect(mockElement.scrollTop).toBe(0);

      // But the hook should still work correctly - ref should be properly typed
      expect(result.current.current).toBe(mockElement);
    });

    it('should handle element being set after initial render', () => {
      let deps = ['test'];
      const { result, rerender } = renderHook(() => useAutoScroll(deps));

      // Initially no element
      expect(result.current.current).toBeNull();

      // Change deps but still no element
      deps = ['changed'];
      rerender();

      // Now set the element
      result.current.current = mockElement;

      // Change deps again to trigger scroll
      deps = ['final'];
      rerender();

      expect(mockElement.scrollTop).toBe(200);
    });
  });

  describe('TypeScript generics', () => {
    it('should work with different HTML element types', () => {
      const { result: divResult } = renderHook(() =>
        useAutoScroll<HTMLDivElement>([]),
      );
      const { result: spanResult } = renderHook(() =>
        useAutoScroll<HTMLSpanElement>([]),
      );
      const { result: pResult } = renderHook(() =>
        useAutoScroll<HTMLParagraphElement>([]),
      );

      expect(divResult.current).toHaveProperty('current');
      expect(spanResult.current).toHaveProperty('current');
      expect(pResult.current).toHaveProperty('current');
    });
  });
});
