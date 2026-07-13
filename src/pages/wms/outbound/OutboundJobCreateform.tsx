import { FileText, MapPin, Ship } from "lucide-react";
import { FormEvent } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { jobClassLabels } from "./Outboundtypes";
import type { WmsRow } from "./Outboundtypes";
import { formatLookupDisplay, lookupText, value } from "./OutboundHelpers";
import {
  loadOutboundPrincipalLookup,
  loadDepartmentLookup,
  loadWmsMasterLookup,
  loadPortLookup,
} from "./OutboundLookups";
import { DateField, TextField } from "./OutboundFormFields";

export function OutboundJobCreateForm({
  form,
  setForm,
  companyCode,
  onSubmit,
}: {
  form: WmsRow;
  setForm: (updater: (current: WmsRow) => WmsRow) => void;
  companyCode: string;
  onSubmit: (event: FormEvent) => void;
}) {
  const jobClass = String(form.job_class || "N");
  const transportMode = String(form.transport_mode || "S");
  const setValue = (name: string, fieldValue: unknown) =>
    setForm((current) => ({ ...current, [name]: fieldValue }));

  return (
    <form id="outbound-job-form" className="outbound-job-create grid gap-2.5" onSubmit={onSubmit}>
      {/* ── Job Information ── */}
      <section className="rounded-md border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              <Ship size={16} />
            </div>
            <div>
              <p className="eyebrow m-0">Job Information</p>
              <h3 className="m-0 text-sm font-semibold">Outbound Job Creation</h3>
            </div>
          </div>
          {/* <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {companyCode || "Company"}
          </span> */}
        </div>
        <div className="grid gap-2.5 p-3 md:grid-cols-4">
          <LookupField
            label="Principal Code"
            value={String(form.prin_code || "")}
            displayValue={formatLookupDisplay(form, ["prin_code", "prin_name"])}
            valueField="prin_code"
            displayFields={["prin_code", "prin_name"]}
            columns={[
              { field: "prin_code", header: "Principal Code" },
              { field: "prin_name", header: "Principal Name" },
              { field: "prin_dept_code", header: "Department" },
              { field: "div_code", header: "Division" },
            ]}
            placeholder="Select principal"
            loadOptions={() => loadOutboundPrincipalLookup(companyCode)}
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                prin_code: selected,
                prin_name: selectedRow ? lookupText(selectedRow, "prin_name") : "",
                div_code: selectedRow
                  ? lookupText(selectedRow, "div_code") || current.div_code
                  : current.div_code,
                div_name: selectedRow
                  ? lookupText(selectedRow, "div_name") || current.div_name
                  : current.div_name,
                dept_code: selectedRow
                  ? lookupText(selectedRow, "prin_dept_code") || current.dept_code
                  : current.dept_code,
                dept_name: selectedRow
                  ? lookupText(selectedRow, "dept_name") || current.dept_name
                  : current.dept_name,
                curr_code: selectedRow
                  ? lookupText(selectedRow, "curr_code") || current.curr_code || "OMR"
                  : current.curr_code || "OMR",
                ex_rate: current.ex_rate || 1,
              }))
            }
          />
          <LookupField
            label="Department"
            value={String(form.dept_code || "")}
            displayValue={formatLookupDisplay(form, ["dept_code", "dept_name"])}
            valueField="dept_code"
            displayFields={["dept_code", "dept_name"]}
            columns={[
              { field: "dept_code", header: "Department Code" },
              { field: "dept_name", header: "Department Name" },
              { field: "div_code", header: "Division" },
            ]}
            placeholder="Select department"
            loadOptions={() =>
              loadDepartmentLookup(companyCode, String(form.div_code || ""))
            }
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                dept_code: selected,
                dept_name: selectedRow ? lookupText(selectedRow, "dept_name") : "",
                div_code: selectedRow
                  ? lookupText(selectedRow, "div_code") || current.div_code
                  : current.div_code,
                div_name: selectedRow
                  ? lookupText(selectedRow, "div_name") || current.div_name
                  : current.div_name,
              }))
            }
          />
          <LookupField
            label="Division"
            value={String(form.div_code || "")}
            displayValue={formatLookupDisplay(form, ["div_code", "div_name"])}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            columns={[
              { field: "div_code", header: "Division Code" },
              { field: "div_name", header: "Division Name" },
              { field: "country_code", header: "Country" },
            ]}
            placeholder="Select division"
            loadOptions={() => loadWmsMasterLookup("division")}
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                div_code: selected,
                div_name: selectedRow ? lookupText(selectedRow, "div_name") : "",
              }))
            }
          />
          <label className="field">
            <span>
              Job Class <strong className="text-destructive">*</strong>
            </span>
            <Select
              value={jobClass}
              onChange={(event) => setValue("job_class", event.target.value)}
            >
              <option value="">Select Job Class</option>
              {Object.entries(jobClassLabels).map(([code, label]) => (
                <option value={code} key={code}>
                  {code} - {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>
              Job Type <strong className="text-destructive">*</strong>
            </span>
            <Select
              value={String(form.job_type || "EXP")}
              onChange={(event) => setValue("job_type", event.target.value)}
            >
              <option value="EXP">EXP - Export</option>
            </Select>
          </label>
          <label className="field">
            <span>Transport Mode</span>
            <Select
              value={transportMode}
              onChange={(event) => setValue("transport_mode", event.target.value)}
            >
              <option value="S">S - Sea</option>
              <option value="A">A - Air</option>
              <option value="R">R - Road</option>
              <option value="C">C - Courier</option>
            </Select>
          </label>
          <DateField name="schedule_date" label="Schedule Date" form={form} setForm={setForm} />
          <TextField name="doc_ref" label="Doc Ref" form={form} setForm={setForm} />
          <TextField name="prin_ref2" label="Principal Ref 2" form={form} setForm={setForm} />
        </div>
      </section>

      {/* ── Routing ── */}
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
            label="Country Origin"
            value={String(form.country_origin || "")}
            displayValue={formatLookupDisplay(form, ["country_origin", "country_origin_name"])}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Country Code" },
              { field: "country_name", header: "Country Name" },
            ]}
            placeholder="Select origin"
            loadOptions={() => loadWmsMasterLookup("country")}
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                country_origin: selected,
                country_origin_name: selectedRow
                  ? lookupText(selectedRow, "country_name")
                  : "",
              }))
            }
          />
          <LookupField
            label="Country Destination"
            value={String(form.country_destination || "")}
            displayValue={formatLookupDisplay(form, ["country_destination", "country_destination_name"])}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Country Code" },
              { field: "country_name", header: "Country Name" },
            ]}
            placeholder="Select destination"
            loadOptions={() => loadWmsMasterLookup("country")}
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                country_destination: selected,
                country_destination_name: selectedRow
                  ? lookupText(selectedRow, "country_name")
                  : "",
              }))
            }
          />
          <LookupField
            label="Port Code"
            value={String(form.port_code || "")}
            displayValue={formatLookupDisplay(form, ["port_code", "port_name"])}
            valueField="port_code"
            displayFields={["port_code", "port_name"]}
            columns={[
              { field: "port_code", header: "Port Code" },
              { field: "port_name", header: "Port Name" },
              { field: "country_code", header: "Country" },
            ]}
            placeholder="Select port"
            loadOptions={loadPortLookup}
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                port_code: selected,
                port_name: selectedRow ? lookupText(selectedRow, "port_name") : "",
              }))
            }
          />
          <LookupField
            label="Destination Port"
            value={String(form.destination_port || "")}
            displayValue={formatLookupDisplay(form, ["destination_port", "destination_port_name"])}
            valueField="port_code"
            displayFields={["port_code", "port_name"]}
            columns={[
              { field: "port_code", header: "Port Code" },
              { field: "port_name", header: "Port Name" },
              { field: "country_code", header: "Country" },
            ]}
            placeholder="Select destination port"
            loadOptions={loadPortLookup}
            onChange={(selected, selectedRow) =>
              setForm((current) => ({
                ...current,
                destination_port: selected,
                destination_port_name: selectedRow
                  ? lookupText(selectedRow, "port_name")
                  : "",
              }))
            }
          />
        </div>
      </section>

      {/* ── References ── */}
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
        <div className="grid gap-2.5 p-3 md:grid-cols-4">
          <label className="field md:col-span-2">
            <span>Description</span>
            <textarea
            className="ui-textarea min-h-[58px] rounded-md"
              value={String(form.description1 || "")}
              onChange={(event) => setValue("description1", event.target.value)}
              placeholder="Short job description"
            />
          </label>
          <label className="field md:col-span-2">
            <span>Remarks</span>
            <textarea
              className="ui-textarea min-h-[58px] rounded-md"
              value={String(form.remarks || "")}
              onChange={(event) => setValue("remarks", event.target.value)}
              placeholder="Operational remarks for this outbound job"
            />
          </label>
        </div>
      </section>
    </form>
  );
}