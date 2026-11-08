// @vitest-environment jsdom
import { StrictMode } from 'react';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, test, vi } from 'vitest';
import { PersistentPlayground } from '../src/PersistentPlayground.js';
import {
  openLabStore,
  StorageConflict,
  type LabStore,
} from '../src/storage.js';
import { LabSession } from '../src/session.js';

afterEach(cleanup);

test('a stale-tab conflict disables writes and cannot force a retry over newer saved data', async () => {
  const store: LabStore = {
    load: async () => ({
      revision: 1,
      checkpoint: new LabSession().checkpoint(),
    }),
    close: vi.fn(),
    save: vi.fn().mockRejectedValue(new StorageConflict()),
  };
  const user = userEvent.setup();
  render(<PersistentPlayground openStore={async () => store} />);
  await screen.findByText(/Saved to this browser/);
  await user.click(
    screen.getByRole('button', { name: 'Disconnect replica A' }),
  );
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Another tab',
  );
  expect(screen.queryByRole('button', { name: 'Retry saving' })).toBeNull();
  expect(
    (
      screen.getByRole('group', {
        name: 'Simulation controls and inspection',
      }) as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
});

test('reset replaces the durable lab and reload cannot resurrect discarded edits', async () => {
  const factory = new IDBFactory();
  const openStore = () => openLabStore(factory);
  const store = await openStore();
  const previous = new LabSession(71);
  previous.write('a', 'discarded', 'old', 'text');
  await store.save(previous.checkpoint(), 0);
  store.close();
  const user = userEvent.setup();
  const mounted = render(<PersistentPlayground openStore={openStore} />);
  await screen.findByText(/Saved replicas restored/);
  expect((screen.getByLabelText('Seed') as HTMLInputElement).value).toBe('71');
  await user.click(screen.getByRole('button', { name: 'Reset lab' }));
  await screen.findByText(/Saved to this browser/);
  mounted.unmount();
  render(<PersistentPlayground openStore={openStore} />);
  await screen.findByText(/Saved replicas restored/);
  expect(screen.queryByText('discarded')).toBeNull();
  expect(screen.getAllByText('A shared starting point')).toHaveLength(3);
});

test('StrictMode startup loads before editing and a remount restores offline writes and counters', async () => {
  const factory = new IDBFactory();
  const openStore = () => openLabStore(factory);
  const user = userEvent.setup();
  const first = render(
    <StrictMode>
      <PersistentPlayground openStore={openStore} />
    </StrictMode>,
  );
  expect(screen.getByText('Opening your lab…')).toBeDefined();
  expect(screen.queryByRole('button', { name: /Save on C/ })).toBeNull();
  await screen.findByText(/Saved to this browser/);
  await user.click(
    screen.getByRole('button', { name: 'Disconnect replica C' }),
  );
  await user.type(
    screen.getByLabelText('Value for replica C'),
    'Durable offline draft',
  );
  await user.click(screen.getByRole('button', { name: /Save on C/ }));
  await screen.findByText(/Saved to this browser/);
  first.unmount();
  render(<PersistentPlayground openStore={openStore} />);
  await screen.findByText(/Saved replicas restored/);
  expect(
    screen.getByRole('button', { name: 'Reconnect replica C' }),
  ).toBeDefined();
  const c = screen.getByRole('region', { name: 'Replica C' });
  expect(within(c).getByText('Durable offline draft')).toBeDefined();
  await user.type(screen.getByLabelText('Value for replica C'), 'Next draft');
  await user.click(screen.getByRole('button', { name: /Save on C/ }));
  await screen.findByText(/Saved to this browser/);
  const store = await openStore();
  const restored = LabSession.restore((await store.load())!.checkpoint);
  expect(restored.replicas[2]!.localSequence).toBe(2);
  expect(restored.replicas[2]!.get('title')).toBe('Next draft');
  store.close();
});

test('failed saves pause editing, show the failure and allow a safe retry', async () => {
  const real = await openLabStore(new IDBFactory());
  const saved = new LabSession().checkpoint();
  await real.save(saved, 0);
  const store: LabStore = {
    ...real,
    save: vi
      .fn()
      .mockRejectedValueOnce(
        new DOMException('Storage full', 'QuotaExceededError'),
      )
      .mockImplementation(real.save),
  };
  const openStore = async () => store;
  const user = userEvent.setup();
  render(<PersistentPlayground openStore={openStore} />);
  await screen.findByText(/Saved to this browser/);
  await user.type(screen.getByLabelText('Value for replica A'), 'Keep me');
  await user.click(screen.getByRole('button', { name: /Save on A/ }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Storage full',
  );
  expect(
    (
      screen.getByRole('group', {
        name: 'Simulation controls and inspection',
      }) as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  expect((await real.load())?.checkpoint).toEqual(saved);
  await user.click(screen.getByRole('button', { name: 'Retry saving' }));
  await screen.findByText(/Saved to this browser/);
  expect(
    LabSession.restore((await real.load())!.checkpoint).replicas[0]!.get(
      'title',
    ),
  ).toBe('Keep me');
});

test('corrupt saved data is preserved and temporary mode never writes to it', async () => {
  const bad = { revision: 1, checkpoint: { version: 999 } };
  const store: LabStore = {
    load: async () => bad,
    save: vi.fn(),
    close: vi.fn(),
  };
  const user = userEvent.setup();
  render(<PersistentPlayground openStore={async () => store} />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Unsupported saved lab schema',
  );
  await user.click(
    screen.getByRole('button', { name: 'Use temporary session' }),
  );
  await user.type(screen.getByLabelText('Value for replica A'), 'Temporary');
  await user.click(screen.getByRole('button', { name: /Save on A/ }));
  expect(store.save).not.toHaveBeenCalled();
  expect(screen.getByText(/Existing saved data is untouched/)).toBeDefined();
});

test('unavailable storage can be retried without silently replacing the session', async () => {
  const factory = new IDBFactory();
  const openStore = vi
    .fn()
    .mockRejectedValueOnce(new Error('Storage unavailable'))
    .mockImplementation(() => openLabStore(factory));
  const user = userEvent.setup();
  render(<PersistentPlayground openStore={openStore} />);
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Retry loading' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await screen.findByText(/Saved to this browser/);
});
