import type { NavItem, SidebarItem, SidebarGroup } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { groupBy } from "../utils/async.js";

/**
 * Generates top navigation items from the configuration or by grouping pages by category.
 *
 * @param ctx - The mutable build context containing pages and config.
 *
 * @example
 * ```ts
 * generateNavigation(ctx);
 * ```
 */
export function generateNavigation(ctx: BuildContextMutable): void {
  if (ctx.config.nav) {
    (ctx as { navItems: NavItem[] }).navItems = [...ctx.config.nav.items];
    return;
  }

  const navItems: NavItem[] = [];
  const pagesByCategory = groupBy(ctx.pages, (p) => p.category);

  for (const [category] of Object.entries(pagesByCategory)) {
    const label = category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    navItems.push({
      label,
      href: `/${category}`,
    });
  }

  (ctx as { navItems: NavItem[] }).navItems = navItems;
}

/**
 * Generates sidebar groups from the configuration or by grouping pages by category.
 *
 * @param ctx - The mutable build context containing pages and config.
 *
 * @example
 * ```ts
 * generateSidebar(ctx);
 * ```
 */
export function generateSidebar(ctx: BuildContextMutable): void {
  if (ctx.config.sidebar.groups.length > 0) {
    (ctx as { sidebarGroups: SidebarGroup[] }).sidebarGroups = ctx.config.sidebar.groups.map(
      (group) => ({
        title: group.title,
        items: group.items.map((item) => ({
          label: item.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          href: `/${item}`,
        })),
      }),
    );
    return;
  }

  const pagesByCategory = groupBy(ctx.pages, (p) => p.category);
  const sidebarGroups: SidebarGroup[] = [];

  for (const [category, pages] of Object.entries(pagesByCategory)) {
    const title = category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const items: SidebarItem[] = pages.map((page) => ({
      label: page.title,
      href: page.slug,
    }));

    sidebarGroups.push({ title, items });
  }

  (ctx as { sidebarGroups: SidebarGroup[] }).sidebarGroups = sidebarGroups;
}
