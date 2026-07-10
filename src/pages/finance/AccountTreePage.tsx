import {
  ChevronDown,
  ChevronRight,
  Edit2,
  FileText,
  Folder,
  FolderOpen,
  Info,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AccountTreeNode,
  createAccountTreeNode,
  deleteAccountTreeNode,
  getAccountTree,
  getAccountTreeNode,
  updateAccountTreeNode,
} from "../../api/finance";
import { getDynamicLookup, getLookupText, getMasterLookup } from "../../api/lookups";
import { Badge } from "../../components/ui/Badge";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "../../lib/utils";
import { useAuth } from "../../state/AuthContext";
import { AccountDetails } from "./AccountDetail";

type DialogState =
  | { mode: "create"; level: number; parent: AccountTreeNode }
  | { mode: "edit"; node: AccountTreeNode }
  | null;

type Notice = { type: "success" | "error"; message: string } | null;

type AccountFormState = {
  ac_name: string;
  country_code: string;
  territory_code: string;
  address_1: string;
  address_2: string;
  address_3: string;
  phone: string;
  fax: string;
  e_mail: string;
  contact_person: string;
  mobile_no: string;
  l4_code: string;
  curr_code: string;
  ac_type: string;
  ac_active: string;
  credit_period: string;
  credit_amount: string;
  exp_alloc: string;
  exp_type_code: string;
  exp_type_description: string;
  pl_bl_code: string;
  ac_status: string;
  dept_code: string;
  exp_subtype_code: string;
  exp_subtype_description: string;
  bank_ac_code: string;
  bank_name: string;
  bank_swift: string;
  salesman_code: string;
  sector_code: string;
  contract_expry_date: string;
  bi_main_group: string;
  bi_sub_group: string;
  bi_exp_type: string;
  bi_pl_bs_ind: string;
  bi_dept: string;
  trn_no: string;
  ac_infze: string;
  tax_registrd: string;
  city_name: string;
  tax_country_code: string;
  rcm_apply: string;
  cr_no: string;
  apprval_factor: string;
  request_number: string;
};

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  ac_name: "",
  country_code: "",
  territory_code: "",
  address_1: "",
  address_2: "",
  address_3: "",
  phone: "",
  fax: "",
  e_mail: "",
  contact_person: "",
  mobile_no: "",
  l4_code: "",
  curr_code: "",
  ac_type: "",
  ac_active: "Y",
  credit_period: "",
  credit_amount: "",
  exp_alloc: "",
  exp_type_code: "",
  exp_type_description: "",
  pl_bl_code: "",
  ac_status: "",
  dept_code: "",
  exp_subtype_code: "",
  exp_subtype_description: "",
  bank_ac_code: "",
  bank_name: "",
  bank_swift: "",
  salesman_code: "",
  sector_code: "",
  contract_expry_date: "",
  bi_main_group: "",
  bi_sub_group: "",
  bi_exp_type: "",
  bi_pl_bs_ind: "",
  bi_dept: "",
  trn_no: "",
  ac_infze: "N",
  tax_registrd: "N",
  city_name: "",
  tax_country_code: "",
  rcm_apply: "N",
  cr_no: "",
  apprval_factor: "",
  request_number: "",
};

const ACCOUNT_FORM_SECTIONS: Array<{
  title: string;
  fields: Array<{ name: keyof AccountFormState; label: string; type?: "number" | "date" | "email" | "flag" | "textarea" }>;
}> = [
  {
    title: "Basic Information",
    fields: [
      { name: "ac_name", label: "Account Name" },
      { name: "l4_code", label: "Level 4 Code" },
      { name: "dept_code", label: "Department Code" },
      { name: "curr_code", label: "Currency Code" },
      { name: "pl_bl_code", label: "BS / PL Code" },
      // { name: "ac_status", label: "Status" },
    ],
  },
  {
    title: "Address and Contact",
    fields: [
      { name: "address_1", label: "Address 1", type: "textarea" },
      { name: "address_2", label: "Address 2", type: "textarea" },
      { name: "address_3", label: "Address 3", type: "textarea" },
      { name: "city_name", label: "City" },
      { name: "territory_code", label: "Territory Code" },
      { name: "country_code", label: "Country Code" },
      { name: "phone", label: "Phone" },
      { name: "mobile_no", label: "Mobile No" },
      { name: "fax", label: "Fax" },
      { name: "e_mail", label: "Email", type: "email" },
      { name: "contact_person", label: "Contact Person" },
    ],
  },
  {
    title: "Credit and Bank",
    fields: [
      { name: "credit_period", label: "Credit Period", type: "number" },
      { name: "credit_amount", label: "Credit Amount", type: "number" },
      { name: "bank_ac_code", label: "Bank Account Code" },
      { name: "bank_name", label: "Bank Name" },
      { name: "bank_swift", label: "Bank Swift" },
    ],
  },
  {
    title: "Contract, Sales and Tax",
    fields: [
      { name: "contract_expry_date", label: "Expiry Date", type: "date" },
      { name: "salesman_code", label: "Salesman Code" },
      { name: "sector_code", label: "Sector Code" },
      { name: "trn_no", label: "TRN No" },
      { name: "tax_country_code", label: "Tax Country Code" },
      { name: "tax_registrd", label: "Tax Registered", type: "flag" },
      { name: "rcm_apply", label: "Reverse Charge Apply", type: "flag" },
      { name: "ac_infze", label: "In Designated Zone", type: "flag" },
    ],
  },
  {
    title: "BI and Expense",
    fields: [
      { name: "bi_main_group", label: "BI Main Group" },
      { name: "bi_sub_group", label: "BI Sub Group" },
      { name: "bi_exp_type", label: "BI Exp Type" },
      { name: "bi_pl_bs_ind", label: "BI PL BS IND" },
      { name: "bi_dept", label: "BI Dept" },
      // { name: "exp_alloc", label: "Expense Allocation" },
      { name: "exp_type_description", label: "Exp Type Description" },
      { name: "exp_subtype_description", label: "Exp SubType Description" },
    ],
  },
  // {
  //   title: "Approval",
  //   fields: [
  //     // { name: "cr_no", label: "CR No" },
  //     // { name: "apprval_factor", label: "Approval Factor" },
  //     // { name: "request_number", label: "Request Number" },
  //     // { name: "ac_type", label: "Account Type" },
  //     { name: "ac_active", label: "Active", type: "flag" },
  //   ],
  // },
];

export function AccountTreePage() {
  const { user } = useAuth();
  const [tree, setTree] = useState<AccountTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountTreeNode | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsNode, setDetailsNode] = useState<AccountTreeNode | null>(null);

  const loadTree = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getAccountTree();
      setTree(data);
      setExpanded(seedExpansion(data));
      setSelectedId((prev) => (prev && flattenTree(data).some((node) => node.id === prev) ? prev : data[0]?.id || ""));
      if (data.length === 0) {
        setNotice({
          type: "error",
          message: "No A/C Tree records were returned by the backend for this company.",
        });
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load account tree" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTree();
  }, []);

  const allNodes = useMemo(() => flattenTree(tree), [tree]);
  const selectedNode = allNodes.find((node) => node.id === selectedId) || allNodes[0];
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);

  const handleDialogSaved = async (message?: string) => {
    setDialog(null);
    setNotice({ type: "success", message: message || "Account tree updated" });
    await loadTree(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAccountTreeNode(deleteTarget.level, deleteTarget.id);
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Account node deleted" });
      await loadTree(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete account node" });
    }
  };

  return (
    <section className="finance-page grid gap-4">
      <div className="finance-toolbar flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">A/C Tree</h1>
        </div>
        <div className="toolbar-actions flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadTree()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          {selectedNode && selectedNode.level < 5 && (
            <Button onClick={() => setDialog({ mode: "create", level: selectedNode.level + 1, parent: selectedNode })}>
              <Plus size={15} /> Add Child
            </Button>
          )}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="account-tree-layout grid grid-cols-[minmax(340px,40%)_1fr] gap-4 max-lg:grid-cols-1 items-start"> 
        <Card className="tree-panel flex min-w-0 flex-col overflow-hidden">
          <CardHeader className="tree-panel-head flex-row items-center justify-between gap-3 space-y-0 border-b">
            <div>
              <p className="eyebrow">Chart Hierarchy</p>
              <h2 className="m-0 text-base font-semibold">Accounts</h2>
            </div>
            <Badge variant="secondary">{loading ? "Loading" : `${allNodes.length} Nodes`}</Badge>
          </CardHeader>

          <label className="tree-search mx-3 my-3 flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground">
            <Search size={15} />
            <Input
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search account code or name"
            />
          </label>

          <div className="tree-scroll min-h-0 flex-1 overflow-auto px-2 pb-3">
            {loading ? (
              <TreeSkeleton />
            ) : filteredTree.length === 0 ? (
              <div className="tree-empty">{query ? "No accounts found" : "No accounts returned from backend"}</div>
            ) : (
              filteredTree.map((node) => (
                <TreeNodeView
                  key={node.id}
                  node={node}
                  selectedId={selectedNode?.id || ""}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  setSelectedId={setSelectedId}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="account-detail-panel overflow-hidden">
          {dialog ? (
            <AccountNodeEditor dialog={dialog} onClose={() => setDialog(null)} onSaved={handleDialogSaved} onDetails={(node) => {       
              setDetailsNode(node);
               setDetailsOpen(true);
             }}/>
          ) : selectedNode ? (
            <>
              <CardHeader className="detail-head flex-row items-center gap-4 space-y-0 border-b">
                <div className={`level-icon level-${selectedNode.level}`}>
                  {selectedNode.children.length > 0 ? <FolderOpen size={22} /> : <FileText size={22} />}
                </div>
                <div>
                  <p className="eyebrow">Level {selectedNode.level}</p>
                  <h2 className="m-0 text-xl font-semibold tracking-tight">{selectedNode.label}</h2>
                  <span className="font-mono text-xs text-muted-foreground">{selectedNode.id}</span>
                </div>
              </CardHeader>

              <CardContent>
                <div className="detail-grid grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <InfoTile label="Account Code" value={selectedNode.id} />
                  <InfoTile label="Description" value={selectedNode.label} />
                  <InfoTile label="Parent Code" value={selectedNode.parent_code || "Root"} />
                  <InfoTile label="Children" value={String(selectedNode.children.length)} />
                </div>
              </CardContent>

              <div className="detail-actions flex flex-wrap items-center justify-end gap-2 px-4 pb-4">
                {/* Detail */}
                 {/* {selectedNode.level === 5 && (
                    <Button variant="outline" onClick={() => setDetailsOpen(true)}>
                      <Info size={15} /> Details
                    </Button>
                 )} */}

                {selectedNode.level === 5 && (
                  <Button variant="outline" onClick={() => setAttachmentOpen(true)}>
                    <Paperclip size={15} /> Attachments
                  </Button>
                )}
                {selectedNode.level >= 2 && selectedNode.level <= 5 && (
                  <Button variant="outline" onClick={() => setDialog({ mode: "edit", node: selectedNode })}>
                    <Edit2 size={15} /> Edit
                  </Button>
                )}
                {selectedNode.level < 5 && (
                  <Button onClick={() => setDialog({ mode: "create", level: selectedNode.level + 1, parent: selectedNode })}>
                    <Plus size={15} /> Add Level {selectedNode.level + 1}
                  </Button>
                )}
                {selectedNode.level >= 2 && selectedNode.children.length === 0 && (
                  <Button variant="destructive" onClick={() => setDeleteTarget(selectedNode)}>
                    <Trash2 size={15} /> Delete
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="tree-empty">Select an account node</div>
          )}
        </Card>
      </div>

      <AttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        requestNumber={selectedNode?.level === 5 ? selectedNode.id : ""}
        title="Account Attachments"
        module="AC_TREE"
        type="Account Tree"
        companyCode={user?.company_code || ""}
        loginId={user?.loginid || user?.username || ""}
        flowLevel={selectedNode?.level || 0}
      />
      {detailsOpen && detailsNode && (
  <AccountDetails
    acCode={detailsNode.id}
    acName={detailsNode.label}
    onClose={() => { setDetailsOpen(false); setDetailsNode(null); }}
  />
    )}


      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Account Node"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">
            Delete <strong>{deleteTarget.label}</strong> ({deleteTarget.id})?
          </p>
        </Dialog>
      )}
    </section>
  );
}

function TreeNodeView({
  node,
  selectedId,
  expanded,
  setExpanded,
  setSelectedId,
  depth = 0,
}: {
  node: AccountTreeNode;
  selectedId: string;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSelectedId: (id: string) => void;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.id] ?? node.level <= 2;
  const selected = selectedId === node.id;

  return (
    <div className="tree-node" data-depth={depth} data-selected={selected ? "true" : undefined}>
      <div
        className={cn(
          "tree-row flex min-h-8 items-center gap-1 rounded-md pr-2 text-sm hover:bg-accent",
          selected && "selected bg-primary/10 text-primary",
        )}
        style={{ paddingLeft: 8 }}
      >
        <button
          className="tree-caret grid h-7 w-6 place-items-center rounded border-0 bg-transparent text-muted-foreground disabled:cursor-default"
          onClick={() => setExpanded((prev) => ({ ...prev, [node.id]: !isExpanded }))}
          disabled={!hasChildren}
        >
          {hasChildren ? isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span />}
        </button>
        <button
          className="tree-label flex h-8 min-w-0 flex-1 items-center gap-2 border-0 bg-transparent text-left text-foreground"
          // onClick={() => setSelectedId(node.id)}
          onClick={() => {
           setSelectedId(node.id);
           if (hasChildren) setExpanded((prev) => ({ ...prev, [node.id]: !isExpanded }));
      }}
        >
          {hasChildren ? <Folder size={15} /> : <FileText size={15} />}
          <span className="min-w-0 flex-1 truncate">{node.label}</span>
          {node.level >= 3 && <code className="ml-auto rounded border bg-card px-1.5 py-0.5 text-[11px] text-primary">{node.id}</code>}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              selectedId={selectedId}
              expanded={expanded}
              setExpanded={setExpanded}
              setSelectedId={setSelectedId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountNodeEditor({ dialog, onClose, onSaved, onDetails }: { dialog: DialogState; onClose: () => void; onSaved: (message?: string) => Promise<void>; onDetails: (node: AccountTreeNode) => void }) {
  const isEdit = dialog?.mode === "edit";
  const level = isEdit ? dialog.node.level : dialog?.level || 2;
  const parent = dialog?.mode === "create" ? dialog.parent : null;
  const node = dialog?.mode === "edit" ? dialog.node : null;
  const [description, setDescription] = useState(node?.label || "");
  const [l4Type, setL4Type] = useState("N");
  const [l4Bill, setL4Bill] = useState("N");
  const [l4Job, setL4Job] = useState("N");
  const { user } = useAuth();
  const [accountForm, setAccountForm] = useState<AccountFormState>({
    ...EMPTY_ACCOUNT_FORM,
    l4_code: level === 5 ? parent?.id || node?.parent_code || "" : "",
    ac_name: level === 5 ? node?.label || "" : "",
  });
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  if (!dialog) return null;

  if (showDetails && node) {
    return (
      <AccountDetails
        acCode={node.id}
        acName={node.label}
        onClose={() => setShowDetails(false)}  // ← Back goes to editor
      />
    );
  }

  const title = `${isEdit ? "Edit" : "Add"} Level ${level}${level === 5 ? " Account" : ""}`;

  useEffect(() => {
    let active = true;

    async function loadEditData() {
      if (!isEdit || !node) return;
      setLoadingDetails(true);
      setError("");
      try {
        const data = await getAccountTreeNode(level, node.id);
        if (!active) return;

        if (level === 5) {
  const form = mapAccountDataToForm(data, node.parent_code || "");

  if (form.exp_type_code && !form.exp_type_description) {
    try {
      const results = await getDynamicLookup({
        parameter: "AC_EXPSTYPE_EXPSTYPE_MASTER",
        loginid: user?.loginid || "",
        code1: user?.company_code || "",
      });
      const found = results.find((r: any) => r.exp_type_code === form.exp_type_code);
      if (found) form.exp_type_description = String(found.exp_type_description || "");
    } catch (_) {}
  }

  if (form.exp_subtype_code && !form.exp_subtype_description) {
    try {
      const results = await getDynamicLookup({
        parameter: "AC_EXPSTYPE_EXPSUBTYPE_MASTER",
        loginid: user?.loginid || "",
        code1: user?.company_code || "",
        code2: form.exp_type_code,
      });
      const found = results.find((r: any) => r.exp_subtype_code === form.exp_subtype_code);
      if (found) form.exp_subtype_description = String(found.exp_subtype_description || "");
    } catch (_) {}
  }

  setAccountForm(form);
}
         else {
          const normalized = normalizeRecord(data);
          if (level === 2) setDescription(String(normalized.l2_description || node.label));
          if (level === 3) setDescription(String(normalized.l3_description || node.label));
          if (level === 4) {
            setDescription(String(normalized.l4_description || node.label));
            setL4Type(String(normalized.l4_type ?? "N"));
            setL4Bill(String(normalized.l4_bill ?? "N"));
            setL4Job(String(normalized.l4_job ?? "N"));
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load account details");
      } finally {
        if (active) setLoadingDetails(false);
      }
    }

    void loadEditData();
    return () => {
      active = false;
    };
  }, [isEdit, level, node]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (level === 5 && !accountForm.ac_name.trim()) {
      setError("Account Name is required.");
      return;
    }

    if (level !== 5 && !description.trim()) {
      setError("Description is required.");
      return;
    }

    try {
      setSaving(true);
      const payload = level === 5
        ? buildAccountPayload(accountForm, parent || node)
        : buildPayload(level, description.trim(), parent || node, { l4Type, l4Bill, l4Job }, isEdit);
      const result = isEdit && node
        ? await updateAccountTreeNode(level, node.id, payload)
        : await createAccountTreeNode(level, payload);
      await onSaved(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save account node");
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="account-editor flex flex-col"> 
      <div className="flex items-start justify-between gap-4 border-b p-4">
        <div>
          <p className="eyebrow">{isEdit ? "Modify Node" : "Create Node"}</p>
          <h2 className="m-0 text-xl font-semibold tracking-tight">{title}</h2>
          {(parent || node) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {parent ? `Parent: ${parent.label} (${parent.id})` : node ? `Code: ${node.id}` : ""}
            </p>
          )}
        </div>
        <Button variant="outline" type="button" onClick={onClose}>
          Back to Details
        </Button>
      </div>


      <form id="account-node-form" className="account-node-form min-h-0 flex-1 overflow-auto p-4" onSubmit={handleSubmit}>
        <NoticeToast notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

        {loadingDetails ? (
          <div className="form-loading">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ) : level === 5 ? (
          <AccountLevelFiveForm value={accountForm} onChange={setAccountForm} />
        ) : (
          <>
            {isEdit && node && (
              <label className="field">
                <span>Code</span>
                <Input value={node.id} disabled />
              </label>
            )}
            <label className="field">
              <span>Description</span>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>

            {level === 4 && (
              <div className="toggle-grid">
                <FlagSelect label="Type" value={l4Type} onChange={setL4Type} />
                <FlagSelect label="Invoice Splitting" value={l4Bill} onChange={setL4Bill} />
                <FlagSelect label="Job" value={l4Job} onChange={setL4Job} />
              </div>
            )}
          </>
        )}
      </form>

      <div className="flex items-center justify-end gap-2 border-t bg-card p-4">
         <div>
    {isEdit && level === 5 && node && (
      <Button variant="outline" type="button" onClick={() => onDetails(node)}>
        <Info size={15} /> Details
      </Button>
    )}
  </div>
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button disabled={saving} type="submit" form="account-node-form">
          {saving ? <span className="spinner small" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AccountLevelFiveForm({
  value,
  onChange,
}: {
  value: AccountFormState;
  onChange: (next: AccountFormState) => void;
}) {
  const { user } = useAuth();
  const setField = (name: keyof AccountFormState, nextValue: string) => onChange({ ...value, [name]: nextValue });
  const setFields = (next: Partial<AccountFormState>) => onChange({ ...value, ...next });
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const lookupFields: Partial<Record<keyof AccountFormState, Parameters<typeof LookupField>[0]>> = {
    curr_code: {
      label: "Currency",
      value: value.curr_code,
      columns: [
        { field: "curr_code", header: "Code" },
        { field: "curr_name", header: "Currency" },
      ],
      valueField: "curr_code",
      displayFields: ["curr_code", "curr_name"],
      loadOptions: () => getMasterLookup("wms", "currency"),
      onChange: (nextValue) => setField("curr_code", nextValue),
    },
    territory_code: {
      label: "Territory",
      value: value.territory_code,
      columns: [
        { field: "territory_code", header: "Code" },
        { field: "territory_name", header: "Territory" },
      ],
      valueField: "territory_code",
      displayFields: ["territory_code", "territory_name"],
      loadOptions: () => getMasterLookup("wms", "territory"),
      onChange: (nextValue) => setField("territory_code", nextValue),
    },
    country_code: {
      label: "Country",
      value: value.country_code,
      columns: [
        { field: "country_code", header: "Code" },
        { field: "country_name", header: "Country" },
      ],
      valueField: "country_code",
      displayFields: ["country_code", "country_name"],
      loadOptions: () => getMasterLookup("wms", "country"),
      onChange: (nextValue) => setField("country_code", nextValue),
    },
    dept_code: {
      label: "Department",
      value: value.dept_code,
      columns: [
        { field: "dept_code", header: "Code" },
        { field: "dept_name", header: "Department" },
      ],
      valueField: "dept_code",
      displayFields: ["dept_code", "dept_name"],
      loadOptions: () => getMasterLookup("wms", "department"),
      onChange: (nextValue) => setField("dept_code", nextValue),
    },
    salesman_code: {
      label: "Salesman",
      value: value.salesman_code,
      columns: [
        { field: "salesman_code", header: "Code" },
        { field: "salesman_name", header: "Salesman" },
      ],
      valueField: "salesman_code",
      displayFields: ["salesman_code", "salesman_name"],
      loadOptions: () => getMasterLookup("wms", "salesman"),
      onChange: (nextValue) => setField("salesman_code", nextValue),
    },
    sector_code: {
      label: "Sector",
      value: value.sector_code,
      columns: [
        { field: "sector_code", header: "Code" },
        { field: "sector_name", header: "Sector" },
      ],
      valueField: "sector_code",
      displayFields: ["sector_code", "sector_name"],
      loadOptions: () => getMasterLookup("wms", "industrysector"),
      onChange: (nextValue) => setField("sector_code", nextValue),
    },
    tax_country_code: {
      label: "Tax Country",
      value: value.tax_country_code,
      columns: [
        { field: "country_code", header: "Code" },
        { field: "country_name", header: "Country" },
      ],
      valueField: "country_code",
      displayFields: ["country_code", "country_name"],
      loadOptions: () => getMasterLookup("wms", "country"),
      onChange: (nextValue) => setField("tax_country_code", nextValue),
    },
    pl_bl_code: {
      label: ["1", "2", "3"].includes(value.l4_code.slice(0, 1)) ? "BS Code" : "PL Code",
      value: value.pl_bl_code,
      columns: ["1", "2", "3"].includes(value.l4_code.slice(0, 1))
        ? [
            { field: "bl_code", header: "Code" },
            { field: "bl_description", header: "Description" },
          ]
        : [
            { field: "pl_code", header: "Code" },
            { field: "pl_description", header: "Description" },
          ],
      valueField: ["1", "2", "3"].includes(value.l4_code.slice(0, 1)) ? "bl_code" : "pl_code",
      displayFields: ["1", "2", "3"].includes(value.l4_code.slice(0, 1)) ? ["bl_code", "bl_description"] : ["pl_code", "pl_description"],
      loadOptions: () => getMasterLookup("finance", ["1", "2", "3"].includes(value.l4_code.slice(0, 1)) ? "bl_setup" : "pl_setup"),
      onChange: (nextValue) => setField("pl_bl_code", nextValue),
    },
    exp_type_description: {
      label: "Exp Type",
      value: value.exp_type_code,
      displayValue: value.exp_type_description || value.exp_type_code,
      columns: [
        { field: "exp_type_code", header: "Code" },
        { field: "exp_type_description", header: "Description" },
      ],
      valueField: "exp_type_code",
      displayFields: ["exp_type_code", "exp_type_description"],
      loadOptions: () => getDynamicLookup({ parameter: "AC_EXPSTYPE_EXPSTYPE_MASTER", loginid: loginId, code1: companyCode }),
      onChange: (nextValue, row) => setFields({
        exp_type_code: nextValue,
        exp_type_description: row ? getLookupText(row, ["exp_type_description"]) : "",
        exp_subtype_code: "",
        exp_subtype_description: "",
      }),
    },
    exp_subtype_description: {
      label: "Exp SubType",
      value: value.exp_subtype_code,
      displayValue: value.exp_subtype_description || value.exp_subtype_code,
      columns: [
        { field: "exp_subtype_code", header: "Code" },
        { field: "exp_subtype_description", header: "Description" },
        { field: "exp_type_code", header: "Exp Type" },
      ],
      valueField: "exp_subtype_code",
      displayFields: ["exp_subtype_code", "exp_subtype_description"],
      disabled: !value.exp_type_code,
      loadOptions: () => getDynamicLookup({ parameter: "AC_EXPSTYPE_EXPSUBTYPE_MASTER", loginid: loginId, code1: companyCode, code2: value.exp_type_code }),
      onChange: (nextValue, row) => setFields({
        exp_subtype_code: nextValue,
        exp_subtype_description: row ? getLookupText(row, ["exp_subtype_description"]) : "",
      }),
    },
  };

  return (
    <div className="level-five-form">
      {ACCOUNT_FORM_SECTIONS.map((section) => (
        <section className="form-section" key={section.title}>
          <div className="form-section-title">
            <h3>{section.title}</h3>
          </div>
          <div className="form-grid">
            {section.fields.map((field) => (
              lookupFields[field.name] ? (
                <div className={field.type === "textarea" ? "field-wide" : ""} key={field.name}>
                  <LookupField {...lookupFields[field.name]!} />
                </div>
              ) : (
                <label className={field.type === "textarea" ? "field field-wide" : "field"} key={field.name}>
                    <span>
                      {field.label}
                      {field.name === "ac_name" && <b>*</b>}
                    </span>
                    {field.type === "flag" ? (
                      <Select value={value[field.name]} onChange={(event) => setField(field.name, event.target.value)}>
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className="ui-textarea"
                        value={value[field.name]}
                        onChange={(event) => setField(field.name, event.target.value)}
                      />
                    ) : (
                      <Input
                        type={field.type || "text"}
                        value={value[field.name]}
                        onChange={(event) => setField(field.name, event.target.value)}
                        disabled={field.name === "l4_code"}
                      />
                    )}
                </label>
              )
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FlagSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="N">No</option>
        <option value="Y">Yes</option>
      </Select>
    </label>
  );
}

function buildPayload(
  level: number,
  description: string,
  context: AccountTreeNode | null,
  flags: { l4Type: string; l4Bill: string; l4Job: string },
  isEdit: boolean,
) {
  const parentCode = isEdit ? context?.parent_code || "" : context?.id || "";
  switch (level) {
    case 2:
      return { l1_code: parentCode, l2_description: description };
    case 3:
      return { l2_code: parentCode, l3_description: description };
    case 4:
      return {
        l3_code: parentCode,
        l4_description: description,
        l4_type: flags.l4Type,
        l4_bill: flags.l4Bill,
        l4_job: flags.l4Job,
      };
    case 5:
      return {
        l4_code: context?.id || "",
        ac_name: description,
        files: [],
      };
    default:
      return {};
  }
}

function buildAccountPayload(form: AccountFormState, context: AccountTreeNode | null) {
  return {
    l4_code: form.l4_code || context?.id || context?.parent_code || "",
    ac_name: form.ac_name.trim(),
    address_1: form.address_1,
    address_2: form.address_2,
    address_3: form.address_3,
    territory_code: form.territory_code,
    city_name: form.city_name,
    country_code: form.country_code,
    phone: form.phone,
    mobile_no: form.mobile_no,
    fax: form.fax,
    e_mail: form.e_mail,
    contact_person: form.contact_person,
    dept_code: form.dept_code,
    credit_period: toNumber(form.credit_period),
    credit_amount: toNumber(form.credit_amount),
    curr_code: form.curr_code,
    bank_ac_code: form.bank_ac_code,
    bank_name: form.bank_name,
    bank_swift: form.bank_swift,
    // contract_expry_date: form.contract_expry_date || null,
    contract_expry_date: form.contract_expry_date ? new Date(form.contract_expry_date) : null,
    ac_infze: form.ac_infze,
    salesman_code: form.salesman_code,
    sector_code: form.sector_code,
    trn_no: form.trn_no,
    tax_registrd: form.tax_registrd,
    tax_country_code: form.tax_country_code,
    rcm_apply: form.rcm_apply,
    bi_main_group: form.bi_main_group,
    bi_sub_group: form.bi_sub_group,
    pl_bl_code: form.pl_bl_code,
    bi_exp_type: form.bi_exp_type,
    bi_pl_bs_ind: form.bi_pl_bs_ind,
    bi_dept: form.bi_dept,
    exp_type_code: form.exp_type_code,
    exp_type_description: form.exp_type_description,
    exp_subtype_code: form.exp_subtype_code,
    exp_subtype_description: form.exp_subtype_description,
    files: [],
  };
}

function mapAccountDataToForm(data: Record<string, unknown>, fallbackL4Code: string): AccountFormState {
  const normalized = normalizeRecord(data);
  return {
    ...EMPTY_ACCOUNT_FORM,
    ac_name: textValue(normalized.ac_name),
    country_code: textValue(normalized.country_code),
    territory_code: textValue(normalized.territory_code),
    address_1: textValue(normalized.address_1),
    address_2: textValue(normalized.address_2),
    address_3: textValue(normalized.address_3),
    phone: textValue(normalized.phone),
    fax: textValue(normalized.fax),
    e_mail: textValue(normalized.e_mail),
    contact_person: textValue(normalized.contact_person),
    mobile_no: textValue(normalized.mobile_no),
    exp_alloc: textValue(normalized.exp_alloc),
    l4_code: textValue(normalized.l4_code) || fallbackL4Code,
    curr_code: textValue(normalized.curr_code),
    ac_type: textValue(normalized.ac_type),
    ac_active: textValue(normalized.ac_active) || "Y",
    credit_period: textValue(normalized.credit_period),
    credit_amount: textValue(normalized.credit_amount),
    exp_type_code: textValue(normalized.exp_type_code),
    exp_type_description: textValue(normalized.exp_type_description),
    pl_bl_code: textValue(normalized.pl_bl_code),
    ac_status: textValue(normalized.ac_status),
    dept_code: textValue(normalized.dept_code),
    exp_subtype_code: textValue(normalized.exp_subtype_code),
    exp_subtype_description: textValue(normalized.exp_subtype_description),
    bank_ac_code: textValue(normalized.bank_ac_code),
    bank_name: textValue(normalized.bank_name),
    bank_swift: textValue(normalized.bank_swift),
    salesman_code: textValue(normalized.salesman_code),
    sector_code: textValue(normalized.sector_code),
    contract_expry_date: dateInputValue(normalized.contract_expry_date),
    bi_main_group: textValue(normalized.bi_main_group),
    bi_sub_group: textValue(normalized.bi_sub_group),
    bi_exp_type: textValue(normalized.bi_exp_type),
    bi_pl_bs_ind: textValue(normalized.bi_pl_bs_ind),
    bi_dept: textValue(normalized.bi_dept),
    trn_no: textValue(normalized.trn_no),
    ac_infze: textValue(normalized.ac_infze) || "N",
    tax_registrd: textValue(normalized.tax_registrd) || "N",
    city_name: textValue(normalized.city_name),
    tax_country_code: textValue(normalized.tax_country_code),
    rcm_apply: textValue(normalized.rcm_apply) || "N",
    cr_no: textValue(normalized.cr_no),
    apprval_factor: textValue(normalized.apprval_factor),
    request_number: textValue(normalized.request_number),
  };
}

function normalizeRecord(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key.toLowerCase(), value])) as Record<string, unknown>;
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNumber(value: string) {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateInputValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-tile min-h-[78px] rounded-md border bg-background p-3">
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      <strong className="break-words text-sm font-semibold">{value}</strong>
    </div>
  );
}

function TreeSkeleton() {
  return (
    <div className="tree-skeleton">
      {Array.from({ length: 10 }).map((_, index) => (
        <Skeleton key={index} style={{ width: `${92 - (index % 4) * 8}%` }} />
      ))}
    </div>
  );
}

function flattenTree(nodes: AccountTreeNode[]): AccountTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children || [])]);
}

function seedExpansion(nodes: AccountTreeNode[]) {
  const next: Record<string, boolean> = {};
  flattenTree(nodes).forEach((node) => {
    if (node.children && node.children.length > 0) next[node.id] = false;
  });
  return next;
}

function filterTree(nodes: AccountTreeNode[], query: string): AccountTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  return nodes
    .map((node) => {
      const children = filterTree(node.children || [], q);
      const match = node.id.toLowerCase().includes(q) || node.label.toLowerCase().includes(q);
      if (!match && children.length === 0) return null;
      return { ...node, children };
    })
    .filter(Boolean) as AccountTreeNode[];
}
