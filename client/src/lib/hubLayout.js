/**
 * Which hub pages get the wide container.
 *
 * Most hub pages are cards and prose, and reading them is easier at the site's
 * usual 1280px measure. The rosters are the exception: they are dense tables
 * with a sidebar beside them, and at 1280 the two together leave the table
 * roughly 890px, which is not enough for the columns without a horizontal
 * scroll. Widening only these pages keeps every other page where it was.
 */
const WIDE_PAGES = [
  "/staff-hub/roster",
  "/civilian-hub/roster",
  "/staff-hub/promotion-board",
];

export function isWideHubPage(pathname) {
  return WIDE_PAGES.includes(pathname);
}

/** The container class for a hub page's content column. */
export function hubContainer(pathname) {
  return isWideHubPage(pathname)
    ? "mx-auto w-full max-w-[1700px] px-4 py-10 sm:px-6 lg:px-8"
    : "mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8";
}
