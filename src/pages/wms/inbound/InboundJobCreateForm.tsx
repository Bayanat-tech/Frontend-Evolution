import { FileText, MapPin, Ship } from "lucide-react";
import { type FormEvent } from "react";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { LookupField } from "../../../components/ui/LookupField";
import { jobClassLabels } from "../../../config/staticData";
import {
  loadInboundPrincipalLookup,
  loadInboundDepartmentLookup,
  loadInboundDivisionLookup,
  loadInboundCountryLookup,
  loadInboundPortLookup,
} from "../../../utils/lookupLoaders";
import { type WmsRow } from "../../../utils/inboundHelpers";
import { LookupFieldInfinite } from "../../../components/ui/LookupFieldInfinite";

type Props = {
  form:        WmsRow;
  setForm:     (updater: (cur: WmsRow) => WmsRow) => void;
  companyCode: string;
  onSubmit:    (e: FormEvent) => void;
};

export function InboundJobCreateForm({ form, setForm, companyCode, onSubmit }: Props) {
  const set = (name: string, val: unknown) =>
    setForm((cur) => ({ ...cur, [name]: val }));

  return (
    <form id="inbound-job-form" className="grid gap-2.5" onSubmit={onSubmit}>

      {/* ── Section 1: Job Information ── */}
      <section className="rounded-md border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b px-3 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Ship size={16} />
          </div>
          <div>
            <p className="eyebrow m-0">Job Information</p>
            <h3 className="m-0 text-sm font-semibold">Inbound Job Creation</h3>
          </div>
        </div>

        <div className="grid gap-2.5 p-3 md:grid-cols-4">
          <LookupFieldInfinite
            label="Principal"
            batchSize={10}
            value={String(form.prin_code || "")}
            displayValue={[form.prin_code, form.prin_name].filter(Boolean).join(" - ")}
            valueField="prin_code"
            displayFields={["prin_code", "prin_name"]}
            columns={[
              { field: "prin_code",      header: "Code" },
              { field: "prin_name",      header: "Principal Name" },
              { field: "prin_dept_code", header: "Department" },
              { field: "div_code",       header: "Division" },
            ]}
            placeholder="Select principal"
            loadOptions={() => loadInboundPrincipalLookup(companyCode)}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                prin_code: val,
                prin_name: row ? String(row["prin_name"]      ?? row["PRIN_NAME"]      ?? "") : cur.prin_name,
                dept_code: row ? String(row["prin_dept_code"] ?? row["PRIN_DEPT_CODE"] ?? cur.dept_code ?? "") : cur.dept_code,
                dept_name: row ? String(row["dept_name"]      ?? row["DEPT_NAME"]      ?? cur.dept_name ?? "") : cur.dept_name,
                div_code:  row ? String(row["div_code"]       ?? row["DIV_CODE"]       ?? cur.div_code  ?? "") : cur.div_code,
                div_name:  row ? String(row["div_name"]       ?? row["DIV_NAME"]       ?? cur.div_name  ?? "") : cur.div_name,
              }))
            }
          />

          <LookupField
            label="Department"
            value={String(form.dept_code || "")}
            displayValue={[form.dept_code, form.dept_name].filter(Boolean).join(" - ")}
            valueField="dept_code"
            displayFields={["dept_code", "dept_name"]}
            columns={[
              { field: "dept_code", header: "Code" },
              { field: "dept_name", header: "Department Name" },
              { field: "div_code",  header: "Division" },
            ]}
            placeholder="Select department"
            loadOptions={() => loadInboundDepartmentLookup(companyCode, String(form.div_code || ""))}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                dept_code: val,
                dept_name: row ? String(row["dept_name"] ?? row["DEPT_NAME"] ?? "") : cur.dept_name,
                div_code:  row ? String(row["div_code"]  ?? row["DIV_CODE"]  ?? cur.div_code ?? "") : cur.div_code,
                div_name:  row ? String(row["div_name"]  ?? row["DIV_NAME"]  ?? cur.div_name ?? "") : cur.div_name,
              }))
            }
          />

          <LookupField
            label="Division"
            value={String(form.div_code || "")}
            displayValue={[form.div_code, form.div_name].filter(Boolean).join(" - ")}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            columns={[
              { field: "div_code", header: "Code" },
              { field: "div_name", header: "Division Name" },
            ]}
            placeholder="Select division"
            loadOptions={() => loadInboundDivisionLookup(companyCode)}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                div_code: val,
                div_name: row ? String(row["div_name"] ?? row["DIV_NAME"] ?? "") : cur.div_name,
              }))
            }
          />

          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">
              Job Classification <strong className="text-destructive">*</strong>
            </span>
            <Select
              value={String(form.job_class || "")}
              onChange={(e) => set("job_class", e.target.value)}
            >
              <option value="">Select Job Classification</option>
              {Object.entries(jobClassLabels).map(([code, label]) => (
                <option key={code} value={code}>{code} - {String(label)}</option>
              ))}
            </Select>
          </label>

          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">
              Job Type <strong className="text-destructive">*</strong>
            </span>
            <Select
              value={String(form.job_type || "IMP")}
              onChange={(e) => set("job_type", e.target.value)}
            >
              <option value="IMP">IMP - Inbound</option>
            </Select>
          </label>

          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Transport Mode</span>
            <Select
              value={String(form.transport_mode || "S")}
              onChange={(e) => set("transport_mode", e.target.value)}
            >
              <option value="S">S - Sea</option>
              <option value="A">A - Air</option>
              <option value="R">R - Road\Land</option>
              <option value="C">C - Courier</option>
            </Select>
          </label>

          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Schedule Date</span>
            <Input
              type="date"
              value={String(form.schedule_date || "")}
              onChange={(e) => set("schedule_date", e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ── Section 2: Routing ── */}
      <section className="rounded-md border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b px-3 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <MapPin size={16} />
          </div>
          <div>
            <p className="eyebrow m-0">Routing</p>
            <h3 className="m-0 text-sm font-semibold">Origin, Destination And Ports</h3>
          </div>
        </div>

        <div className="grid gap-2.5 p-3 md:grid-cols-4">
          <LookupField
            label="Origin Country"
            value={String(form.country_origin || "")}
            displayValue={[form.country_origin, form.country_origin_name].filter(Boolean).join(" - ")}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Code" },
              { field: "country_name", header: "Country" },
            ]}
            placeholder="Select origin country"
            loadOptions={loadInboundCountryLookup}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                country_origin:      val,
                country_origin_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
                port_code:           "",
                port_name:           "",
              }))
            }
          />

          <LookupField
            label="Destination Country"
            value={String(form.country_destination || "")}
            displayValue={[form.country_destination, form.country_destination_name].filter(Boolean).join(" - ")}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Code" },
              { field: "country_name", header: "Country" },
            ]}
            placeholder="Select destination country"
            loadOptions={loadInboundCountryLookup}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                country_destination:      val,
                country_destination_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
                destination_port:         "",
                destination_port_name:    "",
              }))
            }
          />

          <LookupField
            label="Port Of Loading"
            value={String(form.port_code || "")}
            displayValue={[form.port_code, form.port_name].filter(Boolean).join(" - ")}
            valueField="port_code"
            displayFields={["port_code", "port_name"]}
            columns={[
              { field: "port_code",    header: "Port Code" },
              { field: "port_name",    header: "Port Name" },
              { field: "country_code", header: "Country" },
            ]}
            placeholder="Select port of loading"
            loadOptions={() => loadInboundPortLookup(String(form.country_origin || ""))}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                port_code: val,
                port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
              }))
            }
          />

          <LookupField
            label="Port Of Destination"
            value={String(form.destination_port || "")}
            displayValue={[form.destination_port, form.destination_port_name].filter(Boolean).join(" - ")}
            valueField="port_code"
            displayFields={["port_code", "port_name"]}
            columns={[
              { field: "port_code",    header: "Port Code" },
              { field: "port_name",    header: "Port Name" },
              { field: "country_code", header: "Country" },
            ]}
            placeholder="Select port of destination"
            loadOptions={() => loadInboundPortLookup(String(form.country_destination || ""))}
            onChange={(val, row) =>
              setForm((cur) => ({
                ...cur,
                destination_port:      val,
                destination_port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
              }))
            }
          />
        </div>
      </section>

      {/* ── Section 3: References ── */}
      <section className="rounded-md border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b px-3 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText size={16} />
          </div>
          <div>
            <p className="eyebrow m-0">References</p>
            <h3 className="m-0 text-sm font-semibold">Description And Remarks</h3>
          </div>
        </div>

        <div className="grid gap-2.5 p-3 md:grid-cols-3">
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Job Description</span>
            <textarea
              className="ui-textarea min-h-[72px] rounded-md"
              value={String(form.description1 || "")}
              onChange={(e) => set("description1", e.target.value)}
              placeholder="Job description"
            />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">Job Remarks</span>
            <textarea
              className="ui-textarea min-h-[72px] rounded-md"
              value={String(form.remarks || "")}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Job remarks"
            />
          </label>
          <label className="field">
            <span className="text-xs font-medium text-muted-foreground">GRN Remarks</span>
            <textarea
              className="ui-textarea min-h-[72px] rounded-md"
              value={String(form.grn_remarks || "")}
              onChange={(e) => set("grn_remarks", e.target.value)}
              placeholder="GRN remarks"
            />
          </label>
        </div>
      </section>

    </form>
  );
}