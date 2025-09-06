import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareMenu from './ShareMenu';
import { colorSchemes } from '../../../../agentTheme';

describe('ShareMenu', () => {
  const colors = colorSchemes['earthyNeutrals'];

  it('opens menu and invokes copy actions', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const onCopyPlan = jest.fn();
    const onCopyList = jest.fn();

    render(
      <ShareMenu
        anchorEl={null}
        onOpen={onOpen}
        onClose={onClose}
        onCopyMealPlan={onCopyPlan}
        onCopyShoppingList={onCopyList}
        canCopyMealPlan={true}
        canCopyShoppingList={true}
        colors={colors}
      />,
    );

    const openBtn = screen.getByTestId('share-menu-button');
    await user.click(openBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
