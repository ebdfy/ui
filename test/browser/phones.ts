// The phones a fixed overlay's place is measured on: a short one, where a sheet starts near the
// top of the screen, and a tall one. A place can hold on one and break on the other, as the toast
// over a sheet did, so a test of where a toast, sheet, menu or bar sits runs on both:
//   test.for(phones)('… on a $width x $height phone', async ({ width, height }) => {
//     await page.viewport(width, height)
export const phones = [
  { width: 360, height: 600 },
  { width: 360, height: 800 },
] as const
