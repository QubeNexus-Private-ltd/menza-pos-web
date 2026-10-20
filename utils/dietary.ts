/**
 * Dietary Utility Engine for Menza POS Web
 * Normalizes Vegetarian vs Non-Vegetarian indicators across all database,
 * API DTO, network, and UI state formats.
 */

export function parseDietaryIsVeg(val: any, defaultIfUnknown: boolean = true): boolean {
  if (val === undefined || val === null) return defaultIfUnknown;

  // If passed an entire object (e.g. MenuItem / ItemMasterDTO)
  if (typeof val === 'object') {
    const candidate =
      val.isVeg !== undefined
        ? val.isVeg
        : val.IsVeg !== undefined
          ? val.IsVeg
          : val.isVegetarian !== undefined
            ? val.isVegetarian
            : val.IsVegetarian !== undefined
              ? val.IsVegetarian
              : val.dietary !== undefined
                ? val.dietary
                : val.dietaryType !== undefined
                  ? val.dietaryType
                  : val.foodType !== undefined
                    ? val.foodType
                    : val.FoodType;

    if (candidate !== undefined && candidate !== null) {
      return parseDietaryIsVeg(candidate, defaultIfUnknown);
    }
    return defaultIfUnknown;
  }

  // Boolean directly
  if (typeof val === 'boolean') return val;

  // Number (e.g. 1 = veg, 0 = non-veg)
  if (typeof val === 'number') return val === 1;

  // String representations
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (
      s === 'false' ||
      s === '0' ||
      s === 'non-veg' ||
      s === 'nonveg' ||
      s === 'non_veg' ||
      s === 'nonvegetarian' ||
      s === 'non-vegetarian' ||
      s === 'non veg' ||
      s === 'egg' ||
      s === 'meat' ||
      s === 'chicken' ||
      s === 'fish' ||
      s === 'mutton'
    ) {
      return false;
    }

    if (
      s === 'true' ||
      s === '1' ||
      s === 'veg' ||
      s === 'vegetarian' ||
      s === 'pure-veg' ||
      s === 'pureveg'
    ) {
      return true;
    }
  }

  return defaultIfUnknown;
}
