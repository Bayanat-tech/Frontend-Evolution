import {useEffect,useState} from 'react';
import {Dialog} from '../../components/ui/Dialog';
import {Button} from '../../components/ui/Button';
import {api} from '../../api/client';
type Preview={company:string;companyName:string;totalRows:number;tables:{table:string;count:number}[];users:number;sharedUsersPreserved:number;reassignments:{loginid:string;company:string;tenant:string}[];token:string};
export function CompanyDeletionDialog({tenant,company,name,onClose,onDeleted}:{tenant:string;company:string;name:string;onClose:()=>void;onDeleted:()=>void}) {
 const [preview,setPreview]=useState<Preview|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[typed,setTyped]=useState(''),[confirmed,setConfirmed]=useState(false),[revision,setRevision]=useState(0);
 const path=`/api/security/platform/${encodeURIComponent(tenant)}/companies/${encodeURIComponent(company)}`;
 useEffect(()=>{let live=true;setLoading(true);setPreview(null);setError('');setTyped('');setConfirmed(false);
  api.post(path+'/deletion-preview').then(response=>{if(response.data?.success!==true||response.data.data?.company!==company)throw new Error('Invalid preview response');if(live)setPreview(response.data.data);}).catch(e=>{if(live)setError(e.response?.data?.message||'Unable to load deletion preview. Please retry.');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[path,revision]);
 const remove=async()=>{
  if(!preview||typed!==company||!confirmed||busy)return;
  setBusy(true);setError('');
  try{const response=await api.delete(path,{data:{token:preview.token,confirmCompany:typed,confirmPermanent:true}});if(response.data?.success!==true||response.data.data?.company!==company)throw new Error('Invalid deletion response');onDeleted();}
  catch(e:any){setError(e.response?.data?.message||'Deletion could not be completed. Refresh the preview and check the company before retrying.');setPreview(null);}
  finally{setBusy(false);}
 };
 return <Dialog open wide tone="danger" title="Permanently delete company" description={`${company} · ${name} · ${tenant}`} onClose={()=>{if(!busy)onClose();}} footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={loading||busy||!preview||typed!==company||!confirmed} onClick={()=>void remove()}>{busy?'Deleting company…':'Delete company permanently'}</Button></>}>
  {loading&&<p role="status">Checking company records and related tables…</p>}
  {error&&<div role="alert"><p>{error}</p><Button variant="outline" disabled={busy} onClick={()=>setRevision(value=>value+1)}>Refresh preview</Button></div>}
  {preview&&<>
   <p>This removes this company's Finance setup, transactions, users, permissions and related records. This action cannot be undone.</p>
   <p><strong>{preview.totalRows.toLocaleString()} rows</strong> across <strong>{preview.tables.length} tables</strong>. Company users: <strong>{preview.users}</strong>. Shared central accounts preserved: <strong>{preview.sharedUsersPreserved}</strong>.</p>
   <div className="platform-deletion-preview" tabIndex={0} aria-label="Company records to delete"><table><thead><tr><th>Table</th><th>Rows to delete</th></tr></thead><tbody>{preview.tables.map(row=><tr key={row.table}><td>{row.table}</td><td>{row.count.toLocaleString()}</td></tr>)}</tbody></table></div>
   {preview.reassignments.length>0&&<div><h3>Shared accounts kept</h3><p>Their primary company will move to a remaining company:</p><ul>{preview.reassignments.map(user=><li key={user.loginid}>{user.loginid} → {user.company} ({user.tenant})</li>)}</ul></div>}
   <p className="platform-help">The deletion audit stays available in Activity log. Files stored outside the database are not removed by this action. The preview expires after 10 minutes; changed data requires a new preview.</p>
   <label className="platform-delete-confirm"><span>Type <strong>{company}</strong> to confirm</span><input value={typed} onChange={event=>setTyped(event.target.value)} disabled={busy} autoComplete="off" spellCheck={false}/></label>
   <label className="platform-delete-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><span>I understand that this permanently removes the company and the records listed above.</span></label>
  </>}
 </Dialog>;
}
