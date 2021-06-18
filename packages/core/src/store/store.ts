export const store: any = {};

export const useStore = (id = 'default') => {
  if (!store[id]) {
    store[id] = {};
  }

  return store[id];
};
