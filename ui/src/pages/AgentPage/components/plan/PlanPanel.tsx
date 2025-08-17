import React, { useMemo } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { RestaurantMenu as RestaurantMenuIcon } from '@mui/icons-material';
import type { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';
import MealPlanDisplay from './MealPlanDisplay';
import { Colors, getAgentPageStyles } from '../../../../theme';
import ShareMenu from './ShareMenu';
import ShoppingListView from './ShoppingListView';

export interface PlanPanelProps {
  mealPlan: WeeklyMealPlan | null;
  shoppingList: ShoppingListItem[] | null;
  currentTab: number;
  onTabChange: (tab: number) => void;
  highlights: Set<string>;
  onCopyMealPlan: () => void;
  onCopyShoppingList: () => void;
  colors: Colors;
}

const PlanPanel: React.FC<PlanPanelProps> = ({
  mealPlan,
  shoppingList,
  currentTab,
  onTabChange,
  highlights,
  onCopyMealPlan,
  onCopyShoppingList,
  colors,
}) => {
  const styles = useMemo(() => getAgentPageStyles(colors), [colors]);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const hasShopping = !!shoppingList && shoppingList.length > 0;

  return (
    <Box sx={styles.mealPlanContainer}>
      <Paper elevation={0} sx={{ ...styles.mealPlanPaper, boxShadow: 'none' }}>
        {mealPlan || hasShopping ? (
          <>
            <Box sx={styles.sectionHeader}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={() => onTabChange(0)}
                  variant={currentTab === 0 ? 'contained' : 'outlined'}
                  size="small"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    px: 2,
                    py: 0.5,
                    backgroundColor:
                      currentTab === 0 ? colors.apricot : 'transparent',
                    borderColor: colors.apricot,
                    color: currentTab === 0 ? '#ffffff' : colors.apricot,
                    '&:hover': {
                      backgroundColor:
                        currentTab === 0
                          ? '#ff9f2b'
                          : `${colors.apricot}10`,
                    },
                  }}
                >
                  Meal Plan
                </Button>
                <Button
                  onClick={() => onTabChange(1)}
                  variant={currentTab === 1 ? 'contained' : 'outlined'}
                  size="small"
                  disabled={!hasShopping}
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    px: 2,
                    py: 0.5,
                    backgroundColor:
                      currentTab === 1 ? colors.apricot : 'transparent',
                    borderColor: colors.apricot,
                    color: currentTab === 1 ? '#ffffff' : colors.apricot,
                    '&:hover': {
                      backgroundColor:
                        currentTab === 1
                          ? '#ff9f2b'
                          : `${colors.apricot}10`,
                    },
                    '&:disabled': { 
                      borderColor: '#cccccc', 
                      color: '#cccccc',
                      backgroundColor: 'transparent'
                    },
                  }}
                >
                  Shopping List
                </Button>
              </Box>

              <ShareMenu
                anchorEl={anchorEl}
                onOpen={openMenu}
                onClose={closeMenu}
                onCopyMealPlan={mealPlan ? onCopyMealPlan : undefined}
                onCopyShoppingList={
                  hasShopping ? onCopyShoppingList : undefined
                }
                canCopyMealPlan={!!mealPlan}
                canCopyShoppingList={hasShopping}
                colors={colors}
              />
            </Box>

            {currentTab === 0 && mealPlan && (
              <MealPlanDisplay
                plan={mealPlan}
                highlights={highlights}
                colors={colors}
              />
            )}

            {currentTab === 1 && hasShopping && (
              <ShoppingListView items={shoppingList} styles={styles} />
            )}

            {currentTab === 0 && !mealPlan && (
              <Box sx={styles.emptyState}>
                <RestaurantMenuIcon sx={styles.restaurantIcon} />
                <Typography variant="h6" color="text.secondary">
                  No meal plan generated yet
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, maxWidth: '500px' }}>
                  Start a conversation with the assistant to generate a
                  personalized meal plan.
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Box sx={styles.emptyState}>
            <RestaurantMenuIcon sx={styles.restaurantIcon} />
            <Typography variant="h6" color="text.secondary">
              No meal plan generated yet
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, maxWidth: '500px' }}>
              Start a conversation with the assistant to generate a personalized
              meal plan.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default PlanPanel;
