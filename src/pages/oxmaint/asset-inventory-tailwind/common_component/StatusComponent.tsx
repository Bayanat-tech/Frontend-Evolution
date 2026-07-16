import { StatusComponentProps } from './type';
import { assetInventorySizeConfig } from '../config/assetInventorySizeConfig';

const StatusComponent = (props: StatusComponentProps) => {
  const { header, icon, total_count, description } = props;

  return (
    <div
      className="bg-white shadow-md"
      style={{
        borderRadius: assetInventorySizeConfig.statusCard.borderRadius,
        padding: assetInventorySizeConfig.statusCard.padding,
        width: assetInventorySizeConfig.statusCard.width
      }}
    >
      
      <div className="flex justify-between gap-2 mb-3">
        <div className="text-gray-600" style={{ fontSize: assetInventorySizeConfig.statusCard.headerFontSize }}>{header}</div>
        <div
          className="rounded-lg bg-blue-100 flex items-center justify-center"
          style={{
            width: assetInventorySizeConfig.statusCard.iconSize,
            height: assetInventorySizeConfig.statusCard.iconSize,
            fontSize: assetInventorySizeConfig.statusCard.iconFontSize
          }}
        >
          {icon}
        </div>
      </div>

      <div className="font-bold mb-1" style={{ fontSize: assetInventorySizeConfig.statusCard.countFontSize }}>
        {total_count}
      </div>

      <div className="text-gray-400 pt-2" style={{ fontSize: assetInventorySizeConfig.statusCard.descriptionFontSize }}>
        {description}
      </div>

    </div>
  );
};

export default StatusComponent;