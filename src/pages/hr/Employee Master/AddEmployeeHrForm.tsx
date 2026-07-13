import {
  TAirfareHr,
  TContractHr,
  TEmployeeHr,
  TILPHr,
  TIsuranceHr,
  TPassportHr,
  TPayrollHr,
  TPersnolHr,
  TSponsorHr,
} from "./employee-hr.types";
import { useEffect, useState } from "react";
import { PayrollForm } from "./PayrollForm";
import PersnolInfoForm from "./PersnolInfoForm";
import { useToast } from "../../../components/ui/AlertToast";
import { useAuth } from "../../../state/AuthContext";
import { Stepper } from "../../../components/ui/Stepper";
import { PassportInfo } from "./PassportInfo";
import { ContractInfo } from "./ContractInfo";
import { SponsorInfo } from "./SponsorInfo";
import { InsuranceInfo } from "./InsuranceInfo";
import { IdCardInfo } from "./IdCardInfo";
import { AirfareInfo } from "./AirfareInfo";    
import { insUpdHrEmployee } from "../../../api/hr";

const steps = [
  "Persnol Info",
  "Payroll Info",
  "Passport Info",
  "Contract Info",
  "Sponsor Info",
  "Insurance Info",
  "ID/Card Info",
  "Airfare Info",
];

const AddEmployeeHrForm = ({
  onClose,
  isEditMode,
  employee_code,
  existingData,
}: {
  onClose: () => void;
  isEditMode: boolean;
  employee_code: string;
  existingData?: TEmployeeHr;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [persnolInfo, setPersnolInfo] = useState<TPersnolHr>({
    company_code: user?.company_code ?? "BSG",
    employer_code: user?.company_code ?? "BSG",
    div_code: "",
    dept_code: "",
    section_code: "",
    emp_photo: "",
    employee_code: "",
    employee_id: "",
    alternate_id: "",
    rpt_name: "",
    grade_code: "",
    desg_code: "",
    labour_desg_code: "",
    category_code: "",
    birth_date: null as unknown as Date,
    join_date: null as unknown as Date,
    probation_end_date: null as unknown as Date,
    probation_confirm_date: null as unknown as Date,
    emp_status: "",
    country_code: "",
  });

  const [payRollInfo, setPayRolllInfo] = useState<TPayrollHr>({
    include_in_payroll: "",
    payroll_start_date: null as unknown as Date,
    payment_mode: "",
    company_bank_code: "",
    salary_acct_no: "",
    salary_bank_code: "",
    currency_id: "",
    exch_rate: null as unknown as number,
    emp_iban_no: "",
  });

  const [passportInfo, setPassportInfo] = useState<TPassportHr>({
    ppt_no: "",
    ppt_name: "",
    ppt_country: "",
    ppt_status: "",
    ppt_valid_from: null as unknown as Date,
    ppt_valid_to: null as unknown as Date,
    passport_with: "",
  });

  const [contractInfo, setContractInfo] = useState<TContractHr>({
    contract_type: "",
    contract_start_date: null as unknown as Date,
    contract_end_date: null as unknown as Date,
    contract_renewable: "",
  });

  const [sponsorInfo, setSponsorInfo] = useState<TSponsorHr>({
    sponsor_id: null as unknown as number,
    visa_type: "",
    visa_valid_from: null as unknown as Date,
    visa_valid_to: null as unknown as Date,
  });

  const [insuranceInfo, setInsuranceInfo] = useState<TIsuranceHr>({
    ins_card_no: "",
    ins_card_issue_dt: null as unknown as Date,
    ins_card_exp_dt: null as unknown as Date,
    ins_card_type: "",
  });

  const [idCardInfo, setIdCardInfo] = useState<TILPHr>({
    labourcard_no: "",
    pasi_no: "",
    labourcard_valid_from: null as unknown as Date,
    labourcard_valid_to: null as unknown as Date,
    labourcard_status: "",
  });

  const [airfareInfo, setAirfareInfo] = useState<TAirfareHr>({
    airport_code: "",
    ticket_eligibility: "",
    ticket_dpend_adult: null as unknown as number,
    ta_no: null as unknown as number,
    tc_no: null as unknown as number,
    ti_no: null as unknown as number,
    ticket_eligible_period: null as unknown as number,
  });

  const handleEmployeeFromSubmit = async () => {
    setSubmitting(true);
    const finalPayload = {
      ...persnolInfo,
      ...payRollInfo,
      ...passportInfo,
      ...contractInfo,
      ...sponsorInfo,
      ...insuranceInfo,
      ...idCardInfo,
      ...airfareInfo,
    };
    try {
      const response = await insUpdHrEmployee(finalPayload);
      if (response) {
        toast.success(isEditMode ? "Employee updated successfully" : "Employee added successfully");
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (activeStep !== steps.length - 1) {
      setActiveStep((prev) => prev + 1);
      return;
    }
    void handleEmployeeFromSubmit();
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  useEffect(() => {
    if (isEditMode && existingData) {
      const {
        company_code, employer_code, emp_photo, employee_code: empCode, employee_id, alternate_id,
        rpt_name, grade_code, desg_code, labour_desg_code, category_code, birth_date, join_date,
        probation_end_date, probation_confirm_date, emp_status, country_code, include_in_payroll,
        payroll_start_date, payment_mode, company_bank_code, salary_acct_no, salary_bank_code,
        currency_id, exch_rate, emp_iban_no, ppt_no, ppt_name, ppt_country, ppt_status, ppt_valid_from,
        ppt_valid_to, passport_with, contract_type, contract_start_date, contract_end_date,
        contract_renewable, sponsor_id, visa_type, visa_valid_from, visa_valid_to, ins_card_no,
        ins_card_issue_dt, ins_card_exp_dt, ins_card_type, labourcard_no, pasi_no,
        labourcard_valid_from, labourcard_valid_to, labourcard_status, airport_code,
        ticket_eligibility, ticket_dpend_adult, ta_no, tc_no, ti_no, ticket_eligible_period,
        div_code, dept_code, section_code,
      } = existingData;

      setPersnolInfo({
        company_code, employer_code, emp_photo, employee_code: empCode, employee_id, alternate_id,
        rpt_name, grade_code, desg_code, labour_desg_code, category_code, birth_date, join_date,
        probation_end_date, probation_confirm_date, emp_status, country_code, div_code, dept_code,
        section_code,
      });
      setPayRolllInfo({
        include_in_payroll, payroll_start_date, payment_mode, company_bank_code, salary_acct_no,
        salary_bank_code, currency_id, exch_rate, emp_iban_no,
      });
      setPassportInfo({ ppt_no, ppt_name, ppt_country, ppt_status, ppt_valid_from, ppt_valid_to, passport_with });
      setContractInfo({ contract_type, contract_start_date, contract_end_date, contract_renewable });
      setSponsorInfo({ sponsor_id, visa_type, visa_valid_from, visa_valid_to });
      setInsuranceInfo({ ins_card_no, ins_card_issue_dt, ins_card_exp_dt, ins_card_type });
      setIdCardInfo({ labourcard_no, pasi_no, labourcard_valid_from, labourcard_valid_to, labourcard_status });
      setAirfareInfo({
        airport_code, ticket_eligibility, ticket_dpend_adult, ta_no, tc_no, ti_no, ticket_eligible_period,
      });
    }
  }, [existingData, employee_code, isEditMode]);

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <PersnolInfoForm isEditMode={isEditMode} persnolInfo={persnolInfo} setPersnolInfo={setPersnolInfo} handleNext={handleNext} />
        );
      case 1:
        return <PayrollForm payRollInfo={payRollInfo} setPayRollInfo={setPayRolllInfo} handleNext={handleNext} handleBack={handleBack} />;
      case 2:
        return <PassportInfo passportInfo={passportInfo} setPassportInfo={setPassportInfo} handleNext={handleNext} handleBack={handleBack} />;
      case 3:
        return <ContractInfo contractInfo={contractInfo} setContractInfo={setContractInfo} handleNext={handleNext} handleBack={handleBack} />;
      case 4:
        return <SponsorInfo sponsorInfo={sponsorInfo} setSponsorInfo={setSponsorInfo} handleNext={handleNext} handleBack={handleBack} />;
      case 5:
        return <InsuranceInfo insuranceInfo={insuranceInfo} setInsuranceInfo={setInsuranceInfo} handleNext={handleNext} handleBack={handleBack} />;
      case 6:
        return <IdCardInfo idCardInfo={idCardInfo} setIdCardInfo={setIdCardInfo} handleNext={handleNext} handleBack={handleBack} />;
      case 7:
        return (
          <AirfareInfo
            submitting={submitting}
            airfareInfo={airfareInfo}
            setAirfareInfo={setAirfareInfo}
            handleNext={handleNext}
            handleBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      <Stepper steps={steps} activeStep={activeStep} onStepClick={(index) => index < activeStep && setActiveStep(index)} />
      <div className="pt-10">{renderStepContent()}</div>
    </div>
  );
};

export default AddEmployeeHrForm;