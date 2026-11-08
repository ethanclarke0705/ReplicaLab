// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('an offline UI edit stays local and converges after reconnecting and advancing time', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    screen.getByRole('button', { name: 'Disconnect replica C' }),
  );
  await user.type(
    screen.getByLabelText('Value for replica C'),
    'Offline draft',
  );
  await user.click(screen.getByRole('button', { name: /Save on C/ }));
  const a = screen.getByRole('region', { name: 'Replica A' });
  const c = screen.getByRole('region', { name: 'Replica C' });
  expect(within(a).queryByText('Offline draft')).toBeNull();
  expect(
    within(c).getByText('Offline draft', { selector: 'span' }).textContent,
  ).toBe('Offline draft');
  expect(screen.getByText('Replicas diverged')).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Reconnect replica C' }));
  for (let i = 0; i < 5; i++)
    await user.click(screen.getByRole('button', { name: '+100 ms' }));
  expect(within(a).getByText('Offline draft').textContent).toBe(
    'Offline draft',
  );
  expect(screen.getByText('Replicas converged')).toBeDefined();
});

test('invalid JSON is visible as an error and does not replace the original value', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText('Value format for replica A'),
    'json',
  );
  await user.click(screen.getByLabelText('Value for replica A'));
  await user.paste('{bad');
  await user.click(screen.getByRole('button', { name: /Save on A/ }));
  expect(screen.getByRole('alert').textContent).toContain('valid JSON');
  expect(
    within(screen.getByRole('region', { name: 'Replica A' })).getByText(
      'A shared starting point',
    ),
  ).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('deletes leave inspectable tombstones and reset creates a fresh session', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    screen.getByRole('button', { name: 'Delete title on replica A' }),
  );
  expect(
    within(screen.getByRole('region', { name: 'Replica A' })).getByText(
      '1 retained tombstone',
    ),
  ).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Reset lab' }));
  expect(screen.queryByText('1 retained tombstone')).toBeNull();
  expect(screen.getAllByText('A shared starting point')).toHaveLength(3);
});

test('100% packet loss prevents delivery and manual recovery succeeds after loss ends', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.clear(screen.getByLabelText(/Packet loss/));
  await user.type(screen.getByLabelText(/Packet loss/), '100');
  await user.click(screen.getByRole('button', { name: 'Apply conditions' }));
  await user.type(screen.getByLabelText('Value for replica A'), 'Packet lost');
  await user.click(screen.getByRole('button', { name: /Save on A/ }));
  const b = screen.getByRole('region', { name: 'Replica B' });
  await user.click(screen.getByRole('button', { name: '+100 ms' }));
  expect(within(b).queryByText('Packet lost')).toBeNull();
  await user.clear(screen.getByLabelText(/Packet loss/));
  await user.type(screen.getByLabelText(/Packet loss/), '0');
  await user.click(screen.getByRole('button', { name: 'Apply conditions' }));
  await user.click(screen.getByRole('button', { name: /Sync now/ }));
  for (let i = 0; i < 5; i++)
    await user.click(screen.getByRole('button', { name: '+100 ms' }));
  expect(within(b).getByText('Packet lost')).toBeDefined();
});

test('playback advances real simulated time and stops when paused or unmounted', () => {
  vi.useFakeTimers();
  const rendered = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /Run/ }));
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(screen.getByText('500')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(screen.getByText('500')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Run/ }));
  rendered.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
