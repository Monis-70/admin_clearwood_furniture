import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tooltip, TooltipContent, TooltipTrigger } from './overlay';

function Hint() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-describedby="hint-text">
          Publish
        </button>
      </TooltipTrigger>
      <TooltipContent>Needs a primary image</TooltipContent>
      <span id="hint-text" hidden>
        Needs a primary image
      </span>
    </Tooltip>
  );
}

const bubble = () => document.querySelector('[data-slot="tooltip-content"]');

describe('Tooltip', () => {
  it('opens on keyboard focus at once and closes with Escape (WCAG 1.4.13)', async () => {
    render(<Hint />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveFocus();
    expect(bubble()).toHaveTextContent('Needs a primary image');
    expect(bubble()).toHaveAttribute('aria-hidden');
    await user.keyboard('{Escape}');
    expect(bubble()).toBeNull();
  });

  it('opens on hover after a short delay and stays while the pointer is on it', async () => {
    render(<Hint />);
    const trigger = screen.getByRole('button', { name: 'Publish' });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    expect(bubble()).toBeNull();
    await waitFor(() => expect(bubble()).not.toBeNull());
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerEnter(bubble()!);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(bubble()).not.toBeNull();
    fireEvent.pointerLeave(bubble()!);
    await waitFor(() => expect(bubble()).toBeNull());
  });

  it('does not open for a touch, where hover does not exist', async () => {
    render(<Hint />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Publish' }), {
      pointerType: 'touch',
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(bubble()).toBeNull();
  });
});
