import fs from 'node:fs';
import { describe, it } from 'vitest';
import { RootMutationLock } from '../rootMutationLock';

const enabled = process.env.FMCL_ROOT_LOCK_CHILD === '1';

describe.skipIf(!enabled)('RootMutationLock child contender', () => {
  it('acquires and runs the production lock', async () => {
    const id = requiredEnvironment('FMCL_ROOT_LOCK_ID');
    const rootPath = requiredEnvironment('FMCL_ROOT_LOCK_ROOT');
    const eventsPath = requiredEnvironment('FMCL_ROOT_LOCK_EVENTS');
    const releasePath = requiredEnvironment('FMCL_ROOT_LOCK_RELEASE');
    const startPath = process.env.FMCL_ROOT_LOCK_START;
    const ticketBarrierPath = process.env.FMCL_ROOT_LOCK_TICKET_BARRIER;
    const bakeryTurnBarrierPath = process.env.FMCL_ROOT_LOCK_BAKERY_TURN_BARRIER;
    if (startPath) {
      appendEvent(eventsPath, `ready ${id}`);
      await waitForFile(startPath);
    }

    await new RootMutationLock({
      afterTicketSelected: ticketBarrierPath
        ? async (ticket) => {
          appendEvent(eventsPath, `ticket ${id} ${ticket}`);
          await waitForFile(ticketBarrierPath);
        }
        : undefined,
      afterBakeryTurn: bakeryTurnBarrierPath
        ? async () => {
          appendEvent(eventsPath, `turn ${id}`);
          await waitForFile(bakeryTurnBarrierPath);
        }
        : undefined,
    }).run(rootPath, async () => {
      appendEvent(eventsPath, `enter ${id}`);
      await waitForFile(releasePath);
      appendEvent(eventsPath, `exit ${id}`);
    });
  }, 60_000);
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function appendEvent(filePath: string, event: string): void {
  fs.appendFileSync(filePath, `${event}\n`);
}

async function waitForFile(filePath: string): Promise<void> {
  while (!fs.existsSync(filePath)) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
