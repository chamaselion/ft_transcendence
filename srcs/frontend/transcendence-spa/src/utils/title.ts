export const TITLE_DISPLAY_MAX_LENGTH = 17

export function truncateTitle(
  value: string,
  maxLength = TITLE_DISPLAY_MAX_LENGTH,
): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}
