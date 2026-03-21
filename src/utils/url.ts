const base = import.meta.env.BASE_URL; // e.g. '/pr-1/' or '/'

/** Prepend the site base to an absolute path. */
export const url = (path: string): string =>
  `${base}${path.replace(/^\//, '')}`;

/** Strip the base prefix from a pathname for active-state comparisons. */
export const stripBase = (pathname: string): string => {
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  return prefix ? pathname.replace(prefix, '') || '/' : pathname;
};
