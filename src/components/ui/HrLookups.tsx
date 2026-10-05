import { LookupField } from "../ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";
import { getWmsMaster } from "../../api/wms";

type Common = {
  value?: string | number | null;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type ParamProps = Common & {
  parameter: string;
  code2?: string;
  valueField: string;
  descField: string;
  descHeader?: string;
};

/** Lookup backed by getDynamicLookup (company + login from the auth context). */
export const ParamLookup = ({ parameter, code2, valueField, descField, descHeader = "Description", value, onChange, disabled }: ParamProps) => {
  const { user } = useAuth();
  return (
    <LookupField
      value={String(value ?? "")}
      onChange={onChange}
      disabled={disabled}
      valueField={valueField}
      displayFields={[valueField, descField]}
      columns={[
        { field: valueField, header: "Code" },
        { field: descField, header: descHeader },
      ]}
      loadOptions={async () => {
        const res = await getDynamicLookup({
          parameter,
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
          ...(code2 !== undefined ? { code2 } : {}),
        });
        return Array.isArray(res) ? res : [];
      }}
    />
  );
};

const MASTERS = {
  country: { valueField: "country_code", descField: "country_name", header: "Country" },
  currency: { valueField: "curr_code", descField: "curr_name", header: "Currency" },
} as const;

/** Lookup backed by getWmsMaster (country / currency). */
export const MasterLookup = ({ master, value, onChange, disabled }: Common & { master: keyof typeof MASTERS }) => {
  const m = MASTERS[master];
  return (
    <LookupField
      value={String(value ?? "")}
      onChange={onChange}
      disabled={disabled}
      valueField={m.valueField}
      displayFields={[m.valueField, m.descField]}
      columns={[
        { field: m.valueField, header: "Code" },
        { field: m.descField, header: m.header },
      ]}
      loadOptions={async () => {
        const res = await getWmsMaster(master, { page: 1, limit: 100000 });
        return res?.tableData ?? [];
      }}
    />
  );
};