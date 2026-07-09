import { useLocation } from "react-router-dom";
import { ToastProvider } from "../../../components/ui/AlertToast";
import { InboundJobListing } from "./InboundJobListing";
import { InboundJobDetail } from "./InboundJobDetail";
import { parseInboundView } from "../../../utils/inboundHelpers";

export function WmsInboundPage() {
  const location = useLocation();
  const view     = parseInboundView(location.pathname);

  return (
    <ToastProvider>
      {view.jobNo
        ? <InboundJobDetail jobNo={view.jobNo} tab={view.tab || "shipment_details"} />
        : <InboundJobListing />
      }
    </ToastProvider>
  );
}