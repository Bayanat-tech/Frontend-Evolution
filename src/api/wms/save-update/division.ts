import { addDivision, editDivision } from "../../wms";
import type { UserProfile } from "../../../types/auth";

export async function saveDivision(
  values: Record<string, unknown>,
  context: { editMode: boolean; original: Record<string, unknown> | null; user: UserProfile | null }
): Promise<void> {
  const { editMode } = context;

  try {
    if (editMode) {
      await editDivision(values);
    } else {
      await addDivision(values);
    }
  } catch (error) {
    console.error("Error saving division:", error);
    throw error;
  }
}
