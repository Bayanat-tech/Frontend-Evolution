/**
 * Tiny classnames helper — joins truthy class strings together.
 * Replaces the need for MUI's `sx` prop / clsx dependency.
 */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');
