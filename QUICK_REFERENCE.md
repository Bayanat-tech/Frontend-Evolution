# Quick Reference: Row ID and Column Alignment

## 🚀 Quick Start

### Multiple Field Row IDs
```tsx
const config: WmsSimpleMasterConfig = {
  keyFields: ["company", "division", "department"],
  rowIdSeparator: "|", // optional, defaults to "_"
  // ...
};
```

### Column Alignment
```tsx
fields: [
  { name: "code", label: "Code", align: "left" },
  { name: "amount", label: "Amount", align: "right" },
  { name: "status", label: "Status", align: "center" },
]
```

---

## 📋 Type Reference

### WmsMasterField
```tsx
type WmsMasterField = {
  // ... existing properties ...
  align?: "left" | "center" | "right";  // NEW
};
```

### WmsSimpleMasterConfig
```tsx
type WmsSimpleMasterConfig = {
  // ... existing properties ...
  keyField?: string;        // Single key (fallback)
  keyFields?: string[];     // Multiple keys (NEW)
  rowIdSeparator?: string;  // Composite separator (NEW, default: "_")
};
```

---

## 💡 Common Patterns

### Pattern 1: Location Hierarchy
```tsx
keyFields: ["warehouse", "zone", "rack"],
rowIdSeparator: ">"
// Result: WH-01>Z1>R101, WH-02>Z2>R205, ...
```

### Pattern 2: Financial Codes
```tsx
keyFields: ["ledger_code", "cost_center"],
rowIdSeparator: "-"
// Result: 1000-CC01, 1100-CC02, ...
```

### Pattern 3: Document Reference
```tsx
keyFields: ["doc_type", "doc_year", "doc_number"],
rowIdSeparator: "/"
// Result: INV/2026/001, PO/2026/001, ...
```

---

## ✅ Alignment Best Practices

| Type | Alignment | Reason |
|------|-----------|--------|
| Text/Name | left | Natural reading direction |
| Numbers | right | Proper numerical alignment |
| Status/Badge | center | Visual emphasis |
| ID/Code | left | Identifier lookup |
| Amount/Currency | right | Accounting standard |
| Percentage | right | Numerical value |
| Date | center | Compact presentation |

---

## 🔄 Migration Path

### Before (Single Key)
```tsx
keyField: "product_id"
```

### After (Multiple Keys)
```tsx
keyFields: ["category", "product_id"]
```

**No breaking changes!** Old code still works.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Row ID too long | Use fewer fields or shorter separator |
| Row ID collisions | Add more unique fields to keyFields |
| Alignment not showing | Ensure `table: true` on field + `align` property |
| Error about undefined keyField | Update code that accesses keyField directly |

---

## 📚 See Also

- [ROW_ID_AND_ALIGNMENT_GUIDE.md](ROW_ID_AND_ALIGNMENT_GUIDE.md) - Full documentation
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details
- [WmsSimpleMasterPage.tsx](src/pages/wms/WmsSimpleMasterPage.tsx) - Source code

