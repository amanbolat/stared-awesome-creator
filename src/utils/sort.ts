export type SortableItem = {
  stars?: number | null;
  name: string;
};

export function sortItemsByStars(items: SortableItem[]): void {
  items.sort((a, b) => {
    const left = a.stars ?? -1;
    const right = b.stars ?? -1;
    if (right !== left) {
      return right - left;
    }
    return a.name.localeCompare(b.name);
  });
}
