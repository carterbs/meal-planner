import React from 'react';
import { Box } from '@mui/material';
import AddRecipeForm from '../../../AddRecipeForm';

interface AddRecipePanelProps {
  onSuccess: () => void;
}

const AddRecipePanel: React.FC<AddRecipePanelProps> = ({ onSuccess }) => {
  return (
    <Box sx={{ py: 3, px: 3 }}>
      <AddRecipeForm onRecipeAdded={onSuccess} />
    </Box>
  );
};

export default AddRecipePanel;
