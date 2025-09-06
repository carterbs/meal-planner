import React, { useMemo } from 'react';
import { Box, Paper, Typography, Tabs, Tab } from '@mui/material';
import { RestaurantMenu as RestaurantMenuIcon } from '@mui/icons-material';
import type { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';
import MealPlanDisplay from './MealPlanDisplay';
import { Colors, getAgentPageStyles } from '../../../../agentTheme';
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
            <Box
              sx={{
                ...styles.sectionHeader,
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                justifyContent: 'initial',
              }}
            >
              <Box />
              <Tabs
                value={currentTab}
                onChange={(_, v) => onTabChange(v)}
                aria-label="Plan panel tabs"
                sx={{
                  minHeight: 40,
                  borderRadius: 999,
                  px: 1,
                  backgroundColor: 'background.paper',
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Tab label="Meal Plan" value={0} />
                <Tab label="Shopping List" value={1} disabled={!hasShopping} />
              </Tabs>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
