import React from 'react';
import { Chip } from '@mui/material';

interface MealTypeChipProps {
  mealType: string;
}

const MealTypeChip: React.FC<MealTypeChipProps> = ({ mealType }) => (
  <Chip
    label={mealType.charAt(0).toUpperCase() + mealType.slice(1)}
    size="small"
    variant="outlined"
    color="primary"
    sx={{ borderRadius: 10, mr: 0.75 }}
  />
);

export default MealTypeChip;
