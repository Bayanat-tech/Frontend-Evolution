import { VendorAccountEntryPage } from "./VendorAccountEntryPage";
import { VendorApprovalsPage } from "./VendorApprovalsPage";
import { VendorClosedPage } from "./VendorClosedPage";
import { VendorInquiryPage } from "./VendorInquiryPage";
import { VendorProfilePage } from "./VendorProfilePage";
import { VendorRegistrationPage } from "./VendorRegistrationPage";
import { VendorRequestsPage } from "./VendorRequestsPage";
import { VendorSentBackPage } from "./VendorSentBackPage";
import { getVendorViewFromPath } from "./vendorRoutes";

export function VendorWorkspacePage({ routePath = "" }: { routePath?: string }) {
  const view = getVendorViewFromPath(routePath || window.location.pathname);

  return (
    <div className="vendor-compact">
      {view === "requests" ? <VendorRequestsPage /> :
      view === "approvals" ? <VendorApprovalsPage /> :
      view === "sentBack" ? <VendorSentBackPage /> :
      view === "accountEntry" ? <VendorAccountEntryPage /> :
      view === "closed" ? <VendorClosedPage /> :
      view === "registration" ? <VendorRegistrationPage /> :
      view === "profile" ? <VendorProfilePage /> :
      view === "outstanding" ? <VendorInquiryPage mode="outstanding" /> :
      view === "status" ? <VendorInquiryPage mode="status" /> :
      view === "statement" ? <VendorInquiryPage mode="statement" /> :
      <VendorRequestsPage />}
    </div>
  );
}
