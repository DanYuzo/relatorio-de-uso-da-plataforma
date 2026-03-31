import { test, expect } from '@playwright/test';

test('Smoke Test: App loads and shows upload screen', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Prosperus Club/);

    // Check upload screen elements
    await expect(page.getByRole('heading', { name: 'Prosperus Club' })).toBeVisible();
    await expect(page.getByText('Carregar Arquivos CSV')).toBeVisible();

    // Check process button is disabled initially
    const processBtn = page.getByRole('button', { name: /Aguardando todos os arquivos/ });
    await expect(processBtn).toBeDisabled();
});
