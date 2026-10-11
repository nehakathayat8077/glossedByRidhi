export const loadActiveServices = () =>
  import('./catalog').then(({ fetchActiveServices }) => fetchActiveServices());

export const loadActiveProducts = () =>
  import('./catalog').then(({ fetchActiveProducts }) => fetchActiveProducts());

export const loadActiveDesigns = () =>
  import('./catalog').then(({ fetchActiveDesigns }) => fetchActiveDesigns());
