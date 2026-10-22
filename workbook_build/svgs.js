const fs = require("fs");

// palette (matches workbook)
const NAVY="#1F3A5F", TEAL="#0E7C7B", SEA="#2E8BA0", MINT="#2bb3a3", MINT2="#5fd0c5";
const ICE="#CFE8EF", INK="#12222E", GREY="#5A6B75", ACCENT="#C0392B", AMBER="#B7791F";
const WATER="#bfe0ea", LINE="#dbe4e9", PANEL="#ffffff";

const FS = `font-family="Segoe UI, Helvetica, Arial, sans-serif"`;

function wrap(w,h,inner){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>
  ${inner}
  </svg>`;
}
function title(x,y,txt,size=22,color=NAVY,anchor="start",weight="700"){
  return `<text x="${x}" y="${y}" ${FS} font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${txt}</text>`;
}
function label(x,y,txt,size=15,color=INK,anchor="start",weight="400"){
  return `<text x="${x}" y="${y}" ${FS} font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${txt}</text>`;
}
// marker symbol (two-tone circle) used for COG/COB
function navMark(cx,cy,r,c1,c2){
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/>
    <path d="M${cx} ${cy-r} A${r} ${r} 0 0 1 ${cx+r} ${cy} L${cx} ${cy} Z" fill="${c2}"/>
    <path d="M${cx} ${cy+r} A${r} ${r} 0 0 1 ${cx-r} ${cy} L${cx} ${cy} Z" fill="${c2}"/>
  </g>`;
}
function arrow(x1,y1,x2,y2,color,wd=3){
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${wd}" marker-end="url(#ah-${color.replace('#','')})"/>`;
}
function defsArrow(colors){
  return `<defs>${colors.map(c=>`<marker id="ah-${c.replace('#','')}" markerWidth="10" markerHeight="10" refX="7" refY="3.2" orient="auto"><path d="M0 0 L8 3.2 L0 6.4 Z" fill="${c}"/></marker>`).join("")}</defs>`;
}

/* ============================================================ 1. BUOYANCY */
(function(){
  const W=900,H=430;
  const panels=[
    {x:40,  cx:190, cogdy:34, cobdy:-20, title:"Stable \u2714", sub:"COB above COG", good:true},
    {x:330, cx:480, cogdy:-6, cobdy:-6, title:"Marginal", sub:"COB \u2248 COG", good:null},
    {x:620, cx:770, cogdy:-30,cobdy:18, title:"Rolls over \u2718", sub:"COG above COB", good:false},
  ];
  let inner = defsArrow([TEAL,ACCENT,NAVY]);
  inner += title(40,36,"How center of gravity and center of buoyancy decide stability",19,NAVY);
  // legend on its own row under the title
  inner += navMark(52,62,8,"#e2574c","#a83125"); inner += label(66,67,"COG (weight)",13,INK);
  inner += navMark(210,62,8,MINT,"#0e7c6f");      inner += label(224,67,"COB (lift)",13,INK);
  // each mini scene
  panels.forEach(pz=>{
    const baseY=250, cx=pz.cx;
    // water
    inner += `<rect x="${pz.x}" y="150" width="250" height="210" fill="${WATER}" opacity="0.5"/>`;
    inner += `<line x1="${pz.x}" y1="150" x2="${pz.x+250}" y2="150" stroke="${SEA}" stroke-width="2" stroke-dasharray="6 5"/>`;
    // ROV body (slightly rotated if rolls over)
    const rot = pz.good===false ? 24 : 0;
    inner += `<g transform="translate(${cx},${baseY}) rotate(${rot})">`;
    inner += `<rect x="-70" y="-34" width="140" height="68" rx="9" fill="${NAVY}" stroke="${TEAL}" stroke-width="3"/>`;
    // float on top
    inner += `<rect x="-55" y="-52" width="110" height="16" rx="6" fill="${MINT2}" stroke="${MINT}" stroke-width="2"/>`;
    // ballast on bottom
    inner += `<rect x="-42" y="36" width="84" height="14" rx="4" fill="#3a4a55"/>`;
    // COB (teal) and COG (red)
    inner += navMark(0,pz.cobdy,9,MINT,"#0e7c6f");
    inner += navMark(0,pz.cogdy,9,"#e2574c","#a83125");
    inner += `</g>`;
    // restoring arrow
    if(pz.good===true){ inner += `<path d="M ${cx+95} 285 A 55 55 0 0 1 ${cx+95} 215" fill="none" stroke="${TEAL}" stroke-width="3" marker-end="url(#ah-${TEAL.replace('#','')})"/>`;
      inner += label(cx+105,255,"rights",12,TEAL); }
    if(pz.good===false){ inner += `<path d="M ${cx+95} 215 A 55 55 0 0 1 ${cx+95} 285" fill="none" stroke="${ACCENT}" stroke-width="3" marker-end="url(#ah-${ACCENT.replace('#','')})"/>`;
      inner += label(cx+102,255,"flips",12,ACCENT); }
    // caption
    inner += title(cx,392,pz.title,16, pz.good===true?TEAL:pz.good===false?ACCENT:AMBER,"middle");
    inner += label(cx,412,pz.sub,13,GREY,"middle");
  });
  fs.writeFileSync("/home/claude/svg_buoyancy.svg", wrap(W,H,inner));
})();

/* ============================================================ 2. THRUSTER PLACEMENT */
(function(){
  const W=900,H=470;
  let inner = defsArrow([TEAL,SEA,ACCENT]);
  inner += title(40,38,"Three-thruster layout (top-down view)",19,NAVY);
  inner += label(40,60,"Two horizontal thrusters drive and turn; one vertical thruster (center) controls depth.",14,GREY);

  const cx=330, cy=270, fw=250, fh=180;
  // frame (PVC rectangle)
  inner += `<rect x="${cx-fw/2}" y="${cy-fh/2}" width="${fw}" height="${fh}" rx="14" fill="none" stroke="${NAVY}" stroke-width="6"/>`;
  // centerline
  inner += `<line x1="${cx}" y1="${cy-fh/2-10}" x2="${cx}" y2="${cy+fh/2+20}" stroke="${GREY}" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  inner += label(cx+70,cy-fh/2-2,"centerline",11,GREY,"start");
  // helper to draw a thruster (circle + hub)
  function thr(x,y){ return `<circle cx="${x}" cy="${y}" r="26" fill="${NAVY}" stroke="${TEAL}" stroke-width="3"/>
    <rect x="${x-4}" y="${y-18}" width="8" height="36" rx="4" fill="${MINT2}"/>
    <rect x="${x-18}" y="${y-4}" width="36" height="8" rx="4" fill="${MINT2}"/>`; }
  // left & right horizontal thrusters (at rear), pointing back
  const lx=cx-fw/2+34, rx=cx+fw/2-34, ty=cy+fh/2-30;
  inner += thr(lx,ty); inner += thr(rx,ty);
  // thrust arrows backward (water pushed back => ROV forward)
  inner += arrow(lx,ty+34,lx,ty+74,TEAL,4);
  inner += arrow(rx,ty+34,rx,ty+74,TEAL,4);
  inner += label(lx,ty+92,"L",15,TEAL,"middle","700");
  inner += label(rx,ty+92,"R",15,TEAL,"middle","700");
  // vertical thruster at center (shown as circle with up/down symbol)
  inner += `<circle cx="${cx}" cy="${cy-10}" r="24" fill="${NAVY}" stroke="${SEA}" stroke-width="3"/>`;
  inner += `<text x="${cx}" y="${cy-4}" ${FS} font-size="22" fill="${MINT2}" text-anchor="middle" font-weight="700">\u2195</text>`;
  inner += label(cx,cy+28,"vertical",12,SEA,"middle","700");
  // forward direction arrow
  inner += arrow(cx,cy-fh/2-18,cx,cy-fh/2-54,NAVY,4);
  inner += label(cx-80,cy-fh/2-34,"FORWARD",13,NAVY,"start","700");

  // right-side explanatory panel
  const px=600;
  inner += `<rect x="${px}" y="90" width="270" height="330" rx="12" fill="${ICE}"/>`;
  inner += title(px+18,124,"How motions are made",15,NAVY);
  const rows=[
    ["Forward / back","both L+R together"],
    ["Turn","L and R at different speeds, or opposite"],
    ["Dive / rise","vertical thruster up or down"],
    ["Symmetry","L and R mirror-image, or it pulls to one side"],
  ];
  rows.forEach((r,i)=>{
    const y=160+i*62;
    inner += `<circle cx="${px+26}" cy="${y-4}" r="6" fill="${TEAL}"/>`;
    inner += title(px+42,y,r[0],13.5,INK,"start","700");
    inner += label(px+42,y+18,r[1],12.5,GREY);
  });
  fs.writeFileSync("/home/claude/svg_thrusters.svg", wrap(W,H,inner));
})();

/* ============================================================ 3. VOLTAGE DROP */
(function(){
  const W=900,H=380;
  let inner = defsArrow([TEAL,ACCENT,SEA]);
  inner += title(40,38,"Voltage drop along the tether (V = I \u00D7 R)",19,NAVY);
  inner += label(40,60,"Current through the tether's resistance loses voltage before it reaches the motor \u2014 and heats the wire.",14,GREY);

  // battery
  inner += `<rect x="40" y="150" width="110" height="110" rx="10" fill="${NAVY}" stroke="${TEAL}" stroke-width="3"/>`;
  inner += title(95,205,"BATTERY",13,"#fff","middle");
  inner += title(95,232,"12 V",20,MINT2,"middle");

  // tether (out + back) with resistor zig-zags
  inner += `<line x1="150" y1="178" x2="660" y2="178" stroke="${TEAL}" stroke-width="9"/>`;
  inner += `<line x1="660" y1="232" x2="150" y2="232" stroke="${SEA}" stroke-width="9"/>`;
  inner += label(405,166,"tether out  (resistance R)",13,GREY,"middle");
  inner += label(405,250,"tether back  (resistance R)",13,GREY,"middle");
  // heat shimmer marks
  for(let i=0;i<6;i++){ const x=210+i*75; inner += `<path d="M${x} 150 q6 -10 12 0" stroke="${ACCENT}" stroke-width="2" fill="none" opacity="0.65"/>`; }
  inner += label(405,132,"wire heats up",12,ACCENT,"middle","700");

  // motor
  inner += `<circle cx="730" cy="205" r="46" fill="${NAVY}" stroke="${TEAL}" stroke-width="3"/>`;
  inner += `<rect x="726" y="175" width="8" height="60" rx="4" fill="${MINT2}"/>`;
  inner += `<rect x="700" y="201" width="60" height="8" rx="4" fill="${MINT2}"/>`;
  inner += title(730,272,"motor",13,INK,"middle","700");

  // voltage callouts
  inner += `<rect x="150" y="292" width="220" height="60" rx="8" fill="${ICE}"/>`;
  inner += title(160,315,"At the battery",12,GREY);
  inner += title(160,340,"12.0 V",20,TEAL);
  inner += `<rect x="520" y="292" width="250" height="60" rx="8" fill="${ICE}"/>`;
  inner += title(530,315,"At the motor (after drop)",12,GREY);
  inner += title(530,340,"10.8 V",20,ACCENT);
  // the equation
  inner += title(405,330,"\u2192  lose I\u00D7R  \u2192",15,NAVY,"middle","700");
  // example line
  inner += label(40,372,"Example: 3 A through 0.2 \u03A9 each way  \u2192  3\u00D70.2 + 3\u00D70.2 = 1.2 V lost  \u2192  12.0 \u2212 1.2 = 10.8 V at the motor.",13,INK);
  fs.writeFileSync("/home/claude/svg_voltagedrop.svg", wrap(W,H,inner));
})();

/* ============================================================ 4. BILGE-PUMP THRUSTER (hardware) */
(function(){
  const W=760,H=420;
  let inner = defsArrow([TEAL]);
  inner += title(40,38,"Bilge-pump thruster",19,NAVY);
  inner += label(40,60,"A marine bilge pump motor fitted with a propeller \u2014 the ROV's thruster.",14,GREY);

  const cx=300, cy=255;
  // two wires out the top
  inner += `<path d="M${cx-14} ${cy-120} q-10 -34 -34 -50" stroke="${ACCENT}" stroke-width="6" fill="none"/>`;
  inner += `<path d="M${cx+14} ${cy-120} q10 -34 34 -50" stroke="#111" stroke-width="6" fill="none"/>`;
  inner += label(cx+56,cy-158,"power leads (2)",12,GREY);
  // motor body (cylinder)
  inner += `<rect x="${cx-55}" y="${cy-120}" width="110" height="150" rx="14" fill="${NAVY}" stroke="${TEAL}" stroke-width="3"/>`;
  inner += `<ellipse cx="${cx}" cy="${cy-120}" rx="55" ry="16" fill="${SEA}"/>`;
  inner += label(cx,cy-50,"motor",13,"#fff","middle","700");
  inner += label(cx,cy-30,"(bilge pump)",11,ICE,"middle");
  // shaft
  inner += `<rect x="${cx-5}" y="${cy+30}" width="10" height="28" fill="${GREY}"/>`;
  // propeller hub + blades
  inner += `<ellipse cx="${cx}" cy="${cy+62}" rx="70" ry="20" fill="none" stroke="${GREY}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  inner += `<g transform="translate(${cx},${cy+62})">
     <path d="M0 0 Q50 -26 78 -6 Q44 6 0 0 Z" fill="${MINT2}" stroke="${MINT}" stroke-width="2"/>
     <path d="M0 0 Q-50 26 -78 6 Q-44 -6 0 0 Z" fill="${MINT2}" stroke="${MINT}" stroke-width="2"/>
     <circle cx="0" cy="0" r="9" fill="${TEAL}"/></g>`;
  inner += label(cx,cy+108,"propeller",13,INK,"middle","700");
  // waterflow arrow
  inner += arrow(cx+120,cy-20,cx+120,cy+110,TEAL,4);
  inner += label(cx+130,cy+50,"water pushed",12,TEAL);
  inner += label(cx+130,cy+66,"this way",12,TEAL);

  // callout panel
  const px=540;
  inner += `<rect x="${px}" y="90" width="190" height="250" rx="12" fill="${ICE}"/>`;
  inner += title(px+16,120,"Key points",14,NAVY);
  ["Cheap, waterproof","Two wires = power","Spins one way per","wire polarity","Propeller sets","thrust direction"].forEach((s,i)=>{
    inner += label(px+16,150+i*28,s,12.5,INK);
  });
  fs.writeFileSync("/home/claude/svg_thruster_hw.svg", wrap(W,H,inner));
})();

/* ============================================================ 5. TETHER CROSS-SECTION (hardware) */
(function(){
  const W=760,H=430;
  let inner="";
  inner += title(40,38,"The tether (cut-away view)",19,NAVY);
  inner += label(40,60,"One cable from the surface to the ROV: six power conductors plus an Ethernet line for video.",14,GREY);

  // outer jacket (big circle cut-away)
  const cx=250, cy=250, R=150;
  inner += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#2b3942" stroke="#1a242b" stroke-width="6"/>`;
  inner += `<circle cx="${cx}" cy="${cy}" r="${R-14}" fill="#374650"/>`;
  // six power conductors (3 pairs) around a ring
  const pairColors=[["#C0392B","#111"],["#B7791F","#111"],["#2E8BA0","#111"]];
  const condR=26;
  let k=0;
  for(let p=0;p<3;p++){
    for(let s=0;s<2;s++){
      const ang=(k/6)*2*Math.PI - Math.PI/2;
      const ox=cx+Math.cos(ang)*78, oy=cy+Math.sin(ang)*78;
      const col = s===0?pairColors[p][0]:pairColors[p][1];
      inner += `<circle cx="${ox}" cy="${oy}" r="${condR}" fill="${col}" stroke="#000" stroke-width="1.5"/>`;
      inner += `<circle cx="${ox}" cy="${oy}" r="${condR-9}" fill="#d9c9a0" opacity="0.65"/>`;
      k++;
    }
  }
  // ethernet in center
  inner += `<circle cx="${cx}" cy="${cy}" r="30" fill="#2b6b2f" stroke="#000" stroke-width="1.5"/>`;
  inner += label(cx,cy+5,"ETH",12,"#fff","middle","700");

  // labels with leader lines
  function leader(x1,y1,x2,y2,txt,col){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${GREY}" stroke-width="1.3"/>`+label(x2+6,y2+4,txt,13,col||INK,"start","700"); }
  inner += leader(cx+78,cy-120,470,120,"3 pairs = 6 power",INK);
  inner += label(476,142,"conductors (one pair",12,GREY);
  inner += label(476,160,"per thruster)",12,GREY);
  inner += leader(cx,cy,470,250,"Ethernet (video)","#2b6b2f");
  inner += leader(cx-R+12,cy+90,470,330,"outer jacket",INK);
  inner += label(476,350,"waterproof, abrasion-",12,GREY);
  inner += label(476,368,"resistant",12,GREY);
  fs.writeFileSync("/home/claude/svg_tether_hw.svg", wrap(W,H,inner));
})();

/* ============================================================ 6. goBILDA CONTROL PANEL (hardware) */
(function(){
  const W=760,H=430;
  let inner = defsArrow([TEAL,SEA]);
  inner += title(40,38,"goBILDA motor controller",19,NAVY);
  inner += label(40,60,"Reads a small servo-style PWM signal and switches the big battery current to a thruster.",14,GREY);

  // board
  const bx=90,by=110,bw=380,bh=250;
  inner += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="12" fill="#14321f" stroke="#0c2114" stroke-width="3"/>`;
  // mounting holes
  [[bx+16,by+16],[bx+bw-16,by+16],[bx+16,by+bh-16],[bx+bw-16,by+bh-16]].forEach(h=>{
    inner += `<circle cx="${h[0]}" cy="${h[1]}" r="7" fill="#0a1a10" stroke="#2a4a30" stroke-width="2"/>`;
  });
  inner += title(bx+bw/2,by+34,"goBILDA",16,"#cfe8d8","middle");
  inner += label(bx+bw/2,by+54,"speed controller",12,"#9fc2a9","middle",400);

  // battery input terminals (big)
  inner += `<rect x="${bx+24}" y="${by+90}" width="60" height="34" rx="5" fill="${ACCENT}"/>`;
  inner += `<rect x="${bx+24}" y="${by+134}" width="60" height="34" rx="5" fill="#111"/>`;
  inner += label(bx+54,by+112,"+",18,"#fff","middle","700");
  inner += label(bx+54,by+156,"\u2212",18,"#fff","middle","700");
  inner += label(bx+54,by+196,"battery in",12,"#cfe8d8","middle");

  // motor output terminals
  inner += `<rect x="${bx+bw-84}" y="${by+90}" width="60" height="34" rx="5" fill="${MINT}"/>`;
  inner += `<rect x="${bx+bw-84}" y="${by+134}" width="60" height="34" rx="5" fill="${MINT}"/>`;
  inner += label(bx+bw-54,by+196,"motor out",12,"#cfe8d8","middle");

  // signal header (3-pin servo)
  inner += `<rect x="${bx+bw/2-30}" y="${by+bh-44}" width="60" height="26" rx="4" fill="#e8c33a"/>`;
  for(let i=0;i<3;i++){ inner += `<circle cx="${bx+bw/2-18+i*18}" cy="${by+bh-31}" r="4" fill="#333"/>`; }
  inner += label(bx+bw/2,by+bh-54,"signal (PWM)",12,"#cfe8d8","middle");

  // external labels / leaders
  function leaderR(x1,y1,x2,y2,txt,col){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${GREY}" stroke-width="1.3"/>`+label(x2+6,y2+4,txt,13,col||INK,"start","700"); }
  inner += leaderR(bx+24,by+107,500,150,"Battery power in",ACCENT);
  inner += label(506,170,"(from the tether)",12,GREY);
  inner += leaderR(bx+bw-24,by+150,500,230,"To the thruster",MINT);
  inner += leaderR(bx+bw/2,by+bh-18,500,320,"PWM signal",AMBER);
  inner += label(506,340,"from the Raspberry Pi",12,GREY);
  inner += label(506,358,"(~1500 \u00B5s = stop)",12,GREY);
  fs.writeFileSync("/home/claude/svg_gobilda_hw.svg", wrap(W,H,inner));
})();

console.log("6 SVGs written");
