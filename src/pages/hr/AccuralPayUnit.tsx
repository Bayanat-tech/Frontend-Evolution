import { useEffect, useState } from "react";


interface hearderData {
    company_code : string;
    accural_type : string;
    accural_description : string;
    accural_short_description : string;
}

interface detailData {
    pay_comp_id : string;
    service_days_from: number;
    service_days_to: number;
    entitlement_days: number;
    entitlement_days_percentage: number;
    grade_code: string;
    grade_status: string;
    remarks: string;
}

export default function AccuralPayUnit() {
    const [headerData, setHeaderData] = useState<hearderData>({
        company_code: '',
        accural_type: '',
        accural_description: '',
        accural_short_description: ''
    });
    const [detailData, setDetailData] = useState<detailData[]>([{
        pay_comp_id: '',
        service_days_from: 0,
        service_days_to: 0,
        entitlement_days: 0,
        entitlement_days_percentage: 0,
        grade_code: '',
        grade_status: '',
        remarks: ''
    }]);
    const drop_down_params = {
        company_code: 'HR_ACCURIAL_PAY_UNIT_COMPANY_CODE',
        accural_type: 'HR_ACCURIAL_PAY_UNIT_ACCURIAL_TYPE',
        pay_comp_id: 'HR_ACCURIAL_PAY_UNIT_PAY_COMP',
        grade_code: 'HR_ACCURIAL_PAY_UNIT_GRADE',
        main_page_data: 'HR_ACCURIAL_PAY_UNIT_ACCR_COMPONENTS',
    }
    return(
        <div>
            <h1>Accural Pay Unit</h1>
        </div>
    )
}