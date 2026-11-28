export const moduleHierarchyFields=['APP_CODE','LEVEL1','LEVEL2','LEVEL3'];
export function moduleHierarchyOptions(field:string,draft:Record<string,any>,rows:Record<string,any>[]) {
 const parents=moduleHierarchyFields.slice(0,moduleHierarchyFields.indexOf(field));
 return [...new Set(rows.filter(row=>parents.every(parent=>!draft[parent]||String(row[parent]||'').trim().toLowerCase()===String(draft[parent]).trim().toLowerCase())).map(row=>String(row[field]||'').trim()).filter(value=>value&&value.toUpperCase()!=='NULL'))].sort((a,b)=>a.localeCompare(b));
}
export function changeModuleHierarchy(draft:Record<string,any>,field:string,value:string,rows:Record<string,any>[],editing:boolean) {
 if(value===String(draft[field]??''))return {...draft};
 const next={...draft,[field]:value};
 const index=moduleHierarchyFields.indexOf(field);
 if(index>=0)for(const child of moduleHierarchyFields.slice(index+1))next[child]='';
 if(field==='APP_CODE'&&!editing)next.POSITION=Math.max(0,...rows.filter(row=>String(row.APP_CODE||'').trim().toLowerCase()===value.trim().toLowerCase()).map(row=>Number(row.POSITION)||0))+1;
 next.URL_PATH=moduleHierarchyFields.map(key=>String(next[key]||'').trim()).filter(Boolean).join('/').toLowerCase();
 return next;
}
