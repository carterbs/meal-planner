import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import StepsEditor from './StepsEditor';
import { Step } from '@mealplanner/generated';
import { arrayMove } from '@dnd-kit/sortable';

// Mock @dnd-kit modules
let mockOnDragEnd: ((e: { active: { id: string }; over: { id: string } | null }) => void) | null = null;

const computeArrayMove = <T,>(arr: T[], oldIndex: number, newIndex: number): T[] => {
  const newArray = [...arr];
  const [removed] = newArray.splice(oldIndex, 1);
  newArray.splice(newIndex, 0, removed);
  return newArray;
};

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children?: React.ReactNode; onDragEnd?: (e: unknown) => void }) => {
    mockOnDragEnd = onDragEnd ?? null;
    return <div data-testid="dnd-context">{children}</div>;
  },
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn(((arr: unknown[], oldIndex: number, newIndex: number) => {
    const newArray = [...arr];
    const [removed] = newArray.splice(oldIndex, 1);
    newArray.splice(newIndex, 0, removed);
    return newArray;
  }) as unknown as typeof arrayMove),
  SortableContext: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: () => ({
    attributes: { 'data-testid': 'sortable-item' },
    listeners: { onPointerDown: jest.fn() },
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
  }),
  verticalListSortingStrategy: jest.fn(),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: jest.fn(() => ''),
    },
  },
}));

describe('StepsEditor', () => {
  const mockOnChange = jest.fn();
  const user = userEvent.setup();

  const mockSteps = [
    new Step({
      id: 1,
      mealId: 1,
      stepNumber: 1,
      instruction: 'First step instruction',
    }),
    new Step({
      id: 2,
      mealId: 1,
      stepNumber: 2,
      instruction: 'Second step instruction',
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (arrayMove as unknown as jest.Mock).mockImplementation(computeArrayMove);
  });

  describe('Component Rendering', () => {
    it('should render in individual mode by default', () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      expect(screen.getByText('Paste Multiple Steps')).toBeInTheDocument();
      expect(screen.getByLabelText('Add a step')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('should render existing steps', () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      expect(screen.getByText('1. First step instruction')).toBeInTheDocument();
      expect(
        screen.getByText('2. Second step instruction'),
      ).toBeInTheDocument();
    });

    it('should render empty state when no steps', () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      expect(
        screen.getByText('No steps added yet. Add steps using the form below.'),
      ).toBeInTheDocument();
    });

    it('should render in read-only mode', () => {
      render(
        <StepsEditor steps={mockSteps} onChange={mockOnChange} readOnly />,
      );

      expect(screen.getByText('Instructions')).toBeInTheDocument();
      expect(screen.getByText('1. First step instruction')).toBeInTheDocument();
      expect(
        screen.getByText('2. Second step instruction'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });

    it('should render read-only empty state', () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} readOnly />);

      expect(
        screen.getByText('No instructions available for this recipe.'),
      ).toBeInTheDocument();
    });
  });

  describe('Individual Mode - Adding Steps', () => {
    it('should add a new step when Add button is clicked', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');
      const addButton = screen.getByText('Add');

      await user.type(input, 'New step instruction');
      await user.click(addButton);

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 0,
          mealId: 0,
          stepNumber: 1,
          instruction: 'New step instruction',
        }),
      ]);
    });

    it('should add a step when Enter key is pressed', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');

      await user.type(input, 'New step via Enter');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          instruction: 'New step via Enter',
        }),
      ]);
    });

    it('should not add step with Shift+Enter', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');

      await user.type(input, 'New step');
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should not add empty step', () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const addButton = screen.getByText('Add');

      expect(addButton).toBeDisabled();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should not add step with only whitespace', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');
      const addButton = screen.getByText('Add');

      await user.type(input, '   ');
      expect(addButton).toBeDisabled();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should clear input after adding step', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');
      const addButton = screen.getByText('Add');

      await user.type(input, 'New step');
      await user.click(addButton);

      expect((input as HTMLInputElement).value).toBe('');
    });

    it('should disable Add button when input is empty', () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const addButton = screen.getByText('Add');

      expect(addButton).toBeDisabled();
    });

    it('should enable Add button when input has text', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');
      const addButton = screen.getByText('Add');

      await user.type(input, 'Some text');

      expect(addButton).not.toBeDisabled();
    });
  });

  describe('Individual Mode - Editing Steps', () => {
    it('should enter edit mode when edit button is clicked', async () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const editButton = screen.getAllByLabelText('Edit step')[0];

      await user.click(editButton);

      const input = screen.getByDisplayValue('First step instruction');
      expect(input).toBeInTheDocument();
    });

    it('should update step instruction when editing', async () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const editButton = screen.getAllByLabelText('Edit step')[0];
      await user.click(editButton);

      const input = screen.getByDisplayValue('First step instruction');
      fireEvent.change(input, { target: { value: 'Updated instruction' } });

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          instruction: 'Updated instruction',
        }),
        mockSteps[1],
      ]);
    });

    it('should exit edit mode on blur', async () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const editButton = screen.getAllByLabelText('Edit step')[0];
      await user.click(editButton);

      const input = screen.getByDisplayValue('First step instruction');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.queryByDisplayValue('First step instruction'),
        ).not.toBeInTheDocument();
      });
    });

    it('should exit edit mode on Enter key', async () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const editButton = screen.getAllByLabelText('Edit step')[0];
      await user.click(editButton);

      const input = screen.getByDisplayValue('First step instruction');
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(
          screen.queryByDisplayValue('First step instruction'),
        ).not.toBeInTheDocument();
      });
    });

    it('should not exit edit mode on Shift+Enter', async () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const editButton = screen.getAllByLabelText('Edit step')[0];
      await user.click(editButton);

      // Wait for edit mode
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('First step instruction'),
        ).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('First step instruction');
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(
        screen.getByDisplayValue('First step instruction'),
      ).toBeInTheDocument();
    });
  });

  describe('Individual Mode - Deleting Steps', () => {
    it('should delete a step when delete button is clicked', async () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const deleteButton = screen.getAllByLabelText('Delete step')[0];

      await user.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 2,
          stepNumber: 1,
          instruction: 'Second step instruction',
        }),
      ]);
    });

    it('should update step numbers after deletion', async () => {
      const threeSteps = [
        ...mockSteps,
        new Step({
          id: 3,
          mealId: 1,
          stepNumber: 3,
          instruction: 'Third step',
        }),
      ];

      render(<StepsEditor steps={threeSteps} onChange={mockOnChange} />);

      const deleteButton = screen.getAllByLabelText('Delete step')[1];

      await user.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ stepNumber: 1 }),
        expect.objectContaining({ stepNumber: 2 }),
      ]);
    });
  });

  describe('Bulk Mode', () => {
    it('should switch to bulk mode when button is clicked', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');

      await user.click(bulkModeButton);

      expect(
        screen.getByLabelText('Paste Recipe Steps (one per line or paragraph)'),
      ).toBeInTheDocument();
      expect(screen.getByText('Switch to Individual Mode')).toBeInTheDocument();
    });

    it('should switch back to individual mode', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      const individualModeButton = screen.getByText(
        'Switch to Individual Mode',
      );
      await user.click(individualModeButton);

      expect(screen.getByText('Paste Multiple Steps')).toBeInTheDocument();
    });

    it('should show preview when typing in bulk mode', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );

      fireEvent.change(textarea, {
        target: { value: '1. First step\n2. Second step' },
      });

      expect(screen.getByText('Preview: 2 steps detected')).toBeInTheDocument();
    });

    it('should process bulk steps when confirmed', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );
      fireEvent.change(textarea, {
        target: { value: '1. First step\n2. Second step' },
      });

      const processButton = screen.getByText('Process Steps');
      await user.click(processButton);

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ instruction: 'First step', stepNumber: 1 }),
        expect.objectContaining({ instruction: 'Second step', stepNumber: 2 }),
      ]);
    });

    it('should switch to individual mode after processing', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );
      fireEvent.change(textarea, { target: { value: '1. First step' } });

      const processButton = screen.getByText('Process Steps');
      await user.click(processButton);

      expect(screen.getByText('Paste Multiple Steps')).toBeInTheDocument();
    });

    it('should disable process button when no preview', () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      fireEvent.click(bulkModeButton);

      const processButton = screen.getByText('Process Steps');
      expect(processButton).toBeDisabled();
    });
  });

  describe('Text Parsing', () => {
    const testParsingFunction = async (
      input: string,
      expectedInstructions: string[],
    ) => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );

      if (input) {
        fireEvent.change(textarea, { target: { value: input } });

        if (expectedInstructions.length > 0) {
          const processButton = screen.getByText('Process Steps');
          await user.click(processButton);

          const expectedSteps = expectedInstructions.map((instruction, index) =>
            expect.objectContaining({ instruction, stepNumber: index + 1 }),
          );

          expect(mockOnChange).toHaveBeenCalledWith(expectedSteps);
        } else {
          expect(screen.queryByText(/Preview:/)).not.toBeInTheDocument();
        }
      } else {
        expect(screen.queryByText(/Preview:/)).not.toBeInTheDocument();
      }
    };

    it('should parse numbered list', async () => {
      await testParsingFunction(
        '1. First step\n2. Second step\n3. Third step',
        ['First step', 'Second step', 'Third step'],
      );
    });

    it('should parse bullet points with dashes', async () => {
      await testParsingFunction('- First step\n- Second step\n- Third step', [
        'First step',
        'Second step',
        'Third step',
      ]);
    });

    it('should parse bullet points with asterisks', async () => {
      await testParsingFunction('* First step\n* Second step\n* Third step', [
        'First step',
        'Second step',
        'Third step',
      ]);
    });

    it('should parse bullet points with bullets', async () => {
      await testParsingFunction('• First step\n• Second step\n• Third step', [
        'First step',
        'Second step',
        'Third step',
      ]);
    });

    it('should parse double newline separation', async () => {
      await testParsingFunction(
        'First paragraph step\n\nSecond paragraph step\n\nThird paragraph step',
        [
          'First paragraph step',
          'Second paragraph step',
          'Third paragraph step',
        ],
      );
    });

    it('should parse single newline separation', async () => {
      await testParsingFunction(
        'First line step\nSecond line step\nThird line step',
        ['First line step', 'Second line step', 'Third line step'],
      );
    });

    it('should parse long text split by sentences', async () => {
      await testParsingFunction(
        'This is a really long first sentence that should definitely be split from others. This is the second sentence that is also quite long. And here is the third one that should also be separate!',
        [
          'This is a really long first sentence that should definitely be split from others.',
          'This is the second sentence that is also quite long.',
          'And here is the third one that should also be separate!',
        ],
      );
    });

    it('should parse single step fallback', async () => {
      await testParsingFunction('Single step', ['Single step']);
    });

    it('should parse empty text', async () => {
      await testParsingFunction('', []);
    });

    it('should parse whitespace only', async () => {
      await testParsingFunction('   \n  \n   ', []);
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag end event', () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      // Simulate drag end event
      const dragEndEvent = {
        active: { id: '0' },
        over: { id: '1' },
      };

      // Mock arrayMove to return expected result
      const expectedResult = [mockSteps[1], mockSteps[0]];
      (arrayMove as jest.Mock).mockReturnValue(expectedResult);

      mockOnDragEnd!(dragEndEvent);

      expect(arrayMove).toHaveBeenCalledWith(mockSteps, 0, 1);
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should not change order if dropped on same position', () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const dragEndEvent = {
        active: { id: '0' },
        over: { id: '0' },
      };

      mockOnDragEnd!(dragEndEvent);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should not change order if no over target', () => {
      render(<StepsEditor steps={mockSteps} onChange={mockOnChange} />);

      const dragEndEvent = {
        active: { id: '0' },
        over: null,
      };

      mockOnDragEnd!(dragEndEvent);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('useEffect Hook', () => {
    it('should populate bulk text when switching to bulk mode', () => {
      // Create fresh mock steps to avoid interference from other tests
      const freshSteps = [
        new Step({
          id: 1,
          mealId: 1,
          stepNumber: 1,
          instruction: 'First step instruction',
        }),
        new Step({
          id: 2,
          mealId: 1,
          stepNumber: 2,
          instruction: 'Second step instruction',
        }),
      ];

      render(<StepsEditor steps={freshSteps} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      fireEvent.click(bulkModeButton);

      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );

      // The useEffect should populate the textarea with existing steps
      expect((textarea as HTMLTextAreaElement).value).toBe(
        'First step instruction\n\nSecond step instruction',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle steps with no instruction', () => {
      const stepsWithEmptyInstruction = [
        new Step({
          id: 1,
          mealId: 1,
          stepNumber: 1,
          instruction: '',
        }),
      ];

      render(
        <StepsEditor
          steps={stepsWithEmptyInstruction}
          onChange={mockOnChange}
        />,
      );

      expect(screen.getByText('1.')).toBeInTheDocument();
    });

    it('should handle steps with undefined properties', () => {
      const stepWithDefaults = new Step({});

      expect(() => {
        render(
          <StepsEditor steps={[stepWithDefaults]} onChange={mockOnChange} />,
        );
      }).not.toThrow();
    });

    it('should handle onKeyDown with different keys', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Add a step');

      await user.type(input, 'Test step');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should handle sentence-based parsing for long text', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );

      // Use text that will trigger sentence-based splitting (longer text)
      fireEvent.change(textarea, {
        target: {
          value:
            'This is a really long sentence that should be split from the next sentence automatically. This is another sentence with punctuation already included.',
        },
      });

      const processButton = screen.getByText('Process Steps');
      await user.click(processButton);

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          instruction:
            'This is a really long sentence that should be split from the next sentence automatically.',
        }),
        expect.objectContaining({
          instruction:
            'This is another sentence with punctuation already included.',
        }),
      ]);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full workflow: add -> edit -> delete', async () => {
      const { rerender } = render(
        <StepsEditor steps={[]} onChange={mockOnChange} />,
      );

      // Add a step
      const input = screen.getByLabelText('Add a step');
      await user.type(input, 'Original step');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ instruction: 'Original step' }),
      ]);

      // Re-render with the new step for editing
      const newStep = new Step({
        id: 1,
        mealId: 1,
        stepNumber: 1,
        instruction: 'Original step',
      });

      mockOnChange.mockClear();
      rerender(<StepsEditor steps={[newStep]} onChange={mockOnChange} />);

      // Edit the step
      const editButton = screen.getByLabelText('Edit step');
      await user.click(editButton);

      const editInput = screen.getByDisplayValue('Original step');
      fireEvent.change(editInput, { target: { value: 'Edited step' } });

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ instruction: 'Edited step' }),
      ]);
    });

    it('should handle bulk mode to individual mode workflow', async () => {
      render(<StepsEditor steps={[]} onChange={mockOnChange} />);

      // Switch to bulk mode
      const bulkModeButton = screen.getByText('Paste Multiple Steps');
      await user.click(bulkModeButton);

      // Add bulk steps
      const textarea = screen.getByLabelText(
        'Paste Recipe Steps (one per line or paragraph)',
      );
      fireEvent.change(textarea, {
        target: { value: '1. Step one\n2. Step two' },
      });

      // Process steps
      const processButton = screen.getByText('Process Steps');
      await user.click(processButton);

      // Should be back in individual mode
      expect(screen.getByText('Paste Multiple Steps')).toBeInTheDocument();
      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ instruction: 'Step one' }),
        expect.objectContaining({ instruction: 'Step two' }),
      ]);
    });
  });
});
