import { addBrand, editBrand } from "../../wms";
import type { UserProfile } from "../../../types/auth";

export async function saveBrand(
  values: Record<string, unknown>,
  context: { editMode: boolean; original: Record<string, unknown> | null; user: UserProfile | null }
): Promise<void> {
  const { editMode } = context;

  try {
    if (editMode) {
      await editBrand(values);
    } else {
      // Remove brand_code for add mode (it's auto-generated at DB level)
      const { brand_code: _unused, ...dataForCreate } = values;
      await addBrand(dataForCreate);
    }
  } catch (error) {
    console.error("Error saving brand:", error);
    throw error;
  }
}
