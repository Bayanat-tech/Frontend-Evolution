# Row ID and Column Alignment Guide

## Overview
This guide explains how to use the enhanced row ID composition and column alignment features in `WmsSimpleMasterPage`.

---

## 1. Multiple Field Row ID (Composite Keys)

### Problem Solved
Previously, row IDs could only be generated from a single field. Now you can compose unique IDs from multiple fields.

### Usage

#### Option A: Using Multiple Key Fields (Recommended)
```tsx
const config: WmsSimpleMasterConfig = {
  title: "Location Master",
  master: "locationMaster",
  gmEndpoint: "/api/locations",
  
  // Use multiple fields to create composite row ID
  keyFields: ["warehouse_code", "location_code"],
  rowIdSeparator: "|", // Default: "_"
  
  fields: [
    { name: "warehouse_code", label: "Warehouse", required: true, table: true },
    { name: "location_code", label: "Location", required: true, table: true },
    { name: "description", label: "Description", table: true },
  ],
  // ... other config
};
```

#### Option B: Using Single Key Field (Fallback)
```tsx
const config: WmsSimpleMasterConfig = {
  title: "Product Master",
  master: "productMaster",
  keyField: "product_id", // Falls back to single field
  // ... other config
};
```

### How It Works
- **`keyFields`**: Array of field names to compose the row ID
- **`rowIdSeparator`**: Character(s) to separate field values (default: `"_"`)
- If all fields in `keyFields` are empty, falls back to `${master}_${index}`
- Only fields with non-empty values are included in the composite ID

### Examples

**Config with multiple key fields:**
```tsx
keyFields: ["company", "department", "project"]
rowIdSeparator: "|"
```

**Data row:**
```json
{
  "company": "ACME",
  "department": "IT",
  "project": "Dev"
}
```

**Generated Row ID:** `ACME|IT|Dev`

---

## 2. Column Alignment

### Problem Solved
Columns now support text alignment options for better data presentation (left, center, right).

### Usage

Add the `align` property to any field in your configuration:

```tsx
const config: WmsSimpleMasterConfig = {
  title: "Financial Data",
  master: "financialData",
  keyField: "record_id",
  
  fields: [
    { name: "item_code", label: "Item Code", align: "left" },
    { name: "quantity", label: "Quantity", type: "number", align: "center" },
    { name: "amount", label: "Amount", type: "number", align: "right" },
    { name: "status", label: "Status", align: "center" },
  ],
  // ... other config
};
```

### Alignment Options
- **`"left"`**: Text aligned to the left (default)
- **`"center"`**: Text centered in the column
- **`"right"`**: Text aligned to the right (useful for numbers)

### Best Practices
- Use `"right"` alignment for numeric columns (amounts, quantities)
- Use `"center"` alignment for status, codes, or small identifiers
- Use `"left"` alignment for text data, descriptions
- Actions column is always center-aligned

### Example Configuration

```tsx
{
  name: "account_number",
  label: "Account",
  align: "left"
}

{
  name: "balance",
  label: "Balance",
  type: "number",
  align: "right"
}

{
  name: "approval_status",
  label: "Status",
  align: "center"
}
```

---

## 3. Complete Example

```tsx
import { WmsSimpleMasterPage, WmsSimpleMasterConfig } from "./WmsSimpleMasterPage";

const inventoryConfig: WmsSimpleMasterConfig = {
  title: "Inventory Location Master",
  subtitle: "Manage warehouse locations",
  master: "inventory_locations",
  gmEndpoint: "/api/wms/inventory-locations",
  
  // Composite row ID from multiple fields
  keyFields: ["warehouse_id", "zone_id", "rack_id"],
  rowIdSeparator: "-",
  
  fields: [
    {
      name: "warehouse_id",
      label: "Warehouse ID",
      required: true,
      table: true,
      align: "left"
    },
    {
      name: "zone_id",
      label: "Zone ID",
      required: true,
      table: true,
      align: "center"
    },
    {
      name: "rack_id",
      label: "Rack ID",
      required: true,
      table: true,
      align: "center"
    },
    {
      name: "capacity",
      label: "Capacity",
      type: "number",
      table: true,
      align: "right"
    },
    {
      name: "current_stock",
      label: "Current Stock",
      type: "number",
      table: true,
      align: "right"
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      table: true,
      align: "left"
    },
  ],
  
  deleteConfig: {
    mode: "registered",
    payload: (row) => ({
      warehouse_id: row.warehouse_id,
      zone_id: row.zone_id,
      rack_id: row.rack_id,
    }),
  },
};

export function InventoryLocationPage() {
  return <WmsSimpleMasterPage config={inventoryConfig} />;
}
```

---

## 4. Type Definitions

### WmsMasterField (Updated)
```tsx
export type WmsMasterField = {
  name: string;
  label: string;
  required?: boolean;
  hideOnAdd?: boolean;
  disabledOnEdit?: boolean;
  disabledWhen?: (form: Record<string, unknown>) => boolean;
  type?: "text" | "number" | "select" | "email" | "textarea" | "checkbox" | "date";
  options?: { label: string; value: string }[];
  // ... other properties
  align?: "left" | "center" | "right";  // NEW
};
```

### WmsSimpleMasterConfig (Updated)
```tsx
export type WmsSimpleMasterConfig = {
  title: string;
  subtitle: string;
  master: string;
  gmEndpoint: string;
  routeKeys?: string[];
  keyField?: string;        // Single field (fallback)
  keyFields?: string[];     // NEW: Multiple fields for composite ID
  fields: WmsMasterField[];
  // ... other properties
  rowIdSeparator?: string;  // NEW: Separator for composite IDs (default: "_")
};
```

---

## 5. Migration Guide

### If you're using single key field (existing code)
No changes needed! Your existing code will continue to work:
```tsx
keyField: "id" // Still works
```

### To migrate to multiple key fields
Simply add `keyFields` instead of `keyField`:
```tsx
// Before
keyField: "user_id"

// After
keyFields: ["user_id", "company_id"]
rowIdSeparator: "_" // optional
```

---

## 6. Troubleshooting

### Row ID collisions
**Problem:** Duplicate row IDs in the table
**Solution:** Ensure all fields in `keyFields` have unique combinations, or add more identifying fields

### Column alignment not appearing
**Problem:** Text alignment not showing correctly
**Solution:** Check that the field has `align` property set and `table: true` (if you want it in the table view)

### Composite ID too long
**Problem:** Generated ID is very long with multiple fields
**Solution:** Either:
1. Reduce the number of fields in `keyFields`
2. Use a shorter `rowIdSeparator` (e.g., "|" instead of "__")
3. Include only the essential unique-identifying fields

