import { WmsSimpleMasterPage, type WmsSimpleMasterConfig } from "../wms/WmsSimpleMasterPage";

export function FreightMasterPage({ config }: { config: WmsSimpleMasterConfig }) {
  return <WmsSimpleMasterPage config={config} />;
}

export type FreightMasterConfig = WmsSimpleMasterConfig;

