export type CompareItemToTarget<Item, Target> = (item: Item, target: Target) => number;

/**
 * Returns the index of the first item whose comparison to the target is >= 0.
 */
export function lowerBound<Item, Target>(
    items: readonly Item[],
    target: Target,
    compare: CompareItemToTarget<Item, Target>,
): number {
    let low = 0;
    let high = items.length;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const item = items[mid]!;

        if (compare(item, target) < 0) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    return low;
}

/**
 * Returns the index of the first item whose comparison to the target is > 0.
 */
export function upperBound<Item, Target>(
    items: readonly Item[],
    target: Target,
    compare: CompareItemToTarget<Item, Target>,
): number {
    let low = 0;
    let high = items.length;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const item = items[mid]!;

        if (compare(item, target) <= 0) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    return low;
}
