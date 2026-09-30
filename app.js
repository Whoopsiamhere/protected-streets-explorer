(()=>{
'use strict';
const DATA=window.STREETS_DATA;
if(!DATA||!DATA.records) return;
const records=DATA.records;
const names={M:'Manhattan',X:'Bronx',B:'Brooklyn',Q:'Queens',S:'Staten Island'};
const order=['M','X','Q','S','B'];
const totals={}; for(const b of Object.keys(names)) totals[b]=records.filter(r=>r.b===b).length;
const refDate=new Date(DATA.audit.reference_date+'T12:00:00');
const $=s=>document.querySelector(s);
const canvas=$('#map'),ctx=canvas.getContext('2d'),wrap=$('#mapwrap');
const state={months:6,borough:'ALL',query:'',hideLater:false,scale:1,tx:0,ty:0,drag:false,lastX:0,lastY:0,dragDistance:0,selected:null,page:0,compareCounts:false};
records.forEach(r=>{r._et=Date.parse(r.e+'T12:00:00');r._hay=(r.s+' '+r.f+' '+r.t).toUpperCase();});
let viewRecords=records,baseBounds=null,dpr=window.devicePixelRatio||1,cutoffTs=0;
const pageSize=6;

function addMonths(date,n){const d=new Date(date),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d}
function fmtDate(d){return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtDateStr(s){return fmtDate(new Date(s+'T12:00:00'))}
function fmtNum(n){return n.toLocaleString('en-US')}
function cutoff(){return addMonths(refDate,state.months)}
function isSoon(r){return r._et<=cutoffTs}
function scopeMatch(r){if(state.borough!=='ALL'&&r.b!==state.borough)return false;if(state.query&&!r._hay.includes(state.query))return false;return true}
function sortByEnd(a,b){return a._et-b._et||a.s.localeCompare(b.s)||a.f.localeCompare(b.f)}
function monthLabel(){if(state.months===12)return '1 year';if(state.months===36)return '3 years';if(state.months===1)return '1 month';return `${state.months} months`}
function recalc({fit=true}={}){viewRecords=records.filter(scopeMatch).sort(sortByEnd);state.page=0;updateAll();if(fit){baseBounds=boundsFor(viewRecords.length?viewRecords:records);state.scale=1;state.tx=0;state.ty=0}draw()}
function updateAll(){const cut=cutoff();cutoffTs=cut.getTime();const soonCount=viewRecords.reduce((n,r)=>n+(isSoon(r)?1:0),0),total=viewRecords.length;
  $('#monthBig').textContent=monthLabel();$('#dateLine').innerHTML=`From ${fmtDate(refDate)} through <strong>${fmtDate(cut)}</strong>`;
  document.querySelectorAll('.presets button').forEach(b=>b.classList.toggle('active',+b.dataset.m===state.months));
  $('#scopeSubtitle').textContent=state.borough==='ALL'?'All five boroughs':names[state.borough];
  $('#metricNum').textContent=fmtNum(soonCount);$('#metricPct').textContent=`${total?((soonCount/total)*100).toFixed(1):'0.0'}% of ${fmtNum(total)} matching active records`;
  $('#footCount').textContent=`${fmtNum(total)} records displayed · ${fmtNum(soonCount)} scheduled to end by ${fmtDate(cut)}`;
  $('#compareTitle').textContent=state.compareCounts?`Records scheduled to end within ${monthLabel()}`:`Share scheduled to end within ${monthLabel()}`;
  updateBars();updateList();updateSelected();
}
function boundsFor(list){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const r of list)for(const line of r.l)for(const p of line){if(p[0]<minX)minX=p[0];if(p[0]>maxX)maxX=p[0];if(p[1]<minY)minY=p[1];if(p[1]>maxY)maxY=p[1]}if(!isFinite(minX))return[-74.26,40.49,-73.69,40.93];return[minX,minY,maxX,maxY]}
function resize(){const rect=wrap.getBoundingClientRect();dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function project(lon,lat,bounds=baseBounds){const w=canvas.clientWidth,h=canvas.clientHeight,pad=46,[minX,minY,maxX,maxY]=bounds;const sx=(w-2*pad)/(maxX-minX||1),sy=(h-2*pad)/(maxY-minY||1),s=Math.min(sx,sy),bw=(maxX-minX)*s,bh=(maxY-minY)*s;let x=(lon-minX)*s+(w-bw)/2,y=(maxY-lat)*s+(h-bh)/2;x=(x-w/2)*state.scale+w/2+state.tx;y=(y-h/2)*state.scale+h/2+state.ty;return[x,y]}
function fitToCurrent(){baseBounds=boundsFor(viewRecords.length?viewRecords:records);state.scale=1;state.tx=0;state.ty=0;draw()}
function lineVisible(r){return !state.hideLater||isSoon(r)}
function drawLine(r,color,width,alpha){ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(const line of r.l){if(line.length<2)continue;for(let i=0;i<line.length;i++){const p=project(line[i][0],line[i][1]);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])}}ctx.stroke()}
function drawGroup(wantSoon,color,width,alpha){ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(const r of viewRecords){const soon=isSoon(r);if(soon!==wantSoon||!lineVisible(r))continue;for(const line of r.l){if(line.length<2)continue;for(let i=0;i<line.length;i++){const p=project(line[i][0],line[i][1]);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])}}}ctx.stroke()}
function drawLabels(){if(state.scale>2.4)return;const c={X:[-73.875,40.852,'BRONX'],M:[-73.985,40.783,'MANHATTAN'],Q:[-73.828,40.732,'QUEENS'],B:[-73.955,40.657,'BROOKLYN'],S:[-74.153,40.576,'STATEN ISLAND']};ctx.globalAlpha=1;ctx.fillStyle='#28495e';ctx.font='700 13px Inter, Segoe UI, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';Object.entries(c).forEach(([b,v])=>{if(state.borough!=='ALL'&&state.borough!==b)return;const p=project(v[0],v[1]);ctx.fillText(v[2],p[0],p[1])})}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#e7f0f5';ctx.fillRect(0,0,w,h);if(!baseBounds)baseBounds=boundsFor(records);drawGroup(false,'#819daf',1.15,.72);drawGroup(true,'#b94d00',1.55,.96);if(state.selected){drawLine(state.selected,'#102c3b',4.2,.95);drawLine(state.selected,'#fff',1.7,1)}drawLabels();ctx.globalAlpha=1}
function zoomAt(factor,cx=canvas.clientWidth/2,cy=canvas.clientHeight/2){const old=state.scale,ns=Math.min(14,Math.max(.7,old*factor));if(ns===old)return;state.tx=cx-(cx-state.tx)*(ns/old);state.ty=cy-(cy-state.ty)*(ns/old);state.scale=ns;draw()}
function distToSeg(px,py,x1,y1,x2,y2){const vx=x2-x1,vy=y2-y1,wx=px-x1,wy=py-y1,c1=vx*wx+vy*wy;if(c1<=0)return Math.hypot(px-x1,py-y1);const c2=vx*vx+vy*vy;if(c2<=c1)return Math.hypot(px-x2,py-y2);const b=c1/c2;return Math.hypot(px-(x1+b*vx),py-(y1+b*vy))}
function pick(x,y){let best=null,bd=8;for(const r of viewRecords){if(!lineVisible(r))continue;for(const line of r.l)for(let i=1;i<line.length;i++){const a=project(line[i-1][0],line[i-1][1]),b=project(line[i][0],line[i][1]),d=distToSeg(x,y,a[0],a[1],b[0],b[1]);if(d<bd){bd=d;best=r}}}selectRecord(best)}
function selectRecord(r,{fit=false}={}){state.selected=r||null;if(r&&fit){baseBounds=boundsFor([r]);state.scale=1;state.tx=0;state.ty=0}if(r){$('#detailTitle').textContent=r.s;$('#detailText').innerHTML=`${r.f} → ${r.t}<br>Protection dates: ${fmtDateStr(r.a)} to ${fmtDateStr(r.e)}<br>${names[r.b]}`;$('#details').classList.add('show')}else{$('#details').classList.remove('show')}updateSelected();updateList();draw()}
function updateSelected(){const h=$('#selectedHeading'),b=$('#selectedBody');if(!state.selected){h.textContent='Take a closer look';b.innerHTML='Click a line on the map or choose a record from the list. Street, endpoints and protection dates appear here.';return}const r=state.selected;h.textContent=r.s;b.innerHTML=`<div class="selected-details"><div><b>Borough</b><span>${names[r.b]}</span></div><div><b>Block</b><span>${r.f} to ${r.t}</span></div><div><b>Protection dates</b><span>${fmtDateStr(r.a)} to ${fmtDateStr(r.e)}</span></div></div>`}
function boroughSoon(b){let n=0;for(const r of records)if(r.b===b&&isSoon(r))n++;return n}
function updateBars(){const data=order.map(b=>{const n=boroughSoon(b),pct=n/totals[b]*100;return{b,n,pct}});data.sort((a,b)=>state.compareCounts?b.n-a.n:b.pct-a.pct);const max=state.compareCounts?Math.max(...data.map(d=>d.n),1):Math.max(...data.map(d=>d.pct),1);const bars=$('#bars');bars.innerHTML='';for(const d of data){const row=document.createElement('div');row.className='bar-row'+(state.borough===d.b?' active':'');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',`Show ${names[d.b]}`);row.innerHTML=`<div class="bar-label">${names[d.b]}</div><div class="bar-track"><div class="bar-fill" style="width:${(state.compareCounts?d.n:d.pct)/max*100}%"></div></div><div class="bar-value">${state.compareCounts?fmtNum(d.n):d.pct.toFixed(1)+'%'} · ${fmtNum(d.n)}</div>`;const go=()=>{$('#borough').value=d.b;state.borough=d.b;recalc({fit:true})};row.addEventListener('click',go);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});bars.appendChild(row)}}
function updateList(){const total=viewRecords.length,pages=Math.max(1,Math.ceil(total/pageSize));if(state.page>=pages)state.page=pages-1;const start=state.page*pageSize,chunk=viewRecords.slice(start,start+pageSize);$('#pageCount').textContent=`${state.page+1} / ${fmtNum(pages)} ${pages===1?'page':'pages'}`;$('#recordSummary').textContent=`${fmtNum(total)} displayed records, ordered by scheduled end date.`;const list=$('#recordList');list.innerHTML='';if(!chunk.length){list.innerHTML='<div class="record-row"><div><div class="record-street">No matching records</div><div class="record-meta">Try clearing the search or changing the borough.</div></div></div>'}else{for(const r of chunk){const row=document.createElement('div');row.className='record-row'+(state.selected===r?' selected':'');row.tabIndex=0;row.innerHTML=`<div><div class="record-street">${r.s}</div><div class="record-meta">${names[r.b]} · ${r.f} to ${r.t}</div></div><div class="record-date">${fmtDateStr(r.e)}</div>`;const go=()=>selectRecord(r,{fit:true});row.addEventListener('click',go);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});list.appendChild(row)}}$('#prevPage').disabled=state.page<=0;$('#nextPage').disabled=state.page>=pages-1}

$('#months').addEventListener('input',e=>{state.months=+e.target.value;updateAll();draw()});
document.querySelectorAll('.presets button').forEach(b=>b.addEventListener('click',()=>{$('#months').value=b.dataset.m;state.months=+b.dataset.m;updateAll();draw()}));
$('#borough').addEventListener('change',e=>{state.borough=e.target.value;recalc({fit:true})});
let searchTimer;$('#search').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=e.target.value.trim().toUpperCase();recalc({fit:true})},120)});
$('#hideLater').addEventListener('change',e=>{state.hideLater=e.target.checked;draw()});
$('#compareCounts').addEventListener('change',e=>{state.compareCounts=e.target.checked;updateAll()});
$('#resetBtn').addEventListener('click',()=>{state.months=6;state.borough='ALL';state.query='';state.hideLater=false;state.selected=null;state.compareCounts=false;state.page=0;$('#months').value=6;$('#borough').value='ALL';$('#search').value='';$('#hideLater').checked=false;$('#compareCounts').checked=false;$('#details').classList.remove('show');recalc({fit:true})});
$('#fitBtn').addEventListener('click',fitToCurrent);$('#zoomIn').addEventListener('click',()=>zoomAt(1.35));$('#zoomOut').addEventListener('click',()=>zoomAt(1/1.35));
$('#detailsClose').addEventListener('click',()=>selectRecord(null));
$('#prevPage').addEventListener('click',()=>{if(state.page>0){state.page--;updateList()}});$('#nextPage').addEventListener('click',()=>{const pages=Math.max(1,Math.ceil(viewRecords.length/pageSize));if(state.page<pages-1){state.page++;updateList()}});
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(e.deltaY<0?1.16:1/1.16,e.clientX-r.left,e.clientY-r.top)},{passive:false});
canvas.addEventListener('pointerdown',e=>{state.drag=true;state.dragDistance=0;state.lastX=e.clientX;state.lastY=e.clientY;wrap.classList.add('dragging');canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!state.drag)return;const dx=e.clientX-state.lastX,dy=e.clientY-state.lastY;state.dragDistance+=Math.hypot(dx,dy);state.tx+=dx;state.ty+=dy;state.lastX=e.clientX;state.lastY=e.clientY;draw()});
canvas.addEventListener('pointerup',e=>{state.drag=false;wrap.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId)}catch(_){}});
canvas.addEventListener('click',e=>{if(state.dragDistance>5){state.dragDistance=0;return}const r=canvas.getBoundingClientRect();pick(e.clientX-r.left,e.clientY-r.top)});
canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='=')zoomAt(1.25);else if(e.key==='-')zoomAt(.8);else if(e.key==='0')fitToCurrent();else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=30;if(e.key==='ArrowLeft')state.tx+=d;if(e.key==='ArrowRight')state.tx-=d;if(e.key==='ArrowUp')state.ty+=d;if(e.key==='ArrowDown')state.ty-=d;draw()}});
if('ResizeObserver'in window)new ResizeObserver(resize).observe(wrap);else window.addEventListener('resize',resize);

baseBounds=boundsFor(records);cutoffTs=cutoff().getTime();viewRecords=records.slice().sort(sortByEnd);updateAll();requestAnimationFrame(()=>{resize();requestAnimationFrame(draw)});
})();
