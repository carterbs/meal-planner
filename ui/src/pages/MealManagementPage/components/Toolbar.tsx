import React from 'react';
import { Box, Typography } from '@mui/material';
import FilterBar, { MealTypeFilter } from './FilterBar';

interface ToolbarProps {
  total: number;
  text: string;
  type: MealTypeFilter;
  onTextChange: (text: string) => void;
  onTypeChange: (type: MealTypeFilter) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  total,
  text,
  type,
  onTextChange,
  onTypeChange,
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 2 }}>
      <Box sx={{ flex: 1 }}>
        <FilterBar
          text={text}
          type={type}
          onTextChange={onTextChange}
          onTypeChange={onTypeChange}
        />
      </Box>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {total} meals
      </Typography>
    </Box>
  );
};

export default Toolbar;
