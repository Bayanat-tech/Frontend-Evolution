import { executeDynamicDelete, executeDynamicMutation } from '../../../../../api/lookups';


export const inUpdHeaderSection = async (
    inspectionFormId: number,
    sectionTitle: string,
    loginid: string,
    headerSectionId?: number | null
) => {
    const response = await executeDynamicMutation({
        parameter: 'OX_IN_UPD_HEADER_SECTION',
        loginid,
        val1s1: sectionTitle,
        val1n1: inspectionFormId,
        val1n2: headerSectionId ?? undefined,
    });

    return Array.isArray(response) ? response : [];
};

export const inUpdUnderSection = async (
    headerSectionId: number,
    underSectionTitle: string,
    type: string,
    required: string,
    sortOrder: number,
    instruction: string,
    loginid: string,
    underSectionId?: number | null
) => {
    const response = await executeDynamicMutation({
        parameter: 'OX_IN_UPD_UNDER_SECTION',
        loginid,
        val1n1: headerSectionId,
        val1n2: underSectionId ?? undefined,
        val1n3: sortOrder,
        val1s1: underSectionTitle,
        val1s2: type,
        val1s3: required,
        val1s4: instruction,
    });

    return Array.isArray(response) ? response : [];
};

export const delUnderSection = async (
    underSectionId: number,
    headerSectionId: number,
    loginid: string
) => {
    const response = await executeDynamicDelete({
        parameter: 'OX_DEL_INSPECTION_FORM_UNDER_SECTION',
        loginid,
        number1: underSectionId,
        number2: headerSectionId,
    });

    return response;
};

export const inUpdInspectionForm = async (
    inspectionFormName: string,
    description: string,
    loginid: string,
    inspectionFormCode?: number | null
) => {
    const response = await executeDynamicMutation({
        parameter: 'OX_IN_UPD_INSPECTION_FORM',
        loginid,
        val1s1: inspectionFormName,
        val1s2: description,
        val1n1: inspectionFormCode ?? undefined
    });

    return response;
};

export const delInspectionForm = async (
    inspectionFormCode: number,
    loginid: string
) => {
    const response = await executeDynamicDelete({
        parameter: 'OX_DEL_INSPECTION_FORM_MAIN_FORM',
        loginid,
        number1: inspectionFormCode,
    });

    return response;
};