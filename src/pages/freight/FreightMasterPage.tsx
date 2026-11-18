import { WmsSimpleMasterPage, type WmsSimpleMasterConfig } from "../wms/WmsSimpleMasterPage";

export function FreightMasterPage({ config }: { config: WmsSimpleMasterConfig }) {
  return <div className="freight-ui-standard"><WmsSimpleMasterPage config={config} /></div>;
}

export type FreightMasterConfig = WmsSimpleMasterConfig;

