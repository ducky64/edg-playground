import { beforeAll, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'


beforeAll(async () => {
  if (!document.getElementById('app')) {
    const appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
  }
  await import('./main.ts');
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

  const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  await downloadBtn.click();
  expect(createObjectURLSpy).toHaveBeenCalledOnce

  const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
  expect(blob.type).toBe('text/plain');
  const blobText = await blob.text();
  expect(blobText).contains('components');
  expect(blobText).contains('STM32F103');
  expect(blobText).contains('U1');
}, 30_000)
