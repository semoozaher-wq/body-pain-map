import { buildSync } from 'esbuild';
import path from 'node:path'; import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = '/workspace/body-pain-map';
function bundle(entry, name){ const outfile = path.join(os.tmpdir(), `${name}-${process.pid}.cjs`); buildSync({entryPoints:[path.resolve(root,entry)],bundle:true,platform:'node',format:'cjs',outfile,logLevel:'error',loader:{'.json':'json'}}); return require(outfile);}
const app = bundle('services/appAssistant/engine.ts','app2');
const base = (o={})=>({currentScreen:'welcome',currentTab:'muscles',currentBodyView:'front',currentSex:'male',selectedBodyRegion:null,selectedAnatomyStructure:null,selectedPoint:null,selectedPainLocation:null,painSeverity:null,symptoms:[],lastAssistantAction:null,lastUserReference:null,conversationState:'idle',zoomLevel:1,visibleStructures:[],conversationContext:{lastReferencedId:null,lastReferencedKind:null,lastReferencedLabel:null,lastReferencedCoords:null,previousReferencedId:null,previousReferencedCoords:null},language:'ar',conversationMode:'idle',...o});
for (const m of ['عندي وجع في رجلي من تحت','في الساق','ناحية الخلف','شدته 7 من 10']) {
  const t = app.interpret(m, base());
  console.log('>>', m, '| mode=', t.mode, '| understood=', t.understood);
  console.log('   reply=', t.reply.ar);
  console.log('   actions=', t.actions.map(a=>a.type+(a.targetId?':'+a.targetId:'')+(a.value?'='+a.value:'')).join(', '));
}
