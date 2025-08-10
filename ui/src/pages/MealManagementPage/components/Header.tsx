import React from 'react';
import { Box, IconButton, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';

interface HeaderProps {
  onBack?: () => void;
  onClose?: () => void;
  onAdd?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onBack, onClose, onAdd }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 1 }}>
      {onBack && (
        <IconButton aria-label="back" onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
      )}
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        Meal Library
      </Typography>
      <Box sx={{ flex: 1 }} />
      {onAdd && (
        <Button variant="contained" onClick={onAdd} aria-label="add recipe">
          Add Recipe
        </Button>
      )}
      {onClose && (
        <IconButton aria-label="close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default Header;
