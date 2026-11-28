type Identity = {companyCode:string;companyName:string;adminName:string;loginid:string};
export function registrationIdentityError(draft:Identity, throughStep:number, limits?:{companyCode:number;companyName:number}) {
 const companyMax=Math.min(8,limits?.companyCode||8),nameMax=limits?.companyName||80;
 if(!new RegExp(`^[A-Za-z0-9]{2,${companyMax}}$`).test(draft.companyCode.trim()))return {step:0,field:'companyCode',message:`Company code must contain 2 to ${companyMax} letters or digits. Example: BIT.`};
 if(!draft.companyName.trim()||draft.companyName.trim().length>nameMax)return {step:0,field:'companyName',message:`Enter a company name of 1 to ${nameMax} characters.`};
 if(throughStep<1)return null;
 if(!draft.adminName.trim()||draft.adminName.trim().length>50)return {step:1,field:'adminName',message:'Enter an administrator name of 1 to 50 characters.'};
 if(!/^[A-Za-z0-9_.-]{3,15}$/.test(draft.loginid.trim()))return {step:1,field:'loginid',message:'Choose an admin login ID of 3 to 15 letters, digits, dots, underscores or hyphens, such as bitadmin. Enter your email in Admin email.'};
 return null;
}
