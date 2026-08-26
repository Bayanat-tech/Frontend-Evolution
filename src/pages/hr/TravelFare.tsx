// src/pages/hr/TravelFare.tsx
import { useMemo } from "react";
import { MasterPage } from "../../components/ui/MasterPage";
import type { MasterField } from "../../components/ui/MasterPage";
import {
  executeDynamicDelete,
  executeDynamicMutation,
  getDynamicLookup,
} from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";

export default function TravelFare() {
  const { user } = useAuth();

  const fields = useMemo<MasterField[]>(
    () => [
      // ── Header ──────────────────────────────────────────────
      {
        name: "airport_code",
        label: "Fare Code",
        required: true,
        disabledWhen: (ctx) => !!ctx.editMode,
      },
      {
        name: "airport_name",
        label: "Fare Code Name",
        required: true,
      },
      {
        name: "airport_short_name",
        label: "Short Name",
      },
      {
        name: "destination_country",
        label: "Country",
        dropdownParam: "HR_TRAVEL_FARE_DROP_DOWN_COUNTRY",
        dropdownDisplayFields: ["country_code", "country_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "country_code",
        dropdownCode1: user?.company_code || "",
      },

      // ── Ticket Fare ─────────────────────────────────────────
      {
        name: "curr_code",
        label: "Currency",
        section: "Ticket Fare",
        dropdownParam: "HR_TRAVEL_FARE_DROP_DOWN_CURRENCY",
        dropdownDisplayFields: ["curr_code", "curr_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "curr_code",
        dropdownCode1: user?.company_code || "",
        // When currency is picked, also set exchange rate from the same row
        onDropdownSelect: (row: any, setField : any) => {
          if (row?.ex_rate != null) {
            setField("ex_rate", row.ex_rate);
          }
        },
      },
      {
        name: "ex_rate",
        label: "Exchange Rate",
        section: "Ticket Fare",
        type: "number",
      },
      {
        name: "fair_class",
        label: "Class",
        section: "Ticket Fare",
        // simple select – adjust options if you have a code table
        options: [
          { value: "E", label: "Economy" },
          { value: "B", label: "Business" },
          { value: "F", label: "First" },
        ],
      },
      {
        name: "adult_ticket_fair",
        label: "Adult",
        section: "Ticket Fare",
        type: "number",
      },
      {
        name: "child_ticket_fair",
        label: "Child",
        section: "Ticket Fare",
        type: "number",
      },
      {
        name: "infant_ticket_fair",
        label: "Infant",
        section: "Ticket Fare",
        type: "number",
      },
      {
        name: "fc_adult_fair",
        label: "Adult (Foreign Currency)",
        section: "Ticket Fare",
        type: "number",
      },
      {
        name: "fc_child_fair",
        label: "Child (Foreign Currency)",
        section: "Ticket Fare",
        type: "number",
      },
      {
        name: "fc_infant_fair",
        label: "Infant (Foreign Currency)",
        section: "Ticket Fare",
        type: "number",
      },

      // ── Footer ──────────────────────────────────────────────
      {
        name: "remarks",
        label: "Remarks",
        section: "Other",
      },
      {
        name: "status",
        label: "Status",
        section: "Other",
        required: true,
        type: "select",
        options: [
          { value: "A", label: "Active" },
          { value: "I", label: "Inactive" },
        ],
        defaultValue: "A",
      },
    ],
    [user?.company_code],
  );

  // ── Load ────────────────────────────────────────────────────
  const customLoad = async () => {
    const response = await getDynamicLookup({
      parameter: "HR_TRAVEL_FARE_DATA_TABLE",
      code1: user?.company_code || "",
    });

    return {
      tableData: Array.isArray(response) ? response : [],
    };
  };

  // ── Save (Insert / Update) ──────────────────────────────────
  const customSave = async (
    form: Record<string, unknown>,
    context: {
      editMode: boolean;
      original: Record<string, unknown> | null;
      user: unknown;
    },
  ) => {
    const typedUser = context.user as { loginid: string; company_code: string };

    // Key: company + airport_code (existing key on edit)
    const airportCode =
      context.editMode && context.original?.airport_code
        ? String(context.original.airport_code)
        : form.airport_code
          ? String(form.airport_code)
          : undefined;

    await executeDynamicMutation({
    parameter: "HR_TRAVEL_FARE_INS_UPD",
    loginid: typedUser.loginid,

    val1s1: typedUser.company_code,           // COMPANY_CODE
    val1s2: airportCode,                      // AIRPORT_CODE
    val1s3: form.airport_name ? String(form.airport_name) : undefined,
    val1s4: form.airport_short_name ? String(form.airport_short_name) : undefined,
    val1s5: form.destination_country ? String(form.destination_country) : undefined,
    val1s6: form.curr_code ? String(form.curr_code) : undefined,
    val1s7: form.fair_class ? String(form.fair_class) : undefined,
    val1s8: form.remarks ? String(form.remarks) : undefined,
    val1s9: form.status ? String(form.status) : "A",

    val1n1: form.ex_rate !== "" && form.ex_rate != null ? Number(form.ex_rate) : undefined,
    val1n2: form.adult_ticket_fair !== "" && form.adult_ticket_fair != null ? Number(form.adult_ticket_fair) : undefined,
    val1n3: form.child_ticket_fair !== "" && form.child_ticket_fair != null ? Number(form.child_ticket_fair) : undefined,
    val1n4: form.infant_ticket_fair !== "" && form.infant_ticket_fair != null ? Number(form.infant_ticket_fair) : undefined,
    val1n5: form.fc_adult_fair !== "" && form.fc_adult_fair != null ? Number(form.fc_adult_fair) : undefined,

    // extra numerics (signature only has N1–N5)
    wval1n1: form.fc_child_fair !== "" && form.fc_child_fair != null ? Number(form.fc_child_fair) : undefined,
    wval1n2: form.fc_infant_fair !== "" && form.fc_infant_fair != null ? Number(form.fc_infant_fair) : undefined,
    });
  };

  // ── Delete ──────────────────────────────────────────────────
  const customDelete = async (row: Record<string, unknown>, userArg: unknown) => {
    const typedUser = userArg as { loginid: string; company_code: string };

    await executeDynamicDelete({
      parameter: "MST_HR_TRAVEL_FARE_DEL",
      loginid: typedUser.loginid,
      code1: typedUser.company_code,
      code2: String(row.airport_code),
    });
  };

  return (
    <MasterPage
      config={{
        title: "Travel Fare",
        subtitle: "Manage airport / travel ticket fares",
        master: "ms_hr_airport",
        keyFields: ["airport_code"],
        rowIdSeparator: "_",
        fields,
        customLoad,
        customSave,
        customDelete,
      }}
    />
  );
}