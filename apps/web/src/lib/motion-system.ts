export const saunaEase = [0.16, 1, 0.3, 1] as const;

export const motionDuration = {
  micro: 0.2,
  component: 0.34,
  page: 0.44,
  curtain: 0.78,
} as const;

export const routeOrder = ["/lobby", "/studio", "/board-meeting", "/settings"] as const;

export function routeDepth(pathname: string) {
  if (pathname.startsWith("/focus-room")) return 1.5;
  const index = routeOrder.findIndex((route) => pathname === route || pathname.startsWith(`${route}/`));
  return index < 0 ? 0 : index;
}
