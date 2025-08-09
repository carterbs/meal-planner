import React from 'react';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { IosShare as ShareIcon } from '@mui/icons-material';
import { Colors } from '../../../../theme';

interface ShareMenuProps {
  anchorEl: HTMLElement | null;
  onOpen: (e: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  onCopyMealPlan?: () => void;
  onCopyShoppingList?: () => void;
  canCopyMealPlan: boolean;
  canCopyShoppingList: boolean;
  colors: Colors;
}

const ShareMenu: React.FC<ShareMenuProps> = ({
  anchorEl,
  onOpen,
  onClose,
  onCopyMealPlan,
  onCopyShoppingList,
  canCopyMealPlan,
  canCopyShoppingList,
  colors,
}) => {
  return (
    <>
      <IconButton
        onClick={onOpen}
        size="small"
        data-testid="share-menu-button"
        sx={{
          color: colors.accent2,
          '&:hover': { color: colors.accent, backgroundColor: 'unset' },
        }}
      >
        <ShareIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        sx={{ '& .MuiPaper-root': { backgroundColor: colors.cardBg } }}
      >
        {canCopyMealPlan ? (
          <MenuItem
            onClick={() => {
              if (onCopyMealPlan) onCopyMealPlan();
              onClose();
            }}
            data-testid="copy-meal-plan"
          >
            Copy Meal Plan
          </MenuItem>
        ) : null}
        {canCopyShoppingList ? (
          <MenuItem
            onClick={() => {
              if (onCopyShoppingList) onCopyShoppingList();
              onClose();
            }}
            data-testid="copy-shopping-list"
          >
            Copy Shopping List
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
};

export default ShareMenu;


