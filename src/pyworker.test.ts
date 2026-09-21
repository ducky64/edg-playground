import { beforeAll, expect, test } from 'vitest'
import { evaluatePython } from './pyworkerapi';
import { EXAMPLES } from './examples';

let pyWorker: Worker;

beforeAll(async () => {
  pyWorker = new Worker(new URL('./pyworker.ts', import.meta.url), { type: 'module' });

  await new Promise<void>((resolve, reject) => {
    const listener = (event: MessageEvent) => {
      switch (event.data.type) { 
        case 'READY':
          pyWorker.removeEventListener("message", listener);
          resolve();
          break;
        case 'ERROR':
          pyWorker.removeEventListener("message", listener);
          reject(new Error(event.data.error));
          break;
        case 'STDOUT':
        case 'STDERR':
        case 'PROGRESS':
          break;
      }
    };
    pyWorker.addEventListener('message', listener);
  });
})

test('builds example', async () => {
  let keyboardResult = await evaluatePython(pyWorker, EXAMPLES["Keyboard"], (_data) => {})
  expect(keyboardResult.type).toBe('RESULT')
  expect(keyboardResult.name).toBe('Keyboard')
  expect(keyboardResult.netlist).contains("components")
  expect(keyboardResult.netlist).contains("STM32F103")
  expect(keyboardResult.netlist).contains("U1")
  expect(keyboardResult.bom).contains("STM32F103")
  expect(keyboardResult.bom).contains("U1")
  expect(keyboardResult.json).contains("STM32F103")
  expect(keyboardResult.json).contains("U1")
}, 60_000)
