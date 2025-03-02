import React, { useState, useEffect } from 'react';
import {
    Box,
    TextField,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    FormControl,
    FormControlLabel,
    Switch,
    Divider,
    Paper,
    Grid,
    Tooltip
} from '@mui/material';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DeleteIcon from '@mui/icons-material/Delete';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { Step } from '../types';

interface StepsEditorProps {
    steps: Step[];
    onChange: (steps: Step[]) => void;
    readOnly?: boolean;
}

interface SortableItemProps {
    id: string;
    step: Step;
    index: number;
    editingIndex: number | null;
    setEditingIndex: (index: number | null) => void;
    onChange: (steps: Step[]) => void;
    steps: Step[];
    deleteStep: (index: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
    id,
    step,
    index,
    editingIndex,
    setEditingIndex,
    onChange,
    steps,
    deleteStep
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <ListItem
            ref={setNodeRef}
            style={style}
            divider={index < steps.length - 1}
        >
            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }} {...attributes} {...listeners}>
                <DragHandleIcon color="action" />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
                {editingIndex === index ? (
                    <TextField
                        fullWidth
                        multiline
                        variant="outlined"
                        size="small"
                        value={step.instruction}
                        onChange={(e) => {
                            const updatedSteps = [...steps];
                            updatedSteps[index].instruction = e.target.value;
                            onChange(updatedSteps);
                        }}
                        autoFocus
                        onBlur={() => setEditingIndex(null)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                setEditingIndex(null);
                            }
                        }}
                    />
                ) : (
                    <ListItemText
                        primary={`${index + 1}. ${step.instruction}`}
                        primaryTypographyProps={{
                            style: { whiteSpace: 'normal', wordBreak: 'break-word' }
                        }}
                    />
                )}
            </Box>
            <ListItemSecondaryAction>
                <Tooltip title="Edit step">
                    <IconButton edge="end" onClick={() => setEditingIndex(index)}>
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete step">
                    <IconButton edge="end" onClick={() => deleteStep(index)}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </ListItemSecondaryAction>
        </ListItem>
    );
};

const StepsEditor: React.FC<StepsEditorProps> = ({ steps, onChange, readOnly = false }) => {
    // Default to individual mode instead of bulk
    const [stepInputMode, setStepInputMode] = useState<'bulk' | 'individual'>('individual');
    const [bulkStepsText, setBulkStepsText] = useState('');
    const [bulkStepsPreview, setBulkStepsPreview] = useState<string[]>([]);
    const [newStepText, setNewStepText] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Reset bulk text when steps change from outside
    useEffect(() => {
        if (steps.length > 0 && bulkStepsText === '') {
            const stepsText = steps.map(step => step.instruction).join('\n\n');
            setBulkStepsText(stepsText);
        }
    }, [steps]);

    const parseStepsFromText = (text: string): string[] => {
        text = text.trim();
        if (!text) return [];

        // Try different parsing strategies in order of preference

        // 1. Check for numbered steps (e.g., "1. Do this", "2. Do that")
        const numberedPattern = /^\s*\d+\.?\s+(.+)$|(?:\n\s*\d+\.?\s+)(.+)/gm;
        const numberedMatches = Array.from(text.matchAll(numberedPattern));
        if (numberedMatches.length > 0) {
            return numberedMatches
                .map(match => match[1] || match[2])
                .filter(step => step && step.trim().length > 0)
                .map(step => step.trim());
        }

        // 2. Check for bullet points (-, *, •)
        const bulletPattern = /^\s*[-*•]\s+(.+)$|(?:\n\s*[-*•]\s+)(.+)/gm;
        const bulletMatches = Array.from(text.matchAll(bulletPattern));
        if (bulletMatches.length > 0) {
            return bulletMatches
                .map(match => match[1] || match[2])
                .filter(step => step && step.trim().length > 0)
                .map(step => step.trim());
        }

        // 3. Split by double newlines (paragraphs)
        if (text.includes('\n\n')) {
            return text.split('\n\n')
                .filter(paragraph => paragraph.trim().length > 0)
                .map(paragraph => paragraph.trim());
        }

        // 4. Split by single newlines
        if (text.includes('\n')) {
            return text.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => line.trim());
        }

        // 5. If no structured format detected and it's a single block of text
        // Try to split by sentences if it's long enough
        if (text.length > 100) {
            const sentencePattern = /[.!?]+\s+/;
            return text.split(sentencePattern)
                .filter(sentence => sentence.trim().length > 10) // Ignore very short fragments
                .map(sentence => {
                    let trimmed = sentence.trim();
                    // Add back the period if it doesn't end with punctuation
                    if (!trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?')) {
                        trimmed += '.';
                    }
                    return trimmed;
                });
        }

        // If all else fails, treat the whole text as one step
        return [text];
    };

    const handleBulkStepsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setBulkStepsText(text);

        // Update preview as user types/pastes
        if (text.trim()) {
            const parsedSteps = parseStepsFromText(text);
            setBulkStepsPreview(parsedSteps);
        } else {
            setBulkStepsPreview([]);
        }
    };

    const confirmBulkSteps = () => {
        // Convert preview to actual steps
        const newSteps = bulkStepsPreview.map((instruction, index) => {
            // Preserve existing step IDs if possible
            const existingStep = steps.length > index ? steps[index] : null;
            return {
                id: existingStep?.id || 0, // Backend will assign a real ID for new steps
                mealId: existingStep?.mealId || 0, // Set by backend
                stepNumber: index + 1,
                instruction
            };
        });

        onChange(newSteps);

        // Switch to individual mode for fine-tuning if needed
        setStepInputMode('individual');
    };

    const addStep = () => {
        if (!newStepText.trim()) return;

        const updatedSteps = [...steps, {
            id: 0, // Will be assigned by backend
            mealId: 0, // Will be assigned by backend
            stepNumber: steps.length + 1,
            instruction: newStepText.trim()
        }];

        onChange(updatedSteps);
        setNewStepText('');
    };

    const updateStep = (index: number, instruction: string) => {
        const updatedSteps = [...steps];
        updatedSteps[index].instruction = instruction;
        onChange(updatedSteps);
    };

    const deleteStep = (index: number) => {
        const updatedSteps = [...steps];
        updatedSteps.splice(index, 1);
        // Update step numbers
        updatedSteps.forEach((step, i) => step.stepNumber = i + 1);
        onChange(updatedSteps);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = parseInt(active.id.toString().split('-')[1]);
            const newIndex = parseInt(over.id.toString().split('-')[1]);

            const reorderedSteps = arrayMove(
                [...steps],
                oldIndex,
                newIndex
            );

            // Update step numbers
            reorderedSteps.forEach((step, index) => {
                step.stepNumber = index + 1;
            });

            onChange(reorderedSteps);
        }
    };

    if (readOnly) {
        // Read-only view for viewing steps when cooking
        return (
            <Box sx={{ mt: 2 }}>
                <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Instructions</Typography>
                    <List>
                        {steps.map((step, index) => (
                            <React.Fragment key={step.id || index}>
                                <ListItem alignItems="flex-start">
                                    <ListItemText
                                        primary={`${index + 1}. ${step.instruction}`}
                                    />
                                </ListItem>
                                {index < steps.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                        ))}
                        {steps.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                No instructions available for this recipe.
                            </Typography>
                        )}
                    </List>
                </Paper>
            </Box>
        );
    }

    return (
        <Grid item xs={12}>
            {/* Recipe Steps heading is now in the main form, removed from here */}

            {stepInputMode === 'bulk' ? (
                // Bulk text area mode
                <Box>
                    <TextField
                        label="Paste Recipe Steps (one per line or paragraph)"
                        multiline
                        rows={5}
                        fullWidth
                        value={bulkStepsText}
                        onChange={handleBulkStepsChange}
                        placeholder="Paste all recipe steps here. Each line, numbered item, or paragraph will become a separate step."
                        helperText="Paste a list of steps, one per line or paragraph"
                    />

                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button
                            variant="outlined"
                            onClick={confirmBulkSteps}
                            disabled={bulkStepsPreview.length === 0}
                        >
                            Process Steps
                        </Button>

                        <Button
                            variant="outlined"
                            onClick={() => setStepInputMode('individual')}
                        >
                            Switch to Individual Mode
                        </Button>
                    </Box>

                    {bulkStepsPreview.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Preview: {bulkStepsPreview.length} steps detected
                            </Typography>
                        </Box>
                    )}
                </Box>
            ) : (
                // Individual step mode
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setStepInputMode('bulk')}
                        >
                            Paste Multiple Steps
                        </Button>
                    </Box>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={steps.map((step, index) => `${index}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            <List
                                sx={{
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    ...(steps.length > 0 ? { border: 1, borderColor: 'divider' } : {})
                                }}
                            >
                                {steps.map((step, index) => (
                                    <SortableItem
                                        key={`step-${index}`}
                                        id={`${index}`}
                                        step={step}
                                        index={index}
                                        editingIndex={editingIndex}
                                        setEditingIndex={setEditingIndex}
                                        onChange={onChange}
                                        steps={steps}
                                        deleteStep={deleteStep}
                                    />
                                ))}
                                {steps.length === 0 && (
                                    <ListItem>
                                        <ListItemText
                                            primary="No steps added yet. Add steps using the form below."
                                            primaryTypographyProps={{ color: 'text.secondary', align: 'center' }}
                                        />
                                    </ListItem>
                                )}
                            </List>
                        </SortableContext>
                    </DndContext>

                    <Grid container spacing={1} sx={{ mt: 2 }}>
                        <Grid item xs>
                            <TextField
                                fullWidth
                                label="Add a step"
                                placeholder="Enter a new step instruction"
                                value={newStepText}
                                onChange={(e) => setNewStepText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        addStep();
                                    }
                                }}
                                variant="outlined"
                                size="small"
                            />
                        </Grid>
                        <Grid item>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={addStep}
                                disabled={!newStepText.trim()}
                                startIcon={<AddIcon />}
                                sx={{ height: '100%' }}
                            >
                                Add
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            )}
        </Grid>
    );
};

export default StepsEditor; 