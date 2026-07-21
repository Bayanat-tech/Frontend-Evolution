import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { createVendorRegistration, type VendorRow } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { Field, VendorPageHeader } from "./components";
import type { Notice } from "./vendorTypes";

const initialForm: VendorRow = {
  vendor_code: "",
  vendor_name: "",
  vendor_short_name: "",
  address1: "",
  address2: "",
  city: "",
  country_code: "",
  phone: "",
  email: "",
  contact_person: "",
  status: "A",
};

export function VendorRegistrationPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<VendorRow>(() => ({ ...initialForm, company_code: user?.company_code || "" }));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const setField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!form.vendor_code || !form.vendor_name || !form.email) {
      setNotice({ type: "error", message: "Vendor code, vendor name and email are required." });
      return;
    }
    try {
      setSaving(true);
      await createVendorRegistration({ ...form, company_code: user?.company_code || form.company_code });
      setNotice({ type: "success", message: "Vendor saved successfully" });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to save vendor" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <VendorPageHeader title="Vendor Registration" description="Vendor master creation is kept separate from request and approval workflows." />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardContent className="pt-4">
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Company" value={String(form.company_code || "")} onChange={(value) => setField("company_code", value)} readOnly />
              <Field label="Vendor Code" value={String(form.vendor_code || "")} onChange={(value) => setField("vendor_code", value)} required />
              <Field label="Vendor Name" value={String(form.vendor_name || "")} onChange={(value) => setField("vendor_name", value)} required />
              <Field label="Short Name" value={String(form.vendor_short_name || "")} onChange={(value) => setField("vendor_short_name", value)} />
              <Field label="Address 1" value={String(form.address1 || "")} onChange={(value) => setField("address1", value)} />
              <Field label="Address 2" value={String(form.address2 || "")} onChange={(value) => setField("address2", value)} />
              <Field label="City" value={String(form.city || "")} onChange={(value) => setField("city", value)} />
              <Field label="Country" value={String(form.country_code || "")} onChange={(value) => setField("country_code", value)} />
              <Field label="Phone" value={String(form.phone || "")} onChange={(value) => setField("phone", value)} />
              <Field label="Email" value={String(form.email || "")} onChange={(value) => setField("email", value)} required />
              <Field label="Contact Person" value={String(form.contact_person || "")} onChange={(value) => setField("contact_person", value)} />
              <Field label="Status" value={String(form.status || "")} onChange={(value) => setField("status", value)} options={[{ label: "Active", value: "A" }, { label: "Inactive", value: "I" }]} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}><Save size={15} /> Save Vendor</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
