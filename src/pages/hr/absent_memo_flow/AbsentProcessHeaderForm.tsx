import { Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
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
    onEmployeeLookup,
    readOnly = false,
}: AbsentProcessHeaderFormProps) {
    const field = (key: keyof AbsentHeaderData) => ({
        value: header[key] as string,
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
                    <Input type="date" {...field("doc_date")} />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Doc Type</label>
                    <Input {...field("doc_type")} placeholder="e.g. Absence Letter" />
                </div>

                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ref No</label>
                    <Input {...field("ref_no")} placeholder="Reference number" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Employee</label>
                    <div className="flex gap-2">
                        <Input {...field("employee_code")} placeholder="Employee code" className="w-40" />
                        <Button type="button" variant="outline" size="icon" onClick={onEmployeeLookup} disabled={readOnly} title="Search employee">
                            <Search size={15} />
                        </Button>
                    </div>
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
                    <label className="text-xs font-medium text-muted-foreground">Name From</label>
                    <Input {...field("name_from")} placeholder="Name from" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">Address From</label>
                    <Input {...field("addr_from")} placeholder="Address from" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Letter Subject</label>
                    <Input {...field("letter_subject")} placeholder="Letter subject" />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground ">Remarks 1</label>
                    <textarea
                        value={header.remarks1}
                        disabled={readOnly}
                        onChange={(e) => onChange("remarks1", e.target.value)}
                        rows={2}
                        placeholder="Remarks"
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                </div>

                <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Remarks 2</label>
                    <textarea
                        value={header.remarks2}
                        disabled={readOnly}
                        onChange={(e) => onChange("remarks2", e.target.value)}
                        rows={2}
                        placeholder="Remarks"
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                </div>
            </div>
        </div>
    );
}