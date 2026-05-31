import { addGroup, editGroup } from "../../wms";
import type { UserProfile } from "../../../types/auth";

export async function saveGroup(
  values: Record<string, unknown>,
  context: { editMode: boolean; original: Record<string, unknown> | null; user: UserProfile | null }
): Promise<void> {
  const { editMode } = context;

  try {
    if (editMode) {
      await editGroup(values);
    } else {
      await addGroup(values);
    }
  } catch (error) {
    console.error("Error saving group:", error);
    throw error;
  }
}
