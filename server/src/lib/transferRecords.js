import { query } from '../db.js';
import { DEPARTMENT_CONFIGS } from '../departmentSeed.js';
import { fireAdminLogWebhook } from './deptWebhook.js';

// Called with the same transaction that completes the transfer. Stable entry IDs
// make retries safe and the background reads these source records directly.
export async function recordTransfer(sql, transfer, actor, assignedRank, employmentType) {
  const notifications = [];
  for (const dept of [transfer.fromDept, transfer.toDept].sort()) {
    const id = dept.toLowerCase();
    await sql('INSERT INTO department_configs(id,config,updated_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [id, JSON.stringify(DEPARTMENT_CONFIGS[id]), actor.id]);
    const [row] = await sql('SELECT config FROM department_configs WHERE id=$1 FOR UPDATE',[id]);
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    let page = config.pages.find(p=>p.type==='adminlog');
    if (!page) {
      page = {id:'transfer-admin-log',type:'adminlog',label:'Admin Log',navGroup:'admin',icon:'Gavel',config:{books:[],entries:[]}};
      config.pages.push(page);
    }
    page.config ??= {};
    page.config.entries ??= [];
    const entryId = `transfer-${transfer.id}-${id}`;
    if (page.config.entries.some(e=>e.id===entryId)) continue;
    const type = dept===transfer.fromDept ? 'Transfer Out' : 'Transfer In';
    if (!page.config.books?.length) page.config.books=[{id:'book-admin',name:'Admin Log',types:['Transfer In','Transfer Out','Resignation'],fields:[]}];
    const book = page.config.books?.find(b=>b.types?.includes(type)) || page.config.books?.[0];
    const entry = {id:entryId,bookId:book?.id,bookName:book?.name || 'Admin Log',type,at:new Date().toISOString(),
      subject:{discordId:transfer.subjectDiscordId,name:transfer.member},by:{id:actor.id,name:actor.displayName || actor.username},
      values:[{label:'Notes',type:'textarea',value:`${transfer.fromDept} → ${transfer.toDept} · ${assignedRank} · ${employmentType} · Ticket ${transfer.id}`} ]};
    page.config.entries.push(entry);
    await sql('UPDATE department_configs SET config=$1,updated_by=$2 WHERE id=$3',[JSON.stringify(config),actor.id,id]);
    await sql('INSERT INTO department_audit_log(department_id,actor,actor_name,action,summary) VALUES($1,$2,$3,$4,$5)',
      [id,actor.id,actor.displayName || actor.username,'transfer.process',`${transfer.id}: ${type} · ${transfer.subjectDiscordId} · ${assignedRank}`]);
    notifications.push({config,entry});
  }
  return notifications;
}
export function notifyTransferRecords(records) {
  for (const {config,entry} of records) void fireAdminLogWebhook(config,[],[entry]).catch(()=>{});
}

// Personnel history is not discipline. Reading the source log also includes
// existing resignations without a backfill or duplicate disciplinary rows.
export async function withEmploymentHistory(background) {
  const rows = await query('SELECT id,config FROM department_configs');
  const employment = [];
  for (const row of rows) {
    const config = typeof row.config==='string' ? JSON.parse(row.config) : row.config;
    for (const page of config.pages || []) {
      if (page.type!=='adminlog') continue;
      for (const entry of page.config?.entries || []) {
        if (String(entry.subject?.discordId)!==background.discordId || !/resign|transfer|hir(?:e|ed|ing)|promot|retir|commend/i.test(entry.type || '')) continue;
        const date = new Date(entry.at || entry.date);
        if (!Number.isFinite(date.getTime()) || date < new Date(background.since)) continue;
        employment.push({id:`${row.id}:${page.id}:${entry.id}`,type:entry.type,department:row.id,createdAt:date.toISOString(),
          issuedByName:entry.by?.name || '',reason:(entry.values || []).filter(v=>v.value).map(v=>`${v.label}: ${v.value}`).join(' · ').slice(0,1000)});
      }
    }
  }
  return {...background,employment:employment.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
}
