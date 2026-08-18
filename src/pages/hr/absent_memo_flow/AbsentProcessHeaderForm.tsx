import { Input } from "../../../components/ui/Input";
import { AbsentHeaderData } from "./Absentprocesstypes";

interface AbsentProcessHeaderFormProps {
    header: AbsentHeaderData;
    onChange: (field: keyof AbsentHeaderData, value: string) => void;
    onEmployeeLookup: () => void;
    readOnly?: boolean;
}

export function AbsentProcessHeaderForm({
    header,
    onChange,
    readOnly = false,
}: AbsentProcessHeaderFormProps) {
    const field = (key: keyof AbsentHeaderData) => ({
        value: (header[key] as string) ?? "",
        disabled: readOnly,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(key, e.target.value),
    });

    return (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="grid gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Doc No</label>
                    <Input {...field("doc_no")} disabled placeholder="Auto-generated" />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Doc Date</label>
                    <Input type="date" {...field("doc_date")} disabled={readOnly} />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Doc Type</label>
                    <Input {...field("doc_type")} disabled placeholder="e.g. ABM" />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ref No</label>
                    <Input {...field("ref_no")} placeholder="Reference number" />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Employee Code</label>
                    <Input {...field("employee_code")} disabled placeholder="Employee code" />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Request Number</label>
                    <Input {...field("request_number")} disabled />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Next Action By</label>
                    <Input {...field("next_action_by")} disabled />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Signatory Name</label>
                    <Input {...field("signatory_name")} placeholder="Name" />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Signatory Position</label>
                    <Input {...field("signatory_position")} placeholder="Position" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Name To</label>
                    <Input {...field("name_to")} placeholder="Name to" disabled />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Name From</label>
                    <Input {...field("name_from")} placeholder="Name from" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">Address From</label>
                    <Input {...field("addr_from")} placeholder="Address from" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Letter Subject</label>
                    <Input {...field("lettr_subject")} placeholder="Letter subject" disabled />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Remarks 1</label>
                    <textarea
                        value={header.remarks_1 ?? ""}
                        disabled={readOnly}
                        onChange={(e) => onChange("remarks_1", e.target.value)}
                        rows={2}
                        placeholder="Remarks"
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Remarks 2</label>
                    <textarea
                        value={header.remarks_2 ?? ""}
                        disabled={readOnly}
                        onChange={(e) => onChange("remarks_2", e.target.value)}
                        rows={2}
                        placeholder="Remarks"
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                </div>
            </div>
        </div>
    );
}