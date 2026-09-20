import { beforeAll, expect, test } from 'vitest'
import { page } from 'vitest/browser'


beforeAll(async () => {
  if (!document.getElementById('app')) {
    const appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
  }
  await import('./main.ts');

  window.addEventListener('error', (event) => {
    console.error('Runtime error caught:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
  });
})


test('builds and downloads example', async () => {
  const runBtn = page.getByRole('button', { name: /Run/i });
  const downloadBtn = page.getByRole('button', { name: /Download KiCad Netlist/i });
  await expect.element(runBtn).toBeInTheDocument();
  await expect.element(downloadBtn).toBeInTheDocument();

  await expect.element(runBtn).toBeEnabled();

  document.querySelector<HTMLButtonElement>('#run-btn')?.click();
  await expect.element(runBtn).toBeDisabled();

  // compilation happens here
  await expect.element(downloadBtn).toBeEnabled();
  await expect.element(runBtn).toBeEnabled();
  document.querySelector<HTMLButtonElement>('#download-btn')?.click();
}, 30_000)
