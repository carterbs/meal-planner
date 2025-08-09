import React from 'react';
import { Box } from '@mui/material';
import type { ShoppingListItem } from '@mealplanner/generated';
import { getAgentPageStyles } from '../../../../theme';

type AgentStyles = ReturnType<typeof getAgentPageStyles>;

interface ShoppingListViewProps {
  items: ShoppingListItem[];
  styles: AgentStyles;
}

const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  items,
  styles,
}) => {
  return (
    <Box sx={{ mt: 2, flex: 1, overflow: 'auto' }}>
      <Box component="div" sx={{ p: 0, m: 0 }}>
        {items.map((item, index) => (
          <Box component="div" key={index} sx={styles.shoppingListItem}>
            {Number(item.quantity) > 0 ? `${item.quantity} ` : ''}
            {item.ingredient}
            {item.category && ` (${item.category})`}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ShoppingListView;
