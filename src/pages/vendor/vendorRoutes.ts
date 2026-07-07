import type { VendorView } from "./vendorTypes";

export function getVendorViewFromPath(routePath = ""): VendorView {
  const text = routePath.toLowerCase();
  const compact = text.replace(/[^a-z0-9]/g, "");

  if (compact.includes("vendorregistration") || compact.includes("registration")) return "registration";
  if (compact.includes("vendorprofile") || compact.includes("profile")) return "profile";
  if (compact.includes("vendoroutstanding") || compact.includes("invoiceoutstanding") || compact.includes("outstanding")) return "outstanding";
  if (compact.includes("vendorstatus") || compact.includes("invoicestatus") || compact.includes("invoicestatus")) return "status";
  if (compact.includes("invoiceregister") || compact.includes("statement")) return "statement";
  if (compact.includes("accountentry") || compact.includes("accountposting")) return "accountEntry";
  if (compact.includes("sentback")) return "sentBack";
  if (compact.includes("closed")) return "closed";
  if (compact.includes("invoiceapproval") || compact.includes("approval") || compact.includes("approve")) return "approvals";
  if (compact.includes("invoiceentry") || compact.includes("invoice") || compact.includes("request") || compact.includes("lpo")) return "requests";
  return "requests";
}

export function isVendorRouteText(routeText = "") {
  const text = routeText.toLowerCase();
  const compact = text.replace(/[^a-z0-9]/g, "");
  return (
    text.includes("/vendor") ||
    compact.includes("vendorsystem") ||
    compact.includes("invoiceentry") ||
    compact.includes("invoiceapproval") ||
    compact.includes("invoiceregister") ||
    compact.includes("invoiceoutstanding") ||
    compact.includes("invoicestatus") ||
    compact.includes("accountentry") ||
    compact.includes("vendorregistration") ||
    compact.includes("vendorapproval") ||
    compact.includes("vendorrequest") ||
    compact.includes("vendoroutstanding") ||
    compact.includes("vendorstatus")
  );
}
