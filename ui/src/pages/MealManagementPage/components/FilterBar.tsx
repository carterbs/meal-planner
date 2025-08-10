import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';

export type MealTypeFilter = 'All' | 'Breakfast' | 'Lunch' | 'Dinner';

interface FilterBarProps {
  text: string;
  type: MealTypeFilter;
  onTextChange: (text: string) => void;
  onTypeChange: (type: MealTypeFilter) => void;
  debounceMs?: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
  text,
  type,
  onTextChange,
  onTypeChange,
  debounceMs = 300,
}) => {
  const [localText, setLocalText] = useState(text);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  useEffect(() => {
    const handle = setTimeout(() => onTextChange(localText), debounceMs);
    return () => clearTimeout(handle);
  }, [localText, onTextChange, debounceMs]);

  const types: MealTypeFilter[] = useMemo(
    () => ['All', 'Breakfast', 'Lunch', 'Dinner'],
    [],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        label="Search Meals"
        variant="outlined"
        size="small"
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        inputProps={{ 'data-testid': 'filterbar-search' }}
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {types.map((t) => (
          <Button
            key={t}
            variant={type === t ? 'contained' : 'outlined'}
            onClick={() => onTypeChange(t)}
            size="small"
          >
            {t}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

export default FilterBar;
